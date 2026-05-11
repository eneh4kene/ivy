import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import crypto from 'crypto';
import callService from '../../services/call.service';
import messagingService from '../../services/messaging.service';
import paymentService from '../../services/payment.service';
import insightService from '../../services/insight.service';
import { logUsage } from '../../services/usage.service';
import { serverAnalytics } from '../../lib/analytics';
import { handleMissedCall as handleMissedCallComms } from '../../services/communication.service';
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

      switch (event) {
        case 'call_started':
          // Update call status to IN_PROGRESS
          if (call.metadata?.callId) {
            await callService.updateCallStatus(call.metadata.callId, 'IN_PROGRESS', {
              startedAt: new Date(),
              retellCallId: call.call_id,
            });
          }
          break;

        case 'call_ended':
          // Update call with final details
          if (call.metadata?.callId) {
            await callService.updateCallStatus(call.metadata.callId, 'COMPLETED', {
              endedAt: new Date(),
              duration: call.call_analysis?.call_duration || 0,
              outcome: call.disconnection_reason || 'completed',
            });
          }
          break;

        case 'call_analyzed':
          if (call.metadata?.callId) {
            const durationSecs = call.call_analysis?.call_duration ?? 0
            const outcome = call.call_analysis?.user_sentiment ?? 'neutral'

            await callService.updateCallStatus(call.metadata.callId, 'COMPLETED', {
              transcript: call.transcript || '',
              sentiment: outcome,
            })

            // Log Retell usage cost
            const durationMins = durationSecs / 60
            await logUsage('retell', 'call', durationMins, call.metadata?.userId, {
              callId: call.call_id,
              callType: call.metadata?.callType,
            })

            // Server-side analytics
            if (call.metadata?.userId) {
              serverAnalytics.callCompleted(
                call.metadata.userId,
                call.metadata?.callType ?? 'unknown',
                durationSecs,
                outcome
              )
            }

            // Async insight extraction — never blocks webhook response
            if (call.transcript && call.metadata?.callId && call.metadata?.userId) {
              insightService.extractCallInsights(
                call.metadata.callId,
                call.transcript,
                call.metadata?.callType ?? 'unknown',
                call.metadata.userId,
              ).catch((err) => logger.error('Insight extraction error:', err));
            }
          }
          break;

        case 'call_no_answer':
          if (call.metadata?.callId) {
            await callService.handleMissedCall(call.metadata.callId);
          }
          // Fire WhatsApp "bad time?" fallback
          if (call.metadata?.userId) {
            await handleMissedCallComms(call.metadata.userId);
            if (call.metadata?.userId) {
              serverAnalytics.callMissed(call.metadata.userId, call.metadata?.callType ?? 'unknown');
            }
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
}

export default new WebhookController();
