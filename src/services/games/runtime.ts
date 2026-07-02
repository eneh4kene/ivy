/**
 * runtime.ts — the persistence adapter around the pure interpreter.
 *
 * This is the impure shell: it loads a game, runs `applyEvent` (pure), and
 * writes the new state + audit events back. It is deliberately runtime-agnostic
 * — today it is called synchronously from circle-game.service on workout events,
 * and from the cron worker for timer ticks. If/when Inngest is adopted as the
 * durable backbone (founder decision, see docs/game-spec-schema.md), the SAME
 * functions are called from a step.run — nothing here changes.
 *
 * Two deferred hooks, kept honest rather than faked:
 *   • Stake/money effects — NOT moved here. Games needing baton-stake stay on the
 *     legacy processor until generic stake wiring gets its own guardrailed design
 *     pass (must preserve sameUserOnly / no inter-user transfer). The spec still
 *     carries the capped fence for narration + future use.
 *   • LLM referee (`adjudicate`) — surfaced in `result.adjudications`; wiring the
 *     referee call is the next step for hybrid/llm_adjudicated games.
 */
import prisma from '../../utils/prisma';
import logger from '../../utils/logger';
import { applyEvent, initState, type ApplyResult } from './interpreter';
import { parseSpec, type GameEvent, type GameSpec, type Trigger } from './gamespec';

type CircleGameRow = { id: string; spec: unknown; state: unknown; status: string };

/** Map a workout outcome to the game trigger the interpreter understands. */
export function workoutTrigger(status: 'COMPLETED' | 'PARTIAL' | 'SKIPPED' | 'MISSED'): Trigger {
  return status === 'COMPLETED' || status === 'PARTIAL' ? 'workout.logged' : 'workout.missed';
}

/**
 * Create a spec-backed game: validate, seed state from members, persist.
 * `validateSpec` (the full gate) is expected to have run already at authoring
 * time; we re-parse here to pin the spec shape at start.
 */
export async function createSpecGame(opts: {
  circleId: string;
  sprintId?: string | null;
  spec: GameSpec;
  memberIds: string[];
}) {
  const spec = parseSpec(opts.spec); // pin/validate shape at creation

  // The LLM referee is not wired yet (runSpecEvent only logs pending
  // adjudications), so a game that depends on it would sit stuck forever.
  // Refuse loudly at creation instead of stalling silently mid-game.
  if (spec.engine !== 'deterministic') {
    throw new Error(
      `Game "${spec.name}" needs the LLM referee (engine: ${spec.engine}), which isn't live yet. ` +
      'Rephrase the game so outcomes are decided by counts, streaks, or timers alone.'
    );
  }

  const state = initState(spec, opts.memberIds);
  const game = await prisma.circleGame.create({
    data: {
      circleId: opts.circleId,
      sprintId: opts.sprintId ?? null,
      name: spec.name,
      description: spec.description ?? null,
      templateType: spec.author === 'ivy_template' ? 'spec_template' : 'spec_custom',
      rules: {},
      ivyInstruction: spec.narration.instruction,
      spec: spec as unknown as object,
      state: state as object,
      status: 'active',
    },
  });
  logger.info(`createSpecGame: ${game.id} "${spec.name}" (${spec.engine}/${spec.topology}) for circle ${opts.circleId}`);
  return game;
}

/**
 * Run one event through a spec-backed game and persist the outcome atomically.
 * Returns the interpreter result (notes/emits/ended/adjudications/timerResets).
 */
export async function runSpecEvent(game: CircleGameRow, event: GameEvent): Promise<ApplyResult> {
  const spec = parseSpec(game.spec);
  const prevState = (game.state ?? {}) as Record<string, unknown>;
  const result = applyEvent(spec, prevState, event);

  const actor = event.userId ?? 'system';
  const note = result.notes.length ? result.notes.join(' ') : null;

  // One row for the triggering event (carrying the human-readable note), plus a
  // row per emitted game event for the audit trail Ivy reads on calls.
  const rows = [
    prisma.circleGameEvent.create({
      data: { gameId: game.id, userId: actor, eventType: event.type, payload: {}, note },
    }),
    ...result.emits.map((emit) =>
      prisma.circleGameEvent.create({
        data: { gameId: game.id, userId: actor, eventType: emit, payload: {}, note: null },
      }),
    ),
    prisma.circleGame.update({ where: { id: game.id }, data: { state: result.state as object } }),
  ];
  await prisma.$transaction(rows);

  if (result.ended) {
    await prisma.circleGame.update({
      where: { id: game.id },
      data: { status: 'completed', completedAt: new Date() },
    });
    await prisma.circleGameEvent.create({
      data: {
        gameId: game.id,
        userId: result.ended.winner ?? actor,
        eventType: 'game_won',
        payload: { outcome: result.ended.outcome, winner: result.ended.winner ?? null },
        note: `Game ${result.ended.outcome}${result.ended.winner ? ` — winner ${result.ended.winner}` : ''}.`,
      },
    });
    logger.info(`runSpecEvent: game ${game.id} ended (${result.ended.outcome})`);
  }

  // Deferred hooks — surfaced, not silently dropped.
  if (result.adjudications.length) {
    logger.info(`runSpecEvent: game ${game.id} has ${result.adjudications.length} pending adjudication(s) — LLM referee wiring TODO`);
  }
  if (spec.stakeEffects.enabled) {
    logger.info(`runSpecEvent: game ${game.id} has stakeEffects enabled — money stays on the legacy guardrailed path (no-op here)`);
  }

  return result;
}
