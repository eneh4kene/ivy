import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { sendPushToUser, pushTemplates } from './push.service';

// ─── Template definitions ─────────────────────────────────────────────────────
// Each template describes the mechanical rules Ivy's backend enforces.
// The plain-language ivyInstruction is written by the circle when creating a game.

export const GAME_TEMPLATES = {
  relay: {
    name: 'Baton Relay',
    description: 'One member holds the baton. Complete your workout to pass it to the next person. Drop it and the group loses a life.',
    defaultRules: {
      turn_order: [],        // userId array; populated from circle members at game start
      window_hours: 24,      // how long the holder has before the baton drops
      lives: 3,              // group lives before game over
    },
    defaultInstruction: `You're running a baton relay for the circle. {holder_name} currently holds the baton. When they log a workout, pass it to {next_name} and tell the group. If they miss their window, announce the drop, deduct a life, and pass to {next_name} anyway. The group has {lives} lives left. Keep it light and competitive — celebrate passes, commiserate drops, and remind the current holder their window closes at {deadline}.`,
  },
  points_race: {
    name: 'Points Race',
    description: 'Every completed workout earns points. First to the target wins.',
    defaultRules: {
      points_per_workout: 1,
      bonus_streak: 3,       // consecutive days to trigger bonus point
      target: 20,
    },
    defaultInstruction: `This is a points race — {target} points wins. Each completed workout earns 1 point; a {bonus_streak}-day streak earns a bonus. Current standings: {scores_summary}. Mention the leader briefly when relevant. Congratulate someone who scores. If someone hasn't moved in 3+ days, note it warmly — "you're only {gap} points behind, still very catchable."`,
  },
  collective: {
    name: 'Group Challenge',
    description: 'The whole circle works toward a shared target. Everyone wins or no-one does.',
    defaultRules: {
      target: 30,            // total workouts needed
      deadline_days: 28,
    },
    defaultInstruction: `The group is chasing a collective target of {target} workouts in {deadline_days} days. You're at {total} so far — {remaining} to go. Celebrate each contribution. If the pace is behind, note it without pressure: "you need {daily_rate} workouts a day to hit it — still doable." When you hit the target, make it a moment.`,
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
        ({ updatedState, note } = this.processCollectiveEvent(game, userId, isSuccess, updatedState));
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

    if (userId === holderId && isSuccess) {
      // Pass the baton to the next person
      const nextIndex = (currentIndex + 1) % turnOrder.length;
      const nextHolder = turnOrder[nextIndex];
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

  private processCollectiveEvent(
    game: any, userId: string, isSuccess: boolean, state: Record<string, any>
  ) {
    if (!isSuccess) return { updatedState: state, note: null };

    state.total = (state.total ?? 0) + 1;
    const contributors: string[] = state.contributors ?? [];
    if (!contributors.includes(userId)) contributors.push(userId);
    state.contributors = contributors;

    const rules = game.rules as Record<string, any>;
    const remaining = Math.max(0, (rules.target ?? 30) - state.total);
    const note = `${userId} contributed. Group total: ${state.total}/${rules.target ?? 30}. ${remaining} to go.`;
    return { updatedState: state, note };
  }

  // ── Context for calls / briefs ─────────────────────────────────────────────

  async buildStateSummary(game: any, userId: string): Promise<string> {
    const state = game.state as Record<string, any>;
    const rules = game.rules as Record<string, any>;

    switch (game.templateType) {
      case 'relay': {
        const isHolder = state.current_holder_id === userId;
        const heldSince = state.baton_held_since
          ? new Date(state.baton_held_since).toLocaleDateString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' })
          : 'unknown';
        return isHolder
          ? `You hold the baton (since ${heldSince}). Complete your workout to pass it on. ${state.lives_remaining} lives left.`
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

export const circleGameService = new CircleGameService();
export default circleGameService;
