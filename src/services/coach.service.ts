import Anthropic from '@anthropic-ai/sdk';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { opsAlert } from '../lib/ops-alert';
import { serverAnalytics } from '../lib/analytics';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { parseModelJson } from '../utils/model-json';
import authService from './auth.service';
import { logUsage } from './usage.service';
import { inngest } from '../inngest/client';
import crypto from 'crypto';
import { config } from '../config';

// Trial calls spend real Retell + Twilio money on an unpaid account. Two is
// enough to judge the product; more is someone using us as a free phone line.
const TRIAL_CALL_CAP = 2;

/**
 * Drafts starter notes a coach keeps on a client, for Ivy to read before every
 * call. The coach is staring at a blank box; Ivy has been running the client's
 * daily accountability and knows their record. Groundedness is the hard rule —
 * these notes steer real calls, so an invented injury or preference would put a
 * lie in front of the client. Everything else is style.
 */
const DRAFT_NOTES_SYSTEM = `You draft starter notes a coach keeps on one of their clients. These notes are read by Ivy — the AI that runs the client's daily accountability (morning voice notes, evening check-ins, the money on the line) — before every call. The coach is looking at a blank notes box; you've been running this client's accountability and know their record.

Rules:
- Ground every claim strictly in the data provided (their goal, track, call history, what Ivy remembers). Never invent injuries, numbers, events, or preferences that aren't supported. If the client is new with little history, keep it short and factual rather than padding.
- Write in the coach's own voice, as practical notes ABOUT the client for Ivy to act on — not a message to the client, not a report back to the coach. Plain and useful, a few short sentences or lines.
- Where the data supports it, cover: what they're working toward, how they respond or what motivates them, any pattern worth watching (a weak day, missed calls, a recurring obstacle), and anything to avoid.
- These are an editable starting point the coach will refine before saving. Aim for true and useful over polished. No hype, no emoji, no headings.

Return ONLY raw JSON, no markdown, no explanation: {"notes": "..."}`;

export interface CoachProfileInput {
  programmeName: string;
  discipline?: string;
  coachingStyle?: string;
  programmeNotes?: string;
  whitelabelEnabled?: boolean;
  brandName?: string;
  brandLogoUrl?: string;
  alertOnMissedCalls?: number;
  weeklyDigestEnabled?: boolean;
}

class CoachService {
  private anthropic: Anthropic | null = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

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
        isActive: true,
        subscriptionStatus: true,
        subscriptionTier: true,
        lastCallAt: true,
        telegramChatId: true,
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

