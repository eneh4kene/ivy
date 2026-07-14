import Stripe from 'stripe';
import prisma from '../utils/prisma';
import { config } from '../config';
import logger from '../utils/logger';
import { opsAlert } from '../lib/ops-alert';
import { serverAnalytics } from '../lib/analytics';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { SubscriptionTier } from '@prisma/client';
import { getStripePriceId, type Currency } from '../config/pricing';
import emailService from './email.service';

class PaymentService {
  private stripe: Stripe | null = null;

  constructor() {
    if (config.stripe.secretKey) {
      this.stripe = new Stripe(config.stripe.secretKey, {
        apiVersion: '2023-10-16',
      });
    } else {
      logger.warn('Stripe not configured - payment features will be disabled');
    }
  }

  private getPriceId(tier: SubscriptionTier, currency: Currency = 'GBP'): string {
    return getStripePriceId(tier, currency) ?? ''
  }

  private getTierFromPriceId(priceId: string): SubscriptionTier | null {
    // Phase 5 (product-pricing-rework.md §5b): one paid B2C tier = PRO ("Ivy").
    // Legacy ELITE and CONCIERGE Stripe price IDs are routed to PRO so that
    // any existing webhook for a grandfathered subscription still resolves
    // correctly.  The enum values ELITE and CONCIERGE remain in the DB schema
    // for the data-migration period only.
    const tierMap: Record<string, SubscriptionTier> = {
      [process.env.STRIPE_PRICE_IVY_GBP || '']:              'PRO',
      [process.env.STRIPE_PRICE_IVY_USD || '']:              'PRO',
      // Legacy price IDs — routed to PRO (tier-collapse migration)
      [process.env.STRIPE_PRICE_IVY_PLUS_GBP || '']:         'PRO',
      [process.env.STRIPE_PRICE_IVY_PLUS_USD || '']:         'PRO',
      [process.env.STRIPE_PRICE_IVY_CONCIERGE_GBP || '']:   'PRO',
      [process.env.STRIPE_PRICE_IVY_CONCIERGE_USD || '']:   'PRO',
      [process.env.STRIPE_PRICE_B2B_TEAM_GBP || '']:         'B2B',
      [process.env.STRIPE_PRICE_B2B_TEAM_USD || '']:         'B2B',
      [process.env.STRIPE_PRICE_B2B_CHAMPION_GBP || '']:     'B2B',
      [process.env.STRIPE_PRICE_B2B_CHAMPION_USD || '']:     'B2B',
      [process.env.STRIPE_PRICE_COACH_GBP || '']:            'COACH',
      [process.env.STRIPE_PRICE_COACH_USD || '']:            'COACH',
    };

    return tierMap[priceId] || null;
  }

