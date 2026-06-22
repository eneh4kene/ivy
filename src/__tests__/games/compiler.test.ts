import { collectiveSpec, pointsRaceSpec, relaySpec } from '../../services/games/templates';
import type { GameSpec } from '../../services/games/gamespec';

// Mock the Anthropic SDK so compileGame never hits the network.
const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: jest.fn(() => ({ messages: { create: mockCreate } })),
}));

// imported after the mock is registered
import { validateSpec, compileGame, SpecValidationError } from '../../services/games/compiler';

const textResponse = (obj: unknown) => ({ content: [{ type: 'text', text: JSON.stringify(obj) }] });

describe('validateSpec — accepts the built-in templates', () => {
  it.each([
    ['relay', relaySpec()],
    ['points', pointsRaceSpec()],
    ['collective', collectiveSpec()],
  ])('%s passes', (_n, spec) => {
    expect(() => validateSpec(spec)).not.toThrow();
  });
});

describe('validateSpec — rejects invalid specs', () => {
  it('rejects an undeclared variable in a when clause', () => {
    const bad = { ...pointsRaceSpec(), transitions: [{ on: 'workout.logged', when: 'ghost > 1', effects: [] }] };
    expect(() => validateSpec(bad)).toThrow(SpecValidationError);
    try { validateSpec(bad); } catch (e) { expect((e as SpecValidationError).issues.join()).toMatch(/undeclared variable 'ghost'/); }
  });

  it('rejects a blocked-key expression', () => {
    const bad = { ...pointsRaceSpec(), transitions: [{ on: 'workout.logged', when: 'event.constructor', effects: [] }] };
    expect(() => validateSpec(bad)).toThrow(SpecValidationError);
  });

  it('rejects multiplierMax > 3 (schema cap)', () => {
    const bad = { ...relaySpec(), stakeEffects: { enabled: true, multiplierMax: 9, sameUserOnly: true, requiresOptIn: true } };
    expect(() => validateSpec(bad)).toThrow(SpecValidationError);
  });

  it('rejects sameUserOnly:false / requiresOptIn:false (the money fence)', () => {
    const a = { ...relaySpec(), stakeEffects: { enabled: true, multiplierMax: 2, sameUserOnly: false, requiresOptIn: true } };
    const b = { ...relaySpec(), stakeEffects: { enabled: true, multiplierMax: 2, sameUserOnly: true, requiresOptIn: false } };
    expect(() => validateSpec(a)).toThrow(SpecValidationError);
    expect(() => validateSpec(b)).toThrow(SpecValidationError);
  });

  it('rejects an empty endConditions array', () => {
    const bad = { ...pointsRaceSpec(), endConditions: [] };
    expect(() => validateSpec(bad)).toThrow(SpecValidationError);
  });

  it('rejects a non-terminating game (liveness)', () => {
    const stuck: GameSpec = {
      schemaVersion: 1, name: 'Stuck', description: '', author: 'circle_custom',
      engine: 'deterministic', topology: 'individual',
      state: { n: { type: 'int', initial: 0, perMember: false } },
      triggers: ['workout.logged'], timers: [],
      transitions: [{ on: 'workout.logged', effects: [{ op: 'increment', target: 'n', by: 1 }] }],
      endConditions: [{ when: 'n < 0', outcome: 'win' }], // never true
      stakeEffects: { enabled: false, multiplierMax: 1, sameUserOnly: true, requiresOptIn: true },
      narration: { instruction: 'x', bindings: {} },
    };
    expect(() => validateSpec(stuck)).toThrow(SpecValidationError);
    try { validateSpec(stuck); } catch (e) { expect((e as SpecValidationError).issues.join()).toMatch(/liveness/); }
  });
});

describe('compileGame — LLM authoring path (mocked)', () => {
  const OLD = process.env.ANTHROPIC_API_KEY;
  beforeEach(() => { process.env.ANTHROPIC_API_KEY = 'test-key'; mockCreate.mockReset(); });
  afterAll(() => { process.env.ANTHROPIC_API_KEY = OLD; });

  it('returns a validated spec on the first valid response', async () => {
    mockCreate.mockResolvedValueOnce(textResponse(collectiveSpec()));
    const { spec, attempts } = await compileGame('group challenge to 30');
    expect(attempts).toBe(1);
    expect(spec.name).toBe('Group Challenge');
  });

  it('runs the repair loop and feeds issues back', async () => {
    mockCreate
      .mockResolvedValueOnce(textResponse({ ...pointsRaceSpec(), endConditions: [] })) // invalid
      .mockResolvedValueOnce(textResponse(pointsRaceSpec()));                           // valid
    const { attempts } = await compileGame('first to 20 points');
    expect(attempts).toBe(2);
    expect(mockCreate).toHaveBeenCalledTimes(2);
    const secondCallMessages = mockCreate.mock.calls[1][0].messages;
    expect(JSON.stringify(secondCallMessages)).toMatch(/failed validation/i);
  });

  it('repairs non-JSON output', async () => {
    mockCreate
      .mockResolvedValueOnce({ content: [{ type: 'text', text: 'here you go:' }] })
      .mockResolvedValueOnce(textResponse(collectiveSpec()));
    const { attempts } = await compileGame('anything');
    expect(attempts).toBe(2);
  });

  it('throws when ANTHROPIC_API_KEY is unset', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await expect(compileGame('x')).rejects.toThrow(/ANTHROPIC_API_KEY/);
  });
});
