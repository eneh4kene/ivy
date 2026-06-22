/**
 * expression.ts — sandboxed expression evaluator for GameSpec.
 *
 * `when` / `winner` / `endConditions.when` and effect target paths are
 * authored by circles and the LLM compiler. This module is the ONLY thing
 * that evaluates them.
 *
 * SECURITY MODEL (the #1 injection surface — read before editing):
 *   - No `eval`, no `new Function`, no dynamic code. A hand-rolled tokenizer +
 *     Pratt parser produces a whitelisted AST; only whitelisted node types and
 *     a fixed function allowlist are ever evaluated.
 *   - Member/index access blocks prototype-walking keys
 *     (`__proto__`, `constructor`, `prototype`).
 *   - Identifiers resolve ONLY against the supplied scope (declared state +
 *     `event`). An unknown identifier throws — never silent `undefined`.
 *   - `compile()` type-checks every free variable against the declared state
 *     shape at validation time, so the runtime evaluator only ever sees
 *     pre-validated ASTs and is total.
 *
 * Operators: || && == != < <= > >= + - * / %  unary ! -
 * Functions : max min argmax count sum keys now   (allowlist, no others)
 */

// ── AST ──────────────────────────────────────────────────────────────────────

type Node =
  | { t: 'num'; v: number }
  | { t: 'str'; v: string }
  | { t: 'bool'; v: boolean }
  | { t: 'null' }
  | { t: 'id'; name: string }
  | { t: 'member'; obj: Node; prop: string }          // a.b  (non-computed)
  | { t: 'index'; obj: Node; index: Node }            // a[expr]  (computed)
  | { t: 'call'; fn: string; args: Node[] }           // fn(...) — fn must be allowlisted
  | { t: 'unary'; op: '!' | '-'; arg: Node }
  | { t: 'binary'; op: BinOp; left: Node; right: Node }
  | { t: 'logical'; op: '&&' | '||'; left: Node; right: Node };

type BinOp = '==' | '!=' | '<' | '<=' | '>' | '>=' | '+' | '-' | '*' | '/' | '%';

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const FN_ALLOWLIST: Record<string, (...args: any[]) => unknown> = {
  max: (m: unknown) => Math.max(...numericValues(m)),
  min: (m: unknown) => Math.min(...numericValues(m)),
  sum: (m: unknown) => numericValues(m).reduce((a, b) => a + b, 0),
  count: (l: unknown) => (Array.isArray(l) ? l.length : Object.keys(asObject(l)).length),
  keys: (m: unknown) => Object.keys(asObject(m)),
  // argmax over a {key: number} map → the key with the highest value (ties: first)
  argmax: (m: unknown) => {
    const entries = Object.entries(asObject(m)) as [string, number][];
    if (entries.length === 0) return null;
    return entries.reduce((best, cur) => (cur[1] > best[1] ? cur : best))[0];
  },
  now: () => Date.now(),
};
const FN_NAMES = new Set(Object.keys(FN_ALLOWLIST));

function numericValues(m: unknown): number[] {
  if (Array.isArray(m)) return m.map(Number).filter((n) => !Number.isNaN(n));
  return Object.values(asObject(m)).map(Number).filter((n) => !Number.isNaN(n));
}
function asObject(m: unknown): Record<string, unknown> {
  return m && typeof m === 'object' ? (m as Record<string, unknown>) : {};
}

// ── Tokenizer ─────────────────────────────────────────────────────────────────

type Tok =
  | { k: 'num'; v: number }
  | { k: 'str'; v: string }
  | { k: 'id'; v: string }
  | { k: 'op'; v: string }
  | { k: 'punc'; v: string };

const TWO_CHAR = new Set(['==', '!=', '<=', '>=', '&&', '||']);

