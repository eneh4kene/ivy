import Anthropic from '@anthropic-ai/sdk';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { startOfDay, subDays } from 'date-fns';

// Per-call structured insights extracted from transcript
export interface CallInsights {
  commitment_specificity: number;    // 1-10: 1="I'll try later", 10="6pm, 40min, gym"
  commitment_confidence: number;     // 1-10: how certain they sounded
  obstacles_mentioned: string[];     // actual obstacles raised in conversation
  emotional_state: string;           // energised | flat | stressed | resistant | positive
  avoidance_language: boolean;       // true if they used "try", "maybe", "probably", "hopefully"
  nudge_that_landed: string | null;  // consequence_framing | identity | gift_frame | social_proof | minimum_negotiation | none
  completed_outcome: boolean | null; // true=completed, false=missed, null=unknown
  key_insight: string;               // single most notable behavioural signal
  call_summary: string;              // 2-3 sentences from Ivy's perspective — surfaced in the next call
  next_intention: string | null;     // explicit next-day commitment ("gym 7am, 40min upper body") — surfaced as the morning VN hint
  next_season_goal: string | null;   // SEASON_CLOSE only: user's stated goal for the next season
  memorable_moments: Array<{         // specific facts worth remembering long-term
    content: string;
    category: 'motivation' | 'life_event' | 'personal_detail' | 'struggle' | 'breakthrough';
  }>;
}

// Synthesised profile built from the last N calls' insights
export interface InferredProfile {
  inferred_patterns: string | null;
  notable_observation: string | null;
  commitment_style: 'specific' | 'vague' | 'variable';
  most_effective_nudge: string | null;
  high_risk_signals: string[];
  probe_for_specificity: boolean;
  preferred_register: 'direct' | 'gentle' | 'energetic';
  behavioural_modifiers: string | null;
  // Communication preference — learned from call answer rate and explicit signals
  call_answer_rate: number | null;           // 0.0–1.0 over last 30 days, null if < 5 calls
  contact_preference: 'calls' | 'texts' | 'adaptive';
  contact_pattern_note: string | null;       // e.g. "tends not to answer before 8am"
}

const EXTRACTION_SYSTEM = `You analyse accountability coaching call transcripts and extract structured behavioural insights. Your output helps a voice AI named Ivy adapt her approach and remember each user across calls.

Extract these signals from the transcript:

commitment_specificity (1-10)
  1 = "I'll try to work out sometime this week"
  5 = "I'll go to the gym tomorrow"
  10 = "6pm, 40 minutes, upper body weights at the gym on Oxford Street"

commitment_confidence (1-10)
  How certain did they sound about following through? Consider tone, hedging, energy.

obstacles_mentioned
  List the specific obstacles they raised. Be precise: "back-to-back meetings until 7pm" not just "work".

emotional_state
  One of: energised | flat | stressed | resistant | positive

avoidance_language
  true if they used phrases like: "I'll try", "maybe", "probably", "hopefully", "I'll see", "I guess", "I'll attempt"

nudge_that_landed
  If a nudge moved them to commit, which one? Options:
  consequence_framing — streaks/loss of progress
  identity — "you're someone who shows up"
  gift_frame — doing it for someone else
  social_proof — others do it too
  minimum_negotiation — negotiating a smaller action
  none — they committed without needing a nudge
  null — no nudge was used or outcome unclear

completed_outcome
  true if they confirmed completion, false if they said they missed, null if unknown

key_insight
  One sentence. The single most notable behavioural signal in this call — something specific, not generic.

call_summary
  2-3 sentences written from Ivy's perspective, as if briefing the next Ivy call. What was planned or confirmed? What was the person's energy like? Anything notable?

next_intention
  The explicit commitment the person made for their NEXT day or session — what they said they'll do, with time and place if they gave them. Verbatim or close paraphrase ("Gym at 7am before work, 40 min upper body" or "Walk after lunch"). This is shown back to them the next morning as a reminder of what they committed to, so write it as a clean action they'd recognise — not a summary of the conversation. null if no clear next-day intention was stated (e.g. they were vague, only rested, or didn't plan ahead).

next_season_goal
  SEASON_CLOSE calls only: the user's stated goal for the next season, in their own words. Extract verbatim or close paraphrase. null for all other call types, or if the user did not state a goal.

memorable_moments
  An array of specific facts worth remembering long-term about this person. Only include genuinely memorable details — not generic. Each item has:
  - content: the specific fact as Ivy observed it (one sentence, concrete)
  - category: one of motivation | life_event | personal_detail | struggle | breakthrough
  Return an empty array [] if nothing notable emerged.

Respond ONLY with valid JSON. No markdown, no explanation, no code fences.`;

