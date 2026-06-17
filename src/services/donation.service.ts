import prisma from '../utils/prisma';
import { CreateManualDonationInput, GetDonationsQueryInput, UpdateImpactWalletInput } from '../types/donation.schema';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

class DonationService {
  /**
   * @deprecated Phase 5 — per-completion wallet donation retired (§8 of
   * docs/product-pricing-rework.md). The subscription no longer funds a
   * per-tier donation amount; charity funding now comes from stake forfeits
   * (STAKE_FORFEIT) and the Phase 6 corporate CSR pool (STAKE_SUCCESS).
   * This method is retained for any callers not yet migrated; it always
   * returns 1.0 as a safe fallback.
   */
  async calculateDonationAmount(_userId: string): Promise<number> {
    // Bundled wallet allocation retired — return a safe no-op value.
    return 1.0;
  }

  /**
   * @deprecated Phase 5 — bundled wallet monthly/daily cap gates retired (§8 of
   * docs/product-pricing-rework.md). The wallet's monthlyLimit and dailyCap are no
   * longer set on new subscriptions. This method now always returns allowed:true
   * so that MANUAL and STREAK_* donations still pass through; the cap semantics
   * are irrelevant without a funded allocation. Retained to avoid breaking callers.
   */
  async canMakeDonation(_userId: string, _amount: number): Promise<{ allowed: boolean; reason?: string }> {
    // Bundled wallet gate retired — always allow.
    return { allowed: true };
  }

