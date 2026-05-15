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
import { logUsage } from '../../services/usage.service';
import { serverAnalytics } from '../../lib/analytics';
import { handleMissedCall as handleMissedCallComms, handleDroppedCall } from '../../services/communication.service';
import { flattenContext } from '../../utils/retell';
import { sendSuccess } from '../../utils/response';
import logger from '../../utils/logger';
import { config } from '../../config';

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
      // Verify Retell webhook signature
      const secret = process.env.RETELL_WEBHOOK_SECRET
      if (secret) {
        const signature = req.headers['x-retell-signature'] as string
        const timestamp = req.headers['x-retell-timestamp'] as string
        if (!signature || !timestamp) {
          res.status(401).send('Missing Retell signature headers')
          return
        }
        const expected = crypto
          .createHmac('sha256', secret)
          .update(`${timestamp}.${JSON.stringify(req.body)}`)
          .digest('hex')
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          res.status(401).send('Invalid Retell signature')
          return
        }
      }

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
   * Handle WhatsApp webhook events
   * POST /webhooks/whatsapp
   */
  async handleWhatsAppWebhook(
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { entry } = req.body;

      if (!entry || entry.length === 0) {
        sendSuccess(res, { received: true });
        return;
      }

      for (const change of entry[0].changes || []) {
        if (change.value?.messages) {
          for (const message of change.value.messages) {
            const phone = message.from;
            const content = message.text?.body || '';

            logger.info(`WhatsApp message received from ${phone}: ${content}`);

            // Process incoming message
            await messagingService.handleIncomingMessage(phone, content);
          }
        }

        // Handle status updates (delivered, read, etc.)
        if (change.value?.statuses) {
          for (const status of change.value.statuses) {
            const messageId = status.id;
            const newStatus = status.status;

            logger.info(`WhatsApp status update: ${messageId} -> ${newStatus}`);

            // Update message status in database
            // This would require mapping WhatsApp message ID to our message ID
          }
        }
      }

      sendSuccess(res, { received: true });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify WhatsApp webhook (required by WhatsApp)
   * GET /webhooks/whatsapp
   */
  verifyWhatsAppWebhook(req: Request, res: Response): void {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
      logger.info('WhatsApp webhook verified');
      res.status(200).send(challenge);
    } else {
      res.status(403).send('Verification failed');
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
      // Verify Retell signature (reuses RETELL_WEBHOOK_SECRET)
      const secret = config.retell.webhookSecret;
      if (secret) {
        const signature = req.headers['x-retell-signature'] as string;
        const timestamp = req.headers['x-retell-timestamp'] as string;
        if (!signature || !timestamp) {
          res.status(401).send('Missing Retell signature headers');
          return;
        }
        const expected = crypto
          .createHmac('sha256', secret)
          .update(`${timestamp}.${JSON.stringify(req.body)}`)
          .digest('hex');
        if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
          res.status(401).send('Invalid Retell signature');
          return;
        }
      }

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
        retell_llm_dynamic_variables: flattenContext({ ...ctx, call_type: callType.toLowerCase() }),
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