function tokenize(src: string): Tok[] {
  const toks: Tok[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src[i];
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') { i++; continue; }
    // string literal
    if (c === '"' || c === "'") {
      const quote = c;
      let j = i + 1;
      let s = '';
      while (j < n && src[j] !== quote) {
        if (src[j] === '\\' && j + 1 < n) { s += src[j + 1]; j += 2; continue; }
        s += src[j]; j++;
      }
      if (j >= n) throw new ExprError(`Unterminated string in: ${src}`);
      toks.push({ k: 'str', v: s });
      i = j + 1;
      continue;
    }
    // number
    if (isDigit(c) || (c === '.' && isDigit(src[i + 1]))) {
      let j = i;
      while (j < n && (isDigit(src[j]) || src[j] === '.')) j++;
      toks.push({ k: 'num', v: Number(src.slice(i, j)) });
      i = j;
      continue;
    }
    // identifier
    if (isIdentStart(c)) {
      let j = i;
      while (j < n && isIdentPart(src[j])) j++;
      const word = src.slice(i, j);
      // true/false are tokenised as identifiers; nud() promotes them to bool nodes.
      toks.push({ k: 'id', v: word });
      i = j;
      continue;
    }
    // two-char operators
    const two = src.slice(i, i + 2);
    if (TWO_CHAR.has(two)) { toks.push({ k: 'op', v: two }); i += 2; continue; }
    // single-char operators / punctuation
    if ('+-*/%<>!'.includes(c)) { toks.push({ k: 'op', v: c }); i++; continue; }
    if ('()[].,'.includes(c)) { toks.push({ k: 'punc', v: c }); i++; continue; }
    throw new ExprError(`Unexpected character '${c}' in: ${src}`);
  }
  return toks;
}

const isDigit = (c: string) => c >= '0' && c <= '9';
const isIdentStart = (c: string) => /[A-Za-z_]/.test(c);
const isIdentPart = (c: string) => /[A-Za-z0-9_]/.test(c);

// ── Pratt parser ────────────────────────────────────────────────────────────

const BP: Record<string, number> = {
  '||': 1, '&&': 2,
  '==': 3, '!=': 3,
  '<': 4, '<=': 4, '>': 4, '>=': 4,
  '+': 5, '-': 5,
  '*': 6, '/': 6, '%': 6,
};

class Parser {
  private pos = 0;
  constructor(private toks: Tok[], private src: string) {}

  parse(): Node {
    const node = this.expr(0);
    if (this.pos < this.toks.length) {
      throw new ExprError(`Unexpected trailing tokens in: ${this.src}`);
    }
    return node;
  }

  private peek(): Tok | undefined { return this.toks[this.pos]; }
  private next(): Tok { const t = this.toks[this.pos++]; if (!t) throw new ExprError(`Unexpected end of: ${this.src}`); return t; }

  private expr(minBp: number): Node {
    let left = this.nud();
    // postfix (member / index / call) bind tightest
    left = this.postfix(left);
    for (;;) {
      const t = this.peek();
      if (!t || t.k !== 'op') break;
      const bp = BP[t.v];
      if (bp === undefined || bp <= minBp) break;
      this.next();
      const right = this.expr(bp);
      if (t.v === '&&' || t.v === '||') {
        left = { t: 'logical', op: t.v as '&&' | '||', left, right };
      } else {
        left = { t: 'binary', op: t.v as BinOp, left, right };
      }
    }
    return left;
  }

  // null denotation — prefix / primary
  private nud(): Node {
    const t = this.next();
    if (t.k === 'num') return { t: 'num', v: t.v };
    if (t.k === 'str') return { t: 'str', v: t.v };
    if (t.k === 'id') {
      if (t.v === 'true') return { t: 'bool', v: true };
      if (t.v === 'false') return { t: 'bool', v: false };
      if (t.v === 'null') return { t: 'null' };
      return { t: 'id', name: t.v };
    }
    if (t.k === 'op' && (t.v === '!' || t.v === '-')) {
      const arg = this.expr(7); // unary binding power
      return { t: 'unary', op: t.v, arg };
    }
    if (t.k === 'punc' && t.v === '(') {
      const inner = this.expr(0);
      this.expect(')');
      return inner;
    }
    throw new ExprError(`Unexpected token in: ${this.src}`);
  }

