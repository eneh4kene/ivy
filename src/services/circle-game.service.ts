import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { opsAlert } from '../lib/ops-alert';
import { serverAnalytics } from '../lib/analytics';
import { sendPushToUser, pushTemplates } from './push.service';
import { createSpecGame as persistSpecGame, runSpecEvent } from './games/runtime';
import { compileGame, validateSpec } from './games/compiler';
import env from '../config/env';

// ─── Template definitions ─────────────────────────────────────────────────────
// Each template describes the mechanical rules Ivy's backend enforces.
// The plain-language ivyInstruction is written by the circle when creating a game.

export const GAME_TEMPLATES = {
  relay: {
    name: 'Baton Relay',
    description: 'One member holds the baton. Keep your day to pass it to the next person. Drop it and the group loses a life.',
    defaultRules: {
      turn_order: [],        // userId array; populated from circle members at game start
      window_hours: 24,      // how long the holder has before the baton drops
      lives: 3,              // group lives before game over
      // Phase 4b — baton-stake (§4b mechanic 3):
      // When baton_stake_multiplier > 1, holding the baton raises the holder's OWN
      // stakeSliceAmount for the window.  Pass → slice restored to base.
      // Drop → elevated slice forfeits to the holder's OWN destination (never another user's).
      // GUARDRAIL: money always moves within the same user's own stake.  No inter-user transfer.
      baton_stake_multiplier: 1, // default 1 = no elevation; set >1 to enable baton-stake
    },
    defaultInstruction: `You're running a baton relay for the circle. {holder_name} currently holds the baton. When they keep their day, pass it to {next_name} and tell the group. If they miss their window, announce the drop, deduct a life, and pass to {next_name} anyway. The group has {lives} lives left. Keep it light and competitive — celebrate passes, commiserate drops, and remind the current holder their window closes at {deadline}.`,
  },
  points_race: {
    name: 'Points Race',
    description: 'Every kept day earns points. First to the target wins.',
    defaultRules: {
      points_per_workout: 1,
      bonus_streak: 3,       // consecutive days to trigger bonus point
      target: 20,
    },
    defaultInstruction: `This is a points race — {target} points wins. Each kept day earns 1 point; a {bonus_streak}-day streak earns a bonus. Current standings: {scores_summary}. Mention the leader briefly when relevant. Congratulate someone who scores. If someone hasn't moved in 3+ days, note it warmly — "you're only {gap} points behind, still very catchable."`,
  },
  collective: {
    name: 'Group Challenge',
    description: 'The whole circle works toward a shared target. Everyone wins or no-one does.',
    defaultRules: {
      target: 30,            // total workouts needed
      deadline_days: 28,
    },
    defaultInstruction: `The group is chasing a collective target of {target} kept days in {deadline_days} days. You're at {total} so far — {remaining} to go. Celebrate each contribution. If the pace is behind, note it without pressure: "you need {daily_rate} kept days a day to hit it — still doable." When you hit the target, make it a moment.`,
  },
  custom: {
    name: 'Custom Game',
    description: 'Define your own game. Write the rules in plain language and Ivy will run it.',
    defaultRules: {},
    defaultInstruction: '',
  },
} as const;

export type TemplateType = keyof typeof GAME_TEMPLATES;

// ─── State processors ─────────────────────────────────────────────────────────

class CircleGameService {
  /** The auto-seeded sprint game: the room holding 80% together for a sprint. */
  static readonly PACT_SPRINT_DAYS = 14;
  static readonly PACT_RATE = 0.8;
  /** Below this a relay is just two people alternating days — fall back to the Pact. */
  static readonly RELAY_MIN_MEMBERS = 3;
  /** Matches the GameSpec StakeEffects fence (multiplierMax ≤ 3). */
  static readonly MAX_BATON_MULTIPLIER = 3;

  // ── Names & beats ────────────────────────────────────────────────────────────
  // Games live or die on being FELT between calls. Beats are the sound a game
  // makes: short Ivy-thread messages on the moments that matter. Quiet by
  // default (no push) — the one member a beat is about can get a personal line.

  /** userId → firstName for a circle's active members. */
  private async memberNames(circleId: string): Promise<Map<string, string>> {
    const members = await prisma.ivyCircleMember.findMany({
      where: { circleId, isActive: true },
      select: { userId: true, user: { select: { firstName: true } } },
    });
    return new Map(members.map((m) => [m.userId, m.user.firstName || 'Someone']));
  }

  /** Never throws — a failed beat must never break game state. */
  private async announceBeat(
    circleId: string,
    message: string,
    opts: { personal?: { userId: string; message: string; notify?: boolean }; gameId?: string } = {},
  ): Promise<void> {
    try {
      const chatService = (await import('./chat.service')).default;
      const members = await prisma.ivyCircleMember.findMany({
        where: { circleId, isActive: true },
        select: { userId: true },
      });
      for (const m of members) {
        const isPersonal = opts.personal?.userId === m.userId;
        const body = isPersonal ? opts.personal!.message : message;
        if (!body) continue;
        chatService.postIvyMessage(m.userId, body, {
          messageType: 'circle_game',
          metadata: opts.gameId ? { gameId: opts.gameId } : undefined,
          notify: isPersonal ? (opts.personal!.notify ?? false) : false,
        }).catch((err: unknown) => logger.warn(`Game beat failed for ${m.userId}:`, err));
      }
    } catch (err) {
      logger.warn(`Game beat failed for circle ${circleId}:`, err);
    }
  }

  // ── Game CRUD ──────────────────────────────────────────────────────────────

  async createGame(circleId: string, data: {
    name: string;
    description?: string;
    templateType: TemplateType;
    rules?: Record<string, any>;
    ivyInstruction: string;
    sprintId?: string;
  }) {
    const template = GAME_TEMPLATES[data.templateType];
    const rules: Record<string, any> = { ...template.defaultRules, ...(data.rules ?? {}) };

    // For relay: initialise turn_order from circle members if not provided
    let initialState: Record<string, any> = {};
    if (data.templateType === 'relay') {
      if (!rules.turn_order?.length) {
        const members = await prisma.ivyCircleMember.findMany({
          where: { circleId, isActive: true },
          select: { userId: true },
          orderBy: { joinedAt: 'asc' },
        });
        rules.turn_order = members.map((m) => m.userId);
      }
      initialState = {
        current_holder_index: 0,
        current_holder_id: rules.turn_order[0] ?? null,
        baton_held_since: new Date().toISOString(),
        lives_remaining: rules.lives ?? 3,
        passes: 0,
      };
    } else if (data.templateType === 'points_race') {
      const members = await prisma.ivyCircleMember.findMany({
        where: { circleId, isActive: true },
        select: { userId: true },
      });
      initialState = {
        scores: Object.fromEntries(members.map((m) => [m.userId, 0])),
        streak_days: Object.fromEntries(members.map((m) => [m.userId, 0])),
      };
    } else if (data.templateType === 'collective') {
      initialState = { total: 0, contributors: [] };
    }

    const game = await prisma.circleGame.create({
      data: {
        circleId,
        sprintId: data.sprintId ?? null,
        name: data.name,
        description: data.description ?? null,
        templateType: data.templateType,
        rules,
        ivyInstruction: data.ivyInstruction,
        state: initialState,
        status: 'active',
      },
    });

    logger.info(`CircleGame created: ${game.id} (${data.templateType}) for circle ${circleId}`);
    return game;
  }

