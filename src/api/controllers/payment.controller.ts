import { Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import paymentService from '../../services/payment.service';
import { sendSuccess, sendError } from '../../utils/response';
import { SubscriptionTier } from '@prisma/client';
import { config } from '../../config';
import type { Currency } from '../../config/pricing';
import prisma from '../../utils/prisma';

class PaymentController {
  /**
   * Create Stripe checkout session
   * POST /payments/checkout
   */
  async createCheckoutSession(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const { tier, currency: bodyCurrency, promoCode } = req.body;

      // Phase 5: one paid B2C tier = PRO ("Ivy"). ELITE/CONCIERGE are retired.
      if (!tier || !['PRO', 'B2B'].includes(tier)) {
        sendError(res, 'Invalid subscription tier', 400);
        return;
      }

      // Determine currency: use body value, else look up from user record, else default GBP
      let currency: Currency = 'GBP';
      if (bodyCurrency && ['GBP', 'USD'].includes(bodyCurrency)) {
        currency = bodyCurrency as Currency;
      } else {
        const dbUser = await prisma.user.findUnique({ where: { id: userId }, select: { currency: true } });
        if (dbUser?.currency && ['GBP', 'USD'].includes(dbUser.currency)) {
          currency = dbUser.currency as Currency;
        }
      }

      const frontendUrl = config.frontend.url || 'http://localhost:3000';
      const successUrl = `${frontendUrl}/checkout/success?session_id={CHECKOUT_SESSION_ID}`;
      const cancelUrl = `${frontendUrl}/pricing`;

      const session = await paymentService.createCheckoutSession(
        userId,
        tier as SubscriptionTier,
        successUrl,
        cancelUrl,
        currency,
        promoCode
      );

      sendSuccess(res, session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create coach checkout session
   * POST /payments/coach-checkout
   */
  async createCoachCheckoutSession(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) { res.status(401).json({ success: false, error: 'Unauthorized' }); return; }

      const { currency, successUrl, cancelUrl } = req.body;

      const session = await paymentService.createCoachCheckoutSession(
        userId,
        successUrl || `${process.env.FRONTEND_URL}/coach?setup=1`,
        cancelUrl || `${process.env.FRONTEND_URL}/pricing`,
        currency || 'GBP',
      );
      res.json({ success: true, data: session });
    } catch (err) { next(err); }
  }

  /**
   * Create customer portal session
   * POST /payments/portal
   */
  async createPortalSession(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      const frontendUrl = config.frontend.url || 'http://localhost:3000';
      const returnUrl = `${frontendUrl}/settings`;

      const session = await paymentService.createCustomerPortalSession(userId, returnUrl);

      sendSuccess(res, session);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current subscription details
   * GET /payments/subscription
   */
  async getSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      // Get user to check subscription ID
      const user = req.user;

      if (!user?.stripeSubscriptionId) {
        sendSuccess(res, {
          tier: user?.subscriptionTier || 'FREE',
          status: 'NONE',
          subscription: null,
        });
        return;
      }

      const subscription = await paymentService.getSubscriptionDetails(
        user.stripeSubscriptionId
      );

      sendSuccess(res, {
        tier: user.subscriptionTier,
        status: user.subscriptionStatus,
        subscription: {
          id: subscription.id,
          status: subscription.status,
          currentPeriodEnd: subscription.current_period_end,
          cancelAtPeriodEnd: subscription.cancel_at_period_end,
        },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Cancel subscription
   * POST /payments/cancel
   */
  async cancelSubscription(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const userId = req.user?.id;
      if (!userId) {
        sendError(res, 'Unauthorized', 401);
        return;
      }

      await paymentService.cancelSubscription(userId);

      sendSuccess(res, { message: 'Subscription cancelled successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new PaymentController();
