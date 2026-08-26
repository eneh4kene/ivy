/**
 * Plan-adjustment capture — makes an agreed change real.
 *
 * The evening flows now propose a concrete adjustment when a recurring blocker
 * resurfaces ("Thursdays don't work after six — mornings instead?"). Without
 * this, agreement is theatre: the member says yes, and tomorrow the same
 * reminders fire at the same times against the plan that has already failed
 * three times.
 *
 * Reads the transcript with Haiku and writes back ONLY when the member clearly
 * agreed. Mirrors commitment-time.service deliberately — same shape, same
 * conservatism:
 *  - only fires on explicit agreement (a proposal Ivy made but they did not
 *    accept is a no-op; "maybe", "I'll think about it" = no-op)
 *  - LOGISTICS ONLY. Never touches track, goal, stake, or programme. A voice
 *    call may move WHEN you train, never WHAT you train — that is the coach's.
 *  - validates every value before writing (HH:MM, real weekday names)
 *  - refuses a window whose end is not after its start
 *  - never throws into its caller
 *
 * Every write is logged, because a phone call silently mutating someone's
 * schedule is exactly the kind of thing that should be auditable when a member
 * asks "why did it text me at 6am?".
 */
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { opsAlert } from '../lib/ops-alert';
import { logUsage } from './usage.service';

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

/** Only these may ever be changed from a call. */
interface PlanAdjustment {
  armingWindowStart?: string | null;
  armingWindowEnd?: string | null;
  eveningCallTime?: string | null;
  preferredDays?: string[] | null;
}

const SYSTEM = `You read a transcript of an accountability call and report ONLY changes the member EXPLICITLY AGREED to.

Return JSON:
{
  "agreed": true|false,
  "armingWindowStart": "HH:MM" or null,
  "armingWindowEnd": "HH:MM" or null,
  "eveningCallTime": "HH:MM" or null,
  "preferredDays": ["monday","wednesday","friday"] or null,
  "summary": "one short sentence describing what they agreed to, or null"
}

RULES — be strict, a false positive silently changes someone's schedule:
- "agreed" is true ONLY if the member clearly accepted a specific change. Ivy
  proposing something is NOT agreement. "Maybe", "I'll think about it", "we'll
  see", silence, or changing the subject are NOT agreement.
- Only report a field if the new value is unambiguous. Vague ("earlier",
  "mornings") without a clock time = null.
- NEVER report anything about what they train, their goal, their stake or their
  money. Those are out of scope entirely.
- If they agreed to move a session to a different DAY, set preferredDays to the
  full corrected list of training days, not just the new one.
- If nothing was agreed, return {"agreed": false} with all fields null.`;

class PlanAdjustmentService {
  private client: Anthropic | null = null;

  private getClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    if (!this.client) this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return this.client;
  }

  /**
   * Extract and apply an agreed plan change. Fire-and-forget: never throws.
   */
  async captureFromTranscript(userId: string, transcript: string | null | undefined): Promise<void> {
    try {
      if (!transcript || transcript.trim().length < 80) return;
      const client = this.getClient();
      if (!client) return;

      const res = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 400,
        system: SYSTEM,
        messages: [{ role: 'user', content: transcript.slice(0, 12000) }],
      });
      await logUsage('anthropic', 'haiku_tokens', (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), userId, { type: 'plan_adjustment' });

      const text = res.content.find((b) => b.type === 'text');
      if (!text || text.type !== 'text') return;
      const parsed = JSON.parse(text.text.replace(/^```json\s*|\s*```$/g, '').trim()) as
        Record<string, unknown> & { agreed?: boolean; summary?: string };

      if (parsed.agreed !== true) return;

      const update = this.validate(parsed);
      if (!Object.keys(update).length) return;

      const before = await prisma.user.findUnique({
        where: { id: userId },
        select: { armingWindowStart: true, armingWindowEnd: true, eveningCallTime: true, preferredDays: true },
      });
      if (!before) return;

      // An arming window must stay coherent after a partial change — moving only
      // the start could otherwise invert it and silently disable the loop.
      const nextStart = (update.armingWindowStart ?? before.armingWindowStart) as string | null;
      const nextEnd = (update.armingWindowEnd ?? before.armingWindowEnd) as string | null;
      if (nextStart && nextEnd && !(nextStart < nextEnd)) {
        logger.warn(`plan-adjustment: refusing incoherent window ${nextStart}-${nextEnd} for ${userId}`);
        return;
      }

      await prisma.user.update({
        where: { id: userId },
        data: {
          ...(update.armingWindowStart !== undefined && { armingWindowStart: update.armingWindowStart }),
          ...(update.armingWindowEnd !== undefined && { armingWindowEnd: update.armingWindowEnd }),
          ...(update.eveningCallTime !== undefined && { eveningCallTime: update.eveningCallTime }),
          ...(update.preferredDays !== undefined && {
            preferredDays: update.preferredDays ? JSON.stringify(update.preferredDays) : null,
          }),
        },
      });

      logger.info(
        `plan-adjustment applied for ${userId}: ${JSON.stringify(update)} ` +
        `(was ${JSON.stringify(before)}) — "${parsed.summary ?? ''}"`
      );
    } catch (err) {
      // Never break call processing over a plan tweak.
      logger.warn(`plan-adjustment capture failed for ${userId}:`, err);
      opsAlert({
        severity: 'warn',
        source: 'plan-adjustment',
        title: 'capture_failed',
        detail: 'agreed plan change could not be applied — the member may expect a change that did not happen',
        userId,
        error: err,
      }).catch(() => {});
    }
  }

  /** Whitelist + validate. Anything unrecognised or malformed is dropped. */
  private validate(raw: Record<string, unknown>): PlanAdjustment {
    const out: PlanAdjustment = {};
    for (const key of ['armingWindowStart', 'armingWindowEnd', 'eveningCallTime'] as const) {
      const v = raw[key];
      if (typeof v === 'string' && HHMM_RE.test(v)) out[key] = v;
    }
    const days = raw.preferredDays;
    if (Array.isArray(days) && days.length) {
      const clean = days
        .filter((d): d is string => typeof d === 'string')
        .map((d) => d.toLowerCase().trim())
        .filter((d) => DAYS.includes(d));
      if (clean.length) out.preferredDays = Array.from(new Set(clean));
    }
    return out;
  }
}

export const planAdjustmentService = new PlanAdjustmentService();
export default planAdjustmentService;
