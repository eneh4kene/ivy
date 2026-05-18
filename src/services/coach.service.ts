import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import authService from './auth.service';
import { callScheduleQueue } from '../config/queues';
import crypto from 'crypto';

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
    programme_areas: string | null;
  }> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        coachNotes: true,
        programmeAreas: true,
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
      return { coach_name: null, coach_programme: null, coach_notes: null, coach_style: null, brand_name: null, programme_areas: null };
    }

    const profile = user.coach.coachProfile;
    return {
      coach_name: user.coach.firstName,
      coach_programme: profile?.programmeName ?? null,
      coach_notes: user.coachNotes ?? profile?.programmeNotes ?? null,
      coach_style: profile?.coachingStyle ?? null,
      brand_name: (profile?.whitelabelEnabled && profile?.brandName) ? profile.brandName : null,
      programme_areas: (() => {
        const areas = Array.isArray(user.programmeAreas) ? user.programmeAreas as any[] : [];
        return areas.length > 0 ? areas.map((a: any) => `${a.area}: ${a.instruction}`).join('\n') : null;
      })(),
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

  // ── Programme areas ────────────────────────────────────────────────────────

  async updateProgrammeAreas(coachId: string, clientId: string, areas: Array<{ id: string; area: string; instruction: string }>) {
    const client = await prisma.user.findFirst({ where: { id: clientId, coachId } });
    if (!client) throw new NotFoundError('Client not found');
    return prisma.user.update({ where: { id: clientId }, data: { programmeAreas: areas as any } });
  }

  // ── Ponder sessions ────────────────────────────────────────────────────────

  async generatePonderBrief(coachId: string): Promise<string> {
    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: { firstName: true },
    });

    const clients = await prisma.user.findMany({
      where: { coachId },
      include: {
        streaks: { select: { currentStreak: true } },
        calls: {
          where: { scheduledAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) } },
          orderBy: { scheduledAt: 'desc' },
          select: { callType: true, status: true, sentiment: true, callSummary: true, scheduledAt: true },
        },
        callMemories: { orderBy: { createdAt: 'desc' }, take: 3, select: { content: true, category: true } },
      },
      orderBy: { firstName: 'asc' },
    });

    const completedCalls = (c: any) => c.calls.filter((call: any) => call.status === 'COMPLETED').length;

    const isAtRisk = (c: any) => {
      const recent = c.calls.slice(0, 5);
      const missedCount = recent.filter((call: any) => call.status === 'NO_ANSWER').length;
      return missedCount >= 2 || recent[0]?.sentiment === 'negative';
    };

    const needsAttention = clients.filter(isAtRisk);
    const onTrack = clients.filter((c) => !isAtRisk(c));

    const formatDetailed = (c: any) => {
      const areas: any[] = Array.isArray(c.programmeAreas) ? c.programmeAreas : [];
      const areaLine = areas.length > 0
        ? `Programme areas: ${areas.map((a: any) => a.area).join(' · ')}`
        : 'No programme areas set';
      const lastSummary = c.calls.find((call: any) => call.callSummary)?.callSummary ?? null;
      const memories = c.callMemories.map((m: any) => m.content).join(' | ');
      return [
        `[${c.firstName} ${c.lastName}] — ${c.track} track`,
        areaLine,
        `Fortnight: ${completedCalls(c)}/${c.calls.length} calls | streak: ${c.streaks?.currentStreak ?? 0} days`,
        lastSummary ? `Last call: "${lastSummary.slice(0, 120)}"` : 'No completed calls yet',
        memories ? `Ivy remembers: ${memories}` : '',
      ].filter(Boolean).join('\n');
    };

    const formatBrief = (c: any) =>
      `[${c.firstName} ${c.lastName}] — ${c.track} — ${completedCalls(c)}/${c.calls.length} calls — ${c.streaks?.currentStreak ?? 0} day streak`;

    const lines = [
      `You are Ivy, calling ${coach?.firstName ?? 'Coach'} for your biweekly coaching ponder session.`,
      `This is a working session, not a report. Be a thought partner.`,
      '',
      `ROSTER: ${clients.length} clients | ${needsAttention.length} need attention | ${onTrack.length} on track`,
      '',
    ];

    if (needsAttention.length > 0) {
      lines.push('── NEEDS ATTENTION (lead with these) ──────────────────────');
      for (const c of needsAttention) { lines.push(formatDetailed(c)); lines.push(''); }
    }
    if (onTrack.length > 0) {
      lines.push('── ON TRACK ────────────────────────────────────────────────');
      for (const c of onTrack) lines.push(formatBrief(c));
      lines.push('');
    }

    lines.push(
      '── HOW TO RUN THIS SESSION ─────────────────────────────────',
      '- Lead with flagged clients. Share what you have been observing in their calls.',
      '- Let the coach redirect to any client at any time.',
      '- Share patterns — tone, avoidance, what resonates, what does not.',
      '- If the coach adjusts a programme area, confirm it out loud: "Got it — noted."',
      '- At the end, summarise the key decisions made.',
      '- Keep it under 10 minutes unless the coach wants to go deeper.',
      '',
      'After this call, you will send a WhatsApp summary of decisions to this number.',
    );

    return lines.join('\n');
  }

  async schedulePonderCallsForDueCoaches() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const ch = now.getHours();
    const cm = now.getMinutes();

    const coaches = await prisma.user.findMany({
      where: {
        subscriptionTier: 'COACH',
        isActive: true,
        phone: { not: null },
        coachProfile: {
          ponderCallEnabled: true,
          ponderCallDay: dayOfWeek,
        },
      },
      select: {
        id: true, firstName: true, phone: true,
        coachProfile: { select: { ponderCallTime: true } },
      },
    });

    for (const coach of coaches) {
      const ponderTime = coach.coachProfile?.ponderCallTime;
      if (!ponderTime) continue;

      const [ph, pm] = ponderTime.split(':').map(Number);
      const diffMins = Math.abs((ch * 60 + cm) - (ph * 60 + pm));
      if (diffMins > 30) continue;

      const lastPonder = await prisma.call.findFirst({
        where: { userId: coach.id, callType: 'COACH_PONDER' },
        orderBy: { scheduledAt: 'desc' },
        select: { scheduledAt: true },
      });

      if (lastPonder) {
        const daysSince = (now.getTime() - lastPonder.scheduledAt.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSince < 13) continue;
      }

      await this.initiateCoachPonderCall(coach as { id: string; firstName: string; phone: string }).catch((err) =>
        logger.warn(`Ponder call failed for coach ${coach.id}:`, err)
      );
    }
  }

  private async initiateCoachPonderCall(coach: { id: string; firstName: string; phone: string }) {
    const call = await prisma.call.create({
      data: {
        userId: coach.id,
        callType: 'COACH_PONDER',
        scheduledAt: new Date(),
        status: 'SCHEDULED',
      },
    });

    await callScheduleQueue.add('initiate-call', {
      callId: call.id,
      userId: coach.id,
      callType: 'COACH_PONDER',
      phone: coach.phone,
      userName: coach.firstName,
    });

    logger.info(`Coach ponder call initiated for coach ${coach.id} — call ${call.id}`);
    return call;
  }

  async extractAndApplyProgrammeUpdates(coachId: string, callSummary: string) {
    const clients = await prisma.user.findMany({
      where: { coachId },
      select: { id: true, firstName: true, lastName: true, programmeAreas: true },
    });
    if (clients.length === 0 || !callSummary.trim()) return;

    const clientList = clients.map((c) => `${c.firstName} ${c.lastName} (id: ${c.id})`).join('\n');

    let Anthropic: any;
    try {
      Anthropic = (await import('@anthropic-ai/sdk')).default;
    } catch { return; }

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

    let text = '[]';
    try {
      const msg = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `A coaching ponder session just ended. Extract any programme area updates the coach requested.\n\nClients:\n${clientList}\n\nCall summary:\n${callSummary}\n\nReturn JSON array: [{ "clientId": "<id>", "area": "<area name>", "instruction": "<new instruction>" }]\nIf the coach asked to remove an area, set instruction to "REMOVE".\nIf no updates, return [].\nOnly return the JSON.`,
        }],
      });
      text = msg.content[0].type === 'text' ? msg.content[0].text.trim() : '[]';
    } catch { return; }

    let updates: Array<{ clientId: string; area: string; instruction: string }> = [];
    try { updates = JSON.parse(text); } catch { return; }
    if (!Array.isArray(updates) || updates.length === 0) return;

    for (const update of updates) {
      const client = clients.find((c) => c.id === update.clientId);
      if (!client) continue;

      const areas: Array<{ id: string; area: string; instruction: string }> =
        Array.isArray(client.programmeAreas) ? (client.programmeAreas as any) : [];

      const existing = areas.findIndex((a) => a.area.toLowerCase() === update.area.toLowerCase());
      if (update.instruction === 'REMOVE') {
        if (existing !== -1) areas.splice(existing, 1);
      } else if (existing !== -1) {
        areas[existing].instruction = update.instruction;
      } else {
        areas.push({ id: crypto.randomUUID(), area: update.area, instruction: update.instruction });
      }

      await prisma.user.update({ where: { id: client.id }, data: { programmeAreas: areas as any } });
    }

    logger.info(`Ponder: applied ${updates.length} programme area update(s) for coach ${coachId}`);
  }
}

export const coachService = new CoachService();
export default coachService;
