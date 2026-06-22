import { compile, evaluate, ExprError } from '../../services/games/expression';

describe('expression — literals, operators, precedence', () => {
  it('evaluates arithmetic with precedence', () => {
    expect(evaluate('1 + 2 * 3', {})).toBe(7);
    expect(evaluate('(1 + 2) * 3', {})).toBe(9);
    expect(evaluate('10 % 3', {})).toBe(1);
    expect(evaluate('7 / 2', {})).toBe(3.5);
  });

  it('evaluates comparisons and logicals', () => {
    expect(evaluate('5 >= 3', {})).toBe(true);
    expect(evaluate('2 < 1', {})).toBe(false);
    expect(evaluate('!flag', { flag: false })).toBe(true);
    expect(evaluate('-x', { x: 4 })).toBe(-4);
  });

  it('short-circuits && and || returning operand values', () => {
    expect(evaluate('a && b', { a: 0, b: 5 })).toBe(0); // falsy left → returns left
    expect(evaluate('a && b', { a: 1, b: 5 })).toBe(5);
    expect(evaluate('a || b', { a: 0, b: 5 })).toBe(5);
    expect(evaluate('a || b', { a: 9, b: 5 })).toBe(9);
  });

  it('concatenates when either side of + is a string', () => {
    expect(evaluate('"x" + 1', {})).toBe('x1');
    expect(evaluate('1 + "x"', {})).toBe('1x');
  });
});

describe('expression — looseEq null/coercion semantics', () => {
  it('treats null/undefined as equal only to each other', () => {
    expect(evaluate('h == null', { h: null })).toBe(true);
    expect(evaluate('h == null', { h: undefined })).toBe(true);
    expect(evaluate('h == null', { h: 0 })).toBe(false);
    expect(evaluate('h != null', { h: 'u1' })).toBe(true);
  });
  it('coerces across number/string for ==', () => {
    expect(evaluate('"5" == 5', {})).toBe(true);
    expect(evaluate('"5" == 6', {})).toBe(false);
  });
});

describe('expression — member, index, functions', () => {
  it('reads member and computed index access', () => {
    expect(evaluate('event.userId', { event: { userId: 'u1' } })).toBe('u1');
    expect(evaluate('scores[event.userId]', { scores: { u1: 3 }, event: { userId: 'u1' } })).toBe(3);
    expect(evaluate('arr[0]', { arr: [9, 8] })).toBe(9);
    expect(evaluate('arr[i + 1]', { arr: [9, 8, 7], i: 1 })).toBe(7);
  });

  it('applies the function allowlist', () => {
    expect(evaluate('max(scores)', { scores: { a: 1, b: 5 } })).toBe(5);
    expect(evaluate('min(scores)', { scores: { a: 1, b: 5 } })).toBe(1);
    expect(evaluate('sum(scores)', { scores: { a: 1, b: 5 } })).toBe(6);
    expect(evaluate('count(arr)', { arr: [1, 2, 3] })).toBe(3);
    expect(evaluate('argmax(scores)', { scores: { a: 1, b: 5 } })).toBe('b');
    expect(typeof evaluate('now()', {})).toBe('number');
  });

  it('argmax breaks ties toward the first key and handles empty', () => {
    expect(evaluate('argmax(scores)', { scores: { a: 5, b: 5 } })).toBe('a');
    expect(evaluate('argmax(scores)', { scores: {} })).toBeNull();
  });
});

describe('expression — SECURITY', () => {
  it('blocks prototype-walking keys', () => {
    expect(() => evaluate('event.__proto__', { event: {} })).toThrow(ExprError);
    expect(() => evaluate('x.constructor', { x: {} })).toThrow(ExprError);
    expect(() => evaluate('x.prototype', { x: {} })).toThrow(ExprError);
    expect(() => evaluate("x['constructor']", { x: {} })).toThrow(ExprError);
  });

  it('throws on unknown identifier (never silent undefined)', () => {
    expect(() => evaluate('mystery', {})).toThrow(ExprError);
  });

  it('rejects unknown functions', () => {
    expect(() => evaluate('hack()', {})).toThrow(ExprError);
    expect(() => compile('hack()')).toThrow(ExprError);
  });

  it('rejects calling a non-identifier', () => {
    expect(() => compile('arr[0]()')).toThrow(ExprError);
  });

  it('rejects parse errors', () => {
    expect(() => compile('(1 + 2')).toThrow(ExprError);
    expect(() => compile('1 2')).toThrow(ExprError);
    expect(() => compile('* 3')).toThrow(ExprError);
  });

  it('compile() enforces declared variables (event always allowed)', () => {
    expect(() => compile('a + event.x', ['a'])).not.toThrow();
    expect(() => compile('a + b', ['a'])).toThrow(/undeclared variable 'b'/);
    expect(() => compile('max(scores)', ['scores'])).not.toThrow();
  });
});
