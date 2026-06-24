import prisma from '../utils/prisma';
import { CreateUserInput, UpdateUserInput } from '../types/user.schema';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
// IMPACT_WALLET_MONTHLY import removed in Phase 5: bundled wallet allocation retired (§8).
import seasonService from './season.service';
import callService from './call.service';
import { fromZonedTime } from 'date-fns-tz';

/**
 * computeOnboardingCallAt — pick a humane time for a brand-new user's single
 * Day-Zero onboarding call, in their own timezone.
 *
 * Preference order:
 *   1. Their chosen evening slot today, if it's still comfortably ahead.
 *   2. If that slot has passed but it's not yet late (<21:00 local), call shortly
 *      (they clearly just signed up and are active) — but never mid-workday,
 *      because we only reach this branch after the evening slot.
 *   3. Otherwise (late at night) tomorrow at the evening slot.
 *
 * Defaults to a 19:00 evening slot when the user hasn't set one.
 */
function computeOnboardingCallAt(
  timezone: string | null | undefined,
  eveningCallTime: string | null | undefined,
  now: Date = new Date(),
): Date {
  const tz = timezone || 'Europe/London';
  const hhmm = eveningCallTime && /^\d{2}:\d{2}$/.test(eveningCallTime) ? eveningCallTime : '19:00';
  const todayStr = now.toLocaleDateString('en-CA', { timeZone: tz });
  const slotToday = fromZonedTime(`${todayStr}T${hhmm}:00`, tz);
  const localHour = (() => {
    const h = Number(now.toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: tz }));
    return Number.isFinite(h) ? h % 24 : 12;
  })();

  // 1. Evening slot still ahead today (≥10 min buffer).
  if (slotToday.getTime() > now.getTime() + 10 * 60 * 1000) return slotToday;
  // 2. Slot passed but still a reasonable hour → call shortly.
  if (localHour < 21) return new Date(now.getTime() + 10 * 60 * 1000);
  // 3. Late night → tomorrow's evening slot (+24h; DST drift acceptable for beta).
  return new Date(slotToday.getTime() + 24 * 60 * 60 * 1000);
}

class UserService {
  /**
   * Create a new user
   */
  async createUser(data: CreateUserInput) {
    const { email, tcpaConsent, ...rest } = data;
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
        // Store TCPA consent with timestamp for compliance record-keeping
        ...(tcpaConsent !== undefined && {
          tcpaConsent,
          tcpaConsentAt: tcpaConsent ? new Date() : null,
        }),
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        timezone: true,
        region: true,
        currency: true,
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
        region: true,
        currency: true,
        profileImage: true,
        subscriptionTier: true,
        subscriptionStatus: true,
        track: true,
        goal: true,
        // Stake config — used by the frontend to gate paid users with no stake
        // set into the stake-setup flow (default-on policy).
        stakeWeeklyAmount: true,
        forfeitMode: true,
        armingWindowStart: true,
        armingWindowEnd: true,
        minimumMode: true,
        giftFrame: true,
        morningCallTime: true,
        eveningCallTime: true,
        callFrequency: true,
        preferredDays: true,
        googleCalendarConnected: true,
        outlookCalendarConnected: true,
        telegramChatId: true,
        coachId: true,
        coachLinkedAt: true,
        pendingCoachId: true,
        coach: {
          select: {
            firstName: true,
            coachProfile: {
              select: { programmeName: true, brandName: true, whitelabelEnabled: true },
            },
          },
        },
        pendingCoach: {
          select: {
            firstName: true,
            coachProfile: {
              select: { programmeName: true, brandName: true },
            },
          },
        },
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
    let user;
    try {
      user = await prisma.user.update({
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
        // Stake config — used by the frontend to gate paid users with no stake
        // set into the stake-setup flow (default-on policy).
        stakeWeeklyAmount: true,
        forfeitMode: true,
        armingWindowStart: true,
        armingWindowEnd: true,
        minimumMode: true,
        giftFrame: true,
        morningCallTime: true,
        eveningCallTime: true,
        callFrequency: true,
        preferredDays: true,
        updatedAt: true,
      },
      });
    } catch (err: any) {
      // Phone is globally unique — surface a clear 409 instead of a masked
      // "Database error occurred" when the number is already on another account.
      if (err?.code === 'P2002' && (err?.meta?.target as string[] | undefined)?.includes('phone')) {
        throw new ConflictError('That phone number is already linked to another account.');
      }
      throw err;
    }

    logger.info(`User updated: ${user.id}`);

    return user;
  }

  /**
   * Mark user as onboarded
   */
  async markUserAsOnboarded(userId: string) {
    const fullUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, goal: true, morningCallTime: true, eveningCallTime: true, phone: true, subscriptionTier: true, timezone: true },
    });

    // Coaches don't need a phone (they receive calls from their clients, not Ivy)
    if (fullUser?.subscriptionTier !== 'COACH' && !fullUser?.phone) {
      throw new BadRequestError('A phone number is required to complete onboarding.');
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { isOnboarded: true, onboardedAt: new Date() },
      select: { id: true, isOnboarded: true, onboardedAt: true },
    });

    // Coaches don't have a personal season arc or accountability calls
    if (fullUser?.subscriptionTier === 'COACH') {
      logger.info(`Coach onboarded: ${user.id} — skipping season and call setup`);
      return user;
    }

    // Create Season 1 from the user's goal (non-blocking)
    if (fullUser?.goal) {
      seasonService.createSeason(userId, { goal: fullUser.goal, title: 'Season 1' })
        .catch((err) => logger.warn(`Failed to create Season 1 for ${userId}:`, err));
    }

    // Day Zero: schedule ONE onboarding call at a humane hour — never the daily
    // loop (morning VN + evening review), and never an auto-dial in the middle of
    // someone's workday. We aim for the evening (when people are free), in the
    // user's own timezone; if it's already late, we push to tomorrow. The normal
    // loop takes over from the next day's scheduler. See docs/foundation-run-and-day-zero.md.
    const canCall = fullUser?.phone && fullUser.subscriptionTier !== 'FREE';
    if (canCall) {
      (async () => {
        try {
          const at = computeOnboardingCallAt(fullUser.timezone, fullUser.eveningCallTime);
          await callService.scheduleCall(userId, 'ONBOARDING', at);
          logger.info(`Onboarding call scheduled for user ${userId} at ${at.toISOString()}`);
        } catch (err) {
          logger.warn(`Failed to schedule onboarding call for ${userId}:`, err);
        }
      })();
    }

    logger.info(`User onboarded: ${user.id}`);

    return user;
  }

  /**
   * Initialize user's Impact Wallet and Streak.
   *
   * Phase 5 (§8): the bundled wallet allocation (monthlyLimit / dailyCap) is
   * retired. The ImpactWallet row is still created for lifetimeDonated tracking,
   * but monthlyLimit and dailyCap are set to 0 (no allocation). The tier parameter
   * is no longer used for wallet sizing; it is kept in the signature for callers
   * that pass it.
   */
  async initializeUserResources(userId: string, _subscriptionTier: string) {
    // Create the ImpactWallet row for lifetime-donated tracking only.
    // monthlyLimit and dailyCap are 0 — no bundled allocation post-rework.
    await prisma.impactWallet.upsert({
      where: { userId },
      create: {
        userId,
        monthlyLimit: 0,
        dailyCap: 0,
        currentMonthSpent: 0,
        lifetimeDonated: 0,
        monthStartDate: new Date(),
      },
      update: {},  // never downgrade an existing wallet row
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
