/**
 * Async circle sessions — the moment members actually meet.
 *
 * Lifecycle: scheduled (created at sprint close by season.service) → open
 * (72h window; every member is invited to drop one win + one honest struggle)
 * → completed (room sealed; sharers keep the room, absentees get Ivy's
 * catch-up on their next call).
 *
 * The core mechanic: SHARING IS THE PRICE OF SEEING THE ROOM. Until you've
 * put your own win/struggle in, other people's shares are counted but hidden.
 * This keeps the room honest (no lurkers) and gives Ivy real, member-authored
 * material to weave into calls — not synthetic summaries.
 */
import Anthropic from '@anthropic-ai/sdk';
import { subDays } from 'date-fns';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { NotFoundError, BadRequestError } from '../utils/errors';
import { parseModelJson } from '../utils/model-json';
import { logUsage } from './usage.service';
import circleCatchupService from './circle-catchup.service';

const OPEN_WINDOW_HOURS = 72;

/**
 * Drafts the "Need a nudge?" candidate share. The hard rule is groundedness:
 * the member is about to put these words in front of their peers, so an
 * invented specific ("hit all four 6am sessions" when they didn't) would be
 * Ivy putting a lie in their mouth. Everything else is style.
 */
const NUDGE_SYSTEM = `You draft a candidate "win" and "struggle" for a member of an accountability circle who is staring at a blank share form. Their circle-mates will read what they submit, so these drafts must be TRUE.

Rules:
- Ground every claim strictly in the sprint data provided. Never invent numbers, days, times, events, or specifics that are not in the data. If the data only supports something modest, write something modest.
- First person, the member's own casual voice — a quick honest text to friends, not marketing copy and not coach-speak. No greetings, no hashtags, no exclamation-mark cheer.
- The win is one concrete thing they actually did or held this sprint (showing up counts; an armed morning counts). The struggle is one real friction visible in the data — a named obstacle, a pattern of misses, a day of the week that keeps costing them.
- One or two sentences each, under 220 characters each.
- These are editable drafts the member will rewrite, so aim for true and specific over polished.

Return ONLY raw JSON, no markdown, no explanation: {"win": "...", "struggle": "..."}`;

/**
 * Drafts the facilitator's room brief, posted when a session opens. The person
 * who started the circle is a peer, not a professional coach — so this is a
 * light, optional read on where the room is, framed as conversation starters,
 * never a mandate to run the meeting. Same groundedness rule as the nudge: the
 * facilitator will act on this in front of the room, so it must be TRUE.
 */
const FACILITATOR_SYSTEM = `You brief the member who started an accountability circle, just as the group's fortnightly session opens. They're a peer who happened to start the room, not a professional coach — so this is a friendly, optional read on where the room is, so they can nudge the conversation if they feel like it.

Rules:
- Ground every claim strictly in the data provided. Never invent numbers, names, days, or events. If the data is thin, keep it short and general rather than padding.
- Speak TO the facilitator ABOUT the room. Warm, plain, a little dry — a friend passing on what they noticed. No coach-speak, no hype, no emoji, no headings.
- 2-3 short lines. Each line is either something the room did well worth celebrating, or a real friction the session could talk about: a weekday that keeps costing the room, a common obstacle, or a member who's gone quiet.
- Frame frictions as gentle conversation starters ("might be worth asking the room how weekends are landing"), never as orders. Never single out a member for blame — if someone's gone quiet, suggest checking in on them warmly.

Return ONLY raw JSON, no markdown, no explanation: {"brief": "..."}`;

export interface SessionShareView {
  firstName: string;
  isYou: boolean;
  win: string;
  struggle: string;
}

class CircleSessionService {
  private anthropic: Anthropic | null = process.env.ANTHROPIC_API_KEY
    ? new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    : null;

