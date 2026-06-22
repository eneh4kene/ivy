# Game Spec Schema

> **Status:** BUILT & tested (June 2026). The keystone data structure for Circle games.
> Companion to `product-pricing-rework.md`. Generalises the current
> `circle-game.service.ts` (`templateType` / `rules` / `state` /
> `ivyInstruction` + `CircleGameEvent`) into one declarative spec that
> Ivy's templates, the LLM game-compiler, the generic runtime, and the
> LLM referee all key off.

## Why a spec

Today `circle-game.service.ts` switches mechanics on `templateType`
(`relay` / `points_race` / `collective` / `custom`). The `custom`
template is a placeholder: *"Ivy reads ivyInstruction and manages
everything conversationally."* There is no engine behind it.

A declarative **GameSpec** replaces the switch. Mechanics are described
as data, not branched in code. Then:

- **Templates** become named presets that produce a spec.
- **Custom games** are LLM-authored specs in the same shape.
- **One generic runtime** interprets any spec — never changes per game.
- **Safety caps** (the money fence) live in the schema and are enforced
  at parse time, so a hallucinated or malicious spec is rejected before
  it can run.

## The schema (Zod)

Zod because the stack already uses it (`env.ts`, auth schemas) and it
does triple duty: runtime types, **validation of LLM output**, and
**enforcement of the money caps**.

```ts
import { z } from 'zod';

// ── Vocabulary: real-world events a game can react to ───────────────────────
// (generalises CircleGameEvent.eventType + Ivy domain events)
const Trigger = z.enum([
  'workout.logged', 'workout.missed', 'vn.armed',
  'streak.extended', 'member.joined', 'member.left',
  'timer.elapsed',                 // a declared timer fired (baton window, deadline)
]);

// ── Declared state: shape fixed in the spec so the interpreter knows it
//    AND the LLM referee can't invent fields ──────────────────────────────────
const StateVar = z.object({
  type: z.enum(['int','number','bool','string','map','list','userRef','timestamp']),
  initial: z.any(),
  perMember: z.boolean().default(false),   // map keyed by userId → scores, streaks, lives
});

// ── Effects: the DETERMINISTIC vocabulary. Small on purpose. ─────────────────
const Effect = z.discriminatedUnion('op', [
  z.object({ op: z.literal('increment'),    target: z.string(), by: z.union([z.number(), z.string()]).default(1) }),
  z.object({ op: z.literal('decrement'),    target: z.string(), by: z.number().default(1), floor: z.number().optional() }),
  z.object({ op: z.literal('set'),          target: z.string(), value: z.any() }),
  z.object({ op: z.literal('advanceTurn'),  order: z.string() }),                 // baton pass
  z.object({ op: z.literal('appendUnique'), target: z.string(), value: z.string() }), // contributors
  z.object({ op: z.literal('announce'),     message: z.string() }),               // → CircleGameEvent.note
  z.object({ op: z.literal('adjudicate'),   rule: z.string() }),                  // hand to LLM referee
]);

// ── Transition: when <trigger> [and <when>], apply <effects> ────────────────
const Transition = z.object({
  on: Trigger,
  when: z.string().optional(),       // SAFE expression over state, e.g. "holder == event.userId"
  effects: z.array(Effect).max(8),
});

// ── Timers → drive Inngest sleepUntil and emit timer.elapsed ────────────────
const Timer = z.object({
  id: z.string(),
  anchor: z.string().optional(),     // state path the clock starts from, e.g. "baton_held_since"
  duration: z.string(),              // "24h", "28d"
  repeats: z.boolean().default(false),
});

// ── End conditions → loop exit + settlement ─────────────────────────────────
const EndCondition = z.object({
  when: z.string(),                  // predicate: "lives <= 0", "max(scores) >= target"
  outcome: z.enum(['win','lose','complete']),
  winner: z.string().optional(),     // "argmax(scores)"
});

// ── THE MONEY FENCE — generalises the baton_stake_multiplier guardrail ──────
const StakeEffects = z.object({
  enabled:       z.boolean().default(false),
  multiplierMax: z.number().min(1).max(3).default(1),  // HARD CAP, schema-enforced
  sameUserOnly:  z.literal(true),                      // can NEVER be false — no inter-user transfer
  requiresOptIn: z.literal(true),
}).strict();

// ── The full spec ───────────────────────────────────────────────────────────
export const GameSpec = z.object({
  schemaVersion: z.literal(1),
  name: z.string().max(80),
  description: z.string().max(280),

  author: z.enum(['ivy_template', 'circle_custom']),
  engine: z.enum(['deterministic', 'llm_adjudicated', 'hybrid']),
  topology: z.enum(['individual', 'turn_based', 'collective']),

  state:        z.record(StateVar),
  triggers:     z.array(Trigger),
  timers:       z.array(Timer).max(4),
  transitions:  z.array(Transition).max(20),
  endConditions: z.array(EndCondition).min(1),       // ≥1 → liveness (see safety)

  stakeEffects: StakeEffects.default({ enabled: false, multiplierMax: 1, sameUserOnly: true, requiresOptIn: true }),

  narration: z.object({
    instruction: z.string().max(1200),               // the current ivyInstruction
    bindings: z.record(z.string()).default({}),      // {holder_name: "state.current_holder_id|userName"}
  }),
}).strict();

export type GameSpec = z.infer<typeof GameSpec>;
```