  /** Active member ids for a circle, in join order (the spec interpreter's seed order). */
  private async activeMemberIds(circleId: string): Promise<string[]> {
    const members = await prisma.ivyCircleMember.findMany({
      where: { circleId, isActive: true },
      select: { userId: true },
      orderBy: { joinedAt: 'asc' },
    });
    return members.map((m) => m.userId);
  }

  /**
   * Author a spec-backed game from a plain-language prompt — runs the LLM
   * compiler (with its validate+repair loop) and persists the validated spec.
   * Throws SpecValidationError if no valid spec can be produced.
   */
  async createSpecGameFromPrompt(circleId: string, opts: { prompt: string; sprintId?: string }) {
    const { spec, attempts } = await compileGame(opts.prompt);
    const memberIds = await this.activeMemberIds(circleId);
    const game = await persistSpecGame({ circleId, sprintId: opts.sprintId ?? null, spec, memberIds });
    logger.info(`createSpecGameFromPrompt: game ${game.id} compiled in ${attempts} attempt(s) for circle ${circleId}`);
    return game;
  }

  /**
   * Create a spec-backed game from a pre-built spec (e.g. an Ivy template
   * factory's output). Re-runs the full validation gate before persisting.
   */
  async createSpecGameFromSpec(circleId: string, opts: { spec: unknown; sprintId?: string }) {
    const spec = validateSpec(opts.spec);
    const memberIds = await this.activeMemberIds(circleId);
    return persistSpecGame({ circleId, sprintId: opts.sprintId ?? null, spec, memberIds });
  }