  /**
   * "Draft with Ivy" — seed the blank client-notes box from what Ivy already
   * knows about the client (goal, track, recent calls, what she remembers).
   * Editable text only; the coach reviews and saves. Refuses when there's no
   * real history yet, rather than inventing a client.
   */
  async draftClientNotes(coachId: string, clientId: string): Promise<{ notes: string }> {
    if (!this.anthropic) throw new BadRequestError('Drafting is not available right now — write what you know in your own words.');

    const client = await prisma.user.findFirst({
      where: { id: clientId, coachId },
      include: {
        streaks: { select: { currentStreak: true } },
        calls: {
          where: { scheduledAt: { gte: new Date(Date.now() - 28 * 24 * 60 * 60 * 1000) } },
          orderBy: { scheduledAt: 'desc' },
          take: 12,
          select: { status: true, sentiment: true, callSummary: true, callInsights: true, scheduledAt: true },
        },
        callMemories: {
          orderBy: { createdAt: 'desc' },
          take: 8,
          select: { content: true, category: true },
        },
      },
    });
    if (!client) throw new NotFoundError('Client not found');

    const completed = client.calls.filter((c) => c.status === 'COMPLETED');
    const missedCount = client.calls.filter((c) => c.status === 'NO_ANSWER').length;
    const summaries = completed.map((c) => c.callSummary?.trim()).filter((s): s is string => !!s).slice(0, 4);

    const insightLines = client.calls.flatMap((c) => {
      const ins = c.callInsights as { key_insight?: string; obstacles_mentioned?: string[]; emotional_state?: string } | null;
      if (!ins) return [];
      const parts: string[] = [];
      if (ins.key_insight) parts.push(ins.key_insight);
      if (ins.obstacles_mentioned?.length) parts.push(`obstacles: ${ins.obstacles_mentioned.join('; ')}`);
      if (ins.emotional_state) parts.push(`mood: ${ins.emotional_state}`);
      return parts.length ? [`${c.scheduledAt?.toISOString().slice(0, 10)}: ${parts.join(' · ')}`] : [];
    });
    const memoryLines = client.callMemories.map((m) => `[${m.category}] ${m.content}`);

    // Nothing real to draw from → refuse rather than invent a client history.
    if (!client.goal && summaries.length === 0 && insightLines.length === 0 && memoryLines.length === 0) {
      throw new BadRequestError('Not enough history to draft from yet — Ivy will have more to go on after a few calls with this client.');
    }

    const brief = [
      `Client: ${client.firstName} ${client.lastName ?? ''} · track: ${client.track ?? 'unknown'} · goal: ${client.goal || 'not set yet'}`,
      `Last 28 days: ${completed.length} completed call${completed.length === 1 ? '' : 's'}${missedCount ? `, ${missedCount} missed` : ''}; current streak ${client.streaks?.currentStreak ?? 0} days.`,
      summaries.length ? `Recent call summaries:\n${summaries.map((s) => `- ${s.slice(0, 200)}`).join('\n')}` : '',
      insightLines.length ? `From Ivy's call insights:\n${insightLines.join('\n')}` : '',
      memoryLines.length ? `Things Ivy remembers about them:\n${memoryLines.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const res = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 400,
      system: [{ type: 'text', text: DRAFT_NOTES_SYSTEM, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: brief }],
    });
    logUsage('anthropic', 'haiku_tokens', (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), coachId, { op: 'coach_notes_draft' }).catch(() => {});

    const raw = res.content[0]?.type === 'text' ? res.content[0].text.trim() : null;
    if (!raw) throw new BadRequestError("Couldn't draft notes — write what you know in your own words.");
    const parsed = parseModelJson<{ notes?: unknown }>(raw);
    const notes = typeof parsed.notes === 'string' ? parsed.notes.trim().slice(0, 1500) : '';
    if (!notes) throw new BadRequestError("Couldn't draft notes — write what you know in your own words.");

    logger.info(`Client notes drafted for coach ${coachId} client ${clientId} (summaries: ${summaries.length}, insights: ${insightLines.length}, memories: ${memoryLines.length})`);
    return { notes };
  }

  // ── Shareable invite link ──────────────────────────────────────────────────

  async getOrCreateInviteToken(coachId: string): Promise<string> {
    const profile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      select: { inviteToken: true },
    });
    if (!profile) throw new NotFoundError('Coach profile not found');
    if (profile.inviteToken) return profile.inviteToken;

    const token = crypto.randomBytes(16).toString('hex');
    await prisma.coachProfile.update({
      where: { userId: coachId },
      data: { inviteToken: token },
    });
    return token;
  }

  async resetInviteToken(coachId: string): Promise<string> {
    const token = crypto.randomBytes(16).toString('hex');
    await prisma.coachProfile.update({
      where: { userId: coachId },
      data: { inviteToken: token },
    });
    return token;
  }

  async resolveInviteToken(token: string) {
    const profile = await prisma.coachProfile.findUnique({
      where: { inviteToken: token },
      select: {
        programmeName: true,
        brandName: true,
        brandLogoUrl: true,
        whitelabelEnabled: true,
        user: { select: { id: true, firstName: true } },
      },
    });
    if (!profile) throw new NotFoundError('Invite link not found or has been reset');
    return {
      coachId: profile.user.id,
      coachName: profile.user.firstName,
      programmeName: profile.programmeName,
      displayName: (profile.whitelabelEnabled && profile.brandName) ? profile.brandName : null,
      logoUrl: (profile.whitelabelEnabled && profile.brandLogoUrl) ? profile.brandLogoUrl : null,
    };
  }

  async joinViaInviteToken(token: string, email: string): Promise<void> {
    const info = await this.resolveInviteToken(token);
    const coachId = info.coachId;
    serverAnalytics.coachInviteJoinRequested(`email:${email.toLowerCase()}`, coachId);

    const { emailService } = await import('./email.service');
    const profile = await prisma.coachProfile.findUnique({
      where: { userId: coachId },
      select: { brandName: true, brandLogoUrl: true, whitelabelEnabled: true },
    }) as any;
    const brand = (profile?.whitelabelEnabled && profile?.brandName)
      ? { name: profile.brandName, logoUrl: profile.brandLogoUrl ?? null }
      : undefined;

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      if (existing.coachId === coachId) {
        // Already in this programme — just send a magic link to log in
        await authService.sendMagicLink(email);
        return;
      }
      if (existing.coachId && existing.coachId !== coachId) {
        throw new BadRequestError('You already have a coach on Ivy');
      }
      // Existing user, no coach yet — set pending invite, they accept on verify
      await prisma.user.update({
        where: { id: existing.id },
        data: { pendingCoachId: coachId },
      });
      const magicUrl = await authService.createMagicLinkUrl(email);
      await emailService.sendClientMagicLink({
        clientEmail: email, magicUrl, brand, coachName: brand ? undefined : info.coachName,
      });
      return;
    }

    // Brand new user — create stub, they'll go through pricing themselves
    await prisma.user.create({
      data: {
        email,
        firstName: 'Friend',
        lastName: '',
        track: 'fitness',
        goal: '',
        coachId,
        coachLinkedAt: new Date(),
        isActive: true,
        isOnboarded: false,
      },
    });
    const magicUrl = await authService.createMagicLinkUrl(email);
    await emailService.sendClientMagicLink({
      clientEmail: email, magicUrl, brand, coachName: brand ? undefined : info.coachName,
    });
  }

  // ── Client invites ─────────────────────────────────────────────────────────

  async inviteClient(coachId: string, email: string) {
    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: { id: true, subscriptionTier: true, firstName: true, coachProfile: true },
    });
    if (!coach) throw new NotFoundError('Coach not found');

    const profile = coach.coachProfile as any;
    const brand = (profile?.whitelabelEnabled && profile?.brandName)
      ? { name: profile.brandName, logoUrl: profile.brandLogoUrl ?? null }
      : undefined;
    const { emailService } = await import('./email.service');

    const existing = await prisma.user.findUnique({ where: { email } });

    if (existing) {
      // Already fully linked to this coach — idempotent
      if (existing.coachId === coachId) return { status: 'already_linked', email };
      // Already linked to a different coach
      if (existing.coachId && existing.coachId !== coachId) {
        throw new BadRequestError('This user already has a coach');
      }
      // Pending invite from this coach already sent
      if (existing.pendingCoachId === coachId) return { status: 'pending', email };

      // Existing Ivy user — set a pending invite and let THEM accept.
      // We do not change their tier or link them yet.
      await prisma.user.update({
        where: { id: existing.id },
        data: { pendingCoachId: coachId },
      });

      // Send coach-branded magic link — consent screen shown on verify page
      const magicUrl = await authService.createMagicLinkUrl(email);
      await emailService.sendClientMagicLink({
        clientEmail: email,
        magicUrl,
        brand,
        coachName: brand ? undefined : coach.firstName,
      });

      logger.info(`Pending coach invite sent to existing user ${existing.id} from coach ${coachId}`);
      return { status: 'pending', email };
    }

    // Brand new user — create a minimal stub. They pay their own way through
    // the normal pricing/checkout flow; the coach just gets them in the door.
    await prisma.user.create({
      data: {
        email,
        firstName: 'Friend', // placeholder — overwritten when client completes onboarding
        lastName: '',
        track: 'fitness',
        goal: '',
        coachId,
        coachLinkedAt: new Date(),
        isActive: true,
        isOnboarded: false,
      },
    });

    const magicUrl = await authService.createMagicLinkUrl(email);
    await emailService.sendClientMagicLink({
      clientEmail: email,
      magicUrl,
      brand,
      coachName: brand ? undefined : coach.firstName,
    });

    logger.info(`New client stub created and invite sent to ${email} for coach ${coachId}`);
    return { status: 'invited', email };
  }

  async acceptCoachInvite(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, pendingCoachId: true },
    });
    if (!user?.pendingCoachId) throw new BadRequestError('No pending coach invite');

    await prisma.user.update({
      where: { id: userId },
      data: {
        coachId: user.pendingCoachId,
        coachLinkedAt: new Date(),
        pendingCoachId: null,
      },
    });

    serverAnalytics.coachClientLinked(userId, user.pendingCoachId, 'invite_accept');

    // An already-onboarded user linking to a coach can be the activation that
    // tips the book over the coach-circle threshold — check now, since their
    // Day-Zero (the usual trigger) already ran. Fire-and-forget.
    import('./circle.service')
      .then(({ default: circleService }) => circleService.ensureCoachCircle(user.pendingCoachId!))
      .catch((err) => logger.warn(`ensureCoachCircle failed after link for ${userId}:`, err));
  }

  async declineCoachInvite(userId: string): Promise<void> {
    await prisma.user.update({
      where: { id: userId },
      data: { pendingCoachId: null },
    });
  }

  async removeClient(coachId: string, clientId: string) {
    const client = await prisma.user.findFirst({ where: { id: clientId, coachId } });
    if (!client) throw new NotFoundError('Client not found');
    await this._unlinkClient(client);
  }

  async leaveCoach(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, coachId: true, pendingCoachId: true },
    });
    if (!user) throw new NotFoundError('User not found');
    if (user.pendingCoachId) {
      await this.declineCoachInvite(userId);
      return;
    }
    if (!user.coachId) throw new BadRequestError('You are not in a coach programme');
    await this._unlinkClient(user);
  }

  private async _unlinkClient(client: { id: string }): Promise<void> {
    // Subscriptions are fully independent of the coach relationship.
    // Unlinking only removes the coaching overlay — billing and access are untouched.
    // The user reverts to standard Ivy around their own goals until their subscription expires.
    await prisma.user.update({
      where: { id: client.id },
      data: {
        coachId: null,
        coachNotes: null,
        programmeAreas: { set: [] },
        coachLinkedAt: null,
      },
    });

    // Leaving the coach also means leaving the coach's circle — re-seat them
    // in a peer pod so they're never circle-less. Fire-and-forget.
    (async () => {
      const { default: circleService } = await import('./circle.service');
      const coachCircles = await prisma.ivyCircleMember.findMany({
        where: { userId: client.id, isActive: true, circle: { coachId: { not: null } } },
        select: { circleId: true },
      });
      for (const m of coachCircles) {
        await circleService.removeMember(m.circleId, client.id);
      }
      if (coachCircles.length > 0) {
        await circleService.autoAssignToCircle(client.id);
      }
    })().catch((err) => logger.warn(`Coach-circle unlink cleanup failed for ${client.id}:`, err));
  }

  // ── Coach context for Ivy calls ────────────────────────────────────────────

  async getCoachContextForClient(userId: string): Promise<{
    coach_name: string | null;
    coach_programme: string | null;
    coach_notes: string | null;
    coach_style: string | null;
    coach_discipline: string | null;
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
                discipline: true,
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
      return { coach_name: null, coach_programme: null, coach_notes: null, coach_style: null, coach_discipline: null, brand_name: null, programme_areas: null };
    }

    const profile = user.coach.coachProfile;
    return {
      coach_name: user.coach.firstName,
      coach_programme: profile?.programmeName ?? null,
      coach_notes: user.coachNotes ?? profile?.programmeNotes ?? null,
      coach_style: profile?.coachingStyle ?? null,
      coach_discipline: profile?.discipline ?? null,
      brand_name: (profile?.whitelabelEnabled && profile?.brandName) ? profile.brandName : null,
      programme_areas: (() => {
        const areas = Array.isArray(user.programmeAreas) ? user.programmeAreas as any[] : [];
        return areas.length > 0 ? areas.map((a: any) => `${a.area}: ${a.instruction}`).join('\n') : null;
      })(),
    };
  }

  // ── PT weekly digest ───────────────────────────────────────────────────────

  /**
   * Group pulse — the coach's whole book as one number: % of planned days
   * kept (COMPLETED/PARTIAL over planned workouts, same semantics as circle
   * group-consistency) this week vs last, plus who's carrying the group and
   * the coach circle if one has formed.
   */
  async getBookPulse(coachId: string) {
    const clients = await prisma.user.findMany({
      where: { coachId, isOnboarded: true, isActive: true },
      select: { id: true, firstName: true },
    });

    const circle = await prisma.ivyCircle.findFirst({
      where: { coachId, isActive: true },
      select: { id: true, name: true, size: true },
    });

    if (clients.length === 0) {
      return { rate: null, prevRate: null, activeClients: 0, topPerformers: [], circle };
    }

    const now = Date.now();
    const weekAgo = new Date(now - 7 * 86_400_000);
    const twoWeeksAgo = new Date(now - 14 * 86_400_000);
    const userIds = clients.map((c) => c.id);

    const workouts = await prisma.workout.findMany({
      where: { userId: { in: userIds }, plannedDate: { gte: twoWeeksAgo } },
      select: { userId: true, status: true, plannedDate: true },
    });

    const kept = (s: string) => s === 'COMPLETED' || s === 'PARTIAL';
    const thisWeek = workouts.filter((w) => w.plannedDate >= weekAgo);
    const lastWeek = workouts.filter((w) => w.plannedDate < weekAgo);
    const rateOf = (ws: typeof workouts) =>
      ws.length > 0 ? Math.round((ws.filter((w) => kept(w.status)).length / ws.length) * 100) : null;

    // Who's carrying the group this week (min 2 planned days to qualify)
    const byUser = new Map<string, { kept: number; total: number }>();
    for (const w of thisWeek) {
      const e = byUser.get(w.userId) ?? { kept: 0, total: 0 };
      e.total++;
      if (kept(w.status)) e.kept++;
      byUser.set(w.userId, e);
    }
    const topPerformers = [...byUser.entries()]
      .filter(([, e]) => e.total >= 2)
      .sort((a, b) => b[1].kept / b[1].total - a[1].kept / a[1].total)
      .slice(0, 3)
      .map(([id]) => clients.find((c) => c.id === id)?.firstName)
      .filter(Boolean) as string[];

    return {
      rate: rateOf(thisWeek),
      prevRate: rateOf(lastWeek),
      activeClients: clients.length,
      topPerformers,
      circle,
    };
  }

  /**
   * getKeepRateReport — the coach's proof artifact: "my clients' keep-rate."
   *
   * Where getBookPulse is the coach's week-ops view, this is the shop window —
   * a 28-day kept-days percentage across the book plus a per-client breakdown,
   * built only from settled reality (past planned days), never future plans.
   * First names only; this may be read aloud or screenshotted by the coach.
   */
  async getKeepRateReport(coachId: string) {
    const clients = await prisma.user.findMany({
      where: { coachId, isOnboarded: true, isActive: true },
      select: { id: true, firstName: true },
    });
    if (clients.length === 0) {
      return { windowDays: 28, bookRate: null, keptDays: 0, totalDays: 0, clients: [] };
    }

    const windowStart = new Date(Date.now() - 28 * 86_400_000);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const workouts = await prisma.workout.findMany({
      // plannedDate < today: only days whose outcome is real — a future PLANNED
      // day is not an unkept day.
      where: {
        userId: { in: clients.map((c) => c.id) },
        plannedDate: { gte: windowStart, lt: today },
      },
      select: { userId: true, status: true },
    });

    const kept = (s: string) => s === 'COMPLETED' || s === 'PARTIAL';
    const byUser = new Map<string, { kept: number; total: number }>();
    for (const w of workouts) {
      const e = byUser.get(w.userId) ?? { kept: 0, total: 0 };
      e.total++;
      if (kept(w.status)) e.kept++;
      byUser.set(w.userId, e);
    }

    let keptDays = 0;
    let totalDays = 0;
    const perClient = clients
      .map((c) => {
        const e = byUser.get(c.id) ?? { kept: 0, total: 0 };
        keptDays += e.kept;
        totalDays += e.total;
        return {
          id: c.id,
          firstName: c.firstName,
          keptDays: e.kept,
          totalDays: e.total,
          rate: e.total > 0 ? Math.round((e.kept / e.total) * 100) : null,
        };
      })
      .sort((a, b) => (b.rate ?? -1) - (a.rate ?? -1));

    return {
      windowDays: 28,
      bookRate: totalDays > 0 ? Math.round((keptDays / totalDays) * 100) : null,
      keptDays,
      totalDays,
      clients: perClient,
    };
  }

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
        opsAlert({ severity: 'warn', source: 'coach-digest', title: 'digest_send_failed', userId: coach.id, error: err })
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

    // Stamp changed/new areas so the client's Plan view can say "updated today"
    // per area, and diff against what was stored to decide whether anything
    // actually changed (no change → no notification).
    const prev: Array<{ id: string; area: string; instruction: string; updatedAt?: string }> =
      Array.isArray(client.programmeAreas) ? (client.programmeAreas as any) : [];
    const now = new Date().toISOString();
    let changed = prev.length !== areas.length;
    const stamped = areas.map((a) => {
      const old = prev.find((p) => p.id === a.id);
      if (old && old.area === a.area && old.instruction === a.instruction) {
        return { ...a, updatedAt: old.updatedAt ?? now, updatedBy: (old as any).updatedBy ?? 'coach' };
      }
      changed = true;
      return { ...a, updatedAt: now, updatedBy: 'coach' };
    });

    const updated = await prisma.user.update({
      where: { id: clientId },
      data: { programmeAreas: stamped as any },
    });

    if (changed) {
      inngest.send({
        name: 'programme/updated',
        data: { clientId, coachId, source: 'coach' },
      }).catch((err) => logger.warn(`programme/updated event failed for ${clientId}:`, err));
    }
    return updated;
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

    // Data only — the conversational framing and session-running rules live in
    // buildPonderPrompt (prompt.service), which wraps this brief. Duplicating
    // instructions here made the composed prompt contradict itself.
    const lines = [
      `YOUR NOTES ON ${(coach?.firstName ?? 'the coach').toUpperCase()}'S ROSTER (${clients.length} client${clients.length === 1 ? '' : 's'} — ${needsAttention.length} need attention, ${onTrack.length} on track):`,
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
      'After this call, any programme changes the coach agreed are extracted from the transcript and applied automatically, and the coach receives a written summary — you can promise both.',
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
        coachProfile: { select: { ponderCallTime: true, ponderCallFrequency: true } },
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
        const minGap = coach.coachProfile?.ponderCallFrequency === 'fortnightly' ? 13 : 6;
        if (daysSince < minGap) continue;
      }

      await this.initiateCoachPonderCall(coach as { id: string; firstName: string; phone: string }).catch((err) =>
        opsAlert({
          severity: 'warn',
          source: 'ponder-scheduler',
          title: 'ponder_call_failed',
          detail: 'a coach expected their ponder call this window and it was not initiated',
          userId: coach.id,
          error: err,
        })
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

    await inngest.send({
      name: 'call/scheduled',
      data: {
        callId: call.id,
        userId: coach.id,
        callType: 'COACH_PONDER',
        phone: coach.phone,
        userName: coach.firstName,
        scheduledAt: new Date().toISOString(),
      },
    });

    logger.info(`Coach ponder call initiated for coach ${coach.id} — call ${call.id}`);
    serverAnalytics.ponderCallScheduled(coach.id);
    return call;
  }

  /**
   * Extract programme changes the coach stated (in a ponder call summary or a
   * chat message) and apply them. Returns what was applied so the caller can
   * confirm precisely (chat) or summarise (ponder). Emits programme/updated
   * per affected client for the delayed client notification.
   */
  async extractAndApplyProgrammeUpdates(
    coachId: string,
    callSummary: string,
    source: 'ponder' | 'chat' = 'ponder',
  ): Promise<Array<{ clientId: string; clientName: string; area: string; instruction: string }>> {
    const clients = await prisma.user.findMany({
      where: { coachId },
      select: { id: true, firstName: true, lastName: true, programmeAreas: true },
    });
    if (clients.length === 0 || !callSummary.trim()) return [];

    const clientList = clients.map((c) => `${c.firstName} ${c.lastName} (id: ${c.id})`).join('\n');

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
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
    } catch (err) {
      await opsAlert({
        severity: 'critical',
        source: 'coach-ponder',
        title: 'programme_extraction_failed',
        detail: 'updates the coach stated on this call were NOT applied to any client',
        userId: coachId,
        error: err,
      });
      return [];
    }

    // Models sometimes wrap JSON in ``` fences despite instructions.
    const jsonText = text.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');

    let updates: Array<{ clientId: string; area: string; instruction: string }> = [];
    try {
      updates = JSON.parse(jsonText);
    } catch {
      await opsAlert({
        severity: 'critical',
        source: 'coach-ponder',
        title: 'programme_parse_failed',
        detail: `updates NOT applied — raw model output: ${text.slice(0, 300)}`,
        userId: coachId,
      });
      return [];
    }
    if (!Array.isArray(updates) || updates.length === 0) return [];

    const now = new Date().toISOString();
    const applied: Array<{ clientId: string; clientName: string; area: string; instruction: string }> = [];
    const touchedClients = new Set<string>();

    for (const update of updates) {
      const client = clients.find((c) => c.id === update.clientId);
      if (!client) continue;

      const areas: Array<{ id: string; area: string; instruction: string; updatedAt?: string; updatedBy?: string }> =
        Array.isArray(client.programmeAreas) ? (client.programmeAreas as any) : [];

      const existing = areas.findIndex((a) => a.area.toLowerCase() === update.area.toLowerCase());
      if (update.instruction === 'REMOVE') {
        if (existing !== -1) areas.splice(existing, 1);
      } else if (existing !== -1) {
        areas[existing].instruction = update.instruction;
        areas[existing].updatedAt = now;
        areas[existing].updatedBy = 'ivy';
      } else {
        areas.push({ id: crypto.randomUUID(), area: update.area, instruction: update.instruction, updatedAt: now, updatedBy: 'ivy' });
      }

      await prisma.user.update({ where: { id: client.id }, data: { programmeAreas: areas as any } });
      applied.push({ clientId: client.id, clientName: `${client.firstName} ${client.lastName}`.trim(), area: update.area, instruction: update.instruction });
      touchedClients.add(client.id);
    }

    for (const clientId of touchedClients) {
      serverAnalytics.programmeUpdated(clientId, source);
      inngest.send({
        name: 'programme/updated',
        data: { clientId, coachId, source },
      }).catch((err) => logger.warn(`programme/updated event failed for ${clientId}:`, err));
    }

    if (source === 'ponder') serverAnalytics.ponderCompleted(coachId, applied.length);
    logger.info(`Programme updates (${source}): applied ${applied.length} for coach ${coachId}`);
    return applied;
  }

