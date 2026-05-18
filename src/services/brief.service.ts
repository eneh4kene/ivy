import Anthropic from '@anthropic-ai/sdk';
import { TrackConfig } from '../config/tracks';
import logger from '../utils/logger';

// Frozen so prompt caching activates after the first call.
const BRIEF_SYSTEM = `You write the FLOW section of a system prompt for Ivy, an AI voice accountability coach making a real phone call right now.

Your brief replaces a static template — be specific to this person and this moment, not generic.

OUTPUT: 150-250 words. Second person to Ivy ("Ask...", "Lead with...", "Do NOT..."). No headers, no JSON. Ivy speaks naturally from this — give her direction, not a script.

CALL TYPES:
MORNING_PLANNING — get a specific plan locked (60-90s). What + when + where minimum. Confirm and close.
EVENING_REVIEW — determine outcome then follow the right path (30-90s). If status is in context, use it; otherwise ask first.
RESCUE — they're about to skip (3-5 min). Validate → understand → options → nudge ladder → verbal commitment. Highest stakes call.
WEEKLY_PLANNING — review the week, plan the next (3-5 min).
MONTHLY_CHECKIN — transformation tracking, pattern reflection (12-15 min).
SEASON_CLOSE — ceremonial, walk the full arc (15-20 min). Do not rush.
ONBOARDING — first call, build the relationship, set the minimum, get first plan (12-15 min).

TRACK VERIFICATION MECHANICS (use the track_config provided):
self_report — validate through how they describe effort, not just the fact of completion.
recall_probe — user must surface something specific from the work unprompted. "Yeah I did it" is not enough — probe until they give you something concrete.
reflection — quality matters more than completion. One specific observation required before closing.
numbers_audit — get the actual number. Activity language without output ("I was working on it") is a miss.

WHAT TO INCLUDE:
- Specific opening (reference their name, what they planned, their streak if relevant — from context)
- The right verification for their track
- Deflection patterns to watch for (from avoidance_signals AND recent call history)
- Which nudge to lead with if they hesitate (from most_effective_nudge)
- Memorial season override if season_type is "memorial": skip all accountability, check in on them as a person only
- Re-engagement override if days_since_last_interaction > 3: this is a check-in, not a session — no pressure
- Reattempt: if recent_calls shows a "[missed today]" entry, this is a retry after a no-answer. Open simply — "Hey, caught you this time" — then move straight into the plan. Don't dwell on the miss. If they bring it up, one line: "Yeah, I tried earlier." Nothing more. Do not apologise.
- If contact_preference is "texts" or call_answer_rate is below 0.4 and this is not a high-stakes call (rescue, season_close): note "if no answer after 20 seconds, hang up — a text will follow. Don't leave a voicemail."
- If contact_preference is "texts" but the call IS high-stakes: note "she/he usually prefers texts — if they answer, acknowledge it once: 'I know you usually prefer texts — I wanted to catch you for this one.'"
- If contact_pattern_note is set: include a one-line directive reflecting it
- How to close
- If coach_name is set: this person has a PT. Reference the coach and programme naturally where relevant — "your coach Marcus has you on a 12-week fat loss programme." Let coach_notes shape what you probe for or avoid. If coach_style is set, match that register (e.g. "direct and data-driven" means skip the softening). Do NOT reveal the coach can read the summary — just use the notes to be a better extension of the PT.
- If missed_sprint_session is true: this person missed their circle's sprint session. Open naturally — don't lead with guilt. Briefly acknowledge it ("you missed the session"), share what the group pledged (catchup_group_pledge), surface any highlights (catchup_highlights) in one line, then get their own sprint commitment. Close them aligned with the group. This takes priority over standard daily planning for this call.
- If circle_game_name is set: include a brief directive about the game. Quote circle_game_state_summary as the current state. If circle_game_ivy_instruction is provided, let that guide the game interaction — do not invent mechanics not described there. Keep game mentions brief (1-2 sentences max) — it should feel like a natural aside, not a separate agenda item.

WHAT TO AVOID:
- Generic instructions that could apply to anyone
- Repeating facts already in the system prompt (persona, memory, rules are separate)
- Inventing details not in the context — if a field is null, omit it
- Writing a script — Ivy speaks naturally, give her direction`;

