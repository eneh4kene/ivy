import { specStateSummary } from '../../services/circle-game.service';
import { relaySpec, pointsRaceSpec, collectiveSpec } from '../../services/games/templates';
import { initState } from '../../services/games/interpreter';

// Read-side narration gap: a spec-backed game must produce a real one-line
// summary for Ivy's calls/briefs (not fall through to the generic default).
describe('specStateSummary — read-side narration for spec games', () => {
  const members = ['u1', 'u2', 'u3'];

  it('shows the caller’s own per-member score in a points race', () => {
    const spec = pointsRaceSpec({ target: 20 });
    const state = initState(spec, members);
    (state.scores as Record<string, number>).u2 = 5;
    const summary = specStateSummary(spec, state, 'u2');
    expect(summary).toContain('your scores: 5');
    // the other members' scores are not leaked into u2's summary
    expect(summary).not.toContain('u1');
  });

  it('renders the holder as “you” and surfaces lives in a relay', () => {
    const spec = relaySpec({ lives: 3 });
    const state = initState(spec, members); // u1 is first holder
    const summary = specStateSummary(spec, state, 'u1');
    expect(summary).toContain('current holder id: you');
    expect(summary).toContain('lives remaining: 3');
    // internal bookkeeping (turn_order list, baton_held_since timestamp) is omitted
    expect(summary).not.toContain('turn order');
    expect(summary).not.toContain('baton held since');
  });

  it('summarises collective progress and omits the contributors list', () => {
    const spec = collectiveSpec({ target: 30 });
    const state = initState(spec, members);
    (state as Record<string, unknown>).total = 7;
    const summary = specStateSummary(spec, state, 'u1');
    expect(summary).toContain('total: 7');
    expect(summary).not.toContain('contributors');
  });
});
