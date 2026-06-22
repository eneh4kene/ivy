/**
 * gamespec.ts — the declarative GameSpec.
 *
 * One data shape that:
 *   • Ivy's built-in templates compile to (see templates.ts)
 *   • the LLM game-compiler targets (see compiler.ts)
 *   • the generic interpreter executes (see interpreter.ts)
 *
 * Design doc: docs/game-spec-schema.md
 *
 * The money fence (StakeEffects) is enforced HERE at parse time: a spec that
 * tries to move money between users, or exceed the multiplier cap, is rejected
 * by Zod before it can ever run.
 */
import { z } from 'zod';

// Real-world events a game reacts to. Mirrors CircleGameEvent.eventType plus
// the timer tick the interpreter raises when a declared timer elapses.
export const TRIGGERS = [
  'workout.logged',
  'workout.missed',
  'vn.armed',
  'streak.extended',
  'member.joined',
  'member.left',
  'timer.elapsed',
] as const;
export const Trigger = z.enum(TRIGGERS);
export type Trigger = z.infer<typeof Trigger>;

// Declared state variable. Shape is fixed in the spec so the interpreter knows
// it and the LLM referee cannot invent fields.
export const StateVar = z.object({
  type: z.enum(['int', 'number', 'bool', 'string', 'map', 'list', 'userRef', 'timestamp']),
  initial: z.any(),
  // map keyed by userId, auto-seeded from circle members at game start
  // (scores, streaks, per-member lives, …)
  perMember: z.boolean().default(false),
});
export type StateVar = z.infer<typeof StateVar>;

// The deterministic effect vocabulary. Small on purpose; anything outside it
// falls to `adjudicate` (LLM referee). `target` is a state path that may use
// dynamic segments resolved against the event, e.g. "scores[event.userId]".
// `by` / `value` may be a literal or an expression string.
export const Effect = z.discriminatedUnion('op', [
  z.object({ op: z.literal('increment'), target: z.string(), by: z.union([z.number(), z.string()]).default(1) }),
  z.object({ op: z.literal('decrement'), target: z.string(), by: z.union([z.number(), z.string()]).default(1), floor: z.number().optional() }),
  z.object({ op: z.literal('set'), target: z.string(), value: z.any() }),
  z.object({ op: z.literal('advanceTurn'), order: z.string(), indexVar: z.string(), holderVar: z.string().optional() }),
  z.object({ op: z.literal('appendUnique'), target: z.string(), value: z.string() }),
  z.object({ op: z.literal('resetTimer'), timer: z.string() }),
  z.object({ op: z.literal('announce'), message: z.string() }), // → CircleGameEvent.note
  z.object({ op: z.literal('adjudicate'), rule: z.string() }),  // hand to LLM referee
]);
export type Effect = z.infer<typeof Effect>;

export const Transition = z.object({
  on: Trigger,
  when: z.string().optional(),        // safe expression; omitted ⇒ always fires
  effects: z.array(Effect).max(8),
  // optional event raised when this transition fires (for the audit log)
  emits: z.string().optional(),
});
export type Transition = z.infer<typeof Transition>;

export const Timer = z.object({
  id: z.string(),
  anchor: z.string().optional(),      // state path the clock starts from, e.g. "baton_held_since"
  duration: z.string().regex(/^\d+(s|m|h|d)$/), // "24h", "28d", "30m"
  repeats: z.boolean().default(false),
});
export type Timer = z.infer<typeof Timer>;

export const EndCondition = z.object({
  when: z.string(),                   // predicate, e.g. "lives <= 0" / "max(scores) >= target"
  outcome: z.enum(['win', 'lose', 'complete']),
  winner: z.string().optional(),      // expression, e.g. "argmax(scores)"
});
export type EndCondition = z.infer<typeof EndCondition>;

// THE MONEY FENCE. `sameUserOnly` and `requiresOptIn` are z.literal(true): a
// spec literally cannot set them false. Money can only ever raise/lower a
// user's OWN at-risk stake slice — never transfer between users. Mirrors the
// baton_stake guardrail in circle-game.service.ts.
export const StakeEffects = z.object({
  enabled: z.boolean().default(false),
  multiplierMax: z.number().min(1).max(3).default(1), // HARD CAP
  sameUserOnly: z.literal(true).default(true),
  requiresOptIn: z.literal(true).default(true),
}).strict();
export type StakeEffects = z.infer<typeof StakeEffects>;

export const GameSpec = z.object({
  schemaVersion: z.literal(1),
  name: z.string().min(1).max(80),
  description: z.string().max(280).default(''),

  author: z.enum(['ivy_template', 'circle_custom']),
  engine: z.enum(['deterministic', 'llm_adjudicated', 'hybrid']),
  topology: z.enum(['individual', 'turn_based', 'collective']),

  state: z.record(StateVar),
  triggers: z.array(Trigger).min(1),
  timers: z.array(Timer).max(4).default([]),
  transitions: z.array(Transition).max(20),
  endConditions: z.array(EndCondition).min(1), // ≥1 ⇒ liveness (also checked by dry-run)

  stakeEffects: StakeEffects.default({}),

  narration: z.object({
    instruction: z.string().max(1200),
    bindings: z.record(z.string()).default({}),
  }),
}).strict();
export type GameSpec = z.infer<typeof GameSpec>;

/** Runtime state is a free-form bag whose keys are the declared state vars. */
export type GameState = Record<string, unknown>;

/** A domain event handed to the interpreter. */
export interface GameEvent {
  type: Trigger;
  userId?: string;
  timerId?: string;
  at: string; // ISO timestamp
  [k: string]: unknown;
}

/** Parse + structurally validate. Throws ZodError on a malformed/over-cap spec. */
export function parseSpec(input: unknown): GameSpec {
  return GameSpec.parse(input);
}