const SYNTHESIS_SYSTEM = `You synthesise behavioural patterns from a series of accountability coaching call insights. Your output directly shapes how a voice AI named Ivy adapts her approach with each individual user.

How your output is used:
- inferred_patterns: Ivy says this aloud to the user at Season Close or quarterly calls. Write it as something Ivy would naturally say — warm, specific, grounded in data.
- notable_observation: The single sharpest thing Ivy can say. One sentence, maximum specificity.
- behavioural_modifiers: A 1-2 sentence instruction to Ivy (never said to the user) about how to adapt her approach in every call.
- probe_for_specificity: If true, Ivy always asks for time + location in morning plans before confirming.
- most_effective_nudge: Ivy leads with this in rescue calls for this user.
- high_risk_signals: Language or patterns that have preceded misses. Ivy listens for these.
- preferred_register: Ivy calibrates her tone — direct, gentle, or energetic.
- contact_preference: Based on the call_answer_rate and any signals in the data, infer whether this person prefers calls, texts, or is adaptive. If answer rate is below 0.35, lean toward texts. Above 0.65, calls. Otherwise adaptive.
- contact_pattern_note: A one-sentence specific note about when or why they tend not to answer or prefer one medium. null if no clear pattern exists.

Rules:
- Only surface patterns with at least 3 data points. If a pattern has 1-2 instances, return null.
- Never generate flattery or generic observations.
- inferred_patterns should feel like it could only be said to this specific person, not anyone.

Respond ONLY with valid JSON. No markdown, no explanation, no code fences.`;

