import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import authService from './auth.service';

export interface CoachProfileInput {
  programmeName: string;
  coachingStyle?: string;
  programmeNotes?: string;
  whitelabelEnabled?: boolean;
  brandName?: string;
  brandLogoUrl?: string;
  alertOnMissedCalls?: number;
  weeklyDigestEnabled?: boolean;
}

class CoachService {
  // ── Profile ────────────────────────────────────────────────────────────────

  async getProfile(coachId: string) {
    return prisma.coachProfile.findUnique({ where: { userId: coachId } });
  }

  async upsertProfile(coachId: string, data: CoachProfileInput) {
    return prisma.coachProfile.upsert({
      where: { userId: coachId },
      create: { userId: coachId, ...data },
      update: data,
    });
  }

  // ── Clients ────────────────────────────────────────────────────────────────

  async getClients(coachId: string) {
    const clients = await prisma.user.findMany({
      where: { coachId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        track: true,
        goal: true,
        coachNotes: true,
        isOnboarded: true,
        lastCallAt: true,
        streaks: { select: { currentStreak: true, longestStreak: true } },
        calls: {
          where: { status: { in: ['COMPLETED', 'NO_ANSWER'] } },
          orderBy: { scheduledAt: 'desc' },
          take: 5,
          select: {
            callType: true,
            status: true,
            sentiment: true,
            scheduledAt: true,
            callSummary: true,
          },
        },
        inferredProfile: true,
      },
      orderBy: { firstName: 'asc' },
    });

    return clients.map((c) => ({
      ...c,
      currentStreak: c.streaks?.currentStreak ?? 0,
      lastCallSentiment: c.calls[0]?.sentiment ?? null,
      recentMissedCount: c.calls.filter((call) => call.status === 'NO_ANSWER').length,
      needsAttention: c.calls.filter((call) => call.status === 'NO_ANSWER').length >= 2
        || c.calls[0]?.sentiment === 'negative',
    }));
  }

  async getClientDetail(coachId: string, clientId: string) {
    const client = await prisma.user.findFirst({
      where: { id: clientId, coachId },
      include: {
        streaks: true,
        seasons: { orderBy: { number: 'desc' }, take: 1 },
        calls: {
          orderBy: { scheduledAt: 'desc' },
          take: 20,
          select: {
            id: true,
            callType: true,
            status: true,
            sentiment: true,
            scheduledAt: true,
            duration: true,
            callSummary: true,
            callInsights: true,
          },
        },
        callMemories: { orderBy: { createdAt: 'desc' }, take: 10 },
        transformationScores: { orderBy: { createdAt: 'desc' }, take: 5 },
        lifeMarkers: { orderBy: { createdAt: 'desc' }, take: 5 },
      },
    });

    if (!client) throw new NotFoundError('Client not found');
    return client;
  }

  async updateClientNotes(coachId: string, clientId: string, coachNotes: string) {
    const client = await prisma.user.findFirst({ where: { id: clientId, coachId } });
    if (!client) throw new NotFoundError('Client not found');
    return prisma.user.update({ where: { id: clientId }, data: { coachNotes } });
  }

  // ── Client invites ─────────────────────────────────────────────────────────