  // member access, indexing, and function calls
  private postfix(node: Node): Node {
    for (;;) {
      const t = this.peek();
      if (!t) break;
      if (t.k === 'punc' && t.v === '.') {
        this.next();
        const prop = this.next();
        if (prop.k !== 'id') throw new ExprError(`Expected property name after '.' in: ${this.src}`);
        node = { t: 'member', obj: node, prop: prop.v };
      } else if (t.k === 'punc' && t.v === '[') {
        this.next();
        const index = this.expr(0);
        this.expect(']');
        node = { t: 'index', obj: node, index };
      } else if (t.k === 'punc' && t.v === '(') {
        // only bare identifiers may be called → fn allowlist enforced at compile/eval
        if (node.t !== 'id') throw new ExprError(`Only named functions may be called in: ${this.src}`);
        this.next();
        const args: Node[] = [];
        if (!(this.peek()?.k === 'punc' && this.peek()?.v === ')')) {
          for (;;) {
            args.push(this.expr(0));
            const p = this.peek();
            if (p?.k === 'punc' && p.v === ',') { this.next(); continue; }
            break;
          }
        }
        this.expect(')');
        node = { t: 'call', fn: node.name, args };
      } else {
        break;
      }
    }
    return node;
  }

  private expect(punc: string): void {
    const t = this.next();
    if (!((t.k === 'punc' || t.k === 'op') && t.v === punc)) {
      throw new ExprError(`Expected '${punc}' in: ${this.src}`);
    }
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

export class ExprError extends Error {}

export interface CompiledExpr {
  source: string;
  ast: Node;
  /** Free variables referenced (state vars + `event`). */
  vars: string[];
  /** Functions referenced (all guaranteed in the allowlist). */
  fns: string[];
}

/**
 * Parse + statically validate an expression.
 *
 * @param src         the expression source
 * @param declaredVars allowed free-variable names (declared state keys + 'event').
 *                     If omitted, free-variable checking is skipped (parse-only).
 * @throws ExprError on parse error, unknown function, or (when declaredVars given)
 *         a reference to an undeclared variable.
 */
export function compile(src: string, declaredVars?: Iterable<string>): CompiledExpr {
  const ast = new Parser(tokenize(src), src).parse();
  const vars = new Set<string>();
  const fns = new Set<string>();
  collectRefs(ast, vars, fns, src);

  for (const fn of fns) {
    if (!FN_NAMES.has(fn)) throw new ExprError(`Unknown function '${fn}()' in: ${src}`);
  }
  if (declaredVars) {
    const allowed = new Set(declaredVars);
    allowed.add('event'); // the triggering event is always in scope
    for (const v of vars) {
      if (!allowed.has(v)) {
        throw new ExprError(`Expression references undeclared variable '${v}' in: ${src}`);
      }
    }
  }
  return { source: src, ast, vars: [...vars], fns: [...fns] };
}

/** Evaluate a pre-compiled (or raw) expression against a scope. */
export function evaluate(expr: CompiledExpr | string, scope: Record<string, unknown>): unknown {
  const compiled = typeof expr === 'string' ? compile(expr) : expr;
  return ev(compiled.ast, scope, compiled.source);
}

function collectRefs(node: Node, vars: Set<string>, fns: Set<string>, src: string): void {
  switch (node.t) {
    case 'num': case 'str': case 'bool': case 'null': return;
    case 'id': vars.add(node.name); return;
    case 'member':
      // reject prototype-walking keys at COMPILE time, not just at eval
      if (BLOCKED_KEYS.has(node.prop)) throw new ExprError(`Blocked property '${node.prop}' in: ${src}`);
      collectRefs(node.obj, vars, fns, src);
      return; // prop is a name, not a var
    case 'index':
      if (node.index.t === 'str' && BLOCKED_KEYS.has(node.index.v)) {
        throw new ExprError(`Blocked property '${node.index.v}' in: ${src}`);
      }
      collectRefs(node.obj, vars, fns, src);
      collectRefs(node.index, vars, fns, src);
      return;
    case 'call': fns.add(node.fn); node.args.forEach((a) => collectRefs(a, vars, fns, src)); return;
    case 'unary': collectRefs(node.arg, vars, fns, src); return;
    case 'binary':
    case 'logical': collectRefs(node.left, vars, fns, src); collectRefs(node.right, vars, fns, src); return;
  }
}

function ev(node: Node, scope: Record<string, unknown>, src: string): unknown {
  switch (node.t) {
    case 'num': return node.v;
    case 'str': return node.v;
    case 'bool': return node.v;
    case 'null': return null;
    case 'id': {
      if (!(node.name in scope)) throw new ExprError(`Unknown identifier '${node.name}' in: ${src}`);
      return scope[node.name];
    }
    case 'member': {
      if (BLOCKED_KEYS.has(node.prop)) throw new ExprError(`Blocked property '${node.prop}' in: ${src}`);
      const obj = ev(node.obj, scope, src);
      return readKey(obj, node.prop);
    }
    case 'index': {
      const obj = ev(node.obj, scope, src);
      const key = ev(node.index, scope, src);
      const k = String(key);
      if (BLOCKED_KEYS.has(k)) throw new ExprError(`Blocked property '${k}' in: ${src}`);
      return readKey(obj, k);
    }
    case 'call': {
      const fn = FN_ALLOWLIST[node.fn];
      if (!fn) throw new ExprError(`Unknown function '${node.fn}()' in: ${src}`);
      return fn(...node.args.map((a) => ev(a, scope, src)));
    }
    case 'unary': {
      const v = ev(node.arg, scope, src);
      return node.op === '!' ? !truthy(v) : -Number(v);
    }
    case 'logical': {
      const l = ev(node.left, scope, src);
      if (node.op === '&&') return truthy(l) ? ev(node.right, scope, src) : l;
      return truthy(l) ? l : ev(node.right, scope, src);
    }
    case 'binary': {
      const l = ev(node.left, scope, src);
      const r = ev(node.right, scope, src);
      switch (node.op) {
        case '==': return looseEq(l, r);
        case '!=': return !looseEq(l, r);
        case '<': return Number(l) < Number(r);
        case '<=': return Number(l) <= Number(r);
        case '>': return Number(l) > Number(r);
        case '>=': return Number(l) >= Number(r);
        case '+': return (typeof l === 'string' || typeof r === 'string') ? String(l) + String(r) : Number(l) + Number(r);
        case '-': return Number(l) - Number(r);
        case '*': return Number(l) * Number(r);
        case '/': return Number(l) / Number(r);
        case '%': return Number(l) % Number(r);
      }
    }
  }
}

function readKey(obj: unknown, key: string): unknown {
  if (obj == null) return undefined;
  if (Array.isArray(obj)) {
    const idx = Number(key);
    return Number.isInteger(idx) ? obj[idx] : undefined;
  }
  if (typeof obj === 'object') {
    // own-property only — never walk the prototype chain
    return Object.prototype.hasOwnProperty.call(obj, key) ? (obj as Record<string, unknown>)[key] : undefined;
  }
  return undefined;
}

function truthy(v: unknown): boolean { return !!v; }

// `==` compares by value with number/string coercion, but treats null/undefined
// as equal to each other only (so `holder == null` works for "no holder yet").
function looseEq(a: unknown, b: unknown): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (typeof a === 'number' || typeof b === 'number') return Number(a) === Number(b);
  return a === b;
}