## Worked example: baton relay as a spec

Proves the richest current template (timer + turn + lives + money)
reduces to the schema.

```ts
const batonRelay: GameSpec = {
  schemaVersion: 1,
  name: 'Baton Relay',
  description: 'Hold the baton, log your workout, pass it on. Drop it and the group loses a life.',
  author: 'ivy_template',
  engine: 'deterministic',
  topology: 'turn_based',

  state: {
    turn_order:        { type: 'list',      initial: [] },        // filled from members at start
    holder_index:      { type: 'int',       initial: 0 },
    baton_held_since:  { type: 'timestamp', initial: 'now' },
    lives:             { type: 'int',       initial: 3 },
    passes:            { type: 'int',       initial: 0 },
  },
  triggers: ['workout.logged', 'timer.elapsed'],
  timers: [{ id: 'window', anchor: 'baton_held_since', duration: '24h' }],

  transitions: [
    { on: 'workout.logged', when: 'event.userId == turn_order[holder_index]',
      effects: [
        { op: 'increment',   target: 'passes' },
        { op: 'advanceTurn', order: 'turn_order' },          // pass baton
        { op: 'set',         target: 'baton_held_since', value: 'now' },
        { op: 'announce',    message: 'Baton passed!' },
      ] },
    { on: 'timer.elapsed', when: "event.timerId == 'window'",
      effects: [
        { op: 'decrement',   target: 'lives', by: 1, floor: 0 },
        { op: 'advanceTurn', order: 'turn_order' },          // dropped, pass anyway
        { op: 'set',         target: 'baton_held_since', value: 'now' },
        { op: 'announce',    message: 'Baton dropped — a life lost.' },
      ] },
  ],
  endConditions: [{ when: 'lives <= 0', outcome: 'lose' }],

  // baton-stake: opt-in, capped, same-user-only — the §4b guardrail, schema-enforced
  stakeEffects: { enabled: true, multiplierMax: 2, sameUserOnly: true, requiresOptIn: true },

  narration: {
    instruction: 'You are narrating a baton relay. {holder_name} holds the baton with {lives} group lives left...',
    bindings: {
      holder_name: 'turn_order[holder_index]|userName',
      next_name:   'turn_order[holder_index+1]|userName',
      lives:       'lives',
      deadline:    'baton_held_since+24h',
    },
  },
};
```

- **Points race** → `topology: individual`, `perMember` `scores` map, one
  `increment` on `workout.logged`, end on `max(scores) >= target`.
- **Collective** → `topology: collective`, a `total` int, end on
  `total >= target` or a 28-day timer.
- **Custom** → same shape, `engine: 'llm_adjudicated'`, with `adjudicate`
  effects where deterministic ops don't suffice.

## The three consumers

