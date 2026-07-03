/**
 * compiler.ts — the authoring path + the validation gate.
 *
 * Two public entry points:
 *   • validateSpec(spec)  — the non-negotiable gate. Runs on EVERY spec (template
 *     or LLM-authored) before it can go live: schema/caps (Zod) → expression
 *     compile-check against declared state → dry-run liveness. The LLM proposes;
 *     this disposes.
 *   • compileGame(prompt) — turns a circle's plain-language idea into a validated
 *     GameSpec via Claude, with a bounded repair loop fed by validation errors.
 *
 * Design doc: docs/game-spec-schema.md
 */
import Anthropic from '@anthropic-ai/sdk';
import logger from '../../utils/logger';
import { GameSpec, parseSpec, type GameEvent, type Trigger } from './gamespec';
import { compile as compileExpr, ExprError } from './expression';
import { applyEvent, initState } from './interpreter';

export class SpecValidationError extends Error {
  constructor(message: string, readonly issues: string[]) { super(message); }
}

const COMPILER_MODEL = 'claude-sonnet-4-6';

// ── The validation gate ───────────────────────────────────────────────────

/**
 * Full gate. Throws SpecValidationError (with a list of human-readable issues)
 * if anything fails, so the repair loop can feed them back to the LLM.
 */
export function validateSpec(input: unknown): GameSpec {
  // 1. schema + money caps
  let spec: GameSpec;
  try {
    spec = parseSpec(input);
  } catch (e: any) {
    const issues = e?.issues?.map((i: any) => `${i.path?.join('.') || '(root)'}: ${i.message}`) ?? [String(e)];
    throw new SpecValidationError('Spec failed schema/cap validation', issues);
  }

  const declared = Object.keys(spec.state);
  const issues: string[] = [];

  // 2. every expression must compile against declared state
  const check = (src: string, where: string) => {
    try { compileExpr(src, declared); }
    catch (e) { issues.push(`${where}: ${(e as ExprError).message}`); }
  };
  for (const [i, tr] of spec.transitions.entries()) {
    if (tr.when) check(tr.when, `transitions[${i}].when`);
    for (const [j, eff] of tr.effects.entries()) {
      const at = `transitions[${i}].effects[${j}]`;
      if ('target' in eff) extractPathExprs(eff.target).forEach((ex) => check(ex, `${at}.target`));
      if ('by' in eff && typeof eff.by === 'string') check(eff.by, `${at}.by`);
      if ('value' in eff && typeof eff.value === 'string') check(eff.value, `${at}.value`);
      if (eff.op === 'advanceTurn') {
        for (const v of [eff.order, eff.indexVar, eff.holderVar].filter(Boolean) as string[]) {
          if (!declared.includes(v)) issues.push(`${at}: advanceTurn references undeclared state '${v}'`);
        }
      }
    }
  }
  for (const [i, ec] of spec.endConditions.entries()) {
    check(ec.when, `endConditions[${i}].when`);
    if (ec.winner) check(ec.winner, `endConditions[${i}].winner`);
  }

  // 3. liveness — the game must be able to end
  if (issues.length === 0 && !canTerminate(spec)) {
    issues.push('liveness: no simulated event sequence reaches an end condition, and no forcing timer exists — the game could run forever');
  }

  if (issues.length > 0) throw new SpecValidationError('Spec failed validation', issues);
  return spec;
}

/** Pull the `[...]` index expressions out of a target path so they can be checked. */
function extractPathExprs(path: string): string[] {
  const out: string[] = [];
  const re = /\[([^\]]+)\]/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(path)) !== null) out.push(m[1]);
  return out;
}

/**
 * Bounded dry-run: drive the interpreter with synthetic members + a spread of
 * events (each trigger, alternating members, every timer firing) and confirm a
 * path reaches `ended`. Proves the game terminates → no zombie runtime loops.
 */
function canTerminate(spec: GameSpec, maxSteps = 2000): boolean {
  const members = ['sim-a', 'sim-b', 'sim-c'];
  const timerIds = spec.timers.map((t) => t.id);
  // event repertoire to try, in a deterministic round-robin
  const recipes: ((step: number) => GameEvent)[] = [];
  if (spec.triggers.includes('workout.logged'))
    recipes.push((s) => evt('workout.logged', members[s % members.length]));
  if (spec.triggers.includes('workout.missed'))
    recipes.push((s) => evt('workout.missed', members[s % members.length]));
  for (const id of timerIds) recipes.push(() => ({ type: 'timer.elapsed', timerId: id, at: nowIso() }));
  if (recipes.length === 0) return false;

  // Try each recipe as a "dominant" driver — some games only end under one kind
  // of pressure (relay ends on repeated misses; points ends on repeated logs).
  for (let lead = 0; lead < recipes.length; lead++) {
    let state = initState(spec, members);
    for (let step = 0; step < maxSteps; step++) {
      const recipe = recipes[(lead + (step % 2 === 0 ? 0 : step)) % recipes.length] ?? recipes[lead];
      const res = applyEvent(spec, state, recipe(step));
      state = res.state;
      if (res.ended) return true;
    }
  }
  return false;
}