  async inviteClient(coachId: string, email: string) {
    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: { id: true, subscriptionTier: true, coachProfile: true },
    });
    if (!coach) throw new NotFoundError('Coach not found');

    const clientCount = await prisma.user.count({ where: { coachId } });
    // Soft limit check — frontend enforces the plan limit but we guard server-side too
    if (clientCount >= 20) throw new BadRequestError('Client limit reached for your plan');

    // Check if user already exists
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      // Link existing user to this coach
      if (existing.coachId && existing.coachId !== coachId) {
        throw new BadRequestError('This user already has a coach');
      }
      await prisma.user.update({
        where: { id: existing.id },
        data: {
          coachId,
          // Upgrade FREE users so they get daily calls — coach is paying
          subscriptionTier: existing.subscriptionTier === 'FREE' ? 'PRO' : existing.subscriptionTier,
        },
      });
      await authService.sendMagicLink(email);
      logger.info(`Existing user ${existing.id} linked to coach ${coachId}`);
      return { status: 'linked', email };
    }

    // New user — create stub and send coach-branded invite email
    // firstName/lastName left blank until client completes onboarding.
    // getUserContext guards against empty name — falls back to 'there' in messaging,
    // and the onboarding call fires before any personalised calls are scheduled.
    const stub = await prisma.user.create({
      data: {
        email,
        firstName: 'Friend', // placeholder — overwritten when client completes onboarding
        lastName: '',
        track: 'fitness',
        goal: '',
        coachId,
        subscriptionTier: 'PRO',
        isActive: true,
        isOnboarded: false,
      },
    });

    // Generate magic link URL and send coach-branded invite (white-label aware)
    const magicUrl = await authService.createMagicLinkUrl(email);
    const coachUser = await prisma.user.findUnique({
      where: { id: coachId },
      select: { firstName: true, coachProfile: true },
    });
    const profile = coachUser?.coachProfile as any;
    const brand = (profile?.whitelabelEnabled && profile?.brandName)
      ? { name: profile.brandName, logoUrl: profile.brandLogoUrl ?? null }
      : undefined;

    const { emailService } = await import('./email.service');
    await emailService.sendClientMagicLink({
      clientEmail: email,
      magicUrl,
      brand,
      coachName: brand ? undefined : coachUser?.firstName, // only show coach name if not white-labelled
    });

    logger.info(`Client invite sent to ${email} for coach ${coachId} — stub user ${stub.id}`);
    return { status: 'invited', email };
  }

  async removeClient(coachId: string, clientId: string) {
    const client = await prisma.user.findFirst({ where: { id: clientId, coachId } });
    if (!client) throw new NotFoundError('Client not found');
    await prisma.user.update({
      where: { id: clientId },
      data: {
        coachId: null,
        coachNotes: null,
        // Revert to FREE — coach is no longer covering their subscription
        subscriptionTier: 'FREE',
      },
    });
  }

  // ── Coach context for Ivy calls ────────────────────────────────────────────

  async getCoachContextForClient(userId: string): Promise<{
    coach_name: string | null;
    coach_programme: string | null;
    coach_notes: string | null;
    coach_style: string | null;
    brand_name: string | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        coachNotes: true,
        coach: {
          select: {
            firstName: true,
            coachProfile: {
              select: {
                programmeName: true,
                coachingStyle: true,
                programmeNotes: true,
                brandName: true,
                whitelabelEnabled: true,
              },
            },
          },
        },
      },
    });

    if (!user?.coach) {
      return { coach_name: null, coach_programme: null, coach_notes: null, coach_style: null, brand_name: null };
    }

    const profile = user.coach.coachProfile;
    return {
      coach_name: user.coach.firstName,
      coach_programme: profile?.programmeName ?? null,
      coach_notes: user.coachNotes ?? profile?.programmeNotes ?? null,
      coach_style: profile?.coachingStyle ?? null,
      brand_name: (profile?.whitelabelEnabled && profile?.brandName) ? profile.brandName : null,
    };
  }

  // ── PT weekly digest ───────────────────────────────────────────────────────

  async sendWeeklyDigestToAllCoaches() {
    const coaches = await prisma.user.findMany({
      where: {
        subscriptionTier: 'COACH',
        coachProfile: { weeklyDigestEnabled: true },
      },
      select: {
        id: true, firstName: true, email: true,
        coachProfile: { select: { brandName: true, whitelabelEnabled: true } },
      },
    });

    for (const coach of coaches) {
      await this.sendCoachDigest(coach).catch((err) =>
        logger.warn(`Coach digest failed for ${coach.id}`, err)
      );
    }
  }

  private async sendCoachDigest(coach: { id: string; firstName: string; email: string; coachProfile: any }) {
    const clients = await this.getClients(coach.id);
    if (clients.length === 0) return;

    const { emailService } = await import('./email.service');
    await emailService.sendCoachWeeklyDigest(coach, clients);
    logger.info(`Coach digest sent to ${coach.email} (${clients.length} clients)`);
  }

  // ── Alert: client missing calls ────────────────────────────────────────────

  async checkAndAlertCoach(clientId: string) {
    const client = await prisma.user.findUnique({
      where: { id: clientId },
      select: {
        id: true, firstName: true,
        coachId: true,
        coach: {
          select: {
            id: true, firstName: true, email: true,
            coachProfile: { select: { alertOnMissedCalls: true } },
          },
        },
      },
    });

    if (!client?.coach) return;

    const threshold = client.coach.coachProfile?.alertOnMissedCalls ?? 3;
    const recentCalls = await prisma.call.findMany({
      where: { userId: clientId },
      orderBy: { scheduledAt: 'desc' },
      take: threshold,
      select: { status: true },
    });

    const allMissed = recentCalls.length === threshold
      && recentCalls.every((c) => c.status === 'NO_ANSWER');

    if (allMissed) {
      const { emailService } = await import('./email.service');
      await emailService.sendCoachClientAlert(client.coach, client).catch(() => {});
    }
  }
}

export const coachService = new CoachService();
export default coachService;