  /**
   * Create a Stripe checkout session for subscription
   */
  async createCheckoutSession(
    userId: string,
    tier: SubscriptionTier,
    successUrl: string,
    cancelUrl: string,
    currency: Currency = 'GBP',
    promoCode?: string
  ) {
    if (!this.stripe) {
      throw new BadRequestError('Payment service not configured');
    }

    if (tier === 'FREE') {
      throw new BadRequestError('Cannot create checkout for FREE tier');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Already subscribed (including mid-trial) — a reusable card is on file. Don't
    // create a duplicate checkout; signal the caller so it proceeds without a
    // redirect instead of double-charging. The frontend treats this as success.
    if (user.stripeSubscriptionId) {
      logger.info(`Checkout skipped for ${userId} — already subscribed (${user.stripeSubscriptionId})`);
      return { sessionId: null, url: null, alreadySubscribed: true };
    }

    const priceId = this.getPriceId(tier, currency);
    if (!priceId) {
      throw new BadRequestError(`Price not configured for tier: ${tier}`);
    }

    // Create or retrieve Stripe customer
    let customerId = user.stripeCustomerId;

    if (!customerId) {
      const customer = await this.stripe.customers.create({
        email: user.email,
        metadata: {
          userId: user.id,
        },
      });
      customerId = customer.id;

      // Update user with Stripe customer ID
      await prisma.user.update({
        where: { id: userId },
        data: { stripeCustomerId: customerId },
      });
    }

    // Resolve promo code to Stripe promotion_code ID if provided
    let stripeDiscounts: { promotion_code: string }[] | undefined
    if (promoCode && this.stripe) {
      try {
        const promoCodes = await this.stripe.promotionCodes.list({
          code: promoCode,
          active: true,
          limit: 1,
        })
        if (promoCodes.data.length > 0) {
          stripeDiscounts = [{ promotion_code: promoCodes.data[0].id }]
          logger.info(`Promo code applied: ${promoCode}`)
        } else {
          logger.warn(`Promo code not found or inactive: ${promoCode}`)
        }
      } catch (err) {
        logger.warn(`Promo code lookup failed: ${promoCode}`, err)
      }
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      currency: currency.toLowerCase(),
      line_items: [{ price: priceId, quantity: 1 }],
      // Allow user-entered promo codes at checkout unless one was pre-applied
      allow_promotion_codes: !stripeDiscounts,
      ...(stripeDiscounts && { discounts: stripeDiscounts }),
      subscription_data: {
        trial_period_days: 14,
        metadata: { userId: user.id, tier, currency },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId: user.id, tier, currency },
    });

    logger.info(`Checkout session created for user ${userId} - tier ${tier}`);

    return {
      sessionId: session.id,
      url: session.url,
    };
  }

