import { promptService } from '../../services/prompt.service';

// The inbound Retell path (webhook.controller) and the chat path (chat.service)
// both call buildSystemPrompt with NO Haiku brief, so they render the static
// flow. Before the fix, static flows never referenced circle_game_*, so those
// two surfaces were game-blind even though getUserContext already puts the game
// fields in ctx. gameStanding() closes that gap deterministically (no latency).
describe('buildSystemPrompt — circle game standing on the no-brief path', () => {
  const baseCtx: Record<string, any> = {
    first_name: 'Sam',
    current_streak: 3,
  };

  const gameCtx = {
    ...baseCtx,
    circle_game_name: 'Streak Relay',
    circle_game_state_summary: 'You hold the baton (since Fri 09:00). 2 lives left.',
    circle_game_ivy_instruction: 'Nudge them warmly — the baton is theirs to pass.',
  };

  it('surfaces the game standing when no Haiku brief is supplied (inbound/chat)', () => {
    const prompt = promptService.buildSystemPrompt('CHAT', gameCtx, false);
    expect(prompt).toContain('CIRCLE GAME — Streak Relay');
    expect(prompt).toContain('You hold the baton (since Fri 09:00). 2 lives left.');
    expect(prompt).toContain('Nudge them warmly');
    // Guardrail against invented standings must ride along.
    expect(prompt).toContain('Never invent scores or standings');
  });

  it('omits the section entirely when there is no active game', () => {
    const prompt = promptService.buildSystemPrompt('CHAT', baseCtx, false);
    expect(prompt).not.toContain('CIRCLE GAME');
  });

  it('still surfaces the standing on the outbound (brief-present) path', () => {
    // A Haiku brief REPLACES the flow slot; gameStanding lives outside it, so the
    // ground-truth standing survives to anchor the brief against hallucination.
    const prompt = promptService.buildSystemPrompt('MORNING_PLANNING', gameCtx, false, 'Brief: keep it short today.');
    expect(prompt).toContain('Brief: keep it short today.');
    expect(prompt).toContain('CIRCLE GAME — Streak Relay');
  });
});
