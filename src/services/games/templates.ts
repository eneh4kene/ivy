/**
 * templates.ts — Ivy's built-in games, expressed as GameSpec factories.
 *
 * These reproduce the exact mechanics currently hard-coded in
 * circle-game.service.ts (relay / points_race / collective). They are the
 * regression baseline: the generic interpreter running these specs must
 * produce the same state transitions as the legacy processWorkoutEvent.
 *
 * Each is a factory taking the same parameters the legacy `rules` object
 * carried, so circles keep their tuning knobs (lives, target, …).
 *
 * NOTE on baton-stake money: the legacy relay also raises/lowers the holder's
 * OWN stake slice (elevateHolderSlice/restoreBaseSlice). That side-effect is
 * NOT modelled as a generic effect — it stays in a dedicated, audited handler
 * gated by stakeEffects. The spec only carries the fence + the multiplier; the
 * runtime adapter invokes the same guardrailed stake code. See gamespec.ts.
 */
import type { GameSpec } from './gamespec';

export interface RelayParams { lives?: number; windowHours?: number; batonMultiplier?: number; }
export function relaySpec(p: RelayParams = {}): GameSpec {
  const lives = p.lives ?? 3;
  const windowHours = p.windowHours ?? 24;
  const batonMultiplier = p.batonMultiplier ?? 1;
  return {
    schemaVersion: 1,
    name: 'Baton Relay',
    description:
      'One member holds the baton. Complete your workout to pass it on. Drop it and the group loses a life.',
    author: 'ivy_template',
    engine: 'deterministic',
    topology: 'turn_based',
    state: {
      turn_order: { type: 'list', initial: '@members', perMember: false },
      current_holder_index: { type: 'int', initial: 0, perMember: false },
      current_holder_id: { type: 'userRef', initial: '@members[0]', perMember: false },
      baton_held_since: { type: 'timestamp', initial: 'now', perMember: false },
      lives_remaining: { type: 'int', initial: lives, perMember: false },
      passes: { type: 'int', initial: 0, perMember: false },
    },
    triggers: ['workout.logged', 'workout.missed', 'timer.elapsed'],
    timers: [{ id: 'window', anchor: 'baton_held_since', duration: `${windowHours}h`, repeats: false }],
    transitions: [
      // Holder logs a workout → pass the baton on.
      {
        on: 'workout.logged',
        when: 'event.userId == current_holder_id',
        effects: [
          { op: 'increment', target: 'passes', by: 1 },
          { op: 'advanceTurn', order: 'turn_order', indexVar: 'current_holder_index', holderVar: 'current_holder_id' },
          { op: 'set', target: 'baton_held_since', value: 'now()' },
          { op: 'resetTimer', timer: 'window' },
          { op: 'announce', message: 'Baton passed!' },
        ],
        emits: 'baton_passed',
      },
      // Holder misses → drop: lose a life, pass anyway.
      {
        on: 'workout.missed',
        when: 'event.userId == current_holder_id',
        effects: dropEffects(),
        emits: 'baton_dropped',
      },
      // Window elapsed without a pass → same drop.
      {
        on: 'timer.elapsed',
        when: "event.timerId == 'window'",
        effects: dropEffects(),
        emits: 'baton_dropped',
      },
    ],
    endConditions: [{ when: 'lives_remaining <= 0', outcome: 'lose' }],
    stakeEffects: {
      enabled: batonMultiplier > 1,
      multiplierMax: Math.min(3, Math.max(1, batonMultiplier)) as number,
      sameUserOnly: true,
      requiresOptIn: true,
    },
    narration: {
      instruction:
        "You're running a baton relay for the circle. {holder_name} currently holds the baton. When they log a workout, pass it to {next_name} and tell the group. If they miss their window, announce the drop, deduct a life, and pass to {next_name} anyway. The group has {lives} lives left. Keep it light and competitive — celebrate passes, commiserate drops, and remind the current holder their window closes at {deadline}.",
      bindings: {
        holder_name: 'current_holder_id|userName',
        next_name: 'turn_order[current_holder_index+1]|userName',
        lives: 'lives_remaining',
        deadline: 'baton_held_since+window',
      },
    },
  };

  function dropEffects(): GameSpec['transitions'][number]['effects'] {
    return [
      { op: 'decrement', target: 'lives_remaining', by: 1, floor: 0 },
      { op: 'advanceTurn', order: 'turn_order', indexVar: 'current_holder_index', holderVar: 'current_holder_id' },
      { op: 'set', target: 'baton_held_since', value: 'now()' },
      { op: 'resetTimer', timer: 'window' },
      { op: 'announce', message: 'Baton dropped — a life lost.' },
    ];
  }
}

