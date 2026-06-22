import { applyEvent, initState } from '../../services/games/interpreter';
import { relaySpec, pointsRaceSpec, collectiveSpec } from '../../services/games/templates';
import { validateSpec } from '../../services/games/compiler';
import type { GameEvent } from '../../services/games/gamespec';

const members = ['u1', 'u2', 'u3'];
const now = () => new Date().toISOString();
const log = (userId: string): GameEvent => ({ type: 'workout.logged', userId, at: now() });
const miss = (userId: string): GameEvent => ({ type: 'workout.missed', userId, at: now() });
const timer = (timerId: string): GameEvent => ({ type: 'timer.elapsed', timerId, at: now() });

describe('templates — all pass the validation gate', () => {
  it.each([
    ['relay', relaySpec()],
    ['points_race', pointsRaceSpec()],
    ['collective', collectiveSpec()],
  ])('%s validates', (_name, spec) => {
    expect(() => validateSpec(spec)).not.toThrow();
  });
});

describe('points race — parity with legacy scoring', () => {
  it('reaches target via 4 logs (3 base + streak bonus + 1 = 5)', () => {
    const spec = pointsRaceSpec({ target: 5 });
    let s = initState(spec, members);
    let ended = null;
    let n = 0;
    while (!ended && n < 20) { const r = applyEvent(spec, s, log('u1')); s = r.state; ended = r.ended; n++; }
    expect(ended).toEqual({ outcome: 'win', winner: 'u1' });
    expect((s.scores as Record<string, number>).u1).toBe(5);
    expect(n).toBe(4);
  });

  it('awards a bonus every bonusStreak days', () => {
    const spec = pointsRaceSpec({ target: 999, bonusStreak: 3 });
    let s = initState(spec, members);
    for (let i = 0; i < 6; i++) s = applyEvent(spec, s, log('u1')).state;
    // 6 base + bonus at streak 3 and 6 = 8
    expect((s.scores as Record<string, number>).u1).toBe(8);
  });
});

describe('relay — pass, drop, and window timeout', () => {
  it('passes the baton on a holder log', () => {
    const spec = relaySpec();
    let s = initState(spec, members);
    expect(s.current_holder_id).toBe('u1');
    const r = applyEvent(spec, s, log('u1'));
    expect(r.state.current_holder_id).toBe('u2');
    expect(r.state.passes).toBe(1);
    expect(r.notes).toContain('Baton passed!');
  });

  it('drains lives on holder misses until game over', () => {
    const spec = relaySpec({ lives: 2 });
    let s = initState(spec, members);
    let r = applyEvent(spec, s, miss(s.current_holder_id as string)); s = r.state;
    expect(s.lives_remaining).toBe(1);
    r = applyEvent(spec, s, miss(s.current_holder_id as string)); s = r.state;
    expect(s.lives_remaining).toBe(0);
    expect(r.ended).toEqual({ outcome: 'lose' });
  });

  it('treats a window timer.elapsed as a drop', () => {
    const spec = relaySpec({ lives: 3 });
    const s = initState(spec, members);
    const r = applyEvent(spec, s, timer('window'));
    expect(r.state.lives_remaining).toBe(2);
    expect(r.emits).toContain('baton_dropped');
  });
});

describe('collective — shared target & deadline', () => {
  it('completes when total reaches target, contributors deduped', () => {
    const spec = collectiveSpec({ target: 3 });
    let s = initState(spec, members);
    let ended = null;
    for (const u of ['u1', 'u2', 'u1', 'u3']) { const r = applyEvent(spec, s, log(u)); s = r.state; ended = r.ended ?? ended; }
    expect(s.total).toBe(4);
    expect(s.contributors).toEqual(['u1', 'u2', 'u3']);
    expect(ended).toEqual({ outcome: 'complete' });
  });

  it('loses on deadline timer before target', () => {
    const spec = collectiveSpec({ target: 100 });
    const s = initState(spec, members);
    const r = applyEvent(spec, s, timer('deadline'));
    expect(r.ended).toEqual({ outcome: 'lose' });
  });
});
