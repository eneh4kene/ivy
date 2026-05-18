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
 * @route   POST /payments/coach-checkout
 * @desc    Create Stripe checkout for coach plans (COACH_5 / COACH_10 / COACH_20)
 * @access  Private
 */
router.post('/coach-checkout', paymentController.createCoachCheckoutSession);

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
