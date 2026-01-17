import prisma from '../utils/prisma';
import { CreateUserInput, UpdateUserInput } from '../types/user.schema';
import { ConflictError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';

class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserInput) {
    const { email, ...rest } = data;
    const normalizedEmail = email.toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Create user with default settings
    const user = await prisma.user.create({
      data: {
        email: normalizedEmail,
        ...rest,
        subscriptionTier: 'FREE',
        isActive: true,
        isOnboarded: false,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        timezone: true,
        track: true,
        goal: true,
        subscriptionTier: true,
        createdAt: true,
      },
    });

    logger.info(`User created: ${user.id} (${user.email})`);

    return user;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        phone: true,
        firstName: true,
        lastName: true,
        timezone: true,
        profileImage: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        track: true,
        goal: true,
        minimumMode: true,
        giftFrame: true,
        morningCallTime: true,
        eveningCallTime: true,
        callFrequency: true,
        preferredDays: true,
        googleCalendarConnected: true,
        outlookCalendarConnected: true,
        isActive: true,
        isOnboarded: true,
        onboardedAt: true,
        lastCallAt: true,
        createdAt: true,
        updatedAt: true,
        preferredCharity: {
          select: {
            id: true,
            name: true,
            impactMetric: true,
            logoUrl: true,
          },
        },
        company: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    return user;
  }

  /**
   * Update user
   */
  async updateUser(userId: string, data: UpdateUserInput) {
    // Check if user exists
    const existingUser = await prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existingUser) {
      throw new NotFoundError('User not found');
    }

    // Update user
    const user = await prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        timezone: true,
        track: true,
        goal: true,
        minimumMode: true,
        giftFrame: true,
        morningCallTime: true,
        eveningCallTime: true,
        callFrequency: true,
        preferredDays: true,
        updatedAt: true,
      },
    });

    logger.info(`User updated: ${user.id}`);

    return user;
  }

  /**
   * Mark user as onboarded
   */
  async markUserAsOnboarded(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isOnboarded: true,
        onboardedAt: new Date(),
      },
      select: {
        id: true,
        isOnboarded: true,
        onboardedAt: true,
      },
    });

    logger.info(`User onboarded: ${user.id}`);

    return user;
  }

  /**
   * Initialize user's Impact Wallet and Streak
   */
  async initializeUserResources(userId: string, subscriptionTier: string) {
    // Determine wallet limits based on tier
    let monthlyLimit = 20; // FREE/PRO
    let dailyCap = 3;

    if (subscriptionTier === 'ELITE') {
      monthlyLimit = 30;
      dailyCap = 4;
    } else if (subscriptionTier === 'CONCIERGE') {
      monthlyLimit = 50;
      dailyCap = 5;
    } else if (subscriptionTier === 'B2B') {
      monthlyLimit = 25;
      dailyCap = 3;
    }

    // Create Impact Wallet
    await prisma.impactWallet.create({
      data: {
        userId,
        monthlyLimit,
        dailyCap,
        currentMonthSpent: 0,
        monthStartDate: new Date(),
      },
    });

    // Create Streak record
    await prisma.streak.create({
      data: {
        userId,
        currentStreak: 0,
        longestStreak: 0,
      },
    });

    logger.info(`Initialized resources for user: ${userId}`);
  }

  /**
   * Delete user (soft delete - mark as inactive)
   */
  async deleteUser(userId: string) {
    const user = await prisma.user.update({
      where: { id: userId },
      data: {
        isActive: false,
      },
    });

    logger.info(`User deactivated: ${user.id}`);

    return user;
  }
}

export default new UserService();
