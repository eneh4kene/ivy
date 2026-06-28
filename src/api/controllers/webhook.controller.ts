import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import { subHours } from 'date-fns';
import prisma from '../../utils/prisma';
import callService from '../../services/call.service';
import promptService from '../../services/prompt.service';
import messagingService from '../../services/messaging.service';
import paymentService from '../../services/payment.service';
import insightService from '../../services/insight.service';
import callbackService from '../../services/callback.service';
import { logUsage } from '../../services/usage.service';
import { serverAnalytics } from '../../lib/analytics';
import { handleMissedCall as handleMissedCallComms, handleDroppedCall } from '../../services/communication.service';
import circleCatchupService from '../../services/circle-catchup.service';
import coachService from '../../services/coach.service';
import {
  handlePaymentIntentSucceeded,
  handlePaymentIntentCanceled,
  handlePaymentIntentPaymentFailed,
  handlePaymentIntentRequiresAction,
} from '../../services/stake.service';
import transcriptionService from '../../services/transcription.service';
import { flattenContext } from '../../utils/retell';
import { sendSuccess } from '../../utils/response';
import logger from '../../utils/logger';
import { config } from '../../config';

/**
 * Verify a Retell webhook signature. Retell's scheme (NOT a generic HMAC):
 *   header  X-Retell-Signature: "v={unix_ms},d={hex_hmac}"
 *   digest  HMAC-SHA256( rawBody + timestamp ), keyed by the API key
 *   freshness: timestamp within 5 minutes
 * The signed payload is the RAW request bytes (req.rawBody, captured in app.ts) —
 * re-serialising req.body changes formatting and never matches. Our
 * RETELL_WEBHOOK_SECRET is set to the API key, which is the correct secret.
 * Returns null on success, or an error reason string to 401 with.
 */
function verifyRetellSignature(req: Request): string | null {
  const secret = config.retell.webhookSecret || config.retell.apiKey;
  if (!secret) return null; // no secret configured → skip verification
  const header = req.headers['x-retell-signature'] as string | undefined;
  const rawBody: Buffer | undefined = (req as any).rawBody;
  const parsed = header?.match(/v=(\d+),d=([a-f0-9]+)/i);
  if (!header || !parsed || !rawBody) return 'Missing or malformed Retell signature';
  const [, ts, digest] = parsed;
  if (Math.abs(Date.now() - Number(ts)) > 5 * 60 * 1000) return 'Stale Retell signature';
  const expected = crypto
    .createHmac('sha256', secret)
    .update(Buffer.concat([rawBody, Buffer.from(ts)]))
    .digest('hex');
  const a = Buffer.from(digest);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return 'Invalid Retell signature';
  return null;
}

class WebhookController {
  /**
   * Handle Retell AI webhook events
   * POST /webhooks/retell
   */
  async handleRetellWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Verify Retell webhook signature (see verifyRetellSignature).
      const sigError = verifyRetellSignature(req);
      if (sigError) { res.status(401).send(sigError); return; }

      const { event, call } = req.body;

      logger.info(`Retell webhook received: ${event}`, { callId: call?.call_id });

      // Resolve our DB call record — prefer metadata (outbound), fall back to retellCallId (inbound)
      const dbCallId: string | null = call.metadata?.callId
        ?? await this.findCallIdByRetellId(call.call_id);
      const dbUserId: string | null = call.metadata?.userId
        ?? await this.findUserIdByRetellId(call.call_id);
      const dbCallType: string = call.metadata?.callType ?? 'unknown';

