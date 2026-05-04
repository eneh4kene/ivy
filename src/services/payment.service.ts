import Stripe from 'stripe';
import prisma from '../utils/prisma';
import { config } from '../config';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { SubscriptionTier } from '@prisma/client';
import { getStripePriceId, IMPACT_WALLET_MONTHLY, type Currency } from '../config/pricing';

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

  /**
   * Get Stripe price ID for a subscription tier and currency.
   * Tries currency-specific env var first (e.g. STRIPE_PRICE_PRO_GBP),
   * then falls back to the legacy var (e.g. STRIPE_PRICE_PRO).
   */
  private getPriceId(tier: SubscriptionTier, currency: Currency = 'GBP'): string {
    // Try currency-specific price first
    const currencySpecific = getStripePriceId(tier, currency)
    if (currencySpecific) return currencySpecific

    // Fall back to legacy (GBP-only) env vars
    const legacyPriceIds: Record<SubscriptionTier, string> = {
      FREE: '',
      PRO: process.env.STRIPE_PRICE_PRO || '',
      ELITE: process.env.STRIPE_PRICE_ELITE || '',
      CONCIERGE: process.env.STRIPE_PRICE_CONCIERGE || '',
      B2B: process.env.STRIPE_PRICE_B2B || '',
    };

    return legacyPriceIds[tier];
  }

  /**
   * Map Stripe price ID back to subscription tier
   */
  private getTierFromPriceId(priceId: string): SubscriptionTier | null {
    const tierMap: Record<string, SubscriptionTier> = {
      // Legacy (GBP-only) env vars
      [process.env.STRIPE_PRICE_PRO || '']: 'PRO',
      [process.env.STRIPE_PRICE_ELITE || '']: 'ELITE',
      [process.env.STRIPE_PRICE_CONCIERGE || '']: 'CONCIERGE',
      [process.env.STRIPE_PRICE_B2B || '']: 'B2B',
      // Currency-specific env vars
      [process.env.STRIPE_PRICE_PRO_GBP || '']: 'PRO',
      [process.env.STRIPE_PRICE_PRO_USD || '']: 'PRO',
      [process.env.STRIPE_PRICE_ELITE_GBP || '']: 'ELITE',
      [process.env.STRIPE_PRICE_ELITE_USD || '']: 'ELITE',
      [process.env.STRIPE_PRICE_CONCIERGE_GBP || '']: 'CONCIERGE',
      [process.env.STRIPE_PRICE_CONCIERGE_USD || '']: 'CONCIERGE',
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

    // Update Impact Wallet limits based on new tier
    await this.updateImpactWalletLimits(userId, newTier);

    logger.info(`User ${userId} subscription updated to ${newTier}`);
  }

  /**
   * Update Impact Wallet limits based on subscription tier
   */
  private async updateImpactWalletLimits(userId: string, tier: SubscriptionTier) {
    const tierKey = Object.keys(IMPACT_WALLET_MONTHLY).includes(tier) ? tier : 'PRO'
    const walletConfig = IMPACT_WALLET_MONTHLY[tierKey] ?? IMPACT_WALLET_MONTHLY['PRO']
    const monthly = walletConfig.GBP
    const daily = Math.round((monthly / 30) * 100) / 100

    await prisma.impactWallet.upsert({
      where: { userId },
      create: {
        userId,
        monthlyLimit: monthly,
        dailyCap: daily,
        currentMonthSpent: 0,
        lifetimeDonated: 0,
        monthStartDate: new Date(),
      },
      update: { monthlyLimit: monthly, dailyCap: daily },
    });
  }

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
      logger.error('Missing metadata in subscription', { subscription: subscription.id });
      return;
    }

    await this.updateSubscriptionTier(userId, tier, subscription.id);

    logger.info(`Subscription created: ${subscription.id} for user ${userId}`);
  }

  /**
   * Handle subscription updated webhook event
   */
  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    const userId = subscription.metadata.userId;

    if (!userId) {
      // Try to find user by Stripe customer ID
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!user) {
        logger.error('Cannot find user for subscription', { subscription: subscription.id });
        return;
      }
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
    const userId = subscription.metadata.userId;

    if (!userId) {
      const user = await prisma.user.findFirst({
        where: { stripeCustomerId: subscription.customer as string },
      });

      if (!user) {
        logger.error('Cannot find user for subscription', { subscription: subscription.id });
        return;
      }

      await prisma.user.update({
        where: { id: user.id },
        data: {
          subscriptionTier: 'FREE',
          subscriptionStatus: 'CANCELLED',
          stripeSubscriptionId: null,
        },
      });

      // Downgrade Impact Wallet limits
      await this.updateImpactWalletLimits(user.id, 'FREE');

      logger.info(`Subscription cancelled: ${subscription.id} for user ${user.id}`);
      return;
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        subscriptionTier: 'FREE',
        subscriptionStatus: 'CANCELLED',
        stripeSubscriptionId: null,
      },
    });

    await this.updateImpactWalletLimits(userId, 'FREE');

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
          logger.error(`Failed to dispatch pilot donations for ${user.id}:`, err)
        );
      }

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

      logger.error(`Payment failed for user ${user.id} - invoice ${invoice.id}`);

      // TODO: Send notification email to user
    }
  }
}

export default new PaymentService();
