import { Router } from 'express';
import webhookController from '../controllers/webhook.controller';

const router = Router();

/**
 * @route   POST /webhooks/retell
 * @desc    Handle Retell AI webhook events
 * @access  Public (verified by Retell signature)
 */
router.post('/retell', webhookController.handleRetellWebhook);

/**
 * @route   GET /webhooks/whatsapp
 * @desc    Verify WhatsApp webhook
 * @access  Public (required by WhatsApp)
 */
router.get('/whatsapp', webhookController.verifyWhatsAppWebhook);

/**
 * @route   POST /webhooks/whatsapp
 * @desc    Handle WhatsApp webhook events
 * @access  Public (verified by WhatsApp signature)
 */
router.post('/whatsapp', webhookController.handleWhatsAppWebhook);

/**
 * @route   POST /webhooks/stripe
 * @desc    Handle Stripe webhook events
 * @access  Public (verified by Stripe signature)
 */
router.post('/stripe', webhookController.handleStripeWebhook);

/**
 * @route   POST /webhooks/twilio-sms
 * @desc    Twilio Messaging webhook — handles inbound SMS replies on the Twilio number
 * @access  Public
 *
 * Configure in Twilio: Phone Numbers → your number → Messaging → Webhook → this URL (POST)
 * This handles replies when WhatsApp isn't configured and messages go out as SMS.
 */
router.post('/twilio-sms', webhookController.handleTwilioSms);

/**
 * @route   POST /webhooks/twilio-inbound
 * @desc    Twilio Voice webhook — forwards the inbound call to Retell via SIP
 * @access  Public
 *
 * Configure in Twilio: Phone Numbers → your number → Voice → Webhook → this URL (POST)
 * Set RETELL_SIP_ENDPOINT in Railway env (from Retell dashboard → Phone Numbers → BYOC SIP URI)
 */
router.post('/twilio-inbound', webhookController.handleTwilioInbound);

/**
 * @route   POST /webhooks/retell-inbound
 * @desc    Retell inbound call webhook — fires before agent speaks, returns agent config + prompt
 * @access  Public (verified by RETELL_WEBHOOK_SECRET)
 *
 * Configure in Retell: Dashboard → Phone Numbers → your number → Inbound Webhook URL → this URL
 */
router.post('/retell-inbound', webhookController.handleRetellInbound);

export default router;
