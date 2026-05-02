import { Request, Response, NextFunction } from 'express';
import Stripe from 'stripe';
import callService from '../../services/call.service';
import messagingService from '../../services/messaging.service';
import paymentService from '../../services/payment.service';
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
          // Update call with transcript and sentiment
          if (call.metadata?.callId) {
            await callService.updateCallStatus(call.metadata.callId, 'COMPLETED', {
              transcript: call.transcript || '',
              sentiment: call.call_analysis?.user_sentiment || 'neutral',
            });

            // Process call insights (e.g., if user mentioned skipping)
            if (call.transcript?.toLowerCase().includes('skip')) {
              logger.info(`User mentioned skipping in call ${call.metadata.callId}`);
              // Could trigger rescue flow here
            }
          }
          break;

        case 'call_no_answer':
          // Handle missed call
          if (call.metadata?.callId) {
            await callService.handleMissedCall(call.metadata.callId);
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