      switch (event) {
        case 'call_started':
          if (dbCallId) {
            await callService.updateCallStatus(dbCallId, 'IN_PROGRESS', {
              startedAt: new Date(),
              retellCallId: call.call_id,
            });
          }
          break;

        case 'call_ended': {
          const durationSecs: number = call.call_analysis?.call_duration ?? 0;
          const reason: string = call.disconnection_reason ?? 'completed';

          if (dbCallId) {
            await callService.updateCallStatus(dbCallId, 'COMPLETED', {
              endedAt: new Date(),
              duration: durationSecs,
              outcome: reason,
            });
          }

          // Dropped call detection: short duration + abnormal disconnect reason
          const normalEndings = ['user_hangup', 'agent_hangup', 'max_duration_reached', 'call_transfer'];
          if (dbUserId && durationSecs < 45 && !normalEndings.includes(reason)) {
            handleDroppedCall(dbUserId, dbCallType).catch((err) =>
              logger.error('Dropped call follow-up failed:', err)
            );
          }
          break;
        }

        case 'call_analyzed': {
          const durationSecs = call.call_analysis?.call_duration ?? 0;
          const outcome = call.call_analysis?.user_sentiment ?? 'neutral';

          if (dbCallId) {
            await callService.updateCallStatus(dbCallId, 'COMPLETED', {
              transcript: call.transcript || '',
              sentiment: outcome,
            });
          }

          await logUsage('retell', 'call', durationSecs / 60, dbUserId ?? undefined, {
            callId: call.call_id,
            callType: dbCallType,
          });

          if (dbUserId) {
            serverAnalytics.callCompleted(dbUserId, dbCallType, durationSecs, outcome);
          }

          if (call.transcript && dbCallId && dbUserId) {
            insightService.extractCallInsights(
              dbCallId,
              call.transcript,
              dbCallType,
              dbUserId,
            ).catch((err) => logger.error('Insight extraction error:', err));

            // Keep Ivy's word: if the user asked to be called back, schedule it.
            callbackService.detectAndSchedule(dbUserId, call.transcript)
              .catch((err) => logger.error('Callback detection error:', err));
          }

          // Clear any pending circle catch-up — Ivy covered it in this call
          if (dbUserId) {
            circleCatchupService.markCovered(dbUserId)
              .catch((err) => logger.warn('Catch-up clear failed', err));
          }

          // Ponder call post-processing
          if (dbCallType === 'COACH_PONDER' && dbUserId) {
            const summary = call.call_analysis?.call_summary ?? (call.transcript?.slice(0, 800) ?? '');
            if (summary) {
              coachService.extractAndApplyProgrammeUpdates(dbUserId, summary)
                .catch((err) => logger.warn('Ponder programme update failed:', err));

              // Send WhatsApp summary to coach
              prisma.user.findUnique({ where: { id: dbUserId }, select: { phone: true } })
                .then((coach) => {
                  if (coach?.phone) {
                    messagingService.sendMessage(
                      dbUserId,
                      `Ivy ponder summary:\n\n${summary.slice(0, 600)}\n\nAny programme area updates from our chat have been applied.`
                    ).catch((err) => logger.warn('Ponder summary message failed:', err));
                  }
                })
                .catch((err) => logger.warn('Ponder coach lookup failed:', err));
            }
          }
          break;
        }

        case 'call_no_answer':
          if (dbCallId) {
            await callService.handleMissedCall(dbCallId);
          }
          if (dbUserId) {
            await handleMissedCallComms(dbUserId);
            serverAnalytics.callMissed(dbUserId, dbCallType);
          }
          break;

        default:
          logger.warn(`Unknown Retell event: ${event}`);
      }