  /** Sessions whose time has come: scheduled → open, everyone invited. */
  async openDueSessions(): Promise<number> {
    const due = await prisma.circleSprintSession.findMany({
      where: { status: 'scheduled', scheduledAt: { lte: new Date() }, circleId: { not: null } },
      select: { id: true, circleId: true, sprintNumber: true, circle: { select: { name: true } } },
    });

    for (const session of due) {
      await prisma.circleSprintSession.update({
        where: { id: session.id },
        data: { status: 'open' },
      });

      const members = await prisma.ivyCircleMember.findMany({
        where: { circleId: session.circleId!, isActive: true },
        select: { userId: true, role: true },
      });

      const chatService = (await import('./chat.service')).default;
      for (const m of members) {
        chatService.postIvyMessage(
          m.userId,
          `Your ${session.circle?.name ?? 'circle'} session is open — drop one win and one honest struggle from this sprint. You'll see everyone else's the moment yours is in. The room closes in ${OPEN_WINDOW_HOURS} hours.`,
          { messageType: 'circle_session', metadata: { sessionId: session.id, action: 'session_open' } },
        ).catch((err) => logger.warn(`Session-open message failed for ${m.userId}:`, err));
      }

      // The member who started the circle gets a light, optional read on the
      // room going into the session — a friend's brief, grounded in the real
      // fortnight, never a mandate to run the meeting. Best-effort: a failed or
      // empty brief just means no extra message.
      const facilitator = members.find((m) => m.role === 'facilitator');
      if (facilitator) {
        this.draftFacilitatorBrief(session.circleId!)
          .then((brief) => {
            if (!brief) return;
            return chatService.postIvyMessage(
              facilitator.userId,
              `You started ${session.circle?.name ?? 'this circle'}, so here's a quick read on the room going into this session — nudge the conversation if you feel like it:\n\n${brief}`,
              { messageType: 'circle_session', metadata: { sessionId: session.id, action: 'facilitator_brief' }, notify: false },
            );
          })
          .catch((err) => logger.warn(`Facilitator brief post failed for session ${session.id}:`, err));
      }

      logger.info(`Circle session ${session.id} opened (${members.length} members invited)`);
    }
    return due.length;
  }

  /** Sessions past their window: open → completed, room sealed, absentees get catch-up. */
  async closeExpiredSessions(): Promise<number> {
    const cutoff = new Date(Date.now() - OPEN_WINDOW_HOURS * 3_600_000);
    const expired = await prisma.circleSprintSession.findMany({
      where: { status: 'open', scheduledAt: { lte: cutoff }, circleId: { not: null } },
      select: {
        id: true, circleId: true, sprintNumber: true,
        collectivePledge: true,
        circle: { select: { name: true } },
        shares: { select: { userId: true, win: true, struggle: true, user: { select: { firstName: true } } } },
      },
    });

    for (const session of expired) {
      const sharerIds = session.shares.map((s) => s.userId);
      const memberCount = await prisma.ivyCircleMember.count({
        where: { circleId: session.circleId!, isActive: true },
      });

      // Latest sprint pledge doubles as the collective pledge the catch-up
      // references — fall back to the standing promise of the room.
      let pledge = session.collectivePledge;
      if (!pledge) {
        const goal = await prisma.circleSprintGoal.findFirst({
          where: { circleId: session.circleId! },
          orderBy: { sprintNumber: 'desc' },
          select: { pledge: true },
        });
        pledge = goal?.pledge ?? 'Show up for each other, one day at a time';
      }

      await prisma.circleSprintSession.update({
        where: { id: session.id },
        data: {
          status: 'completed',
          conductedAt: new Date(),
          participantUserIds: JSON.stringify(sharerIds),
          collectivePledge: pledge,
          // Member-authored highlights — Ivy weaves these into absentees'
          // catch-ups and future calls. Real words beat synthetic summaries.
          highlights: JSON.stringify(
            session.shares.map((s) => ({
              name: s.user.firstName,
              win: s.win.slice(0, 200),
              struggle: s.struggle.slice(0, 200),
            })),
          ),
        },
      });

      // Sharers get the seal; absentees get Ivy's catch-up on their next call.
      const chatService = (await import('./chat.service')).default;
      for (const sharerId of sharerIds) {
        chatService.postIvyMessage(
          sharerId,
          `${session.circle?.name ?? 'Circle'} session closed — ${sharerIds.length} of ${memberCount} stepped in. I'll be carrying the room's words into the week.`,
          { messageType: 'circle_session', metadata: { sessionId: session.id, action: 'session_closed' }, notify: false },
        ).catch((err) => logger.warn(`Session-close message failed for ${sharerId}:`, err));
      }

      await circleCatchupService.createCatchupsForAbsentees(session.id)
        .catch((err) => logger.warn(`Catch-up creation failed for session ${session.id}:`, err));

      // Session close = the sprint rolls — seed the next sprint's game if the
      // room doesn't already have one running.
      import('./circle-game.service')
        .then(({ default: circleGameService }) => circleGameService.seedSprintPact(session.circleId!))
        .catch((err) => logger.warn(`Sprint pact seed failed for circle ${session.circleId}:`, err));

      logger.info(`Circle session ${session.id} completed: ${sharerIds.length}/${memberCount} shared`);
    }
    return expired.length;
  }

