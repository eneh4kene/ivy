import { Router } from 'express';
import paymentController from '../controllers/payment.controller';
import { authenticate } from '../../middleware/auth';

const router = Router();

// All payment routes require authentication
router.use(authenticate);

/**
 * @route   POST /payments/checkout
 * @desc    Create Stripe checkout session for subscription
 * @access  Private
 */
router.post('/checkout', paymentController.createCheckoutSession);

/**
 * @route   POST /payments/portal
 * @desc    Create customer portal session for managing subscription
 * @access  Private
 */
router.post('/portal', paymentController.createPortalSession);

/**
 * @route   GET /payments/subscription
 * @desc    Get current subscription details
 * @access  Private
 */
router.get('/subscription', paymentController.getSubscription);

/**
 * @route   POST /payments/cancel
 * @desc    Cancel subscription
 * @access  Private
 */
router.post('/cancel', paymentController.cancelSubscription);

export default router;