  /**
   * "Try it first" — place ONE real client-style call to a prospective coach.
   *
   * The coach funnel asked for £79/mo before showing anything the product does.
   * A coach signed up in July, hit that wall, stopped, and five weeks later
   * asked to experience it first-hand for a funding application — the exact
   * thing the paywall withheld. A coach cannot sell what they have never felt,
   * so this puts the experience before the price.
   *
   * It runs the SAME pipeline as a real client call (real context, real Haiku
   * brief, real composed prompt), because a mock would prove nothing about the
   * product they are being asked to buy.
   *
   * The trial client is deliberately inert: no eveningCallTime and no arming
   * window, so no scheduler ever picks it up. It exists only to hang a call and
   * its transcript on.
   */
  async placeTrialCall(coachId: string, phone: string): Promise<{ callId: string; retellCallId: string }> {
    const coach = await prisma.user.findUnique({
      where: { id: coachId },
      select: { id: true, firstName: true, role: true, currency: true, timezone: true },
    });
    if (!coach) throw new NotFoundError('Coach not found');
    if (coach.role !== 'coach') throw new BadRequestError('Not a coach account');

    const trialEmail = `trial-${coachId}@ivy-trial.invalid`;

    // Hard cap — this spends real Retell + Twilio money on an unpaid account.
    const existing = await prisma.user.findUnique({
      where: { email: trialEmail },
      select: { id: true, _count: { select: { calls: true } } },
    });
    if (existing && existing._count.calls >= TRIAL_CALL_CAP) {
      throw new BadRequestError(
        `You've used your ${TRIAL_CALL_CAP} trial calls. Ready to bring your clients on?`,
      );
    }

    // The coach experiences it AS a client: their own name, their own number,
    // themselves as the coach behind it — so what they hear is exactly what
    // their client would hear.
    const trialClient = await prisma.user.upsert({
      where: { email: trialEmail },
      update: { phone },
      create: {
        email: trialEmail,
        phone,
        firstName: coach.firstName,
        lastName: '',
        timezone: coach.timezone ?? 'Europe/London',
        currency: coach.currency ?? 'GBP',
        subscriptionTier: 'PRO',
        commStyle: 'CALLS',
        track: 'fitness',
        goal: 'See what my clients experience',
        coachId: coach.id,
        coachLinkedAt: new Date(),
        coachNotes:
          'This is the coach themselves, trying the client experience before deciding. ' +
          'Treat them exactly like a real new client — they are judging whether this is ' +
          'good enough for the people they coach.',
        isOnboarded: true,
        isActive: true,
        // No eveningCallTime and no arming window: nothing must ever schedule
        // itself off this record.
      },
      select: { id: true, firstName: true },
    });

    const call = await prisma.call.create({
      data: { userId: trialClient.id, callType: 'ONBOARDING', scheduledAt: new Date(), status: 'SCHEDULED' },
      select: { id: true },
    });

    const [{ default: callService }, { default: outboundCallService }, { default: promptService }, { default: briefService }] =
      await Promise.all([
        import('./call.service'),
        import('./outbound-call.service'),
        import('./prompt.service'),
        import('./brief.service'),
      ]);
    const { getTrackConfig } = await import('../config/tracks');
    const { flattenContext } = await import('../utils/retell');

    const ctx = await callService.getUserContext(trialClient.id, 'ONBOARDING');
    const brief = await briefService.generateCallBrief('ONBOARDING', ctx, getTrackConfig(ctx.track)!);
    const systemPrompt = promptService.buildSystemPrompt('ONBOARDING', ctx, false, brief ?? undefined);

    const fromNumber = phone.startsWith('+1')
      ? (config.twilio.phoneNumberUs ?? config.twilio.phoneNumber)
      : config.twilio.phoneNumber;
    if (!fromNumber) throw new BadRequestError('No caller ID configured');

    const placed = await outboundCallService.placeCall({
      toNumber: phone,
      fromNumber,
      agentId: config.retell.agentIds.b2c || '',
      variables: flattenContext({ ...ctx, call_type: 'onboarding' }),
      metadata: { callId: call.id, userId: trialClient.id, callType: 'ONBOARDING', trial: true },
      systemPrompt,
    });

    await callService.updateCallStatus(call.id, 'IN_PROGRESS', { retellCallId: placed.retellCallId });
    logger.info(`Coach trial call placed for ${coachId} -> ${phone} (retell=${placed.retellCallId})`);
    return { callId: call.id, retellCallId: placed.retellCallId };
  }
}

export const coachService = new CoachService();
export default coachService;
