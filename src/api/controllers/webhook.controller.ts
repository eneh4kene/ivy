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
import { opsAlert } from '../../lib/ops-alert';
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

/**
 * True call duration in seconds from a Retell call object. Retell reports
 * `duration_ms` at the top level (there is NO call_analysis.call_duration —
 * reading it wrote duration=0 on every call row and logged 0 minutes of
 * Retell usage for cost tracking). Timestamp diff is the fallback.
 */
function retellDurationSecs(call: any): number {
  const ms = call?.duration_ms
    ?? ((call?.end_timestamp && call?.start_timestamp) ? call.end_timestamp - call.start_timestamp : 0);
  return Math.max(0, Math.round(ms / 1000));
}


/**
 * Normalise a phone number for matching. Deliberately conservative: strips
 * formatting only, never guesses a country code.
 */
function normalisePhoneForMatch(raw: string): string | null {
  const stripped = (raw ?? '').replace(/[\s\-().]/g, '');
  if (!stripped) return null;
  if (stripped.startsWith('+')) return stripped;
  if (stripped.startsWith('00')) return `+${stripped.slice(2)}`;
  return stripped;
}

/**
 * Plausible stored spellings of the same number, so a member is found whichever
 * way their number was written. Matching a fixed candidate list keeps this an
 * indexed lookup rather than a scan.
 */
function phoneMatchCandidates(normalised: string): string[] {
  const set = new Set<string>([normalised]);
  if (normalised.startsWith('+')) {
    const digits = normalised.slice(1);
    set.add(digits);
    set.add(`00${digits}`);
    // UK national form: +447… <-> 07…
    if (digits.startsWith('44')) set.add(`0${digits.slice(2)}`);
    // US national form: +1555… <-> 555…
    if (digits.startsWith('1')) set.add(digits.slice(1));
  }
  return Array.from(set);
}

