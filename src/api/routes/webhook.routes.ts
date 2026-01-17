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

export default router;