  async getGame(gameId: string) {
    return prisma.circleGame.findUnique({
      where: { id: gameId },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 10 } },
    });
  }

  async listGamesForCircle(circleId: string) {
    return prisma.circleGame.findMany({
      where: { circleId },
      orderBy: { createdAt: 'desc' },
      include: { events: { orderBy: { createdAt: 'desc' }, take: 5 } },
    });
  }

  async getActiveGameForUser(userId: string): Promise<{
    game: any;
    stateSummary: string;
  } | null> {
    // Find circles this user belongs to
    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    });
    if (!membership) return null;

    const game = await prisma.circleGame.findFirst({
      where: { circleId: membership.circleId, status: 'active' },
      orderBy: { createdAt: 'desc' },
      include: {
        events: { orderBy: { createdAt: 'desc' }, take: 5 },
        circle: { select: { name: true } },
      },
    });
    if (!game) return null;

    const stateSummary = await this.buildStateSummary(game, userId);
    return { game, stateSummary };
  }

  async pauseGame(gameId: string) {
    return prisma.circleGame.update({ where: { id: gameId }, data: { status: 'paused' } });
  }

  async completeGame(gameId: string) {
    return prisma.circleGame.update({
      where: { id: gameId },
      data: { status: 'completed', completedAt: new Date() },
    });
  }

  // ── Event processing ───────────────────────────────────────────────────────

  async processWorkoutEvent(userId: string, workoutStatus: 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'MISSED') {
    await this.processOutcome(userId, workoutStatus === 'COMPLETED' || workoutStatus === 'PARTIAL');
  }

  /**
   * The LIVE daily loop's entry point. In the arming product an armed morning
   * IS the kept day (the slice releases on it) and a blown arming deadline is
   * the miss — so games advance on the events the product actually generates:
   * voice-notes controller fires (userId, true) on arm, arming.service fires
   * (userId, false) at deadline enforcement.
   */
  async processArmingEvent(userId: string, armed: boolean) {
    await this.processOutcome(userId, armed);
  }

  private async processOutcome(userId: string, isSuccess: boolean) {
    const result = await this.getActiveGameForUser(userId);
    if (!result) return;

    const { game } = result;

    // Spec-backed games run on the generic interpreter (src/services/games).
    // Legacy games (spec == null) fall through to the hard-coded processors below.
    if ((game as { spec?: unknown }).spec) {
      const triggers: string[] = (game.spec as { triggers?: string[] })?.triggers ?? [];
      // A spec authored against vn.armed gets vn.armed; everything else gets the
      // workout trigger. Never both — one real-world moment, one game event.
      const type = isSuccess
        ? (triggers.includes('vn.armed') && !triggers.includes('workout.logged') ? 'vn.armed' : 'workout.logged')
        : 'workout.missed';
      const res = await runSpecEvent(game as any, { type: type as any, userId, at: new Date().toISOString() });
      await this.emitSpecBeats(game, res, userId);
      return;
    }

    const eventType = isSuccess ? 'workout_completed' : 'workout_missed';

    // Pre-state snapshots for beat detection (the processors mutate in place).
    const prevScores = { ...(((game.state as Record<string, any>).scores ?? {}) as Record<string, number>) };
    const prevTotal = Number((game.state as Record<string, any>).total ?? 0);

    let note: string | null = null;
    let updatedState = { ...(game.state as Record<string, any>) };
    let extraEventType: string | null = null;
    let extraPayload: Record<string, any> = {};

    // Names are resolved BEFORE the processors so notes are written as sentences.
    // CircleGameEvent.note is documented as "plain sentence Ivy can surface in a
    // call"; until it was read by anything, every processor interpolated a raw
    // UUID into it, which no one would ever have said out loud.
    const names = await this.memberNames(game.circleId);
    const name = (id: string | null | undefined) => (id ? names.get(id) ?? 'someone' : 'someone');

    switch (game.templateType) {
      case 'relay':
        ({ updatedState, note, extraEventType, extraPayload } = await this.processRelayEvent(
          game, userId, isSuccess, updatedState, name
        ));
        break;

      case 'points_race':
        ({ updatedState, note } = this.processPointsRaceEvent(game, userId, isSuccess, updatedState, name));
        if (isSuccess) extraEventType = 'points_awarded';
        break;

      case 'collective':
        ({ updatedState, note } = await this.processCollectiveEvent(game, userId, isSuccess, updatedState, name));
        break;

      default:
        // custom — just log the event, Ivy handles everything via ivyInstruction
        note = isSuccess
          ? `${name(userId)} kept the day.`
          : `${name(userId)} missed.`;
        break;
    }

    // Persist event + updated state atomically
    await prisma.$transaction([
      prisma.circleGameEvent.create({
        data: { gameId: game.id, userId, eventType, payload: {}, note },
      }),
      ...(extraEventType ? [prisma.circleGameEvent.create({
        data: { gameId: game.id, userId, eventType: extraEventType, payload: extraPayload, note: null },
      })] : []),
      prisma.circleGame.update({
        where: { id: game.id },
        data: { state: updatedState },
      }),
    ]);

    serverAnalytics.circleGameEvent(userId, game.id, eventType);
    if (extraEventType) serverAnalytics.circleGameEvent(userId, game.id, extraEventType);

    // ── Beats + win conditions ─────────────────────────────────────────────
    const rules = game.rules as Record<string, any>;

    if (game.templateType === 'relay' && userId === (game.state as Record<string, any>).current_holder_id) {
      // The actor WAS the holder — this outcome moved the baton.
      const next = updatedState.current_holder_id as string | null;
      // The turn's decision, offered in the same breath as the handover. Never
      // imposed: the multiplier only ever moves money after they say yes.
      const doubleOffer = updatedState.double_offered_to === next
        ? ` Want teeth on it? Say "double" and today's slice doubles for your window — keep the day and it releases like any other, drop it and the bigger number goes to your charity. Your money, your call.`
        : '';
      if (isSuccess) {
        this.announceBeat(game.circleId, `${name(userId)} kept the day and passed the baton to ${name(next)} — ${updatedState.lives_remaining} lives intact.`, {
          gameId: game.id,
          personal: next ? { userId: next, message: `${name(userId)} just passed you the baton. Keep today to pass it on — the room's watching.${doubleOffer}` } : undefined,
        }).catch(() => {});
      } else if (updatedState.lives_remaining > 0) {
        this.announceBeat(game.circleId, `${name(userId)} dropped the baton — ${updatedState.lives_remaining} ${updatedState.lives_remaining === 1 ? 'life' : 'lives'} left. ${name(next)} picks it up.`, {
          gameId: game.id,
          personal: next ? { userId: next, message: `The baton's yours after a drop — ${updatedState.lives_remaining} ${updatedState.lives_remaining === 1 ? 'life' : 'lives'} left. Keep today and steady the room.${doubleOffer}` } : undefined,
        }).catch(() => {});
      } else {
        this.announceBeat(game.circleId, `That was the last life. The relay is over — ${updatedState.passes ?? 0} passes was the run. New game with the next sprint.`, { gameId: game.id }).catch(() => {});
      }
    }

    if (game.templateType === 'points_race' && isSuccess) {
      const scores = updatedState.scores as Record<string, number>;
      const leaderOf = (s: Record<string, number>) => Object.entries(s).sort(([, a], [, b]) => b - a)[0]?.[0] ?? null;
      const prevLeader = leaderOf(prevScores);
      const nowLeader = leaderOf(scores);
      if (nowLeader && nowLeader !== prevLeader && nowLeader === userId) {
        this.announceBeat(game.circleId, `${name(userId)} just took the lead in ${game.name} — ${scores[userId]} points. First to ${rules.target ?? 20} takes the crown.`, { gameId: game.id }).catch(() => {});
      }
      const winner = Object.entries(scores).find(([, pts]) => pts >= (rules.target ?? 20));
      if (winner) {
        await this.completeGame(game.id);
        await prisma.circleGameEvent.create({
          data: { gameId: game.id, userId: winner[0], eventType: 'game_won', payload: { winner_id: winner[0], score: winner[1] }, note: `${name(winner[0])} won the race with ${winner[1]} points!` },
        });
        serverAnalytics.circleGameEvent(winner[0], game.id, 'game_won');
        // Winner's spoils: victory buys influence, not just bragging rights.
        this.announceBeat(game.circleId, `${name(winner[0])} takes the ${game.name} crown with ${winner[1]} points. 👑 Spoils of victory: ${name(winner[0])} names the room's pledge for the next sprint.`, {
          gameId: game.id,
          personal: { userId: winner[0], message: `The crown is yours — ${winner[1]} points. 👑 Your spoils: you name the room's pledge for the next sprint. Tell me here and I'll hold everyone to it. Want ideas? Ask me — I've been watching where the room slips.`, notify: true },
        }).catch(() => {});
      }
    }

    if (game.templateType === 'collective' && isSuccess) {
      const target = rules.target ?? 30;
      const total = Number(updatedState.total ?? 0);
      const crossed = (frac: number) => prevTotal < target * frac && total >= target * frac && total < target;
      if (crossed(0.5)) {
        this.announceBeat(game.circleId, `Halfway. ${total} of ${target} kept days banked — the room is carrying it together.`, { gameId: game.id }).catch(() => {});
      } else if (crossed(0.9)) {
        this.announceBeat(game.circleId, `${target - total} to go. The room is at ${total} of ${target} — bring it home.`, { gameId: game.id }).catch(() => {});
      }
      if (total >= target) {
        await this.completeGame(game.id);
        await prisma.circleGameEvent.create({
          data: { gameId: game.id, userId, eventType: 'game_won', payload: updatedState, note: 'Group hit the target!' },
        });
        this.announceBeat(game.circleId, `TARGET HIT — ${total} kept days. 🏆 ${game.name} is won, and every single contribution built it. This room holds.`, { gameId: game.id }).catch(() => {});
      }
    }
  }

  /** Beats for spec-backed games: announce() notes + turn handoffs + finales. */
  private async emitSpecBeats(game: any, res: { notes: string[]; emits: string[]; state: Record<string, unknown>; ended: { outcome: string; winner?: string } | null }, actorId?: string): Promise<void> {
    try {
      const names = await this.memberNames(game.circleId);
      const name = (id: string | null | undefined) => (id ? names.get(id) ?? 'someone' : 'someone');

      if (res.notes.length && !res.ended) {
        const line = res.notes.join(' ');
        const holder = res.state.current_holder_id as string | undefined;
        this.announceBeat(game.circleId, actorId ? `${game.name}: ${name(actorId)} — ${line}` : `${game.name}: ${line}`, {
          gameId: game.id,
          personal: res.emits.includes('baton_passed') && holder
            ? { userId: holder, message: `The baton's yours in ${game.name} — keep today to pass it on.` }
            : undefined,
        }).catch(() => {});
      }
      if (res.ended) {
        const winnerName = res.ended.winner ? name(res.ended.winner) : null;
        const msg = res.ended.outcome === 'win' && winnerName
          ? `${game.name} is over — ${winnerName} takes the crown. 👑 Spoils of victory: ${winnerName} names the room's pledge for the next sprint.`
          : res.ended.outcome === 'lose'
            ? `${game.name} is over — the room ran out of road this time. New game with the next sprint.`
            : `${game.name} complete — the room did it together. 🏆`;
        this.announceBeat(game.circleId, msg, {
          gameId: game.id,
          personal: res.ended.outcome === 'win' && res.ended.winner
            ? { userId: res.ended.winner, message: `The ${game.name} crown is yours. 👑 Your spoils: name the room's pledge for the next sprint — tell me here and I'll hold everyone to it. Want ideas? Ask me — I've been watching where the room slips.`, notify: true }
            : undefined,
        }).catch(() => {});
      }
    } catch (err) {
      logger.warn(`Spec game beats failed for ${game.id}:`, err);
    }
  }

  private async processRelayEvent(
    game: any, userId: string, isSuccess: boolean, state: Record<string, any>,
    name: (id: string | null | undefined) => string
  ) {
    const rules = game.rules as Record<string, any>;
    const turnOrder: string[] = rules.turn_order ?? [];
    const currentIndex: number = state.current_holder_index ?? 0;
    const holderId: string | null = state.current_holder_id ?? null;

    let note: string | null = null;
    let extraEventType: string | null = null;
    let extraPayload: Record<string, any> = {};

    // Phase 4b baton-stake multiplier (§4b mechanic 3)
    // GUARDRAIL: the multiplier raises/lowers the holder's OWN stakeSliceAmount ONLY.
    // Money is never transferred to or from another user.
    const batonMultiplier: number = Number(rules.baton_stake_multiplier ?? 1);

    if (userId === holderId && isSuccess) {
      // Pass the baton to the next person
      const nextIndex = (currentIndex + 1) % turnOrder.length;
      const nextHolder = turnOrder[nextIndex];

      // Baton-stake: the outgoing holder goes back to base. The INCOMING holder
      // is only ever OFFERED the elevation — see offer state below.
      if (batonMultiplier > 1) {
        await this.restoreBaseSlice(userId);
      }

      state.current_holder_index = nextIndex;
      state.current_holder_id = nextHolder;
      state.baton_held_since = new Date().toISOString();
      state.passes = (state.passes ?? 0) + 1;
      // A fresh hold: the offer is open again and unspent.
      state.double_offered_to = batonMultiplier > 1 ? nextHolder : null;
      state.doubled = false;
      note = `${name(userId)} kept the day and passed the baton to ${name(nextHolder)}.`;
      extraEventType = 'baton_passed';
      extraPayload = { from: userId, to: nextHolder };

      // Notify the new holder
      const passer = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
      const windowHours: number = (rules.window_hours as number) ?? 24;
      sendPushToUser(nextHolder, pushTemplates.batonPassed(passer?.firstName ?? 'Someone', windowHours))
        .catch((err) => logger.warn('Baton push failed', err));

    } else if (userId === holderId && !isSuccess) {
      // Baton dropped — deduct a life, pass anyway
      const nextIndex = (currentIndex + 1) % turnOrder.length;
      const nextHolder = turnOrder[nextIndex];

      // Baton-stake: the elevated slice is already set on the holder's workout.
      // The larger slice will forfeit to THEIR OWN destination in settleStakeCycle.
      // We restore to base for the incoming holder (fresh start for them).
      if (batonMultiplier > 1) {
        // Do NOT restore the dropped holder's slice — the elevated amount forfeits.
        // Mark the drop event explicitly so the settlement audit trail is clear.
        await prisma.circleGameEvent.create({
          data: {
            gameId: game.id,
            userId,
            eventType: 'baton_stake_drop',
            payload: {
              baton_multiplier: batonMultiplier,
              // GUARDRAIL note: forfeited to userId's OWN destination — not another user
              forfeit_destination: 'own_stake_destination',
            },
            note: `Baton drop: ${name(userId)}'s elevated stake slice (×${batonMultiplier}) forfeits to their own destination.`,
          },
        });
      }

      state.current_holder_index = nextIndex;
      state.current_holder_id = nextHolder;
      state.baton_held_since = new Date().toISOString();
      state.double_offered_to = batonMultiplier > 1 ? nextHolder : null;
      state.doubled = false;
      state.lives_remaining = Math.max(0, (state.lives_remaining ?? 3) - 1);
      note = `${name(userId)} dropped the baton — ${state.lives_remaining} ${state.lives_remaining === 1 ? 'life' : 'lives'} left. ${name(nextHolder)} has it now.`;
      if (state.lives_remaining === 0) {
        await this.completeGame(game.id);
        note += ' Game over — no lives left.';
      }
    } else if (!isSuccess && userId !== holderId) {
      // Non-holder missed — no mechanical effect, but log it
      note = `${name(userId)} missed, but wasn't holding the baton — no effect on the relay.`;
    }

    return { updatedState: state, note, extraEventType, extraPayload };
  }

  /**
   * Shared lookup for the baton-stake mechanic: the user's open cycle, their
   * base daily slice, and today's PENDING workout in that cycle.
   *
   * Base slice mirrors linkWorkoutToCycle: stakeAmount / daysInCycle (NOT /7 —
   * Foundation Runs are often shorter, and slices must sum to the hold).
   */
  private async findTodaysPendingSlice(userId: string): Promise<{
    cycleId: string
    baseSlice: number
    workoutId: string
  } | null> {
    const cycle = await prisma.stakeCycle.findFirst({
      where: { userId, status: 'AUTHORIZED' },
      select: { id: true, stakeAmount: true, daysInCycle: true },
      orderBy: { periodStart: 'desc' },
    });
    if (!cycle) return null;

    const baseSlice = Math.round((Number(cycle.stakeAmount) / cycle.daysInCycle) * 100) / 100;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);

    const workout = await prisma.workout.findFirst({
      where: {
        userId,
        stakeCycleId: cycle.id,
        sliceOutcome: 'PENDING',
        plannedDate: { gte: today, lt: tomorrow },
      },
      select: { id: true },
    });
    if (!workout) return null;

    return { cycleId: cycle.id, baseSlice, workoutId: workout.id };
  }

  /**
   * restoreBaseSlice — baton-stake mechanic.
   *
   * After a successful pass, restore the outgoing holder's slice back to the base
   * rate (weeklyStake / 7) — the elevation was for the hold window only.
   * On a DROP the slice is NOT restored — the elevated amount forfeits.
   *
   * GUARDRAIL: only the holder's OWN workout is touched.
   */
  private async restoreBaseSlice(userId: string): Promise<void> {
    const target = await this.findTodaysPendingSlice(userId);
    if (!target) return;

    await prisma.workout.update({
      where: { id: target.workoutId },
      data: { stakeSliceAmount: target.baseSlice },
    });

    logger.info(
      `baton-stake: restored ${userId}'s slice to base ${target.baseSlice} after successful pass (workout ${target.workoutId})`
    );
  }

  private processPointsRaceEvent(
    game: any, userId: string, isSuccess: boolean, state: Record<string, any>,
    name: (id: string | null | undefined) => string
  ) {
    if (!isSuccess) return { updatedState: state, note: null };

    const rules = game.rules as Record<string, any>;
    const scores = (state.scores ?? {}) as Record<string, number>;
    const streakDays = (state.streak_days ?? {}) as Record<string, number>;

    scores[userId] = (scores[userId] ?? 0) + (rules.points_per_workout ?? 1);
    streakDays[userId] = (streakDays[userId] ?? 0) + 1;

    // Bonus for streak
    if (streakDays[userId] % (rules.bonus_streak ?? 3) === 0) {
      scores[userId] += 1;
    }

    state.scores = scores;
    state.streak_days = streakDays;

    const note = `${name(userId)} scored — ${scores[userId]} points.`;
    return { updatedState: state, note };
  }

  /**
   * processCollectiveEvent — Phase 4b mechanic 2 (collective charity goal).
   *
   * When a collective game target is hit, we mark the moment on the linked
   * CircleSprintGoal (if one exists).
   *
   * IMPORTANT: no donation is fired here — the actual group donation rides on
   * STAKE_SUCCESS which requires Phase 6 corporate funding.
   * TODO(phase6): wire STAKE_SUCCESS donations to collectiveCharityGoalId once
   *               the corporate funding layer is live (product-pricing-rework.md §6).
   */
  private async processCollectiveEvent(
    game: any, userId: string, isSuccess: boolean, state: Record<string, any>,
    name: (id: string | null | undefined) => string
  ) {
    if (!isSuccess) return { updatedState: state, note: null };

    state.total = (state.total ?? 0) + 1;
    const contributors: string[] = state.contributors ?? [];
    if (!contributors.includes(userId)) contributors.push(userId);
    state.contributors = contributors;

    const rules = game.rules as Record<string, any>;
    const target = rules.target ?? 30;
    const remaining = Math.max(0, target - state.total);
    const note = `${name(userId)} contributed — the room is at ${state.total} of ${target}, ${remaining} to go.`;

    // Phase 4b mechanic 2: if the game has a linked sprint (and the sprint has a
    // collective charity goal), mark the moment when target is hit.
    // Degrade gracefully — if no sprint / no goal, this is a no-op.
    if (state.total >= target && game.sprintId) {
      await this.flagCollectiveGoalHit(game).catch((err) =>
        logger.warn(`collective goal flag failed for game ${game.id}`, err)
      );
    }

    return { updatedState: state, note };
  }

  /**
   * flagCollectiveGoalHit — coordination-only (§4b mechanic 2).
   *
   * Sets collectiveGoalHitAt on the CircleSprintGoal for this sprint, marking the
   * group impact moment.  No donation is created — that is Phase 6 work.
   *
   * TODO(phase6): after Phase 6 corporate layer is built, fire STAKE_SUCCESS
   *               donations here for each member who contributed, pointing at
   *               CircleSprintGoal.collectiveCharityGoalId.
   */
  private async flagCollectiveGoalHit(game: any): Promise<void> {
    if (!game.sprintId) return;

    // Find the sprint to get the circle's sprint number
    const sprint = await prisma.sprint.findUnique({
      where: { id: game.sprintId },
      select: { id: true, seasonId: true, number: true },
    });
    if (!sprint) return;

    // Find the circle's sprint goal for this sprint number
    const sprintGoal = await prisma.circleSprintGoal.findFirst({
      where: {
        circleId: game.circleId,
        sprintNumber: sprint.number,
        collectiveGoalHitAt: null, // only mark once
      },
      select: { id: true, collectiveCharityGoalId: true },
    });

    if (!sprintGoal) return;

    await prisma.circleSprintGoal.update({
      where: { id: sprintGoal.id },
      data: { collectiveGoalHitAt: new Date() },
    });

    logger.info(
      `collective goal hit: sprint ${sprint.id}, circle ${game.circleId}, ` +
      `charity goal ${sprintGoal.collectiveCharityGoalId ?? 'none set'} — ` +
      `marked collectiveGoalHitAt. No donation fired (Phase 6 TODO).`
    );
  }

  // ── Context for calls / briefs ─────────────────────────────────────────────

  async buildStateSummary(game: any, userId: string): Promise<string> {
    // Ivy may speak this aloud — names, never user IDs.
    const names = await this.memberNames(game.circleId).catch(() => new Map<string, string>());

    // Spec-backed games describe their own state — summarise it generically.
    if (game.spec) {
      const summary = specStateSummary(game.spec, (game.state ?? {}) as Record<string, any>, userId, Object.fromEntries(names));
      return summary || `Active game: ${game.name}. ${game.description ?? ''}`.trim();
    }

    const state = game.state as Record<string, any>;
    const rules = game.rules as Record<string, any>;

    switch (game.templateType) {
      case 'relay': {
        const isHolder = state.current_holder_id === userId;
        const heldSince = state.baton_held_since
          ? new Date(state.baton_held_since).toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
          : 'unknown';
        const multiplier: number = Number(rules.baton_stake_multiplier ?? 1);
        const batonStakeNote = multiplier > 1
          ? ` Your stake is ×${multiplier} while you hold the baton.`
          : '';
        return isHolder
          ? `You hold the baton (since ${heldSince}). Complete your workout to pass it on. ${state.lives_remaining} lives left.${batonStakeNote}`
          : `${names.get(state.current_holder_id) ?? 'A circle-mate'} holds the baton. ${state.lives_remaining} lives remaining.`;
      }
      case 'points_race': {
        const scores = (state.scores ?? {}) as Record<string, number>;
        const userScore = scores[userId] ?? 0;
        const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
        const rank = sorted.findIndex(([id]) => id === userId) + 1;
        const leader = sorted[0];
        const leaderBit = leader && leader[0] !== userId
          ? `${names.get(leader[0]) ?? 'The leader'} leads with ${leader[1]} pts.`
          : `You lead the race.`;
        return `You have ${userScore} pts (rank #${rank}). ${leaderBit} Target: ${rules.target ?? 20}.`;
      }
      case 'collective': {
        const target = rules.target ?? 30;
        const total = state.total ?? 0;
        const pct = Math.round((total / target) * 100);
        return `Group total: ${total}/${target} workouts (${pct}%). ${target - total} to go.`;
      }
      default:
        return `Active game: ${game.name}. ${game.description ?? ''}`.trim();
    }
  }

  /**
   * Circle-level standing (no "you" perspective) — one line for the weekly
   * pulse and the coach console. Returns '' when there's nothing to say.
   */
  async circlePulseLine(circleId: string): Promise<string> {
    const game = await prisma.circleGame.findFirst({
      where: { circleId, status: 'active' },
      orderBy: { createdAt: 'desc' },
    });

    // No live game — was a crown taken this week? Say so once.
    if (!game) {
      const weekAgo = new Date(Date.now() - 7 * 86_400_000);
      const win = await prisma.circleGameEvent.findFirst({
        where: { eventType: 'game_won', createdAt: { gte: weekAgo }, game: { circleId } },
        orderBy: { createdAt: 'desc' },
        select: { userId: true, payload: true, game: { select: { name: true, templateType: true } } },
      });
      if (!win) return '';
      const winnerId = (win.payload as { winner_id?: string; winner?: string } | null)?.winner_id
        ?? (win.payload as { winner?: string } | null)?.winner
        ?? (win.game?.templateType === 'collective' ? null : win.userId);
      if (!winnerId) {
        // A collective win belongs to the whole room.
        return win.game?.templateType === 'collective'
          ? `The room took ${win.game?.name ?? 'the game'} together last sprint. 🏆`
          : '';
      }
      const names = await this.memberNames(circleId);
      const winnerName = names.get(winnerId);
      return winnerName ? `${winnerName} wears the ${win.game?.name ?? 'game'} crown from last sprint. 👑` : '';
    }

    const names = await this.memberNames(circleId);
    const state = game.state as Record<string, any>;
    const rules = game.rules as Record<string, any>;
    switch (game.templateType) {
      case 'relay':
        return `${names.get(state.current_holder_id) ?? 'Someone'} holds the ${game.name} baton — ${state.lives_remaining} lives left.`;
      case 'points_race': {
        const sorted = Object.entries((state.scores ?? {}) as Record<string, number>).sort(([, a], [, b]) => b - a);
        const [leadId, leadPts] = sorted[0] ?? [null, 0];
        return leadId && Number(leadPts) > 0
          ? `${names.get(leadId) ?? 'Someone'} leads ${game.name} with ${leadPts} pts — first to ${rules.target ?? 20} takes the crown.`
          : `${game.name} is on — first to ${rules.target ?? 20} points takes the crown.`;
      }
      case 'collective': {
        const target = rules.target ?? 30;
        const total = Number(state.total ?? 0);
        const deadlineDays = Number(rules.deadline_days ?? 0);
        const daysLeft = deadlineDays
          ? Math.max(0, Math.ceil((game.createdAt.getTime() + deadlineDays * 86_400_000 - Date.now()) / 86_400_000))
          : null;
        return `${game.name}: ${total} of ${target} kept days banked${daysLeft != null ? ` — ${daysLeft} day${daysLeft === 1 ? '' : 's'} left` : ''}.`;
      }
      default:
        return `${game.name} is live.`;
    }
  }

  // ── The clock ────────────────────────────────────────────────────────────────
  // Games with windows and deadlines need time to pass IN the game, not just in
  // the world. Called by the Inngest cron every 30 minutes.

  private parseDurationMs(d: string): number | null {
    const m = /^(\d+)(s|m|h|d)$/.exec(d);
    if (!m) return null;
    const unit = { s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 }[m[2] as 's' | 'm' | 'h' | 'd'];
    return Number(m[1]) * unit;
  }

  async tickGameClocks(): Promise<number> {
    const games = await prisma.circleGame.findMany({ where: { status: 'active' } });
    let ticked = 0;
    for (const game of games) {
      try {
        if ((game as { spec?: unknown }).spec) ticked += await this.tickSpecTimers(game);
        else ticked += await this.tickLegacyClock(game);
      } catch (err) {
        await opsAlert({
          severity: 'warn',
          source: 'circle-game-clock',
          title: 'game_tick_failed',
          detail: 'time is passing in the world but not in this game',
          entity: { type: 'circleGame', id: game.id },
          error: err,
        });
      }
    }
    if (ticked > 0) logger.info(`Game clocks: ${ticked} timer event(s) fired`);
    return ticked;
  }

  /**
   * Fire due spec timers as timer.elapsed events. An anchored timer re-arms
   * whenever its anchor moves (relay: dropping resets baton_held_since), so we
   * record WHICH anchor value a firing consumed under state.__timer_fired and
   * only refire when the anchor changes (or, for repeating timers, a full
   * duration after the last firing).
   */
  private async tickSpecTimers(game: any): Promise<number> {
    const spec = game.spec as { timers?: { id: string; anchor?: string; duration: string; repeats?: boolean }[] };
    let state = (game.state ?? {}) as Record<string, any>;
    const fired: Record<string, number> = { ...(state.__timer_fired ?? {}) };
    let count = 0;

    for (const t of spec.timers ?? []) {
      const dur = this.parseDurationMs(t.duration);
      if (!dur) continue;
      const anchorMs = t.anchor ? Number(state[t.anchor]) : new Date(game.createdAt).getTime();
      if (!Number.isFinite(anchorMs) || Date.now() < anchorMs + dur) continue;
      const last = fired[t.id];
      if (t.repeats ? last != null && Date.now() < last + dur : last === anchorMs) continue;

      const res = await runSpecEvent({ ...game, state }, { type: 'timer.elapsed', timerId: t.id, at: new Date().toISOString() });
      fired[t.id] = t.repeats ? Date.now() : anchorMs;
      state = { ...(res.state as Record<string, any>), __timer_fired: fired };
      await prisma.circleGame.update({ where: { id: game.id }, data: { state: state as object } });
      await this.emitSpecBeats(game, res);
      count++;
      if (res.ended) break;
    }
    return count;
  }

  /** Legacy games: enforce the relay window and the collective deadline. */
  private async tickLegacyClock(game: any): Promise<number> {
    const state = { ...(game.state as Record<string, any>) };
    const rules = game.rules as Record<string, any>;

    if (game.templateType === 'relay') {
      const heldMs = state.baton_held_since ? Date.parse(state.baton_held_since) : NaN;
      const windowMs = Number(rules.window_hours ?? 24) * 3_600_000;
      const holderId: string | null = state.current_holder_id ?? null;
      if (!holderId || !Number.isFinite(heldMs) || Date.now() < heldMs + windowMs) return 0;

      const names = await this.memberNames(game.circleId);
      const name = (id: string | null | undefined) => (id ? names.get(id) ?? 'someone' : 'someone');

      // Window blown in silence — same consequence as a logged miss.
      const { updatedState, note } = await this.processRelayEvent(game, holderId, false, state, name);
      await prisma.$transaction([
        prisma.circleGameEvent.create({
          data: { gameId: game.id, userId: holderId, eventType: 'baton_timeout', payload: {}, note },
        }),
        prisma.circleGame.update({ where: { id: game.id }, data: { state: updatedState } }),
      ]);
      const next = updatedState.current_holder_id as string | null;
      const lives = Number(updatedState.lives_remaining ?? 0);
      const msg = lives > 0
        ? `${name(holderId)}'s baton window closed — a life lost, ${lives} left. ${name(next)} picks it up.`
        : `${name(holderId)}'s baton window closed — that was the last life. The relay is over; ${state.passes ?? 0} passes was the run.`;
      this.announceBeat(game.circleId, msg, {
        gameId: game.id,
        personal: lives > 0 && next ? { userId: next, message: `The baton's yours — the window ran out on ${name(holderId)}. Keep today and steady the room.`, notify: true } : undefined,
      }).catch(() => {});
      return 1;
    }

    if (game.templateType === 'collective' && rules.deadline_days) {
      const deadline = game.createdAt.getTime() + Number(rules.deadline_days) * 86_400_000;
      if (Date.now() < deadline) return 0;
      const target = rules.target ?? 30;
      const total = Number(state.total ?? 0);
      if (total >= target) return 0; // won at the wire; win path already handled it

      await this.completeGame(game.id);
      await prisma.circleGameEvent.create({
        data: { gameId: game.id, userId: null, eventType: 'game_lost', payload: state, note: `Deadline passed at ${total}/${target}.` },
      });
      this.announceBeat(game.circleId, `Time's up on ${game.name} — the room banked ${total} of ${target}. Short this sprint, but the number's real and it resets clean. New game with the next sprint.`, { gameId: game.id }).catch(() => {});
      return 1;
    }

    return 0;
  }

  // ── Ivy the game master ──────────────────────────────────────────────────────

  /**
   * Seed the sprint's game so every circle has one without anyone lifting a
   * finger. Called at circle formation and at every sprint roll (session
   * close); a no-op when a game is already running or the room is too small.
   *
   * The default is the BATON RELAY, not the 80% Pact.
   *
   * The Pact is a shared counter: a kept day increments it, and there is
   * nothing a member can do differently because the game is running. It can be
   * reported but not played, which is why it produced standings Ivy could only
   * ever recite. The relay is the one legacy mechanic with an actual turn —
   * the baton is in YOUR hands, for a window, and dropping it costs the room a
   * life rather than costing you a number. That is the version with a moment
   * in it, and it was the one template that never auto-started.
   *
   * The Pact survives as the fallback for a room too small to pass a baton
   * around (a two-person relay is just alternating days), and as an explicit
   * choice via createGame.
   */
  async seedSprintPact(circleId: string): Promise<{ id: string } | null> {
    const existing = await prisma.circleGame.findFirst({
      where: { circleId, status: 'active' },
      select: { id: true },
    });
    if (existing) return null;

    const memberCount = await prisma.ivyCircleMember.count({ where: { circleId, isActive: true } });
    if (memberCount < 2) return null;

    const days = CircleGameService.PACT_SPRINT_DAYS;
    const target = Math.ceil(memberCount * days * CircleGameService.PACT_RATE);

    // The reigning crown carries over as narrative, not mechanics.
    const names = await this.memberNames(circleId);
    const asRelay = memberCount >= CircleGameService.RELAY_MIN_MEMBERS;
    const lastWin = await prisma.circleGameEvent.findFirst({
      where: { eventType: 'game_won', game: { circleId } },
      orderBy: { createdAt: 'desc' },
      select: { userId: true, payload: true },
    });
    const champId = (lastWin?.payload as { winner_id?: string; winner?: string } | null)?.winner_id
      ?? (lastWin?.payload as { winner?: string } | null)?.winner ?? lastWin?.userId;
    const champName = champId ? names.get(champId) : undefined;

    const crownTail = champName ? ` ${champName} wears the crown from the last game — a light nod to the reigning champion is fair game.` : '';
    const crownBeat = champName ? ` ${champName} defends the crown.` : '';

    const game = asRelay
      ? await this.createGame(circleId, {
          name: 'The Baton',
          description: `${memberCount} of you, one baton. Keep your day to pass it on. Drop it and the room loses a life — three drops and the run is over.`,
          templateType: 'relay',
          rules: { window_hours: 24, lives: 3, baton_stake_multiplier: env.BATON_DOUBLE_ENABLED ? 2 : 1 },
          ivyInstruction: `The circle is running The Baton — a relay. Whoever holds it has 24 hours to keep their day and pass it on; a drop costs the room one of its three lives. If they are the current holder, that is worth a line: the baton is theirs right now and the room is waiting on them. If they are not, keep it to a passing mention of where it sits. Never pressure someone about another member's drop.${env.BATON_DOUBLE_ENABLED ? ` A holder may double their own slice for their window by saying "double" here — mention it at most once, only to the current holder, and never push it: doubling is theirs to offer themselves, and someone who ignores it has answered.` : ''}${crownTail}`,
        })
      : await this.createGame(circleId, {
          name: 'The 80% Pact',
          description: `${memberCount} of you, one number: ${target} kept days in ${days} — the room holding 80% together. Everyone counts or nobody crowns.`,
          templateType: 'collective',
          rules: { target, deadline_days: days },
          ivyInstruction: `The circle is running The 80% Pact: ${target} kept days in ${days} days — that's the whole room holding 80% together. Every armed morning adds one. Mention the running total when it fits naturally, celebrate contributions, and if the pace slips say what's needed per day without pressure. When the target lands, make it a moment.${crownTail}`,
        });

    const firstHolder = asRelay
      ? names.get(((game as { state?: Record<string, unknown> }).state?.current_holder_id as string) ?? '')
      : undefined;

    await this.announceBeat(
      circleId,
      asRelay
        ? `New game on the table: The Baton. One of you holds it at a time — keep your day, pass it on. Three drops and the run is over.${firstHolder ? ` ${firstHolder} starts with it.` : ''}${crownBeat}`
        : `New game on the table: The 80% Pact. ${target} kept days in the next ${days} — that's this room holding 80% together. Every armed morning counts, and I'm keeping score.${crownBeat}`,
      { gameId: game.id },
    );
    logger.info(
      asRelay
        ? `Sprint relay seeded for circle ${circleId}: ${memberCount} members, 24h window, 3 lives`
        : `Sprint pact seeded for circle ${circleId}: target ${target} over ${days}d (${memberCount} members)`,
    );
    return game;
  }

  /**
   * Take the baton double — the turn's decision, and the only decision the
   * legacy relay has ever had.
   *
   * Before this, baton_stake_multiplier elevated the incoming holder's slice
   * automatically. That was both a worse game (nothing to decide) and a worse
   * product (money moved on someone's behalf without them saying yes). The
   * multiplier is now an OFFER made once per hold, and this is the only path
   * that spends it.
   *
   * GUARDRAILS, all of them load-bearing:
   *   - only the CURRENT holder, and only while the offer for this hold is open
   *   - once per hold (state.doubled short-circuits a second call)
   *   - capped at MAX_BATON_MULTIPLIER, matching the GameSpec money fence
   *   - touches the caller's OWN workout slice only; forfeits to their OWN
   *     destination. No inter-user transfer, ever.
   *
   * Returns the new slice when it applied, null when it did not — a no-op is
   * always safe to call.
   */
  async acceptBatonDouble(userId: string): Promise<{ multiplier: number; slice: number } | null> {
    const result = await this.getActiveGameForUser(userId);
    if (!result) return null;

    const { game } = result;
    if (game.templateType !== 'relay') return null;

    const state = { ...(game.state as Record<string, any>) };
    const rules = game.rules as Record<string, any>;

    // Offer must be open, unspent, and theirs.
    if (state.current_holder_id !== userId) return null;
    if (state.double_offered_to !== userId) return null;
    if (state.doubled === true) return null;

    const multiplier = Math.min(
      Number(rules.baton_stake_multiplier ?? 1),
      CircleGameService.MAX_BATON_MULTIPLIER,
    );
    if (!(multiplier > 1)) return null;

    // The window must still be open — a double after the baton has effectively
    // timed out would raise a slice that is about to forfeit anyway.
    const heldMs = state.baton_held_since ? Date.parse(state.baton_held_since) : NaN;
    const windowMs = Number(rules.window_hours ?? 24) * 3_600_000;
    if (Number.isFinite(heldMs) && Date.now() >= heldMs + windowMs) return null;

    const target = await this.findTodaysPendingSlice(userId);
    if (!target) {
      logger.info(`baton-double: no open cycle or PENDING workout today for ${userId} — declined`);
      return null;
    }

    const slice = Math.round(target.baseSlice * multiplier * 100) / 100;
    state.doubled = true;

    await prisma.$transaction([
      prisma.workout.update({
        where: { id: target.workoutId },
        data: { stakeSliceAmount: slice },
      }),
      prisma.circleGame.update({ where: { id: game.id }, data: { state } }),
      prisma.circleGameEvent.create({
        data: {
          gameId: game.id,
          userId,
          eventType: 'baton_doubled',
          // GUARDRAIL: own slice, own destination — recorded for the settlement audit trail.
          payload: { baton_multiplier: multiplier, slice, forfeit_destination: 'own_stake_destination' },
          note: `${await this.firstName(userId)} doubled down on the baton — ${slice} on today.`,
        },
      }),
    ]);

    const names = await this.memberNames(game.circleId);
    const who = names.get(userId) ?? 'Someone';
    this.announceBeat(
      game.circleId,
      `${who} just doubled down on the baton — twice the slice riding on today.`,
      { gameId: game.id },
    ).catch(() => {});

    logger.info(`baton-double: ${userId} elevated ${target.baseSlice} → ${slice} (×${multiplier})`);
    return { multiplier, slice };
  }

  /** One name, for a note written about a single member. */
  private async firstName(userId: string): Promise<string> {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { firstName: true } });
    return u?.firstName || 'Someone';
  }

  /**
   * What the game DID since Ivy last spoke to this person — not where it stands.
   *
   * A standing ("41 of 56") is weather: it can be mentioned but not discussed.
   * A beat ("Amara took the lead this afternoon") is news, and news is what makes
   * one aside worth spending. The beats are read back from the member's OWN chat
   * thread, which means they are already public to them by construction — a
   * private miss that was never announced can never leak into a call this way.
   *
   * Window: since their last completed call ("since we last spoke"), clamped to
   * 7 days so a returning user isn't read a fortnight of history, and defaulting
   * to 48h for someone who has never had a call.
   */
  private async gameBeatsSince(userId: string): Promise<string | null> {
    const lastCall = await prisma.call.findFirst({
      where: { userId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    const now = Date.now();
    const floor = now - 7 * 86_400_000;
    const since = new Date(
      lastCall ? Math.max(lastCall.createdAt.getTime(), floor) : now - 2 * 86_400_000,
    );

    const beats = await prisma.message.findMany({
      where: { userId, messageType: 'circle_game', createdAt: { gte: since } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { content: true },
    });
    if (beats.length === 0) return null;

    // Oldest first — the order they happened in, which is the order they read in.
    return beats.reverse().map((b) => b.content).join(' ');
  }

  /**
   * The unclaimed crown: this user won their circle's game in the last 14 days
   * and hasn't spent the winner's right to name the room's next pledge. Same
   * gate applyWinnerPledge (chat.service) checks silently before extraction —
   * surfaced here so chat/call Ivy can raise the prize proactively instead of
   * the right lapsing because one push notification went unread.
   */
  private async getUnclaimedCrownForUser(userId: string): Promise<{
    circleId: string;
    gameName: string;
    daysLeft: number;
  } | null> {
    const membership = await prisma.ivyCircleMember.findFirst({
      where: { userId, isActive: true },
      select: { circleId: true },
    });
    if (!membership) return null;

    const since = new Date(Date.now() - 14 * 86_400_000);
    const wins = await prisma.circleGameEvent.findMany({
      where: { eventType: 'game_won', createdAt: { gte: since }, game: { circleId: membership.circleId } },
      orderBy: { createdAt: 'desc' },
      take: 3,
      select: { userId: true, createdAt: true, payload: true, game: { select: { name: true, state: true } } },
    });
    const win = wins.find((w) => {
      const p = w.payload as { winner_id?: string; winner?: string } | null;
      return (p?.winner_id ?? p?.winner ?? w.userId) === userId;
    });
    if (!win || (win.game.state as Record<string, unknown> | null)?.pledge_claimed === true) return null;

    const daysLeft = Math.max(1, Math.ceil((win.createdAt.getTime() + 14 * 86_400_000 - Date.now()) / 86_400_000));
    return { circleId: membership.circleId, gameName: win.game.name, daysLeft };
  }

  /**
   * Room facts for pledge-drafting — where the circle actually slipped in the
   * last 14 days, so the candidates Ivy offers a crowned winner are grounded
   * instead of generic. Aggregate only: no member is named for their misses.
   */
  private async pledgeMaterial(circleId: string): Promise<string> {
    const members = await prisma.ivyCircleMember.findMany({
      where: { circleId, isActive: true },
      select: { userId: true },
    });
    if (members.length === 0) return '';

    const since = new Date(Date.now() - 14 * 86_400_000);
    const workouts = await prisma.workout.findMany({
      where: { userId: { in: members.map((m) => m.userId) }, plannedDate: { gte: since } },
      select: { status: true, armedAt: true, skippedReason: true, plannedDate: true },
    });
    if (workouts.length === 0) return '';

    const kept = workouts.filter((w) =>
      w.status === 'COMPLETED' || w.status === 'PARTIAL' ||
      (!!w.armedAt && w.status !== 'MISSED' && w.status !== 'SKIPPED'),
    ).length;
    const misses = workouts.filter((w) => w.status === 'MISSED' || w.status === 'SKIPPED');

    const parts = [
      `the room kept ${kept} of ${workouts.length} member-days (${Math.round((kept / workouts.length) * 100)}%)`,
    ];
    if (misses.length > 0) {
      const byDay = new Map<string, number>();
      for (const m of misses) {
        const day = m.plannedDate.toLocaleDateString('en-GB', { weekday: 'long' });
        byDay.set(day, (byDay.get(day) ?? 0) + 1);
      }
      const worst = [...byDay.entries()].sort((a, b) => b[1] - a[1])[0];
      parts.push(`${misses.length} day${misses.length === 1 ? '' : 's'} lost to misses/skips${worst[1] > 1 ? `, most on ${worst[0]}s` : ''}`);
      const reasons = [...new Set(misses.map((m) => m.skippedReason?.trim()).filter((r): r is string => !!r))].slice(0, 2);
      if (reasons.length) parts.push(`reasons given: ${reasons.map((r) => `"${r.slice(0, 60)}"`).join(', ')}`);
    }
    return `${parts.join('; ')}.`;
  }

  async getGameContextForUser(userId: string): Promise<{
    circle_game_name: string | null;
    circle_game_state_summary: string | null;
    circle_game_ivy_instruction: string | null;
    circle_game_recent_beats: string | null;
    circle_crown_game?: string;
    circle_crown_days_left?: number;
    circle_crown_material?: string;
  } | null> {
    // The crown check runs regardless of an active game: the next sprint's
    // pact auto-seeds at session close, so a fresh game and an unclaimed
    // crown from the previous one routinely coexist.
    const [result, crown, beats] = await Promise.all([
      this.getActiveGameForUser(userId),
      this.getUnclaimedCrownForUser(userId).catch(() => null),
      this.gameBeatsSince(userId).catch(() => null),
    ]);
    if (!result && !crown) return null;
    return {
      circle_game_name: result?.game.name ?? null,
      circle_game_state_summary: result?.stateSummary ?? null,
      circle_game_ivy_instruction: result?.game.ivyInstruction ?? null,
      circle_game_recent_beats: beats,
      ...(crown ? {
        circle_crown_game: crown.gameName,
        circle_crown_days_left: crown.daysLeft,
        circle_crown_material: await this.pledgeMaterial(crown.circleId).catch(() => ''),
      } : {}),
    };
  }
}

/**
 * specStateSummary — one-line state summary for a spec-backed game, surfaced to
 * Ivy on calls/briefs. Walks the spec's declared state and renders scalars plus
 * the caller's own per-member values; internal bookkeeping vars (lists,
 * timestamps, non-per-member maps) are omitted as noise for a spoken summary.
 * Pure + side-effect free so it's unit-testable without a DB.
 */
export function specStateSummary(
  spec: { state?: Record<string, { type: string; perMember?: boolean }> },
  state: Record<string, any>,
  userId: string,
  names?: Record<string, string>,
): string {
  const decls = spec.state ?? {};
  const parts: string[] = [];
  for (const [name, decl] of Object.entries(decls)) {
    const val = state[name];
    if (val == null) continue;
    if (decl.perMember && typeof val === 'object') {
      parts.push(`your ${labelize(name)}: ${(val as Record<string, unknown>)[userId] ?? 0}`);
    } else if (decl.type === 'userRef') {
      // Ivy speaks this — a first name, never a user id.
      parts.push(`${labelize(name)}: ${val === userId ? 'you' : names?.[String(val)] ?? 'a circle-mate'}`);
    } else if (decl.type === 'int' || decl.type === 'number' || decl.type === 'string' || decl.type === 'bool') {
      parts.push(`${labelize(name)}: ${val}`);
    }
    // list / timestamp / non-per-member map → omitted
  }
  return parts.join(' · ');
}

const labelize = (s: string): string => s.replace(/_/g, ' ');

export const circleGameService = new CircleGameService();
export default circleGameService;