// Inbound calls are user-initiated and uncapped by nature. This bounds a single
// user's daily voice spend; scheduled calls have their own cap in call.service.
const INBOUND_DAILY_CALL_CAP = 8;

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
          const durationSecs = retellDurationSecs(call);
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
            serverAnalytics.callDropped(dbUserId, durationSecs, reason);
            handleDroppedCall(dbUserId, dbCallType).catch((err) =>
              opsAlert({
                severity: 'warn',
                source: 'webhook:retell',
                title: 'dropped_call_followup_failed',
                detail: `call dropped (${reason}, ${durationSecs}s) and the follow-up did not go out`,
                userId: dbUserId,
                entity: dbCallId ? { type: 'call', id: dbCallId } : undefined,
                error: err,
              })
            );
          }
          break;
        }

        case 'call_analyzed': {
          const durationSecs = retellDurationSecs(call);
          const outcome = call.call_analysis?.user_sentiment ?? 'neutral';

          if (dbCallId) {
            await callService.updateCallStatus(dbCallId, 'COMPLETED', {
              transcript: call.transcript || '',
              sentiment: outcome,
              // call_ended already wrote duration, but re-assert it here — the
              // analyzed payload is the more settled record of the two.
              ...(durationSecs > 0 && { duration: durationSecs }),
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
            ).catch((err) => opsAlert({
              severity: 'warn',
              source: 'webhook:retell',
              title: 'insight_extraction_failed',
              userId: dbUserId,
              entity: { type: 'call', id: dbCallId },
              error: err,
            }));

            // The spoken "when" → Workout.plannedTime, so the T-60 pre-commit
            // nudge fires for times stated on calls, not just typed in the app.
            // Skipped for COACH_PONDER (the speaker is the coach, not a client),
            // and for calls that never reached a human.
            //
            // A voicemail still produces a transcript — Ivy's own message — which
            // sailed past the length gate and had three separate Haiku
            // extractions asking what commitments were agreed on an answering
            // machine. Wasted spend, and a pointless failure surface: the
            // plan-adjustment ops alert that surfaced this was raised on a
            // voicemail. Same threshold as an "accounted day" in
            // integrity.service, so the two definitions cannot drift.
            const reachedAHuman =
              call.call_analysis?.in_voicemail !== true &&
              durationSecs >= 30 &&
              (call.transcript?.length ?? 0) > 200;

            if (dbCallType !== 'COACH_PONDER' && reachedAHuman) {
              import('../../services/commitment-time.service')
                .then(({ default: commitmentTimeService }) =>
                  commitmentTimeService.captureFromText(dbUserId, call.transcript, 'call'))
                .catch(() => {});

              // An agreed adjustment has to reach the record, or the member says
              // yes to moving Thursdays and the same reminders fire at the same
              // times against the plan that already failed. Logistics only —
              // never programme. Fire-and-forget, same as above.
              import('../../services/plan-adjustment.service')
                .then(({ default: planAdjustmentService }) =>
                  planAdjustmentService.captureFromTranscript(dbUserId, call.transcript))
                .catch(() => {});

              // "I'll do legs Tuesday at 10" — the commonest thing said on an
              // evening call, and previously captured by nothing: commitment-time
              // only handles today, plan-adjustment only permanent patterns.
              import('../../services/future-commitment.service')
                .then(({ default: futureCommitmentService }) =>
                  futureCommitmentService.captureFromTranscript(dbUserId, call.transcript))
                .catch(() => {});

              // "I'm in Chicago this week" — move their calls with them. Call
              // times are stored as LOCAL wall clock, so shifting the zone is
              // the entire fix: 20:00 stays 20:00 where they actually are.
              import('../../services/timezone.service')
                .then(({ default: timezoneService }) =>
                  timezoneService.captureFromTranscript(dbUserId, call.transcript))
                .catch(() => {});
            }

            // Keep Ivy's word: if the user asked to be called back, schedule it.
            callbackService.detectAndSchedule(dbUserId, call.transcript, dbCallType)
              .catch((err) => opsAlert({
                severity: 'warn',
                source: 'webhook:retell',
                title: 'callback_detection_failed',
                detail: 'a callback the user may have asked for was never evaluated',
                userId: dbUserId,
                entity: { type: 'call', id: dbCallId },
                error: err,
              }));
          }

          // Clear any pending circle catch-up — Ivy covered it in this call
          if (dbUserId) {
            circleCatchupService.markCovered(dbUserId)
              .catch((err) => opsAlert({
                severity: 'warn',
                source: 'webhook:retell',
                title: 'catchup_clear_failed',
                userId: dbUserId,
                error: err,
              }));
          }

          // Ponder call post-processing: apply the programme changes the coach
          // stated, then tell them exactly what was applied — in-app thread
          // (with web push) AND SMS/WhatsApp, so the confirmation is precise
          // rather than "any updates have been applied".
          if (dbCallType === 'COACH_PONDER' && dbUserId) {
            const summary = call.call_analysis?.call_summary ?? (call.transcript?.slice(0, 800) ?? '');
            if (summary) {
              coachService.extractAndApplyProgrammeUpdates(dbUserId, summary, 'ponder')
                .then(async (applied) => {
                  const appliedBlock = applied.length > 0
                    ? `\n\nApplied to programmes:\n${applied.map((u) => `• ${u.clientName} — ${u.area}: ${u.instruction === 'REMOVE' ? 'removed' : u.instruction}`).join('\n')}\nYour clients will see the changes in their Plan tab (and get a nudge within the hour).`
                    : `\n\nNo programme changes were requested on this call.`;
                  const content = `Ponder summary:\n\n${summary.slice(0, 600)}${appliedBlock}`;

                  const chatService = (await import('../../services/chat.service')).default;
                  await chatService.postIvyMessage(dbUserId, content, { messageType: 'ponder_summary' })
                    .catch((err) => opsAlert({
                      severity: 'warn',
                      source: 'webhook:retell',
                      title: 'ponder_summary_post_failed',
                      userId: dbUserId,
                      error: err,
                    }));

                  const coach = await prisma.user.findUnique({ where: { id: dbUserId }, select: { phone: true } });
                  if (coach?.phone) {
                    messagingService.sendMessage(dbUserId, `Ivy ${content}`)
                      .catch((err) => opsAlert({
                        severity: 'warn',
                        source: 'webhook:retell',
                        title: 'ponder_summary_message_failed',
                        userId: dbUserId,
                        error: err,
                      }));
                  }
                })
                .catch((err) => opsAlert({
                  severity: 'critical',
                  source: 'webhook:retell',
                  title: 'ponder_programme_update_failed',
                  detail: 'programme changes the coach stated on the ponder call were NOT applied to clients',
                  userId: dbUserId,
                  entity: dbCallId ? { type: 'call', id: dbCallId } : undefined,
                  error: err,
                }));
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
          // Stripe signs the RAW request bytes. express.json has already parsed
          // req.body, so verify against req.rawBody (captured in app.ts) —
          // constructEvent on the parsed object rejects every event.
          const rawBody: Buffer | undefined = (req as any).rawBody;
          if (!rawBody) {
            logger.error('Stripe webhook: req.rawBody missing — json verify hook not capturing');
            res.status(400).send('Raw body unavailable for signature verification');
            return;
          }
          event = stripe.webhooks.constructEvent(rawBody, sig, config.stripe.webhookSecret);
        } catch (err) {
          // A bad STRIPE_WEBHOOK_SECRET rejects EVERY payment event — page it.
          await opsAlert({
            severity: 'critical',
            source: 'webhook:stripe',
            title: 'signature_verification_failed',
            detail: 'Stripe event rejected — if this repeats, the webhook secret is wrong and all payment events are being dropped',
            error: err,
          });
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

        case 'checkout.session.completed':
          // Only meaningful for SETUP-mode sessions (card-add for stake opt-in);
          // subscription-mode sessions are handled via customer.subscription.*.
          await paymentService.handleCheckoutSessionCompleted(event.data.object);
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
      // A failed Stripe event handler means payment state drifted from Stripe's
      // reality (subscription not recorded, cycle not authorized…). Stripe will
      // retry on the 500, but page immediately — money paths don't wait.
      await opsAlert({
        severity: 'critical',
        source: 'webhook:stripe',
        title: 'event_handler_failed',
        detail: `handler for ${req.body?.type ?? 'unknown event'} threw`,
        error,
      });
      next(error);
    }
  }

  /**
   * Final-status callback for outbound dials.
   * POST /webhooks/twilio-call-status?callId=<our call row id>
   *
   * Fires once per outbound call with the final Twilio status. Only failure
   * outcomes are recorded here (no-answer / busy / failed / canceled): for
   * connected calls Retell's call_ended webhook is the source of truth
   * (transcript, duration, outcome), so a 'completed' here is ignored.
   * Guarded to rows still SCHEDULED/IN_PROGRESS so it can never overwrite a
   * result Retell already wrote.
   */
  async handleTwilioCallStatus(req: Request, res: Response, _next: NextFunction): Promise<void> {
    try {
      const callId = String(req.query.callId ?? '');
      const twilioStatus = String(req.body.CallStatus ?? '');
      res.status(200).send('ok'); // ack immediately — Twilio retries on non-2xx

      if (!callId || !twilioStatus) return;
      const failureMap: Record<string, 'NO_ANSWER' | 'FAILED'> = {
        'no-answer': 'NO_ANSWER',
        busy: 'NO_ANSWER',
        failed: 'FAILED',
        canceled: 'FAILED',
      };
      const mapped = failureMap[twilioStatus];
      if (!mapped) return;

      const call = await prisma.call.findUnique({ where: { id: callId }, select: { status: true } });
      if (!call || (call.status !== 'IN_PROGRESS' && call.status !== 'SCHEDULED')) return;

      await callService.updateCallStatus(callId, mapped, {
        endedAt: new Date(),
        outcome: `twilio: ${twilioStatus}`,
      });
      logger.info(`Call ${callId} marked ${mapped} (twilio ${twilioStatus})`);
    } catch (err) {
      logger.error('twilio-call-status processing failed', err);
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
        opsAlert({
          severity: 'warn',
          source: 'webhook:twilio-sms',
          title: 'inbound_sms_processing_failed',
          detail: `a user texted Ivy and got silence (from ${from.slice(0, 6)}…)`,
          error: err,
        })
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

      // Identify user by phone number.
      //
      // Matched on a normalised form rather than raw equality: the write path
      // (updateUser) does not normalise, so a member whose number was saved as
      // "07432 846353" instead of "+447432846353" would fail an exact match and
      // be treated as a stranger on their own account.
      const normalisedFrom = normalisePhoneForMatch(fromNumber);
      const user = normalisedFrom
        ? await prisma.user.findFirst({
            where: { phone: { in: phoneMatchCandidates(normalisedFrom) } },
            select: { id: true, firstName: true, isActive: true, isOnboarded: true, subscriptionTier: true },
          })
        : null;

      if (!user?.isActive || !user?.isOnboarded) {
        // Genuine stranger. The number is published nowhere — only people Ivy has
        // called know it — so there is no first-contact case to protect, and
        // handing an unidentified caller an open-ended agent was an uncapped
        // spend on a line anyone could dial. One scripted line and hang up: a few
        // cents instead of unbounded minutes, and more useful than a generic
        // agent for the likeliest case (a member ringing from a second line).
        logger.warn(`Retell inbound from unrecognised number ${fromNumber} — short-answering`);
        res.json({
          agent_id: config.retell.agentIds.b2c ?? '',
          retell_llm_dynamic_variables: {
            system_prompt:
              'You are Ivy, an AI accountability coach. The person calling is not recognised. ' +
              'Say EXACTLY this and then END THE CALL: "Hi — this is Ivy. I only take calls from ' +
              'members, and I don\'t recognise this number. If you\'re a member, give me a ring from ' +
              'the phone on your account, or open the app and I\'ll call you. Take care." ' +
              'Do not answer questions. Do not continue the conversation. Keep it under fifteen seconds.',
          },
        });
        return;
      }

      const isB2B = user.subscriptionTier === 'B2B';
      const agentId = (isB2B ? config.retell.agentIds.b2b : config.retell.agentIds.b2c) ?? '';

      // Inbound cost guard.
      //
      // Scheduled calls cap at DAILY_CALL_CAP (call.service), but inbound had no
      // ceiling at all — and the voicemail now actively invites callbacks. A
      // 5-minute call is ~$0.60, so an unbounded caller costs more per day than
      // they pay per month.
      //
      // Counted here rather than at the Twilio layer on purpose: this handler
      // already depends on the DB, so the check adds no new failure class, and
      // rejecting a few seconds later costs pennies. handleTwilioInbound has NO
      // database dependency today and a sleeping Neon takes ~4s to wake — putting
      // a query in front of "can this person reach Ivy at all" to save $0.60 is
      // the wrong trade.
      //
      // FAILS OPEN by design: this is a cost guard, not a security control.
      // Any error and the call connects normally.
      let overCap = false;
      try {
        const dayStart = new Date();
        dayStart.setHours(0, 0, 0, 0);
        const callsToday = await prisma.call.count({
          where: { userId: user.id, scheduledAt: { gte: dayStart } },
        });
        overCap = callsToday >= INBOUND_DAILY_CALL_CAP;
        if (overCap) {
          logger.warn(`Inbound cap hit for ${user.id}: ${callsToday} calls today (cap ${INBOUND_DAILY_CALL_CAP})`);
        }
      } catch (err) {
        logger.warn(`Inbound cap check failed for ${user.id} — allowing the call through:`, err);
      }

      if (overCap) {
        // Answer briefly rather than dropping the line: a dead line reads as
        // broken, and the whole product is "someone always picks up".
        res.json({
          agent_id: agentId,
          retell_llm_dynamic_variables: {
            system_prompt:
              `You are Ivy. ${user.firstName} has already spoken with you several times today. ` +
              `Say EXACTLY this and then END THE CALL: "Hey ${user.firstName} — we've already talked a fair bit today. ` +
              `I'm still here for your evening check-in, so let's save it for then." Do not discuss anything else. ` +
              `Do not take a commitment. Keep it under ten seconds.`,
          },
          metadata: { userId: user.id, callType: 'INBOUND_CAPPED' },
        });
        return;
      }

      const callType = await this.resolveInboundCallType(user.id);

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
