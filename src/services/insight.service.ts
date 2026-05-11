import Anthropic from '@anthropic-ai/sdk';
import prisma from '../utils/prisma';
import logger from '../utils/logger';

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
  memorable_moments: Array<{         // specific facts worth remembering long-term
    content: string;
    category: 'motivation' | 'life_event' | 'personal_detail' | 'struggle' | 'breakthrough';
  }>;
}

// Synthesised profile built from the last N calls' insights
export interface InferredProfile {
  inferred_patterns: string | null;     // what Ivy says aloud at Season Close / quarterly call
  notable_observation: string | null;   // one specific earned observation
  commitment_style: 'specific' | 'vague' | 'variable';
  most_effective_nudge: string | null;  // lead with this in rescue calls
  high_risk_signals: string[];          // language patterns that precede misses
  probe_for_specificity: boolean;       // if true, always ask time + location in morning plans
  preferred_register: 'direct' | 'gentle' | 'energetic';
  behavioural_modifiers: string | null; // 1-2 sentence instruction to Ivy about how to adapt
}

// Static system prompts — kept frozen so prompt caching activates once the prompts
// grow past Haiku's 4096-token minimum. Cache_control markers are included as best
// practice; expand these prompts with examples to unlock caching.

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
  2-3 sentences written from Ivy's perspective, as if briefing the next Ivy call. What was planned or confirmed? What was the person's energy like? Anything notable? Example: "James committed to a 6pm gym session — upper body weights. He was slightly hesitant due to meetings but responded well to identity framing and locked it in confidently."

memorable_moments
  An array of specific facts worth remembering long-term about this person. Only include genuinely memorable details — not generic. Each item has:
  - content: the specific fact as Ivy observed it (one sentence, concrete)
  - category: one of motivation | life_event | personal_detail | struggle | breakthrough
  Return an empty array [] if nothing notable emerged.

Respond ONLY with valid JSON. No markdown, no explanation, no code fences.`;

const SYNTHESIS_SYSTEM = `You synthesise behavioural patterns from a series of accountability coaching call insights. Your output directly shapes how a voice AI named Ivy adapts her approach with each individual user.

How your output is used:
- inferred_patterns: Ivy says this aloud to the user at Season Close or quarterly calls. Write it as something Ivy would naturally say — warm, specific, grounded in data. "I've noticed something about you..." Not flattery. An earned observation.
- notable_observation: The single sharpest thing Ivy can say. One sentence, maximum specificity.
- behavioural_modifiers: A 1-2 sentence instruction to Ivy (never said to the user) about how to adapt her approach in every call.
- probe_for_specificity: If true, Ivy always asks for time + location in morning plans before confirming.
- most_effective_nudge: Ivy leads with this in rescue calls for this user.
- high_risk_signals: Language or patterns that have preceded misses. Ivy listens for these.
- preferred_register: Ivy calibrates her tone — direct, gentle, or energetic.

Rules:
- Only surface patterns with at least 3 data points. If a pattern has 1-2 instances, return null.
- Never generate flattery or generic observations. "You always follow through" is not an observation — it's praise. "Every time you've said 'I'll probably go', you've missed — but every time you've named a specific time, you've done it" is an observation.
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
   * Fires async after call_analyzed webhook — never blocks the webhook response.
   * On completion, triggers synthesizeUserProfile.
   */
  async extractCallInsights(
    callId: string,
    transcript: string,
    callType: string,
    userId: string,
  ): Promise<void> {
    if (!this.client) return;
    if (!transcript || transcript.length < 200) return; // too short to analyse

    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 700,
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

      // Store full insights JSON + copy call_summary to the dedicated text column
      await prisma.call.update({
        where: { id: callId },
        data: {
          callInsights: insights as object,
          callSummary: insights.call_summary ?? null,
        },
      });

      // Persist memorable moments as CallMemory records (Layer 3 long-term memory)
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

      // Synthesise updated profile — fires async, never throws to caller
      this.synthesizeUserProfile(userId).catch((err) =>
        logger.error(`Profile synthesis failed for user ${userId}:`, err)
      );
    } catch (err) {
      logger.error(`Insight extraction failed for call ${callId}:`, err);
    }
  }

  /**
   * Synthesise a behavioural profile from the last 20 calls with insights.
   * Called after each extraction. Requires ≥3 calls with insights before producing output.
   */
  async synthesizeUserProfile(userId: string): Promise<void> {
    if (!this.client) return;

    try {
      const recentCalls = await prisma.call.findMany({
        where: { userId, NOT: { callInsights: { equals: undefined } }, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: { callType: true, callInsights: true, createdAt: true },
      });

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
  "behavioural_modifiers": "string or null"
}`;

      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 600,
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
            content: `Synthesise a behavioural profile from ${recentCalls.length} recent calls.\n\nInsights:\n${insightsSummary}\n\nReturn JSON matching:\n${responseSchema}`,
          },
        ],
      });

      const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : null;
      if (!raw) return;

      const profile: InferredProfile = JSON.parse(raw);

      await prisma.user.update({
        where: { id: userId },
        data: { inferredProfile: profile as any },
      });

      logger.info(`Behavioural profile updated for user ${userId} (${recentCalls.length} calls)`);
    } catch (err) {
      logger.error(`Profile synthesis failed for user ${userId}:`, err);
    }
  }
}

export default new InsightService();