export interface PointsParams { pointsPerWorkout?: number; bonusStreak?: number; target?: number; }
export function pointsRaceSpec(p: PointsParams = {}): GameSpec {
  const pts = p.pointsPerWorkout ?? 1;
  const bonusStreak = p.bonusStreak ?? 3;
  const target = p.target ?? 20;
  return {
    schemaVersion: 1,
    name: 'Points Race',
    description: 'Every completed workout earns points. First to the target wins.',
    author: 'ivy_template',
    engine: 'deterministic',
    topology: 'individual',
    state: {
      scores: { type: 'map', initial: {}, perMember: true },
      streak_days: { type: 'map', initial: {}, perMember: true },
    },
    triggers: ['workout.logged'],
    timers: [],
    transitions: [
      // Base award + streak bump (always).
      {
        on: 'workout.logged',
        effects: [
          { op: 'increment', target: 'streak_days[event.userId]', by: 1 },
          { op: 'increment', target: 'scores[event.userId]', by: pts },
        ],
        emits: 'points_awarded',
      },
      // Streak bonus, evaluated AFTER the streak bump above.
      {
        on: 'workout.logged',
        when: `streak_days[event.userId] % ${bonusStreak} == 0`,
        effects: [{ op: 'increment', target: 'scores[event.userId]', by: 1 }],
        emits: 'streak_bonus',
      },
    ],
    endConditions: [{ when: `max(scores) >= ${target}`, outcome: 'win', winner: 'argmax(scores)' }],
    stakeEffects: { enabled: false, multiplierMax: 1, sameUserOnly: true, requiresOptIn: true },
    narration: {
      instruction:
        'This is a points race — {target} points wins. Each completed workout earns a point; a {bonus_streak}-day streak earns a bonus. Mention the leader briefly when relevant, congratulate scorers, and nudge anyone who has stalled warmly.',
      bindings: { target: String(target), bonus_streak: String(bonusStreak) },
    },
  };
}

export interface CollectiveParams { target?: number; deadlineDays?: number; }
export function collectiveSpec(p: CollectiveParams = {}): GameSpec {
  const target = p.target ?? 30;
  const deadlineDays = p.deadlineDays ?? 28;
  return {
    schemaVersion: 1,
    name: 'Group Challenge',
    description: 'The whole circle works toward a shared target. Everyone wins or no-one does.',
    author: 'ivy_template',
    engine: 'deterministic',
    topology: 'collective',
    state: {
      total: { type: 'int', initial: 0, perMember: false },
      contributors: { type: 'list', initial: [], perMember: false },
    },
    triggers: ['workout.logged', 'timer.elapsed'],
    timers: [{ id: 'deadline', duration: `${deadlineDays}d`, repeats: false }],
    transitions: [
      {
        on: 'workout.logged',
        effects: [
          { op: 'increment', target: 'total', by: 1 },
          { op: 'appendUnique', target: 'contributors', value: 'event.userId' },
        ],
        emits: 'group_progress',
      },
    ],
    endConditions: [
      { when: `total >= ${target}`, outcome: 'complete' },
      { when: "event.timerId == 'deadline'", outcome: 'lose' },
    ],
    stakeEffects: { enabled: false, multiplierMax: 1, sameUserOnly: true, requiresOptIn: true },
    narration: {
      instruction:
        'The group is chasing a collective target of {target} workouts in {deadline_days} days. Celebrate each contribution. If the pace is behind, note it without pressure. When you hit the target, make it a moment.',
      bindings: { target: String(target), deadline_days: String(deadlineDays) },
    },
  };
}

export const TEMPLATE_FACTORIES = {
  relay: relaySpec,
  points_race: pointsRaceSpec,
  collective: collectiveSpec,
} as const;
export type TemplateKey = keyof typeof TEMPLATE_FACTORIES;