      sendSuccess(res, { received: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle Telegram webhook updates
   * POST /webhooks/telegram
   */
  async handleTelegramWebhook(req: Request, res: Response): Promise<void> {
    try {
      const update = req.body;
      const message = update?.message;

      if (message) {
        const chatId = String(message.chat.id);
        const telegramUserId: number | undefined = message.from?.id;

        if (message.text) {
          logger.info(`Telegram text from chat ${chatId}`);
          await messagingService.handleTelegramUpdate(chatId, message.text, telegramUserId);
        } else if (message.voice) {
          const fileId: string = message.voice.file_id;
          const durationSeconds: number | undefined = message.voice.duration;
          logger.info(`Telegram voice note from chat ${chatId} (${durationSeconds ?? '?'}s)`);

          const transcription = await transcriptionService.transcribeTelegramVoice(fileId, durationSeconds);
          if (transcription) {
            logger.info(`Voice note transcribed (${transcription.length} chars)`);
            await messagingService.handleTelegramUpdate(chatId, transcription, telegramUserId);
          } else {
            logger.warn(`Voice note from chat ${chatId} produced empty transcription — ignored`);
          }
        }
      }

      // Always respond 200 quickly — Telegram retries on non-200
      res.status(200).json({ ok: true });
    } catch (error) {
      // Still return 200 so Telegram doesn't retry
      res.status(200).json({ ok: true });
      logger.error('Telegram webhook error:', error);
    }
  }

  /**
   * Handle Sentry issue webhook — forwards new/regressed issues to admin Telegram
   * POST /webhooks/sentry
   */
  async handleSentryWebhook(req: Request, res: Response): Promise<void> {
    // Respond immediately — Sentry expects fast acknowledgement
    res.status(200).json({ ok: true });

    try {
      const { action, data, actor } = req.body;
      if (!data?.issue) return;

      // Only alert on new issues or regressions — not every event
      if (!['created', 'regression'].includes(action)) return;

      const issue = data.issue;
      const emoji = action === 'regression' ? '🔄' : '🚨';
      const label = action === 'regression' ? 'REGRESSION' : 'NEW ISSUE';
      const culprit = issue.culprit || issue.metadata?.filename || 'unknown';
      const count = issue.count ? ` (${issue.count} events)` : '';
      const assignee = actor?.name ? ` · assigned to ${actor.name}` : '';

      const text =
        `${emoji} Sentry ${label}\n\n` +
        `${issue.title}\n` +
        `📍 ${culprit}${count}${assignee}\n` +
        `🔗 ${issue.permalink}`;

      const { sendTelegramAdmin } = await import('../../utils/telegram-admin');
      await sendTelegramAdmin(text);
    } catch (err) {
      logger.error('Sentry webhook handler error:', err);
    }
  }

  /**
   * Handle Stripe webhook events
   * POST /webhooks/stripe
   */
  async handleStripeWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      let event = req.body;

      // Verify webhook signature if secret is configured
      if (config.stripe.webhookSecret && config.stripe.secretKey) {
        const sig = req.headers['stripe-signature'] as string;
        if (!sig) {
          res.status(400).send('Missing stripe-signature header');
          return;
        }
        try {
          const stripe = new Stripe(config.stripe.secretKey, { apiVersion: '2023-10-16' });
          event = stripe.webhooks.constructEvent(req.body, sig, config.stripe.webhookSecret);
        } catch (err) {
          logger.error('Stripe webhook signature verification failed:', err);
          res.status(400).send('Webhook signature verification failed');
          return;
        }
      }

      logger.info(`Stripe webhook received: ${event.type}`);

      switch (event.type) {
        case 'customer.subscription.created':
          // Handle new subscription
          await paymentService.handleSubscriptionCreated(event.data.object);
          break;

        case 'customer.subscription.updated':
          // Handle subscription update (e.g., plan change)
          await paymentService.handleSubscriptionUpdated(event.data.object);
          break;

        case 'customer.subscription.deleted':
          // Handle subscription cancellation
          await paymentService.handleSubscriptionDeleted(event.data.object);
          break;

        case 'invoice.payment_succeeded':
          // Handle successful payment
          await paymentService.handlePaymentSucceeded(event.data.object);
          break;

        case 'invoice.payment_failed':
          // Handle failed payment
          await paymentService.handlePaymentFailed(event.data.object);
          break;

        // ── Stake PaymentIntent events (auth-and-capture cycle) ──────────────
        case 'payment_intent.succeeded':
          // Card auth hold confirmed — mark StakeCycle AUTHORIZED (if not already)
          await handlePaymentIntentSucceeded(event.data.object);
          break;

        case 'payment_intent.canceled':
          // Auth voided (either by us on full-release settle, or by user/expiry)
          await handlePaymentIntentCanceled(event.data.object);
          break;

        case 'payment_intent.payment_failed':
          // Auth failed (card declined, insufficient funds, etc.)
          await handlePaymentIntentPaymentFailed(event.data.object);
          break;

        case 'payment_intent.requires_action':
          // 3DS/SCA required — log; user must complete authentication
          await handlePaymentIntentRequiresAction(event.data.object);
          break;

        default:
          logger.warn(`Unhandled Stripe event type: ${event.type}`);
      }

      sendSuccess(res, { received: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Handle inbound SMS replies on the Twilio number.
   * POST /webhooks/twilio-sms
   *
   * Twilio Messaging webhook — fires when someone texts your Twilio number.
   * Configure in Twilio: Phone Numbers → your number → Messaging → Webhook → this URL (POST).
   *
   * Twilio sends: Body (message text), From (E.164 sender phone), To (your Twilio number).
   * We look up the user by From, feed the text into processIncomingMessage, and return
   * an empty TwiML response (no auto-reply — Ivy sends any reply via the queue).
   */
  async handleTwilioSms(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const body: string = req.body.Body ?? '';
      const from: string = req.body.From ?? '';

      if (!from || !body.trim()) {
        res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
        return;
      }

      // Non-blocking — don't hold Twilio's webhook waiting for the full processing chain
      messagingService.handleIncomingMessage(from, body.trim(), 'SMS').catch((err) =>
        logger.error('SMS inbound processing failed', err)
      );

      // Twilio expects a valid TwiML response — empty means no auto-reply
      res.type('application/xml').send('<?xml version="1.0" encoding="UTF-8"?><Response/>');
    } catch (err) {
      next(err);
    }
  }

  /**
   * Handle inbound calls on the Twilio phone number.
   * POST /webhooks/twilio-inbound
   *
   * Twilio Voice webhook — forwards the call to Retell via SIP.
   * Retell then hits /webhooks/retell-inbound to get the agent config.
   *
   * Configure in Twilio: Phone Numbers → your number → Voice → Webhook → this URL (POST).
   * Set RETELL_SIP_ENDPOINT in env (from Retell dashboard → Phone Numbers → BYOC SIP URI).
   */
  handleTwilioInbound(_req: Request, res: Response): void {
    const sipEndpoint = config.retell.sipEndpoint;

    if (!sipEndpoint) {
      // SIP endpoint not configured — tell the caller to use the app
      res.type('application/xml').send(
        '<?xml version="1.0" encoding="UTF-8"?>' +
        '<Response>' +
        '<Say voice="alice">Ivy isn\'t set up to receive calls yet. Use the app to request a call.</Say>' +
        '<Hangup/>' +
        '</Response>'
      );
      return;
    }

    // Forward to Retell — Retell will call /webhooks/retell-inbound for agent config
    res.type('application/xml').send(
      '<?xml version="1.0" encoding="UTF-8"?>' +
      '<Response>' +
      `<Dial><Sip>${sipEndpoint}</Sip></Dial>` +
      '</Response>'
    );
  }

  /**
   * Retell inbound call webhook — fires before the agent speaks its first word.
   * POST /webhooks/retell-inbound
   *
   * Configure in Retell: Dashboard → Phone Numbers → your number → Inbound Webhook URL.
   * Responds with agent ID + personalised system prompt built from live DB context.
   * No Haiku brief — must respond within ~2-3 seconds.
   */
  async handleRetellInbound(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // Verify Retell signature (see verifyRetellSignature).
      const sigError = verifyRetellSignature(req);
      if (sigError) { res.status(401).send(sigError); return; }

      const fromNumber: string = req.body.from_number ?? '';
      const retellCallId: string = req.body.call_id ?? '';

      logger.info(`Retell inbound call from ${fromNumber} (${retellCallId})`);

      // Identify user by phone number
      const user = await prisma.user.findUnique({
        where: { phone: fromNumber },
        select: { id: true, firstName: true, isActive: true, isOnboarded: true, subscriptionTier: true },
      });

      if (!user?.isActive || !user?.isOnboarded) {
        // Unknown or inactive — connect with base agent, no personalisation
        res.json({ agent_id: config.retell.agentIds.b2c ?? '' });
        return;
      }

      const callType = await this.resolveInboundCallType(user.id);
      const isB2B = user.subscriptionTier === 'B2B';
      const agentId = (isB2B ? config.retell.agentIds.b2b : config.retell.agentIds.b2c) ?? '';

      // Build context (DB queries only — no Haiku brief to stay within response window)
      const ctx = await callService.getUserContext(user.id, callType);
      const systemPrompt = promptService.buildSystemPrompt(callType, ctx, isB2B);

      // Create a call record so all subsequent webhook events (call_analyzed etc.) can correlate
      const dbCall = await prisma.call.create({
        data: {
          userId: user.id,
          callType: callType as any,
          scheduledAt: new Date(),
          status: 'IN_PROGRESS',
          startedAt: new Date(),
          retellCallId,
        },
      });

      logger.info(`Retell inbound: ${callType} for ${user.firstName} — DB call ${dbCall.id}`);

      // Retell echoes metadata back in all subsequent webhooks (call_ended, call_analyzed, etc.)
      res.json({
        agent_id: agentId,
        override_llm_config: { general_prompt: systemPrompt },
        // The agent's general_prompt is bound to {{system_prompt}} (see
        // /retell-bind-prompt), so inject our composed prompt as a dynamic var too
        // — this is the path that actually applies (override_llm_config is not
        // reliably honoured). flattenContext also exposes user_name/streak/etc.
        retell_llm_dynamic_variables: {
          ...flattenContext({ ...ctx, call_type: callType.toLowerCase() }),
          system_prompt: systemPrompt,
        },
        metadata: { callId: dbCall.id, userId: user.id, callType },
      });
    } catch (error) {
      next(error);
    }
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  /**
   * Determine the right call type for a user who called in unprompted.
   * - Missed call in last 2 hours → same type (this is a callback)
   * - Otherwise → RESCUE (user-initiated; the rescue flow opens with "tell me what's
   *   going on" which works for any reason: checking in, completion, struggling)
   */
  private async resolveInboundCallType(userId: string): Promise<string> {
    const recentMissed = await prisma.call.findFirst({
      where: {
        userId,
        status: 'NO_ANSWER',
        scheduledAt: { gte: subHours(new Date(), 2) },
      },
      orderBy: { scheduledAt: 'desc' },
      select: { callType: true },
    });
    return recentMissed?.callType ?? 'RESCUE';
  }

  /** Look up our DB call ID from a Retell call ID — used for inbound calls where
   *  metadata may not be present in the first webhook event. */
  private async findCallIdByRetellId(retellCallId: string): Promise<string | null> {
    const record = await prisma.call.findFirst({
      where: { retellCallId },
      select: { id: true },
    });
    return record?.id ?? null;
  }

  /** Look up the user ID from a Retell call ID — companion to findCallIdByRetellId. */
  private async findUserIdByRetellId(retellCallId: string): Promise<string | null> {
    const record = await prisma.call.findFirst({
      where: { retellCallId },
      select: { userId: true },
    });
    return record?.userId ?? null;
  }
}

export default new WebhookController();
