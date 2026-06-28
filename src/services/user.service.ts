import prisma from '../utils/prisma';
import { CreateUserInput, UpdateUserInput } from '../types/user.schema';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/errors';
import logger from '../utils/logger';
// IMPACT_WALLET_MONTHLY import removed in Phase 5: bundled wallet allocation retired (§8).
import seasonService from './season.service';
import circleService from './circle.service';
import chatService from './chat.service';

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

    // Make sure the home surfaces never 404 on a brand-new user: every onboarded
    // member must have a Streak + Impact Wallet row. Idempotent (upsert), so it's
    // safe even if createUser already seeded them. Non-blocking.
    this.initializeUserResources(userId, fullUser?.subscriptionTier ?? 'FREE')
      .catch((err) => logger.warn(`Failed to initialize resources for ${userId}:`, err));

    // Create Season 1 from the user's goal (non-blocking)
    if (fullUser?.goal) {
      seasonService.createSeason(userId, { goal: fullUser.goal, title: 'Season 1' })
        .catch((err) => logger.warn(`Failed to create Season 1 for ${userId}:`, err));
    }

    // Day Zero: kick off the new-user experience. The welcome half (circle +
    // onboarding call) fires NOW — it needs no card, so Ivy is aware of and
    // reaches out to the member during the free trial. The money half (the
    // Foundation Run stake hold) waits inside for a card on file and is
    // re-triggered by the subscription-created webhook. Idempotent + non-blocking.
    this.startDayZeroExperience(userId)
      .catch((err) => logger.warn(`Day-Zero experience failed for ${userId}:`, err));

    logger.info(`User onboarded: ${user.id}`);

    return user;
  }

  /**
   * startDayZeroExperience — idempotently start everything a new member gets on
   * Day Zero. Split into two halves by what each actually needs:
   *
   *   The WELCOME half (no card — fires the moment the user is onboarded, during
   *   the free trial, so Ivy is aware of the member and reaches out):
   *     • Circle        — autoAssignToCircle (idempotent by design)
   *     • Welcome call  — one ONBOARDING call at a humane hour, if none exists
   *
   *   The MONEY half (needs a card on file — an off-session auth hold can't be
   *   placed without one):
   *     • Foundation Run— the flat-rate first stake cycle; opens once a card is on
   *                       file. Skipped if a cycle already exists, or deferred to
   *                       the Monday opener if too few days remain before reset.
   *
   * Called from two triggers — markUserAsOnboarded (welcome half) and the
   * subscription-created webhook (re-runs to add the money half once the card
   * lands). Every piece is independently idempotent, so both triggers firing
   * never double-fires. Coaches are skipped. Fire-and-forget safe.
   */
  async startDayZeroExperience(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, firstName: true, isOnboarded: true, phone: true, timezone: true,
        eveningCallTime: true, subscriptionTier: true, stakeWeeklyAmount: true,
        stripeSubscriptionId: true,
      },
    });
    if (!user) return;
    if (user.subscriptionTier === 'COACH') return; // coaches have no peer circle / personal stake

    // The welcome half needs only an onboarded user — NOT a card. This is the fix
    // for the "dead home / Ivy doesn't know I exist" gap: the circle + call no
    // longer wait behind Stripe checkout.
    if (!user.isOnboarded) {
      logger.info(`Day-Zero deferred for ${userId} (not onboarded yet)`);
      return;
    }

    const hasCard = !!user.stripeSubscriptionId;

    // ── WELCOME HALF (no card needed) ──────────────────────────────────────────

    // 1) Circle — idempotent.
    circleService.autoAssignToCircle(userId)
      .then((res) => {
        if (res) logger.info(`Circle assignment for ${userId}: ${res.circleId} (created=${res.created})`);
      })
      .catch((err) => logger.warn(`Failed to auto-assign circle for ${userId}:`, err));

    // 2) Welcome handoff — instead of silently booking a call, Ivy MESSAGES the
    // new member in chat the moment they're onboarded, offering agency: call now,
    // pick a time, or just text. The action buttons (chat.service handleAction)
    // drive the actual call scheduling / channel choice. Idempotent: skip if a
    // handoff already exists. No phone required — text-preferred users are served
    // entirely in chat. See docs/claude.md (Ivy chat + onboarding handoff).
    try {
      const existing = await prisma.message.findFirst({
        where: { userId, channel: 'IN_APP', messageType: 'onboarding_handoff' },
        select: { id: true },
      });
      if (!existing) {
        const name = user.firstName ? ` ${user.firstName}` : '';
        await chatService.postIvyMessage(
          userId,
          `Hey${name} — I'm Ivy, and I'm in your corner from here on. ` +
            `Quickest way to start is a short intro call so I get how you work. ` +
            `Want me to call you now, or pick a time? If you'd rather keep it to text, that's good too — I'll check in with you right here.`,
          {
            messageType: 'onboarding_handoff',
            metadata: { actions: ['call_now', 'schedule', 'just_text'] },
            notify: true,
          },
        );
        logger.info(`Onboarding handoff message posted for user ${userId}`);
      }
    } catch (err) {
      logger.warn(`Failed to post onboarding handoff for ${userId}:`, err);
    }

    // ── MONEY HALF (needs a card on file) ──────────────────────────────────────

    // 3) Foundation Run — the flat-rate first stake cycle. Opening it places an
    // off-session auth hold, which is impossible without a saved card, so this
    // only runs once the subscription (incl. trial card) exists. The
    // subscription-created webhook re-runs this method to reach here. No teeth on
    // day one, ends the coming Sunday; deferred to the Monday opener if too few
    // days remain (Sat/Sun signup). See docs/foundation-run-and-day-zero.md.
    if (!hasCard) {
      logger.info(`Foundation Run for ${userId} deferred until a card is on file (trial active)`);
      return;
    }

    if (user.stakeWeeklyAmount != null) {
      try {
        const priorCycle = await prisma.stakeCycle.findFirst({
          where: { userId, status: { not: 'FAILED' } },
          select: { id: true },
        });
        if (!priorCycle) {
          const { openFoundationCycle, computeFoundationWindow } = await import('./stake.service');
          const tz = user.timezone || 'Europe/London';
          const window = computeFoundationWindow(tz);
          if (!window) {
            logger.info(`Foundation Run for ${userId} deferred to Monday opener (too few days before reset)`);
          } else {
            await openFoundationCycle(userId, window);
            logger.info(`Foundation Run opened for ${userId} (days=${window.daysInCycle})`);
          }
        }
      } catch (err) {
        logger.warn(`Failed to open Foundation Run for ${userId}:`, err);
      }
    }
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

    // Create Streak record (idempotent — onboarding re-runs this as a safety net,
    // and create() would throw on the @unique userId).
    await prisma.streak.upsert({
      where: { userId },
      create: {
        userId,
        currentStreak: 0,
        longestStreak: 0,
      },
      update: {},  // never reset an existing streak
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
