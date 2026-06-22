/**
 * interpreter.ts — the generic, PURE game engine.
 *
 * `applyEvent(spec, state, event)` is deterministic and side-effect free: same
 * inputs ⇒ same outputs. All I/O (persistence, push, the LLM referee, stake
 * money, timers) lives in the runtime adapter, which calls this. Purity is what
 * makes the runtime replay-safe (Inngest today or the cron worker now).
 *
 * Conventions:
 *   • Effect `target` is a state path that may use dynamic segments resolved
 *     against the event, e.g. "scores[event.userId]".
 *   • `by` / `value` and `when` / `winner` / timer logic are EXPRESSIONS
 *     (strings → evaluated). Numbers/bools/objects are literals. `announce`
 *     `message` is literal text, never evaluated.
 *   • State-var `initial` sentinels seeded at start: 'now' (timestamp → ms),
 *     '@members' (→ member-id array), '@members[0]' (→ first member id).
 */
import type { Effect, GameEvent, GameSpec, GameState, Transition } from './gamespec';
import { evaluate } from './expression';

export interface ApplyResult {
  state: GameState;
  notes: string[];                         // → CircleGameEvent.note
  emits: string[];                         // event types fired (audit log)
  timerResets: string[];                   // timers the runtime should re-arm
  adjudications: { rule: string }[];       // hand-offs to the LLM referee
  ended: { outcome: 'win' | 'lose' | 'complete'; winner?: string } | null;
}

/** Seed initial runtime state from a spec + the circle's member ids. */
export function initState(spec: GameSpec, memberIds: string[]): GameState {
  const state: GameState = {};
  for (const [name, decl] of Object.entries(spec.state)) {
    state[name] = seedInitial(decl.initial, decl.perMember, memberIds);
  }
  return state;
}

function seedInitial(initial: unknown, perMember: boolean, memberIds: string[]): unknown {
  if (perMember) {
    // per-member map seeded to 0 for every current member
    return Object.fromEntries(memberIds.map((id) => [id, 0]));
  }
  if (initial === 'now') return Date.now();
  if (initial === '@members') return [...memberIds];
  if (initial === '@members[0]') return memberIds[0] ?? null;
  // deep-clone arrays/objects so the spec's literal isn't shared/mutated
  if (Array.isArray(initial)) return [...initial];
  if (initial && typeof initial === 'object') return { ...(initial as object) };
  return initial;
}

/** Apply one event. Returns a NEW state plus the audit/effect log. */
export function applyEvent(spec: GameSpec, prevState: GameState, event: GameEvent): ApplyResult {
  const state: GameState = structuredClone(prevState);
  const result: ApplyResult = {
    state, notes: [], emits: [], timerResets: [], adjudications: [], ended: null,
  };

  for (const tr of spec.transitions) {
    if (tr.on !== event.type) continue;
    const scope = mkScope(state, event);
    if (tr.when && !truthy(evaluate(tr.when, scope))) continue;
    applyTransition(tr, state, event, result);
    if (tr.emits) result.emits.push(tr.emits);
  }

  result.ended = evalEnd(spec, state, event);
  return result;
}

function applyTransition(tr: Transition, state: GameState, event: GameEvent, out: ApplyResult): void {
  for (const eff of tr.effects) {
    // rebuild scope before each effect so it sees prior mutations
    applyEffect(eff, state, mkScope(state, event), out);
  }
}

function applyEffect(eff: Effect, state: GameState, scope: Record<string, unknown>, out: ApplyResult): void {
  switch (eff.op) {
    case 'increment': {
      const { container, key } = resolvePath(eff.target, state, scope);
      const by = Number(resolveValue(eff.by, scope));
      container[key] = Number(container[key] ?? 0) + by;
      return;
    }
    case 'decrement': {
      const { container, key } = resolvePath(eff.target, state, scope);
      const by = Number(resolveValue(eff.by, scope));
      let next = Number(container[key] ?? 0) - by;
      if (eff.floor !== undefined) next = Math.max(eff.floor, next);
      container[key] = next;
      return;
    }
    case 'set': {
      const { container, key } = resolvePath(eff.target, state, scope);
      container[key] = resolveValue(eff.value, scope);
      return;
    }
    case 'advanceTurn': {
      const order = state[eff.order];
      if (!Array.isArray(order) || order.length === 0) return;
      const cur = Number(state[eff.indexVar] ?? 0);
      const next = (cur + 1) % order.length;
      state[eff.indexVar] = next;
      if (eff.holderVar) state[eff.holderVar] = order[next];
      return;
    }
    case 'appendUnique': {
      const { container, key } = resolvePath(eff.target, state, scope);
      const list = Array.isArray(container[key]) ? (container[key] as unknown[]) : [];
      const value = resolveValue(eff.value, scope);
      if (!list.includes(value)) list.push(value);
      container[key] = list;
      return;
    }
    case 'resetTimer':
      out.timerResets.push(eff.timer);
      return;
    case 'announce':
      out.notes.push(eff.message);
      return;
    case 'adjudicate':
      out.adjudications.push({ rule: eff.rule });
      return;
  }
}

function evalEnd(spec: GameSpec, state: GameState, event: GameEvent): ApplyResult['ended'] {
  const scope = mkScope(state, event);
  for (const ec of spec.endConditions) {
    if (truthy(evaluate(ec.when, scope))) {
      const winner = ec.winner ? toStrOrUndef(evaluate(ec.winner, scope)) : undefined;
      return { outcome: ec.outcome, winner };
    }
  }
  return null;
}

// ── helpers ────────────────────────────────────────────────────────────────

function mkScope(state: GameState, event: GameEvent): Record<string, unknown> {
  return { ...state, event };
}

// `by`/`value`: strings are expressions, everything else is a literal.
function resolveValue(v: unknown, scope: Record<string, unknown>): unknown {
  if (typeof v === 'string') return evaluate(v, scope);
  return v;
}

// Resolve a target path like "scores[event.userId]" or "a.b" to the container
// object holding the final key. Auto-vivifies intermediate objects.
function resolvePath(
  path: string,
  state: GameState,
  scope: Record<string, unknown>,
): { container: Record<string, unknown>; key: string } {
  const { head, keys } = parsePath(path, scope);
  let container: Record<string, unknown> = state as Record<string, unknown>;
  let key = head;
  for (const k of keys) {
    const cur = container[key];
    if (cur == null || typeof cur !== 'object') container[key] = {};
    container = container[key] as Record<string, unknown>;
    key = k;
  }
  return { container, key };
}

function parsePath(path: string, scope: Record<string, unknown>): { head: string; keys: string[] } {
  let i = 0;
  const readIdent = (): string => {
    const start = i;
    while (i < path.length && /[A-Za-z0-9_]/.test(path[i])) i++;
    if (i === start) throw new Error(`Invalid path segment in '${path}'`);
    return path.slice(start, i);
  };
  const head = readIdent();
  const keys: string[] = [];
  while (i < path.length) {
    if (path[i] === '.') {
      i++;
      keys.push(readIdent());
    } else if (path[i] === '[') {
      const close = path.indexOf(']', i);
      if (close === -1) throw new Error(`Unterminated '[' in path '${path}'`);
      const inner = path.slice(i + 1, close);
      keys.push(String(evaluate(inner, scope)));
      i = close + 1;
    } else {
      throw new Error(`Unexpected char '${path[i]}' in path '${path}'`);
    }
  }
  // last key is the final accessor; head+all-but-last walk the containers
  return { head, keys };
}

function truthy(v: unknown): boolean { return !!v; }
function toStrOrUndef(v: unknown): string | undefined { return v == null ? undefined : String(v); }