class BriefService {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else {
      logger.warn('ANTHROPIC_API_KEY not set — pre-call brief generation disabled, using static flows');
    }
  }

  async generateCallBrief(
    callType: string,
    ctx: Record<string, any>,
    trackConfig: TrackConfig,
  ): Promise<string | null> {
    if (!this.client) return null;

    const snapshot = {
      callType,

      // Identity
      user_name: ctx.user_name,
      track: ctx.track,
      track_detail: ctx.track_detail,
      goal: ctx.goal,
      gift_frame: ctx.gift_frame,
      minimum_action: ctx.minimum_action,

      // Stats
      current_streak: ctx.current_streak,
      days_since_workout: ctx.days_since_workout,
      days_since_last_interaction: ctx.days_since_last_interaction,
      workouts_this_week: ctx.workouts_this_week,
      total_workouts: ctx.total_workouts,

      // Today
      todays_plan: ctx.todays_plan,
      todays_workout_status: ctx.todays_workout_status,

      // Season / sprint
      season_type: ctx.season_type,
      season_number: ctx.season_number,
      sprint_number: ctx.sprint_number,
      days_left_in_sprint: ctx.days_left_in_sprint,

      // Social
      buddy_name: ctx.buddy_name,
      buddy_reply: ctx.buddy_reply,
      calendar_connected: ctx.calendar_connected,

      // Charity
      charity_name: ctx.charity_name,
      donation_amount: ctx.donation_amount,

      // Memory (Layers 1 + 2 — Layer 3 long-term memories are in the system prompt memory block)
      morning_context: ctx.morning_context,
      last_evening_context: ctx.last_evening_context,
      recent_calls: ctx.recent_calls,

      // Behavioural intelligence
      most_effective_nudge: ctx.most_effective_nudge,
      high_risk_signals: ctx.high_risk_signals,
      probe_for_specificity: ctx.probe_for_specificity,
      inferred_patterns: ctx.inferred_patterns,
      notable_observation: ctx.notable_observation,

      // Communication preference
      call_answer_rate: ctx.call_answer_rate,
      contact_preference: ctx.contact_preference,
      contact_pattern_note: ctx.contact_pattern_note,

      // Coach context (if user has a PT)
      coach_name: ctx.coach_name,
      coach_programme: ctx.coach_programme,
      coach_notes: ctx.coach_notes,
      coach_style: ctx.coach_style,

      // Circle game (if active)
      circle_game_name: ctx.circle_game_name,
      circle_game_state_summary: ctx.circle_game_state_summary,
      circle_game_ivy_instruction: ctx.circle_game_ivy_instruction,

      // Circle catch-up (if user missed last sprint session)
      missed_sprint_session: ctx.missed_sprint_session,
      catchup_sprint_number: ctx.catchup_sprint_number,
      catchup_group_pledge: ctx.catchup_group_pledge,
      catchup_highlights: ctx.catchup_highlights,

      // Track schema
      track_config: {
        verification: trackConfig.verification,
        unit: trackConfig.unit,
        commitment_format: trackConfig.commitment_format,
        evening_probe: trackConfig.evening_probe,
        avoidance_signals: trackConfig.avoidance_signals,
        avoid: trackConfig.avoid,
        lean_into: trackConfig.lean_into,
      },
    };

    // Strip null/undefined to keep token count lean
    const clean = Object.fromEntries(
      Object.entries(snapshot).filter(([, v]) => v !== null && v !== undefined)
    );

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: [
          {
            type: 'text',
            text: BRIEF_SYSTEM,
            cache_control: { type: 'ephemeral' },
          },
        ] as any,
        messages: [
          {
            role: 'user',
            content: JSON.stringify(clean, null, 2),
          },
        ],
      });

      const brief = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null;
      if (!brief) return null;

      logger.info(`Brief generated for ${ctx.user_name ?? 'user'} (${callType}, ${ctx.track ?? 'fitness'})`);
      return brief;
    } catch (err) {
      logger.error(`Brief generation failed for ${callType} — falling back to static flow:`, err);
      return null;
    }
  }
}

export default new BriefService();
