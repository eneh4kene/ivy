import prisma from '../utils/prisma';
import { CreateManualDonationInput, GetDonationsQueryInput, UpdateImpactWalletInput } from '../types/donation.schema';
import { NotFoundError, BadRequestError } from '../utils/errors';
import logger from '../utils/logger';
import { startOfMonth, endOfMonth, startOfDay, endOfDay } from 'date-fns';

class DonationService {
  /**
   * Calculate donation amount for a workout completion
   * Based on user's subscription tier
   */
  async calculateDonationAmount(userId: string): Promise<number> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Donation amounts by tier
    const amounts: Record<string, number> = {
      FREE: 1.0,
      PRO: 1.0,
      ELITE: 1.5,
      CONCIERGE: 2.0,
      B2B: 1.0,
    };

    return amounts[user.subscriptionTier] || 1.0;
  }

  /**
   * Check if user can make a donation (within daily/monthly limits)
   */
  async canMakeDonation(userId: string, amount: number): Promise<{ allowed: boolean; reason?: string }> {
    const wallet = await prisma.impactWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      return { allowed: false, reason: 'Impact Wallet not found' };
    }

    // Check monthly limit
    if (wallet.currentMonthSpent + amount > Number(wallet.monthlyLimit)) {
      return {
        allowed: false,
        reason: `Monthly limit reached (£${wallet.monthlyLimit})`,
      };
    }

    // Check daily cap
    const today = new Date();
    const startOfToday = startOfDay(today);
    const endOfToday = endOfDay(today);

    const todaysDonations = await prisma.donation.aggregate({
      where: {
        userId,
        createdAt: {
          gte: startOfToday,
          lte: endOfToday,
        },
      },
      _sum: {
        amount: true,
      },
    });

    const todaysTotal = Number(todaysDonations._sum.amount || 0);

    if (todaysTotal + amount > Number(wallet.dailyCap)) {
      return {
        allowed: false,
        reason: `Daily cap reached (£${wallet.dailyCap})`,
      };
    }

    return { allowed: true };
  }

  /**
   * Create a donation
   */
  async createDonation(
    userId: string,
    charityId: string,
    amount: number,
    donationType: 'COMPLETION' | 'STREAK_7_DAY' | 'STREAK_30_DAY' | 'STREAK_90_DAY' | 'MANUAL',
    workoutId?: string,
    streakDays?: number
  ) {
    // Verify user exists
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { preferredCharity: true },
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

    // Check if donation is allowed (for non-manual donations)
    if (donationType !== 'MANUAL') {
      const check = await this.canMakeDonation(userId, amount);
      if (!check.allowed) {
        throw new BadRequestError(check.reason || 'Donation not allowed');
      }
    }

    // Create donation
    const donation = await prisma.donation.create({
      data: {
        userId,
        charityId: targetCharityId,
        amount,
        currency: 'GBP',
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
   * Update Impact Wallet after a donation
   */
  private async updateWalletAfterDonation(userId: string, amount: number) {
    const wallet = await prisma.impactWallet.findUnique({
      where: { userId },
    });

    if (!wallet) {
      throw new NotFoundError('Impact Wallet not found');
    }

    // Check if we need to reset monthly counter (new month)
    const now = new Date();
    const monthStart = startOfMonth(now);
    const walletMonthStart = startOfMonth(new Date(wallet.monthStartDate));

    let currentMonthSpent = Number(wallet.currentMonthSpent);

    // Reset if new month
    if (monthStart > walletMonthStart) {
      currentMonthSpent = 0;
      await prisma.impactWallet.update({
        where: { userId },
        data: {
          monthStartDate: monthStart,
          currentMonthSpent: 0,
        },
      });
    }

    // Update wallet
    await prisma.impactWallet.update({
      where: { userId },
      data: {
        currentMonthSpent: currentMonthSpent + amount,
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