  /**
   * Create Stripe checkout for the coach plan (flat rate, unlimited clients)
   */
  async createCoachCheckoutSession(
    userId: string,
    successUrl: string,
    cancelUrl: string,
    currency: Currency = 'GBP',
  ) {
    if (!this.stripe) throw new BadRequestError('Payment service not configured');

    const priceId = process.env[`STRIPE_PRICE_COACH_${currency}`];
    if (!priceId) throw new BadRequestError(`Coach price not configured: STRIPE_PRICE_COACH_${currency}`);

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    let customerId = user.stripeCustomerId;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email: user.email, metadata: { userId } });
      customerId = customer.id;
      await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
    }

    const session = await this.stripe.checkout.sessions.create({
      customer: customerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      currency: currency.toLowerCase(),
      line_items: [{ price: priceId, quantity: 1 }],
      allow_promotion_codes: true,
      subscription_data: {
        metadata: { userId, tier: 'COACH', currency },
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: { userId, tier: 'COACH', currency },
    });

    logger.info(`Coach checkout session created for user ${userId}`);
    return { sessionId: session.id, url: session.url };
  }

  /**
   * Create customer portal session for managing subscription
   */
  async createCustomerPortalSession(userId: string, returnUrl: string) {
    if (!this.stripe) {
      throw new BadRequestError('Payment service not configured');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeCustomerId) {
      throw new NotFoundError('No subscription found for user');
    }

    const session = await this.stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: returnUrl,
    });

    return {
      url: session.url,
    };
  }

  /**
   * Get subscription details from Stripe
   */
  async getSubscriptionDetails(subscriptionId: string) {
    if (!this.stripe) {
      throw new BadRequestError('Payment service not configured');
    }

    const subscription = await this.stripe.subscriptions.retrieve(subscriptionId);
    return subscription;
  }

  /**
   * Update user's subscription tier
   */
  async updateSubscriptionTier(
    userId: string,
    newTier: SubscriptionTier,
    stripeSubscriptionId: string
  ) {
    if (!this.stripe) {
      throw new BadRequestError('Payment service not configured');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Update user in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: newTier,
        stripeSubscriptionId: stripeSubscriptionId,
        subscriptionStatus: 'ACTIVE',
      },
    });

    // Phase 5 (§8): bundled-wallet allocation retired — no longer update monthlyLimit/dailyCap.
    // ImpactWallet.lifetimeDonated remains for lifetime-donated tracking only.

    logger.info(`User ${userId} subscription updated to ${newTier}`);
  }

  // updateImpactWalletLimits removed in Phase 5 — all callers migrated.
  // Bundled wallet allocation retired (§8 of docs/product-pricing-rework.md).

  /**
   * Cancel user subscription
   */
  async cancelSubscription(userId: string) {
    if (!this.stripe) {
      throw new BadRequestError('Payment service not configured');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || !user.stripeSubscriptionId) {
      throw new NotFoundError('No active subscription found');
    }

    // Cancel at period end (don't cancel immediately)
    await this.stripe.subscriptions.update(user.stripeSubscriptionId, {
      cancel_at_period_end: true,
    });

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionStatus: 'CANCELLING',
      },
    });

    logger.info(`Subscription cancelled for user ${userId}`);
  }

  /**
   * Handle subscription created webhook event
   */
  async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;
    const tier = subscription.metadata.tier as SubscriptionTier;

    if (!userId || !tier) {
      await opsAlert({
        severity: 'critical',
        source: 'webhook:stripe',
        title: 'subscription_missing_metadata',
        detail: `subscription ${subscription.id} created with no userId/tier metadata — someone paid and got nothing provisioned`,
        entity: { type: 'stripeSubscription', id: subscription.id },
      });
      return;
    }

    await this.updateSubscriptionTier(userId, tier, subscription.id);

    // Day Zero starts at TRIAL START, not first payment: the card is now on file,
    // so the stake can arm during the 14-day trial ("full access, stake required").
    // Idempotent + gated on the user being onboarded — if they haven't finished
    // onboarding yet, this no-ops and markUserAsOnboarded re-triggers it.
    // Fire-and-forget; never block the webhook.
    const { default: userService } = await import('./user.service');
    userService.startDayZeroExperience(userId).catch((err) =>
      opsAlert({
        severity: 'warn',
        source: 'payments',
        title: 'day_zero_trigger_failed',
        detail: 'trial started but the Day-Zero experience did not kick off (backstop runs at first payment)',
        userId,
        error: err,
      })
    );

    // Send confirmation email — non-blocking
    prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, firstName: true, email: true, subscriptionTier: true, currency: true },
    }).then((user) => {
      if (user) emailService.sendSubscriptionConfirmation(user).catch(() => {});
    }).catch(() => {});

    logger.info(`Subscription created: ${subscription.id} for user ${userId}`);
  }

  /**
   * Handle subscription updated webhook event
   */
  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    let userId = subscription.metadata.userId;

    if (!userId) {
      // Try to find user by Stripe customer ID
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!user) {
        await opsAlert({
          severity: 'critical',
          source: 'webhook:stripe',
          title: 'subscription_user_not_found',
          detail: `subscription ${subscription.id} updated but no matching user — subscription state is drifting`,
          entity: { type: 'stripeSubscription', id: subscription.id },
        });
        return;
      }

      userId = user.id;
    }

    // Get the price ID from the subscription
    const priceId = subscription.items.data[0]?.price.id;
    const newTier = priceId ? this.getTierFromPriceId(priceId) : null;

    if (newTier) {
      await this.updateSubscriptionTier(userId, newTier, subscription.id);

    }

    // Update subscription status
    let status: 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'NONE' = 'ACTIVE';
    if (subscription.status === 'past_due') {
      status = 'PAST_DUE';
    } else if (subscription.status === 'canceled') {
      status = 'CANCELLED';
    }

    await prisma.user.update({
      where: { id: userId },
      data: { subscriptionStatus: status },
    });

    logger.info(`Subscription updated: ${subscription.id} for user ${userId}`);
  }

  /**
   * Handle subscription deleted webhook event
   */
  async handleSubscriptionDeleted(subscription: Stripe.Subscription) {
    let userId = subscription.metadata.userId;

    if (!userId) {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!user) {
        await opsAlert({
          severity: 'critical',
          source: 'webhook:stripe',
          title: 'subscription_user_not_found',
          detail: `subscription ${subscription.id} deleted but no matching user — a cancellation was not recorded`,
          entity: { type: 'stripeSubscription', id: subscription.id },
        });
        return;
      }

      userId = user.id;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'FREE',
        subscriptionStatus: 'CANCELLED',
        stripeSubscriptionId: null,
      },
    });

    // Phase 5: updateImpactWalletLimits is a no-op (bundled wallet allocation retired).

    logger.info(`Subscription deleted: ${subscription.id} for user ${userId}`);
  }

  /**
   * Handle successful payment webhook event
   */
  async handlePaymentSucceeded(invoice: Stripe.Invoice) {
    const subscription = invoice.subscription;
    if (!subscription) {
      return;
    }

    const subscriptionId = typeof subscription === 'string' ? subscription : subscription.id;

    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (user) {
      const amountPaid = typeof invoice.amount_paid === 'number' ? invoice.amount_paid : 0;
      const isFirstRealPayment = amountPaid > 0 && !user.hasPaid;

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionStatus: 'ACTIVE',
          ...(isFirstRealPayment ? { hasPaid: true } : {}),
        },
      });

      // Dispatch all accumulated pilot donations on first real payment
      if (isFirstRealPayment) {
        const { dispatchPendingDonationsForUser } = await import('./every-org.service');
        dispatchPendingDonationsForUser(user.id).catch((err) =>
          opsAlert({
            severity: 'critical',
            source: 'payments',
            title: 'pilot_donation_dispatch_failed',
            detail: 'first real payment landed but accumulated pilot donations were not dispatched',
            userId: user.id,
            error: err,
          })
        );

        // Backstop: ensure the Day-Zero experience (circle + onboarding call +
        // Foundation Run) is running. It normally fires at trial start (the
        // subscription-created webhook), so by first real payment this is an
        // idempotent no-op — but it covers any case where the trial-start trigger
        // didn't land. Fire-and-forget; never block the webhook.
        // See docs/foundation-run-and-day-zero.md.
        const { default: userService } = await import('./user.service');
        userService.startDayZeroExperience(user.id).catch((err) =>
          opsAlert({
            severity: 'critical',
            source: 'payments',
            title: 'day_zero_backstop_failed',
            detail: 'both the trial-start trigger and the first-payment backstop failed — user has no Day-Zero setup',
            userId: user.id,
            error: err,
          })
        );
      }

      serverAnalytics.paymentSucceeded(user.id, amountPaid / 100, invoice.currency ?? 'gbp');
      logger.info(`Payment succeeded for user ${user.id} - invoice ${invoice.id} - amount: ${amountPaid}`);
    }
  }

  /**
   * Handle failed payment webhook event
   */
  async handlePaymentFailed(invoice: Stripe.Invoice) {
    const subscription = invoice.subscription;
    if (!subscription) {
      return;
    }

    const subscriptionId = typeof subscription === 'string' ? subscription : subscription.id;

    const user = await prisma.user.findFirst({
      where: { stripeSubscriptionId: subscriptionId },
    });

    if (user) {
      await prisma.user.update({
        where: { id: user.id },
        data: { subscriptionStatus: 'PAST_DUE' },
      });

      serverAnalytics.paymentFailed(user.id, invoice.id ?? 'unknown');
      await opsAlert({
        severity: 'warn',
        source: 'webhook:stripe',
        title: 'invoice_payment_failed',
        detail: `invoice ${invoice.id} failed — user now PAST_DUE`,
        userId: user.id,
      });

      emailService.sendPaymentFailed({
        id: user.id,
        firstName: user.firstName,
        email: user.email,
      }).catch(() => {});
    }
  }
}

export default new PaymentService();
