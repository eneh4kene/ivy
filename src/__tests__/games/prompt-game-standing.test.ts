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
    expect(prompt).toContain('Never invent scores, standings or events');
  });

  // A standing is weather; a beat is news. The beats are what make one aside
  // worth spending, so they must reach every path the standing reaches.
  it('surfaces what MOVED since the last call, not just where things stand', () => {
    const prompt = promptService.buildSystemPrompt('CHAT', {
      ...gameCtx,
      circle_game_recent_beats: 'Amara kept the day and passed the baton to Sam.',
    }, false);
    expect(prompt).toContain('SINCE YOU LAST SPOKE');
    expect(prompt).toContain('Amara kept the day and passed the baton to Sam.');
    // They read these in their own thread already — reacting, not announcing.
    expect(prompt).toContain('shared news');
  });

  it('drops the beats line when nothing has happened since the last call', () => {
    const prompt = promptService.buildSystemPrompt('CHAT', gameCtx, false);
    expect(prompt).toContain('CIRCLE GAME — Streak Relay');
    expect(prompt).not.toContain('SINCE YOU LAST SPOKE');
  });

  // The only two things that persist across sprints. Both are deliberately
  // un-rankable: a run one person is on, and a number belonging to the room.
  it('carries the crown run and the room record, and forbids ranking members', () => {
    const prompt = promptService.buildSystemPrompt('CHAT', {
      ...gameCtx,
      circle_crown_run: 'Amara has held the crown 3 sprints running.',
      circle_room_record: 'This room kept 44 days last sprint; its best is 48.',
    }, false)
    expect(prompt).toContain('CROWN RUN')
    expect(prompt).toContain('Amara has held the crown 3 sprints running.')
    expect(prompt).toContain('ROOM RECORD')
    expect(prompt).toContain('This room kept 44 days last sprint; its best is 48.')
    expect(prompt).toContain('Never rank members against each other')
  })

  it('omits both cross-sprint lines for a room with no history', () => {
    const prompt = promptService.buildSystemPrompt('CHAT', gameCtx, false)
    expect(prompt).toContain('CIRCLE GAME — Streak Relay')
    expect(prompt).not.toContain('CROWN RUN')
    expect(prompt).not.toContain('ROOM RECORD')
  })

  // A live obligation earns room in the call. It must NEVER earn the opening —
  // being met with "the baton's with you, three hours left" the second you pick
  // up is a system notification wearing a voice.
  it('gives a live obligation real room but never the opening', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...gameCtx,
      circle_game_live_obligation: 'They are holding the baton — about 3 hours left in their window. The room is on its LAST life — a drop ends the run.',
    }, false)
    expect(prompt).toContain('LIVE RIGHT NOW')
    expect(prompt).toContain('LAST life')
    expect(prompt).toContain('not an aside')
    expect(prompt).toContain('do NOT open with it')
    expect(prompt).toContain('Open the way you always open')
  })

  it('keeps the rest of the game an aside even when something is live', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...gameCtx,
      circle_game_live_obligation: 'They are holding the baton.',
    }, false)
    expect(prompt).toContain('Everything else about the game stays an aside')
  })

  it('holds the one-aside cap when nothing is live', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', gameCtx, false)
    expect(prompt).toContain('one aside, not a lecture')
    expect(prompt).not.toContain('LIVE RIGHT NOW')
  })

  // The crown tail was written for chat ("your reply", "this one message") and
  // applied to voice with no callType check, at a priority that OUTRANKED the
  // rule telling her to say hello and ask one thing.
  it('never lets the crown hijack the opening of a CALL', () => {
    const prompt = promptService.buildSystemPrompt('EVENING_REVIEW', {
      ...gameCtx,
      circle_crown_game: 'The Baton',
      circle_crown_days_left: 6,
      circle_crown_can_claim_pledge: true,
    }, false)
    expect(prompt).not.toContain('BEFORE ANYTHING ELSE')
    expect(prompt).toContain('do NOT open with it')
    // The opening rule must still be the thing that wins.
    expect(prompt).toContain('Say hello and ask ONE thing')
  })

  it('still leads with the crown in CHAT, where leading is fine', () => {
    const prompt = promptService.buildSystemPrompt('CHAT', {
      ...gameCtx,
      circle_crown_game: 'The Baton',
      circle_crown_days_left: 6,
      circle_crown_can_claim_pledge: true,
    }, false)
    expect(prompt).toContain('BEFORE ANYTHING ELSE')
  })

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
