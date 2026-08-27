/**
 * Future-commitment capture — makes a session promised for ANOTHER day real.
 *
 * commitment-time.service captures the clock time for TODAY's activity, and
 * plan-adjustment.service captures permanent pattern changes. Neither covers the
 * commonest thing people actually say on an evening call: "I'll do legs Tuesday
 * at 10." Observed live — a member rescheduled a missed session to the following
 * Tuesday, agreed a time, and nothing in the system knew: no T-60 nudge on the
 * day, and Ivy's next call had no idea a session was owed.
 *
 * Writes a PLANNED Workout for the future date. That is deliberately the same
 * row the app's own plan flow writes, so the existing machinery picks it up for
 * free: runPreCommitReminders already scans a ±36h window on plannedDate, and
 * the daily loop reads today's PLANNED workout.
 *
 * Conservative, mirroring commitment-time.service:
 *  - only an explicit day AND clock time ("Tuesday at 10") — "next week" alone,
 *    or a day with no time, is a no-op
 *  - resolves to the NEXT occurrence of that weekday in the member's timezone,
 *    never a date in the past
 *  - refuses anything more than 14 days out (a model hallucinating a date should
 *    not silently plant a reminder months away)
 *  - never overwrites an existing PLANNED workout for that date
 *  - never throws into its caller
 */
import Anthropic from '@anthropic-ai/sdk';
import { fromZonedTime } from 'date-fns-tz';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { logUsage } from './usage.service';

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/;
const DAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MAX_DAYS_AHEAD = 14;

const SYSTEM = `You read a transcript of an accountability call and report ONLY a session the member committed to on a FUTURE day (not today).

Return JSON:
{
  "committed": true|false,
  "weekday": "monday"|"tuesday"|...|"sunday" or null,
  "time": "HH:MM" (24h) or null,
  "activity": "short description, e.g. 'legs session at the gym'" or null
}

RULES — be strict; a false positive plants a reminder for something nobody agreed:
- "committed" is true ONLY if they named BOTH a day and a clock time for a
  session on a day OTHER than today. "Sometime next week", "Tuesday probably",
  or a day with no time = committed:false.
- Ivy asking is not committing. The MEMBER must state or confirm it.
- If they discussed several, report the one they settled on last.
- Convert plain speech to 24h: "10" in a morning context = "10:00", "7 in the
  evening" = "19:00". If genuinely ambiguous, return committed:false.
- Today's session is out of scope — another service handles that.`;

class FutureCommitmentService {
  private client: Anthropic | null = null;
  private getClient(): Anthropic | null {
    if (!process.env.ANTHROPIC_API_KEY) return null;
    if (!this.client) this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    return this.client;
  }

  async captureFromTranscript(userId: string, transcript: string | null | undefined): Promise<void> {
    try {
      if (!transcript || transcript.trim().length < 80) return;
      const client = this.getClient();
      if (!client) return;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true, track: true },
      });
      if (!user) return;
      const tz = user.timezone || 'Europe/London';

      const res = await client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 300,
        system: SYSTEM,
        messages: [{ role: 'user', content: transcript.slice(0, 12000) }],
      });
      await logUsage('anthropic', 'haiku_tokens', (res.usage?.input_tokens ?? 0) + (res.usage?.output_tokens ?? 0), userId, { type: 'future_commitment' });

      const block = res.content.find((b) => b.type === 'text');
      if (!block || block.type !== 'text') return;
      const parsed = JSON.parse(block.text.replace(/^```json\s*|\s*```$/g, '').trim()) as {
        committed?: boolean; weekday?: string; time?: string; activity?: string;
      };

      if (parsed.committed !== true) return;
      const weekday = (parsed.weekday ?? '').toLowerCase().trim();
      const time = (parsed.time ?? '').trim();
      if (!DAYS.includes(weekday) || !HHMM_RE.test(time)) return;

      const plannedDate = this.nextOccurrence(weekday, time, tz);
      if (!plannedDate) return;

      const daysAhead = (plannedDate.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
      if (daysAhead < 0 || daysAhead > MAX_DAYS_AHEAD) {
        logger.warn(`future-commitment: ${daysAhead.toFixed(1)}d out for ${userId} — outside window, ignoring`);
        return;
      }

      // Never clobber a session the member already planned themselves.
      const dayStart = new Date(plannedDate); dayStart.setUTCHours(0, 0, 0, 0);
      const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);
      const existing = await prisma.workout.findFirst({
        where: { userId, status: 'PLANNED', plannedDate: { gte: dayStart, lt: dayEnd } },
        select: { id: true },
      });
      if (existing) {
        logger.info(`future-commitment: ${userId} already has a PLANNED session that day — leaving it`);
        return;
      }

      await prisma.workout.create({
        data: {
          userId,
          plannedDate,
          plannedTime: time,
          status: 'PLANNED',
          activity: parsed.activity?.slice(0, 120) || `${user.track ?? 'training'} session`,
        },
      });

      logger.info(`future-commitment captured for ${userId}: ${weekday} ${time} (${plannedDate.toISOString()}) — "${parsed.activity ?? ''}"`);
    } catch (err) {
      logger.warn(`future-commitment capture failed for ${userId}:`, err);
    }
  }

  /**
   * The next occurrence of `weekday` at `time` in the member's timezone.
   * "Tuesday" said on a Tuesday means NEXT Tuesday if that time has passed,
   * later today if it has not.
   */
  private nextOccurrence(weekday: string, time: string, tz: string): Date | null {
    try {
      const target = DAYS.indexOf(weekday);
      if (target < 0) return null;
      const now = new Date();
      for (let add = 0; add <= 7; add++) {
        const probe = new Date(now.getTime() + add * 24 * 60 * 60 * 1000);
        const localDay = probe.toLocaleDateString('en-US', { weekday: 'long', timeZone: tz }).toLowerCase();
        if (localDay !== weekday) continue;
        const localDate = probe.toLocaleDateString('en-CA', { timeZone: tz }); // YYYY-MM-DD
        const when = fromZonedTime(`${localDate}T${time}:00`, tz);
        if (when.getTime() > now.getTime()) return when;
      }
      return null;
    } catch {
      return null;
    }
  }
}

export const futureCommitmentService = new FutureCommitmentService();
export default futureCommitmentService;