  /** The member's current session (latest for their circle) + room visibility rules. */
  async getCurrentSession(userId: string) {
    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    });
    if (!membership) return null;

    const session = await prisma.circleSprintSession.findFirst({
      where: { circleId: membership.circleId, status: { in: ['scheduled', 'open', 'completed'] } },
      orderBy: { scheduledAt: 'desc' },
      select: {
        id: true, status: true, scheduledAt: true, sprintNumber: true,
        shares: { select: { userId: true, win: true, struggle: true, user: { select: { firstName: true } } } },
      },
    });
    if (!session) return null;

    const memberCount = await prisma.ivyCircleMember.count({
      where: { circleId: membership.circleId, isActive: true },
    });
    const mine = session.shares.find((s) => s.userId === userId) ?? null;

    // The room is visible only to those who put something in it.
    const room: SessionShareView[] | null = mine
      ? session.shares.map((s) => ({
          firstName: s.user.firstName,
          isYou: s.userId === userId,
          win: s.win,
          struggle: s.struggle,
        }))
      : null;

    return {
      id: session.id,
      status: session.status,
      opensAt: session.scheduledAt,
      closesAt: new Date(session.scheduledAt.getTime() + OPEN_WINDOW_HOURS * 3_600_000),
      sprintNumber: session.sprintNumber,
      memberCount,
      sharedCount: session.shares.length,
      myShare: mine ? { win: mine.win, struggle: mine.struggle } : null,
      room,
    };
  }

  /**
   * "Need a nudge?" — draft a candidate win + struggle from the member's REAL
   * sprint record (arming history, call insights, long-term memories). The
   * draft lands in the textareas as editable text and is never auto-submitted:
   * the share stays member-authored, Ivy just breaks the blank page.
   */
  async draftShareNudge(userId: string): Promise<{ win: string; struggle: string }> {
    if (!this.anthropic) {
      throw new BadRequestError('Nudges are not available right now — say it in your own words.');
    }

    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    });
    if (!membership) throw new NotFoundError('You are not in a circle');

    const session = await prisma.circleSprintSession.findFirst({
      where: { circleId: membership.circleId, status: 'open' },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true },
    });
    if (!session) throw new BadRequestError('No session is open right now');

    // The sprint window: sessions open at sprint close, so the last 14 days
    // is the sprint the member is being asked to speak about.
    const since = subDays(new Date(), 14);
    const [user, workouts, calls, memories] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: { firstName: true, track: true, goal: true },
      }),
      prisma.workout.findMany({
        where: { userId, plannedDate: { gte: since } },
        orderBy: { plannedDate: 'asc' },
        select: { plannedDate: true, activity: true, status: true, armedAt: true, sliceOutcome: true, skippedReason: true },
      }),
      prisma.call.findMany({
        where: { userId, status: 'COMPLETED', scheduledAt: { gte: since } },
        orderBy: { scheduledAt: 'desc' },
        take: 6,
        select: { callInsights: true, scheduledAt: true },
      }),
      prisma.callMemory.findMany({
        where: { userId, createdAt: { gte: since }, category: { in: ['struggle', 'breakthrough', 'motivation'] } },
        orderBy: { createdAt: 'desc' },
        take: 6,
        select: { content: true, category: true },
      }),
    ]);

    const dayLines = workouts.map((w) => {
      const bits = [w.activity, w.armedAt ? 'armed (morning voice note in)' : 'not armed'];
      if (w.status === 'COMPLETED' || w.sliceOutcome === 'RELEASED') bits.push('day kept');
      else if (w.status === 'PARTIAL') bits.push('did the minimum');
      else if (w.status === 'MISSED' || w.sliceOutcome === 'FORFEITED') bits.push('day missed');
      if (w.skippedReason) bits.push(`reason: ${w.skippedReason}`);
      const weekday = w.plannedDate.toLocaleDateString('en-GB', { weekday: 'short' });
      return `${weekday} ${w.plannedDate.toISOString().slice(0, 10)} — ${bits.join(', ')}`;
    });

    const insightLines = calls.flatMap((c) => {
      const ins = c.callInsights as {
        key_insight?: string;
        obstacles_mentioned?: string[];
        emotional_state?: string;
      } | null;
      if (!ins) return [];
      const parts = [];
      if (ins.key_insight) parts.push(ins.key_insight);
      if (ins.obstacles_mentioned?.length) parts.push(`obstacles: ${ins.obstacles_mentioned.join('; ')}`);
      if (ins.emotional_state) parts.push(`mood: ${ins.emotional_state}`);
      return parts.length ? [`${c.scheduledAt?.toISOString().slice(0, 10)}: ${parts.join(' · ')}`] : [];
    });

    const memoryLines = memories.map((m) => `[${m.category}] ${m.content}`);

    // Nothing real to draw from → refuse rather than let the model invent a
    // sprint that never happened. The member writes their own words.
    if (dayLines.length === 0 && insightLines.length === 0 && memoryLines.length === 0) {
      throw new BadRequestError('Not enough sprint history to draft from yet — say it in your own words.');
    }

    const brief = [
      `Member: ${user?.firstName ?? 'the member'} · track: ${user?.track ?? 'unknown'} · goal: ${user?.goal ?? 'not set'}`,
      dayLines.length ? `Sprint days (last 14):\n${dayLines.join('\n')}` : 'Sprint days: no planned days recorded.',
      insightLines.length ? `From their recent calls with Ivy:\n${insightLines.join('\n')}` : '',
      memoryLines.length ? `Things Ivy remembers about them:\n${memoryLines.join('\n')}` : '',
    ].filter(Boolean).join('\n\n');

    const res = await this.anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 300,
      system: [{ type: 'text', text: NUDGE_SYSTEM, cache_control: { type: 'ephemeral' } }] as any,
      messages: [{ role: 'user', content: brief }],
    });
    logUsage('anthropic', 'haiku_tokens', (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), userId, { op: 'circle_nudge' }).catch(() => {});

    const raw = res.content[0]?.type === 'text' ? res.content[0].text.trim() : null;
    if (!raw) throw new BadRequestError("Couldn't draft a nudge — say it in your own words.");

    const draft = parseModelJson<{ win?: unknown; struggle?: unknown }>(raw);
    const win = typeof draft.win === 'string' ? draft.win.trim().slice(0, 500) : '';
    const struggle = typeof draft.struggle === 'string' ? draft.struggle.trim().slice(0, 500) : '';
    if (!win || !struggle) throw new BadRequestError("Couldn't draft a nudge — say it in your own words.");

    logger.info(`Circle nudge drafted for ${userId} (days: ${dayLines.length}, insights: ${insightLines.length}, memories: ${memoryLines.length})`);
    return { win, struggle };
  }

  /**
   * Draft the facilitator's room brief from the circle's real fortnight —
   * consistency, the weekday that keeps costing the room, who's gone quiet,
   * the standing pledge and any live game. Returns null (never throws) when
   * there's nothing grounded to say, so the caller can simply skip the post.
   */
  async draftFacilitatorBrief(circleId: string): Promise<string | null> {
    if (!this.anthropic) return null;

    const members = await prisma.ivyCircleMember.findMany({
      where: { circleId, isActive: true },
      select: { userId: true, user: { select: { firstName: true } } },
    });
    if (members.length < 2) return null;

    const since = subDays(new Date(), 14);
    const workouts = await prisma.workout.findMany({
      where: { userId: { in: members.map((m) => m.userId) }, plannedDate: { gte: since } },
      select: { userId: true, status: true, armedAt: true, skippedReason: true, plannedDate: true },
    });
    if (workouts.length === 0) return null;

    const keptBy = new Map<string, number>(members.map((m) => [m.userId, 0]));
    const missByDay = new Map<string, number>();
    const reasons: string[] = [];
    let kept = 0;
    for (const w of workouts) {
      const isKept =
        w.status === 'COMPLETED' || w.status === 'PARTIAL' ||
        (!!w.armedAt && w.status !== 'MISSED' && w.status !== 'SKIPPED');
      if (isKept) {
        kept++;
        keptBy.set(w.userId, (keptBy.get(w.userId) ?? 0) + 1);
      } else if (w.status === 'MISSED' || w.status === 'SKIPPED') {
        const day = w.plannedDate.toLocaleDateString('en-GB', { weekday: 'long' });
        missByDay.set(day, (missByDay.get(day) ?? 0) + 1);
        if (w.skippedReason?.trim()) reasons.push(w.skippedReason.trim());
      }
    }

    const rate = Math.round((kept / workouts.length) * 100);
    const worstDay = [...missByDay.entries()].sort((a, b) => b[1] - a[1])[0];
    const quiet = members.filter((m) => (keptBy.get(m.userId) ?? 0) === 0).map((m) => m.user.firstName);

    const [goal, gameLine] = await Promise.all([
      prisma.circleSprintGoal.findFirst({
        where: { circleId },
        orderBy: { sprintNumber: 'desc' },
        select: { pledge: true },
      }),
      import('./circle-game.service')
        .then(({ default: g }) => g.circlePulseLine(circleId))
        .catch(() => ''),
    ]);

    const facts = [
      `The room kept ${kept} of ${workouts.length} member-days (${rate}%) over the last fortnight.`,
      worstDay && worstDay[1] > 1 ? `Misses cluster on ${worstDay[0]}s (${worstDay[1]} this fortnight).` : '',
      reasons.length ? `Reasons members gave for missing: ${[...new Set(reasons)].slice(0, 3).map((r) => `"${r.slice(0, 60)}"`).join(', ')}.` : '',
      quiet.length ? `Gone quiet (no kept days this fortnight): ${quiet.slice(0, 3).join(', ')}.` : '',
      goal?.pledge ? `The room's standing pledge: "${goal.pledge}".` : '',
      gameLine ? `Game standing: ${gameLine}` : '',
    ].filter(Boolean).join('\n');

    try {
      const res = await this.anthropic.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 260,
        system: [{ type: 'text', text: FACILITATOR_SYSTEM, cache_control: { type: 'ephemeral' } }] as any,
        messages: [{ role: 'user', content: facts }],
      });
      logUsage('anthropic', 'haiku_tokens', (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), undefined, { op: 'facilitator_brief' }).catch(() => {});
      const raw = res.content[0]?.type === 'text' ? res.content[0].text.trim() : null;
      if (!raw) return null;
      const parsed = parseModelJson<{ brief?: unknown }>(raw);
      const brief = typeof parsed.brief === 'string' ? parsed.brief.trim().slice(0, 600) : '';
      return brief || null;
    } catch (err) {
      logger.warn(`Facilitator brief draft failed for circle ${circleId}:`, err);
      return null;
    }
  }

  /** Put your win + struggle in — unlocks the room. Upsert (edits allowed while open). */
  async submitShare(userId: string, win: string, struggle: string) {
    if (!win.trim() || !struggle.trim()) {
      throw new BadRequestError('Both a win and an honest struggle are required — that\'s the deal.');
    }

    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    });
    if (!membership) throw new NotFoundError('You are not in a circle');

    const session = await prisma.circleSprintSession.findFirst({
      where: { circleId: membership.circleId, status: 'open' },
      orderBy: { scheduledAt: 'desc' },
      select: { id: true },
    });
    if (!session) throw new BadRequestError('No session is open right now');

    await prisma.circleSessionShare.upsert({
      where: { sessionId_userId: { sessionId: session.id, userId } },
      create: { sessionId: session.id, userId, win: win.trim().slice(0, 500), struggle: struggle.trim().slice(0, 500) },
      update: { win: win.trim().slice(0, 500), struggle: struggle.trim().slice(0, 500) },
    });

    return this.getCurrentSession(userId);
  }
}

export const circleSessionService = new CircleSessionService();
export default circleSessionService;