- **Runtime (generic Inngest fn):** `triggers` → which events to
  `waitForEvent`; `timers` → `sleepUntil`; `transitions` → `applyRules`
  deterministically (or `adjudicate` → LLM); `endConditions` → loop exit
  + settlement. The function body never changes per game.
- **Compiler (authoring):** circle's plain-language idea → LLM emits a
  candidate `GameSpec` → `GameSpec.parse()` validates → over-cap/invalid
  rejected → valid saved.
- **Referee (runtime LLM):** invoked only by `adjudicate` effects, and it
  must return *effects from the vocabulary* against *declared state* —
  bounded by the same schema, never freeform.

## The expression evaluator

`when` / `winner` / `endConditions.when` are user/LLM-authored strings.
**This is the #1 injection surface. Never `eval`, never `new Function`.**

Use a sandboxed expression evaluator over a whitelisted AST. Two viable
routes:

1. **`expr-eval` (jsep-style):** parse to AST, evaluate against a scope
   object. Lock it down by passing only `{ ...state, event, fns }` as
   scope and disabling member-function calls.
2. **Hand-rolled mini-evaluator** (recommended — ~150 lines, zero deps,
   total control). Whitelisted node types only:
   - literals (number, string, bool)
   - identifiers → resolve against `{ state, event }` only
   - member/index access (`turn_order[holder_index]`, `event.userId`)
   - binary ops: `== != < <= > >= + - * /`
   - logical: `&& || !`
   - a fixed function allowlist: `max() min() argmax() count() sum() now()`

```ts
// Shape of the safe evaluator. No eval, no Function, no prototype access.
type Scope = { state: Record<string, unknown>; event: Record<string, unknown> };

const FN_ALLOWLIST = {
  max:    (m: Record<string, number>) => Math.max(...Object.values(m)),
  argmax: (m: Record<string, number>) => Object.entries(m).sort((a,b)=>b[1]-a[1])[0]?.[0],
  count:  (l: unknown[]) => l.length,
  sum:    (m: Record<string, number>) => Object.values(m).reduce((a,b)=>a+b,0),
  now:    () => Date.now(),
} as const;

// evaluate(ast, scope): walk the whitelisted AST; any unknown node type
// throws at COMPILE time (during validation), not at runtime. Identifiers
// that don't resolve in scope throw too — no silent undefined.
```

**Rule:** every expression in a candidate spec is parsed and type-checked
**at compile time** against the declared `state` shape. A spec referencing
an undeclared variable, an unknown function, or an unsupported operator is
**rejected** — it never reaches the runtime. This makes the runtime
evaluator total (it only ever sees pre-validated ASTs).

## The LLM compiler prompt

Turns a circle's plain-language idea into a validated `GameSpec`. The LLM
proposes; Zod + the evaluator dispose.

```
SYSTEM
You are Ivy's game compiler. You translate a fitness accountability game
described in plain language into a strict JSON GameSpec. You do not invent
mechanics the schema can't express — when a rule needs human/contextual
judgement, encode it as an `adjudicate` effect with a clear `rule` string
and set engine to "hybrid" or "llm_adjudicated".

HARD CONSTRAINTS (a spec violating any of these will be rejected):
- Output ONLY valid JSON matching the GameSpec schema. No prose.
- Money never moves between users. If the game touches stakes, set
  stakeEffects.enabled=true, sameUserOnly=true (always), requiresOptIn=true,
  and multiplierMax ≤ 3. A user's forfeit can only ever affect their OWN stake.
- Every variable used in any `when`/`winner` expression MUST be declared in
  `state`. Expressions may only use: == != < <= > >= + - * / && || !, index
  access, and the functions max() min() argmax() count() sum() now().
- The game MUST be able to end: provide ≥1 endCondition, OR a timer that
  forces termination. Infinite games are rejected.
- Keep it small: ≤20 transitions, ≤4 timers, ≤8 effects per transition.

PROCESS
1. Identify topology: individual | turn_based | collective.
2. Declare the minimal state needed (use perMember:true for per-user values).
3. List the triggers (real events) the game reacts to.
4. Write transitions as (trigger, when, effects) using the effect vocabulary.
   Reach for `adjudicate` only when no deterministic effect fits.
5. Define timers for any deadline/window.
6. Define end conditions and the winner expression.
7. Set stakeEffects honestly (default disabled).
8. Write narration.instruction for how Ivy should talk about the game on
   calls, and bind any names/values it references.

USER
{plain-language game description from the circle}
```