const evt = (type: Trigger, userId: string): GameEvent => ({ type, userId, at: nowIso() });
const nowIso = () => new Date().toISOString();

// ── The LLM authoring path ──────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are Ivy's game compiler. You translate an accountability game described in plain language (any track — fitness, focus, sleep, balance) into a strict JSON GameSpec. Output ONLY the JSON object — no prose, no markdown fences.

You do not invent mechanics the schema can't express. The LLM referee is NOT live yet, so engine MUST be "deterministic" and the "adjudicate" effect MUST NOT be used — express every rule through counts, streaks, turns, and timers. If a requested rule truly cannot be decided without human/contextual judgement, approximate it with the closest deterministic mechanic (e.g. "kept the day" instead of "really pushed hard").

HARD CONSTRAINTS (a spec violating any of these is rejected):
- Money NEVER moves between users. If the game touches stakes, set stakeEffects.enabled=true, sameUserOnly=true, requiresOptIn=true, multiplierMax<=3. A user's forfeit can only ever affect their OWN stake.
- Every variable used in any "when"/"winner"/index expression MUST be declared in "state".
- Expressions may only use: == != < <= > >= + - * / % && || !, index access, and the functions max() min() argmax() count() sum() keys() now().
- The game MUST be able to end: provide >=1 endCondition, or a timer whose elapsed leads to an end condition. Infinite games are rejected.
- Size limits: <=20 transitions, <=4 timers, <=8 effects per transition.

EFFECT VOCABULARY: increment, decrement (with optional floor), set, advanceTurn (order/indexVar/holderVar), appendUnique, resetTimer, announce.
TRIGGERS: workout.logged, workout.missed, vn.armed, streak.extended, member.joined, member.left, timer.elapsed.
STATE initial sentinels: "now" (timestamp), "@members" (member-id array), "@members[0]" (first member).
Set author="circle_custom". Write narration.instruction for how Ivy should talk about the game on calls.`;

export interface CompileResult {
  spec: GameSpec;
  attempts: number;
}

/**
 * Compile a plain-language game description into a validated GameSpec.
 * Retries up to `maxRepairs` times, feeding validation errors back to the model.
 */
export async function compileGame(description: string, maxRepairs = 2): Promise<CompileResult> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new Error('ANTHROPIC_API_KEY not set — custom game compilation is unavailable');
  }
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const messages: Anthropic.MessageParam[] = [
    { role: 'user', content: `Game description:\n${description}` },
  ];

  let lastIssues: string[] = [];
  for (let attempt = 1; attempt <= maxRepairs + 1; attempt++) {
    const response = await client.messages.create({
      model: COMPILER_MODEL,
      max_tokens: 2000,
      system: SYSTEM_PROMPT,
      messages,
    });
    const text = response.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    let candidate: unknown;
    try {
      candidate = JSON.parse(stripFences(text));
    } catch {
      lastIssues = ['Output was not valid JSON'];
      messages.push({ role: 'assistant', content: text });
      messages.push({ role: 'user', content: 'That was not valid JSON. Return ONLY the GameSpec JSON object.' });
      continue;
    }

    try {
      const spec = validateSpec(candidate);
      logger.info(`compileGame: produced valid spec "${spec.name}" in ${attempt} attempt(s)`);
      return { spec, attempts: attempt };
    } catch (e) {
      lastIssues = e instanceof SpecValidationError ? e.issues : [String(e)];
      messages.push({ role: 'assistant', content: text });
      messages.push({
        role: 'user',
        content: `That spec failed validation:\n- ${lastIssues.join('\n- ')}\nFix these and return ONLY the corrected GameSpec JSON.`,
      });
    }
  }
  throw new SpecValidationError(`Could not produce a valid spec after ${maxRepairs + 1} attempts`, lastIssues);
}

function stripFences(text: string): string {
  const t = text.trim();
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/);
  return (fence ? fence[1] : t).trim();
}
