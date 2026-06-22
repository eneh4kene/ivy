import { applyEvent, initState } from '../../services/games/interpreter';
import { relaySpec, pointsRaceSpec, collectiveSpec } from '../../services/games/templates';
import type { GameEvent } from '../../services/games/gamespec';

const members = ['u1', 'u2', 'u3'];
const log = (userId: string): GameEvent => ({ type: 'workout.logged', userId, at: new Date().toISOString() });
const miss = (userId: string): GameEvent => ({ type: 'workout.missed', userId, at: new Date().toISOString() });

describe('initState — sentinels & seeding', () => {
  it('seeds relay state from member ids', () => {
    const s = initState(relaySpec(), members);
    expect(s.turn_order).toEqual(members);
    expect(s.current_holder_id).toBe('u1');
    expect(s.current_holder_index).toBe(0);
    expect(s.lives_remaining).toBe(3);
    expect(typeof s.baton_held_since).toBe('number'); // 'now' → ms
  });

  it('seeds perMember maps to 0 for every member', () => {
    const s = initState(pointsRaceSpec(), members);
    expect(s.scores).toEqual({ u1: 0, u2: 0, u3: 0 });
    expect(s.streak_days).toEqual({ u1: 0, u2: 0, u3: 0 });
  });

  it('clones literal arrays so the spec is not shared/mutated', () => {
    const s1 = initState(collectiveSpec(), members);
    (s1.contributors as string[]).push('x');
    const s2 = initState(collectiveSpec(), members);
    expect(s2.contributors).toEqual([]);
  });
});

describe('applyEvent — purity', () => {
  it('does not mutate the previous state', () => {
    const spec = pointsRaceSpec();
    const prev = initState(spec, members);
    const snapshot = JSON.parse(JSON.stringify(prev));
    applyEvent(spec, prev, log('u1'));
    expect(prev).toEqual(snapshot);
  });
});

describe('applyEvent — effect primitives', () => {
  it('advanceTurn wraps around and updates holderVar', () => {
    const spec = relaySpec();
    let s = initState(spec, ['a', 'b']);
    s = applyEvent(spec, s, log('a')).state; // a passes → b
    expect(s.current_holder_id).toBe('b');
    s = applyEvent(spec, s, log('b')).state; // b passes → wraps to a
    expect(s.current_holder_index).toBe(0);
    expect(s.current_holder_id).toBe('a');
  });

  it('decrement honours floor (lives never go below 0)', () => {
    const spec = relaySpec({ lives: 1 });
    let s = initState(spec, members);
    s = applyEvent(spec, s, miss(s.current_holder_id as string)).state; // → 0
    s = applyEvent(spec, s, miss(s.current_holder_id as string)).state; // stays 0
    expect(s.lives_remaining).toBe(0);
  });

  it('increment with a dynamic per-member target', () => {
    const spec = pointsRaceSpec();
    const s = applyEvent(spec, initState(spec, members), log('u2')).state;
    expect((s.scores as Record<string, number>).u2).toBe(1);
    expect((s.scores as Record<string, number>).u1).toBe(0);
  });

  it('appendUnique de-duplicates contributors', () => {
    const spec = collectiveSpec({ target: 99 });
    let s = initState(spec, members);
    s = applyEvent(spec, s, log('u1')).state;
    s = applyEvent(spec, s, log('u1')).state;
    expect(s.contributors).toEqual(['u1']);
    expect(s.total).toBe(2);
  });

  it('later transitions see earlier mutations (streak bonus reads bumped streak)', () => {
    const spec = pointsRaceSpec({ target: 99, bonusStreak: 3 });
    let s = initState(spec, members);
    for (let i = 0; i < 3; i++) s = applyEvent(spec, s, log('u1')).state;
    // 3 base points + 1 bonus when streak hits 3
    expect((s.scores as Record<string, number>).u1).toBe(4);
    expect((s.streak_days as Record<string, number>).u1).toBe(3);
  });
});

describe('applyEvent — emits, notes, ended', () => {
  it('emits transition names and surfaces notes', () => {
    const spec = relaySpec();
    const r = applyEvent(spec, initState(spec, members), log('u1'));
    expect(r.emits).toContain('baton_passed');
    expect(r.notes).toContain('Baton passed!');
  });

  it('detects end with a resolved winner', () => {
    const spec = pointsRaceSpec({ target: 2 });
    let s = initState(spec, members);
    s = applyEvent(spec, s, log('u3')).state;          // u3 → 1
    const r = applyEvent(spec, s, log('u3'));          // u3 → 2, hits target
    expect(r.ended).toEqual({ outcome: 'win', winner: 'u3' });
  });
});