**Post-generation gate (non-negotiable, every time):**

1. `GameSpec.parse(candidate)` — schema + caps.
2. Compile every expression against the declared `state` shape (the
   evaluator's compile step) — reject unknown vars/fns/ops.
3. **Dry-run / liveness simulation:** fast-forward synthetic events and
   confirm the game reaches an end condition (or a forcing timer). Reject
   specs that can't terminate — otherwise they become zombie Inngest
   functions sleeping forever.
4. Only then persist and allow `game/started`.

## Safety summary

1. **Expression sandbox** — whitelisted AST, no `eval`/`Function`,
   compile-time type-check against declared state.
2. **Money is schema-fenced** — `multiplierMax ≤ 3`,
   `sameUserOnly: z.literal(true)` (literally cannot be false),
   `requiresOptIn: z.literal(true)`. A bad spec physically cannot mint
   forfeits or move money between users; Zod rejects it at parse.
3. **Liveness** — ≥1 reachable end condition or a forcing timer, proven by
   dry-run before go-live.
4. **Validate, don't trust LLM output** — parse + compile + dry-run, every
   time.
5. **Pin the spec at game start** — carry it in the `game/started` event so
   mid-game edits apply to the *next* game, not a running one.

## Implementation (shipped)

All under `src/services/games/`, with `src/__tests__/games/` (49 tests, all green):

| File | Role |
|------|------|
| `expression.ts` | Sandboxed evaluator — tokenizer + Pratt parser + whitelisted-AST eval. No `eval`/`Function`. Blocks `__proto__`/`constructor`/`prototype` **at compile time**, own-property reads only, unknown id/fn throws. Supports `null` literal and `%`. |
| `gamespec.ts` | The Zod `GameSpec` + the money fence (`StakeEffects` with `z.literal(true)` guards, `multiplierMax ≤ 3`). |
| `interpreter.ts` | Pure `initState` + `applyEvent` reducer. Deterministic, no I/O — replay-safe. |
| `templates.ts` | `relaySpec`/`pointsRaceSpec`/`collectiveSpec` factories — reproduce the legacy mechanics exactly (the regression baseline). |
| `compiler.ts` | `validateSpec` gate (schema → expr compile-check → dry-run liveness) + `compileGame` LLM authoring with a repair loop. |
| `runtime.ts` | Impure persistence adapter (`createSpecGame`, `runSpecEvent`) — runtime-agnostic; called synchronously today, drop-in for Inngest later. |

Wiring: `CircleGame.spec Json?` column (migration `20260622000000_game_spec`, additive/nullable). `circle-game.service.processWorkoutEvent` delegates to `runSpecEvent` when `spec` is present; `spec == null` keeps the legacy processor untouched.

Deferred (honestly, not faked): **stake/money effects** stay on the legacy guardrailed path — spec-backed games don't move money yet (the capped fence still travels in the spec); and the **LLM referee** for `adjudicate` effects is surfaced in `runSpecEvent` but not yet wired. Inngest adoption remains the founder infra decision.

## Migration (non-breaking)

Columns map almost 1:1:

| Current (`CircleGame`)        | Spec model                              |
|-------------------------------|-----------------------------------------|
| `templateType`                | spec presets (`author: ivy_template`)   |
| `rules` + `state` (Json)      | declared `state` + runtime state        |
| `ivyInstruction`              | `narration.instruction`                 |
| `CircleGameEvent`             | unchanged — it's the event log          |

Add a `spec Json` column, backfill the three templates as specs, and the
existing `custom` row becomes a real `llm_adjudicated` spec instead of a
TODO. `CircleGameEvent.eventType` values line up with the `Trigger` enum.
