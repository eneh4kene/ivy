import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { sendPushToUser, pushTemplates } from './push.service';
import { createSpecGame as persistSpecGame, runSpecEvent, workoutTrigger } from './games/runtime';
import { compileGame, validateSpec } from './games/compiler';

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
    const result = await this.getActiveGameForUser(userId);
    if (!result) return;

    const { game } = result;

    // Spec-backed games run on the generic interpreter (src/services/games).
    // Legacy games (spec == null) fall through to the hard-coded processors below.
    if ((game as { spec?: unknown }).spec) {
      await runSpecEvent(game as any, {
        type: workoutTrigger(workoutStatus),
        userId,
        at: new Date().toISOString(),
      });
      return;
    }

    const isSuccess = workoutStatus === 'COMPLETED' || workoutStatus === 'PARTIAL';
    const eventType = isSuccess ? 'workout_completed' : 'workout_missed';

    let note: string | null = null;
    let updatedState = { ...(game.state as Record<string, any>) };
    let extraEventType: string | null = null;
    let extraPayload: Record<string, any> = {};

    switch (game.templateType) {
      case 'relay':
        ({ updatedState, note, extraEventType, extraPayload } = await this.processRelayEvent(
          game, userId, isSuccess, updatedState
        ));
        break;

      case 'points_race':
        ({ updatedState, note } = this.processPointsRaceEvent(game, userId, isSuccess, updatedState));
        if (isSuccess) extraEventType = 'points_awarded';
        break;

      case 'collective':
        ({ updatedState, note } = await this.processCollectiveEvent(game, userId, isSuccess, updatedState));
        break;

      default:
        // custom — just log the event, Ivy handles everything via ivyInstruction
        note = isSuccess
          ? `${userId} completed a workout`
          : `${userId} missed a workout`;
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

    // Check win condition for collective / points_race
    if (game.templateType === 'collective') {
      const rules = game.rules as Record<string, any>;
      if (updatedState.total >= (rules.target ?? 30)) {
        await this.completeGame(game.id);
        await prisma.circleGameEvent.create({
          data: { gameId: game.id, userId, eventType: 'game_won', payload: updatedState, note: 'Group hit the target!' },
        });
      }
    }
    if (game.templateType === 'points_race') {
      const rules = game.rules as Record<string, any>;
      const scores = updatedState.scores as Record<string, number>;
      const winner = Object.entries(scores).find(([, pts]) => pts >= (rules.target ?? 20));
      if (winner) {
        await this.completeGame(game.id);
        await prisma.circleGameEvent.create({
          data: { gameId: game.id, userId: winner[0], eventType: 'game_won', payload: { winner_id: winner[0], score: winner[1] }, note: `${winner[0]} won the race with ${winner[1]} points!` },
        });
      }
    }
  }

  private async processRelayEvent(
    game: any, userId: string, isSuccess: boolean, state: Record<string, any>
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

      // Baton-stake: restore previous holder's slice to base, then elevate the new holder's
      if (batonMultiplier > 1) {
        // Restore outgoing holder's slice to base (baton released successfully)
        await this.restoreBaseSlice(userId);
        // Elevate new holder's slice
        await this.elevateHolderSlice(nextHolder, batonMultiplier);
      }

      state.current_holder_index = nextIndex;
      state.current_holder_id = nextHolder;
      state.baton_held_since = new Date().toISOString();
      state.passes = (state.passes ?? 0) + 1;
      note = `Baton passed from ${userId} to ${nextHolder}`;
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
            note: `Baton drop: ${userId}'s elevated stake slice (×${batonMultiplier}) forfeits to their own destination.`,
          },
        });
        // Elevate new holder's slice
        await this.elevateHolderSlice(nextHolder, batonMultiplier);
      }

      state.current_holder_index = nextIndex;
      state.current_holder_id = nextHolder;
      state.baton_held_since = new Date().toISOString();
      state.lives_remaining = Math.max(0, (state.lives_remaining ?? 3) - 1);
      note = `Baton dropped by ${userId} — life lost. ${state.lives_remaining} lives remaining. Passed to ${nextHolder}.`;
      if (state.lives_remaining === 0) {
        await this.completeGame(game.id);
        note += ' Game over — no lives left.';
      }
    } else if (!isSuccess && userId !== holderId) {
      // Non-holder missed — no mechanical effect, but log it
      note = `${userId} missed a workout (not the current holder, no effect)`;
    }

    return { updatedState: state, note, extraEventType, extraPayload };
  }

  /**
   * elevateHolderSlice — baton-stake mechanic (§4b mechanic 3).
   *
   * Finds the new holder's most-recent PENDING workout in the current open stake cycle
   * and multiplies its stakeSliceAmount by the baton multiplier.
   *
   * GUARDRAIL: only the holder's OWN workout is touched.  No other user's slice changes.
   * Money never moves between users — only the holder's own at-risk amount increases.
   */
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

  private async elevateHolderSlice(userId: string, multiplier: number): Promise<void> {
    if (multiplier <= 1) return; // no-op for multiplier ≤ 1

    const target = await this.findTodaysPendingSlice(userId);
    if (!target) {
      logger.info(`baton-stake: no open cycle or PENDING workout today for ${userId} — elevation skipped`);
      return;
    }

    const elevatedSlice = Math.round(target.baseSlice * multiplier * 100) / 100;
    await prisma.workout.update({
      where: { id: target.workoutId },
      data: { stakeSliceAmount: elevatedSlice },
    });

    logger.info(
      `baton-stake: elevated ${userId}'s slice from ${target.baseSlice} → ${elevatedSlice} ` +
      `(×${multiplier}) for workout ${target.workoutId}`
    );
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
    game: any, userId: string, isSuccess: boolean, state: Record<string, any>
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

    const note = `${userId} scored. Total: ${scores[userId]} pts`;
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
    game: any, userId: string, isSuccess: boolean, state: Record<string, any>
  ) {
    if (!isSuccess) return { updatedState: state, note: null };

    state.total = (state.total ?? 0) + 1;
    const contributors: string[] = state.contributors ?? [];
    if (!contributors.includes(userId)) contributors.push(userId);
    state.contributors = contributors;

    const rules = game.rules as Record<string, any>;
    const target = rules.target ?? 30;
    const remaining = Math.max(0, target - state.total);
    const note = `${userId} contributed. Group total: ${state.total}/${target}. ${remaining} to go.`;

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
    // Spec-backed games describe their own state — summarise it generically.
    if (game.spec) {
      const summary = specStateSummary(game.spec, (game.state ?? {}) as Record<string, any>, userId);
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
          : `${state.current_holder_id ?? 'Someone'} holds the baton. ${state.lives_remaining} lives remaining.`;
      }
      case 'points_race': {
        const scores = (state.scores ?? {}) as Record<string, number>;
        const userScore = scores[userId] ?? 0;
        const sorted = Object.entries(scores).sort(([, a], [, b]) => b - a);
        const rank = sorted.findIndex(([id]) => id === userId) + 1;
        const leader = sorted[0];
        return `You have ${userScore} pts (rank #${rank}). Leader has ${leader?.[1] ?? 0} pts. Target: ${rules.target ?? 20}.`;
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

  async getGameContextForUser(userId: string): Promise<{
    circle_game_name: string;
    circle_game_state_summary: string;
    circle_game_ivy_instruction: string;
  } | null> {
    const result = await this.getActiveGameForUser(userId);
    if (!result) return null;
    return {
      circle_game_name: result.game.name,
      circle_game_state_summary: result.stateSummary,
      circle_game_ivy_instruction: result.game.ivyInstruction,
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
): string {
  const decls = spec.state ?? {};
  const parts: string[] = [];
  for (const [name, decl] of Object.entries(decls)) {
    const val = state[name];
    if (val == null) continue;
    if (decl.perMember && typeof val === 'object') {
      parts.push(`your ${labelize(name)}: ${(val as Record<string, unknown>)[userId] ?? 0}`);
    } else if (decl.type === 'userRef') {
      parts.push(`${labelize(name)}: ${val === userId ? 'you' : String(val)}`);
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