  // ---------------------------------------------------------------------------
  // INTERNAL — kept private, only used by createDonation for MANUAL type guard
  // ---------------------------------------------------------------------------
  /**
   * Create a donation
   * donationType 'COMPLETION' is deprecated (Phase 5 §8) — no longer called from workout.service.
   * Active types: STAKE_FORFEIT, STAKE_SUCCESS, STREAK_7_DAY, STREAK_30_DAY, STREAK_90_DAY, MANUAL.
   * COMPLETION is retained in the signature only for backward compatibility during transition.
   */
  async createDonation(
    userId: string,
    charityId: string,
    amount: number,
    donationType: 'COMPLETION' | 'STAKE_FORFEIT' | 'STAKE_SUCCESS' | 'STREAK_7_DAY' | 'STREAK_30_DAY' | 'STREAK_90_DAY' | 'MANUAL',
    workoutId?: string,
    streakDays?: number
  ) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferredCharity: true },
      // select not used here because include is present; currency comes from the model
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Use preferred charity if not specified
    const targetCharityId = charityId || user.preferredCharityId;

    if (!targetCharityId) {
      throw new BadRequestError('Charity not specified and no preferred charity set');
    }

    // Verify charity exists
    const charity = await prisma.charity.findUnique({
      where: { id: targetCharityId },
    });

    if (!charity || !charity.isActive) {
      throw new NotFoundError('Charity not found or inactive');
    }

    // Phase 5: wallet cap check retired (canMakeDonation is a no-op stub).
    // All donation types are allowed without a wallet gate.

    // Create donation
    const donation = await prisma.donation.create({
      data: {
        userId,
        charityId: targetCharityId,
        amount,
        currency: user.currency,
        donationType,
        workoutId,
        streakDays,
      },
      include: {
        charity: {
          select: {
            id: true,
            name: true,
            impactMetric: true,
            impactPerPound: true,
            logoUrl: true,
          },
        },
      },
    });

    // Update Impact Wallet
    await this.updateWalletAfterDonation(userId, amount);

    logger.info(`Donation created: ${donation.id} - £${amount} to ${charity.name}`);

    return donation;
  }

  /**
   * Update Impact Wallet after a donation.
   *
   * Phase 5 (§8): the bundled wallet allocation (monthlyLimit / dailyCap /
   * currentMonthSpent) is retired. Only lifetimeDonated is updated — it is
   * the single field still relevant post-rework (lifetime impact tracking).
   * If no wallet row exists yet we silently skip; it is no longer mandatory.
   */
  private async updateWalletAfterDonation(userId: string, amount: number) {
    const wallet = await prisma.impactWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      // No wallet row — fine post-rework; new users don't get one on subscription.
      return;
    }

    await prisma.impactWallet.update({
      where: { userId },
      data: {
        lifetimeDonated: {
          increment: amount,
        },
      },
    });
  }

  /**
   * Get user's donations with filtering
   */
  async getUserDonations(userId: string, query: GetDonationsQueryInput) {
    const { startDate, endDate, charityId, donationType, page = 1, limit = 20 } = query;

    const where: any = { userId };

    if (charityId) {
      where.charityId = charityId;
    }

    if (donationType) {
      where.donationType = donationType;
    }

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = new Date(startDate);
      }
      if (endDate) {
        where.createdAt.lte = new Date(endDate);
      }
    }

    const [donations, total] = await Promise.all([
      prisma.donation.findMany({
        where,
        include: {
          charity: {
            select: {
              id: true,
              name: true,
              impactMetric: true,
              impactPerPound: true,
              logoUrl: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.donation.count({ where }),
    ]);

    return {
      donations,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Get Impact Wallet details
   */
  async getImpactWallet(userId: string) {
    const wallet = await prisma.impactWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Impact Wallet not found');
    }

    // Get current month donations
    const now = new Date();
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const monthlyDonations = await prisma.donation.aggregate({
      where: {
        userId,
        createdAt: {
          gte: monthStart,
          lte: monthEnd,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    // Get today's donations
    const todayStart = startOfDay(now);
    const todayEnd = endOfDay(now);

    const todayDonations = await prisma.donation.aggregate({
      where: {
        userId,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      _sum: {
        amount: true,
      },
      _count: true,
    });

    return {
      wallet: {
        monthlyLimit: Number(wallet.monthlyLimit),
        dailyCap: Number(wallet.dailyCap),
        currentMonthSpent: Number(wallet.currentMonthSpent),
        lifetimeDonated: Number(wallet.lifetimeDonated),
        monthStartDate: wallet.monthStartDate,
      },
      currentMonth: {
        totalDonated: Number(monthlyDonations._sum.amount || 0),
        donationCount: monthlyDonations._count,
        remaining: Number(wallet.monthlyLimit) - Number(wallet.currentMonthSpent),
      },
      today: {
        totalDonated: Number(todayDonations._sum.amount || 0),
        donationCount: todayDonations._count,
        remaining: Number(wallet.dailyCap) - Number(todayDonations._sum.amount || 0),
      },
    };
  }

  /**
   * Get donation statistics
   */
  async getDonationStats(userId: string) {
    const [totalStats, charityBreakdown, typeBreakdown] = await Promise.all([
      // Total stats
      prisma.donation.aggregate({
        where: { userId },
        _sum: { amount: true },
        _count: true,
      }),

      // By charity
      prisma.donation.groupBy({
        by: ['charityId'],
        where: { userId },
        _sum: { amount: true },
        _count: true,
      }),

      // By type
      prisma.donation.groupBy({
        by: ['donationType'],
        where: { userId },
        _sum: { amount: true },
        _count: true,
      }),
    ]);

    // Get charity details for breakdown
    const charityIds = charityBreakdown.map((c) => c.charityId);
    const charities = await prisma.charity.findMany({
      where: { id: { in: charityIds } },
      select: {
        id: true,
        name: true,
        logoUrl: true,
        impactMetric: true,
      },
    });

    const charityMap = new Map(charities.map((c) => [c.id, c]));

    return {
      total: {
        amount: Number(totalStats._sum.amount || 0),
        count: totalStats._count,
      },
      byCharity: charityBreakdown.map((item) => ({
        charity: charityMap.get(item.charityId),
        amount: Number(item._sum.amount || 0),
        count: item._count,
      })),
      byType: typeBreakdown.map((item) => ({
        type: item.donationType,
        amount: Number(item._sum.amount || 0),
        count: item._count,
      })),
    };
  }

  /**
   * Update Impact Wallet limits (admin)
   */
  async updateImpactWallet(userId: string, data: UpdateImpactWalletInput) {
    const wallet = await prisma.impactWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Impact Wallet not found');
    }

    const updated = await prisma.impactWallet.update({
      where: { userId },
      data,
    });

    logger.info(`Impact Wallet updated for user ${userId}`);

    return updated;
  }

  /**
   * Create manual donation (admin only)
   */
  async createManualDonation(data: CreateManualDonationInput) {
    return this.createDonation(
      data.userId,
      data.charityId,
      data.amount,
      'MANUAL'
    );
  }

  /**
   * Get all charities
   */
  async getCharities() {
    return prisma.charity.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  async getCharitiesForUser(region: string, track?: string) {
    const all = await prisma.charity.findMany({
      where: { isActive: true },
      orderBy: [{ featured: 'desc' }, { name: 'asc' }],
    })

    // Filter by region — include global charities and region-specific ones
    const filtered = all.filter((c) => {
      const regions: string[] = JSON.parse(c.regions)
      return regions.includes('global') || regions.includes(region)
    })

    // Sort by track relevance if a track is provided
    if (track) {
      filtered.sort((a, b) => {
        const aRelevant = (JSON.parse(a.tracks) as string[]).includes(track)
        const bRelevant = (JSON.parse(b.tracks) as string[]).includes(track)
        if (aRelevant && !bRelevant) return -1
        if (!aRelevant && bRelevant) return 1
        // Featured first within each relevance group
        if (a.featured && !b.featured) return -1
        if (!a.featured && b.featured) return 1
        return 0
      })
    }

    return filtered
  }

  /**
   * Get charity by ID
   */
  async getCharityById(charityId: string) {
    const charity = await prisma.charity.findUnique({
      where: { id: charityId },
    });

    if (!charity) {
      throw new NotFoundError('Charity not found');
    }

    return charity;
  }
}

export default new DonationService();