class InsightService {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else {
      logger.warn('ANTHROPIC_API_KEY not set — call insights and behavioural profiles disabled');
    }
  }

  /**
   * Extract structured behavioural insights from a completed call transcript.
   * Fires async after call_analyzed webhook. On completion, triggers synthesizeUserProfile.
   * For SEASON_CLOSE calls: if a next_season_goal is found, starts Season 2 automatically.
   */
  async extractCallInsights(
    callId: string,
    transcript: string,
    callType: string,
    userId: string,
  ): Promise<void> {
    if (!this.client) return;
    if (!transcript || transcript.length < 200) return;

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 800,
        system: [
          {
            type: 'text',
            text: EXTRACTION_SYSTEM,
            cache_control: { type: 'ephemeral' },
          },
        ] as any,
        messages: [
          {
            role: 'user',
            content: `Call type: ${callType}\n\nTranscript:\n${transcript}`,
          },
        ],
      });

      const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null;
      if (!raw) return;

      const insights: CallInsights = JSON.parse(raw);

      await prisma.call.update({
        where: { id: callId },
        data: {
          callInsights: insights as object,
          callSummary: insights.call_summary ?? null,
        },
      });

      if (insights.memorable_moments?.length) {
        await prisma.callMemory.createMany({
          data: insights.memorable_moments.map((m) => ({
            userId,
            callId,
            content: m.content,
            category: m.category,
          })),
        });
      }

      logger.info(`Call insights extracted for ${callId} (summary: ${!!insights.call_summary}, memories: ${insights.memorable_moments?.length ?? 0})`);

      // Season Close: if user stated a next-season goal, start the next season automatically
      if (callType === 'SEASON_CLOSE' && insights.next_season_goal) {
        this.startNextSeasonFromClose(userId, insights.next_season_goal).catch((err) =>
          logger.error(`Auto-startNextSeason failed for user ${userId}:`, err)
        );
      }

      this.synthesizeUserProfile(userId).catch((err) =>
        logger.error(`Profile synthesis failed for user ${userId}:`, err)
      );
    } catch (err) {
      logger.error(`Insight extraction failed for call ${callId}:`, err);
    }
  }

  /**
   * Called after a SEASON_CLOSE call is analysed. Marks the closing season as CLOSED
   * and starts the next season with the goal the user stated on the call.
   */
  private async startNextSeasonFromClose(userId: string, nextGoal: string): Promise<void> {
    // Lazy import to avoid circular dependency
    const seasonService = (await import('./season.service')).default;
    await seasonService.startNextSeason(userId, nextGoal);
    logger.info(`Season auto-advanced for user ${userId} — next goal: "${nextGoal}"`);
  }

  /**
   * Synthesise a behavioural profile from the last 20 calls with insights.
   * Requires ≥3 calls with insights before producing output.
   */
  async synthesizeUserProfile(userId: string): Promise<void> {
    if (!this.client) return;

    try {
      const [recentCalls, callAnswerRate] = await Promise.all([
        prisma.call.findMany({
          where: { userId, NOT: { callInsights: { equals: undefined } }, status: 'COMPLETED' },
          orderBy: { createdAt: 'desc' },
          take: 20,
          select: { callType: true, callInsights: true, createdAt: true },
        }),
        this.calculateCallAnswerRate(userId),
      ]);

      if (recentCalls.length < 3) return;

      const insightsSummary = recentCalls
        .map((c, i) => `Call ${i + 1} (${c.callType}): ${JSON.stringify(c.callInsights)}`)
        .join('\n');

      const responseSchema = `{
  "inferred_patterns": "string or null",
  "notable_observation": "string or null",
  "commitment_style": "specific | vague | variable",
  "most_effective_nudge": "consequence_framing | identity | gift_frame | social_proof | minimum_negotiation | null",
  "high_risk_signals": ["array of strings"],
  "probe_for_specificity": true or false,
  "preferred_register": "direct | gentle | energetic",
  "behavioural_modifiers": "string or null",
  "contact_preference": "calls | texts | adaptive",
  "contact_pattern_note": "string or null"
}`;

      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
        system: [
          {
            type: 'text',
            text: SYNTHESIS_SYSTEM,
            cache_control: { type: 'ephemeral' },
          },
        ] as any,
        messages: [
          {
            role: 'user',
            content: `Synthesise a behavioural profile from ${recentCalls.length} recent calls.\n\nCall answer rate (last 30 days): ${callAnswerRate !== null ? `${Math.round(callAnswerRate * 100)}%` : 'not enough data'}\n\nInsights:\n${insightsSummary}\n\nReturn JSON matching:\n${responseSchema}`,
          },
        ],
      });

      const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null;
      if (!raw) return;

      const profile: Omit<InferredProfile, 'call_answer_rate'> = JSON.parse(raw);

      await prisma.user.update({
        where: { id: userId },
        data: {
          inferredProfile: {
            ...profile,
            call_answer_rate: callAnswerRate,
          } as any,
        },
      });

      logger.info(`Behavioural profile updated for user ${userId} (${recentCalls.length} calls, answer rate: ${callAnswerRate !== null ? `${Math.round(callAnswerRate * 100)}%` : 'n/a'})`);
    } catch (err) {
      logger.error(`Profile synthesis failed for user ${userId}:`, err);
    }
  }

  /**
   * Calculate the fraction of scheduled calls the user has answered over the last 30 days.
   * Returns null if fewer than 5 scheduled calls — not enough signal yet.
   */
  private async calculateCallAnswerRate(userId: string): Promise<number | null> {
    const since = subDays(startOfDay(new Date()), 30);
    const calls = await prisma.call.findMany({
      where: {
        userId,
        scheduledAt: { gte: since },
        status: { in: ['COMPLETED', 'NO_ANSWER', 'FAILED'] },
      },
      select: { status: true },
    });

    if (calls.length < 5) return null;

    const answered = calls.filter((c) => c.status === 'COMPLETED').length;
    return Math.round((answered / calls.length) * 100) / 100;
  }
}

export default new InsightService();
