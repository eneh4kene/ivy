/**
 * Callback detection — keeps Ivy's word.
 *
 * When a user asks Ivy to "call me back in an hour" / "ring me after work", the
 * agent agrees verbally but nothing in the pipeline acted on it (the post-call
 * webhooks only logged status + insights). This reads the finished transcript
 * with Haiku, and if the user EXPLICITLY requested a callback at a parseable
 * time, schedules a RESCUE call so the promise is actually kept.
 *
 * Conservative by design: only fires on a clear user request, clamps the delay,
 * and won't double-book near an existing scheduled call. The scheduleCall daily
 * cap (5) is the final backstop against runaway scheduling.
 */
import Anthropic from '@anthropic-ai/sdk';
import callService from './call.service';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { opsAlert } from '../lib/ops-alert';

const MIN_DELAY_MIN = 5;        // ignore "call me right now" — that's what rescue is for
// 26h, not 12h: "ring me after my interview tomorrow morning" is a normal ask
// and used to fall outside the window. Still tight enough that a misparse
// cannot book days out.
const MAX_DELAY_MIN = 26 * 60;
const DEDUPE_WINDOW_MIN = 20;   // don't add a callback within ±20m of an existing call

class CallbackService {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else {
      logger.warn('ANTHROPIC_API_KEY not set — callback detection disabled');
    }
  }

  /**
   * Inspect a completed call's transcript; schedule a callback if the user asked
   * for one. Best-effort: never throws into the webhook (caller should .catch).
   */
  async detectAndSchedule(userId: string, transcript: string, originalCallType?: string): Promise<void> {
    if (!this.client || !transcript?.trim()) return;

    const minutes = await this.extractCallbackDelay(transcript);
    if (minutes == null) return;

    // Never CLAMP a request that overshoots. Clamping keeps the promise's shape
    // and destroys its content: "I'll call after your 11am interview" becomes a
    // call at 9am, which is worse than no call — she rang, and she was wrong.
    // Out of range is a promise we cannot keep, so page it instead of guessing.
    if (minutes > MAX_DELAY_MIN) {
      await opsAlert({
        severity: 'warn',
        source: 'callback',
        title: 'callback_out_of_range',
        detail: `user asked to be called back in ~${Math.round(minutes / 60)}h, beyond the ${MAX_DELAY_MIN / 60}h window — not scheduled`,
        userId,
      }).catch(() => {});
      logger.warn(`Callback for ${userId} out of range (${minutes}m) — not scheduled`);
      return;
    }
    const clamped = Math.max(minutes, MIN_DELAY_MIN);
    const scheduledAt = new Date(Date.now() + clamped * 60 * 1000);

    // Don't double-book: skip if a non-terminal call already sits near this slot.
    const windowMs = DEDUPE_WINDOW_MIN * 60 * 1000;
    const clash = await prisma.call.findFirst({
      where: {
        userId,
        status: { in: ['SCHEDULED', 'IN_PROGRESS'] },
        scheduledAt: {
          gte: new Date(scheduledAt.getTime() - windowMs),
          lte: new Date(scheduledAt.getTime() + windowMs),
        },
      },
      select: { id: true },
    });
    if (clash) {
      logger.info(`Callback for ${userId} skipped — existing call ${clash.id} near ${scheduledAt.toISOString()}`);
      return;
    }

    try {
      // Resume the call they cut short, as the SAME call type — an onboarding
      // interrupted by "call me back in a minute" must come back as onboarding,
      // not a rescue (learned live: the first ever callback returned as RESCUE
      // and pitched skip-recovery to a brand-new user's voicemail). Markers let
      // the prompt have Ivy acknowledge the callback AND pick up where the last
      // call left off instead of starting over.
      const resumeType = (originalCallType ?? 'RESCUE') as Parameters<typeof callService.scheduleCall>[1];
      const call = await callService.scheduleCall(userId, resumeType, scheduledAt, {
        is_callback: true,
        callback_requested_minutes: clamped,
        resumes_interrupted_call: true,
      });
      logger.info(`Callback honoured: ${call.id} for user ${userId} in ${clamped}m (${scheduledAt.toISOString()})`);
      const { serverAnalytics } = await import('../lib/analytics');
      serverAnalytics.callbackDetected(userId, clamped);
      serverAnalytics.callbackCallScheduled(userId, resumeType as string);
    } catch (err) {
      // Daily cap or no-phone etc. — the promise Ivy made on the call can't be
      // kept, and the user is waiting for a callback that won't come. Page it.
      await opsAlert({
        severity: 'critical',
        source: 'callback',
        title: 'callback_schedule_failed',
        detail: 'user asked to be called back on the call and the callback was never scheduled',
        userId,
        error: err,
      });
    }
  }

  /**
   * Ask Haiku whether the USER asked to be called back and after how many minutes.
   * Returns minutes (number) or null if no clear request.
   */
  private async extractCallbackDelay(transcript: string): Promise<number | null> {
    if (!this.client) return null;
    try {
      const response = await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 80,
        messages: [
          {
            role: 'user',
            content:
              'You read a phone call transcript between a fitness coach (Ivy/Agent/Assistant) ' +
              'and a USER. Decide ONLY whether the USER explicitly asked to be called back later, ' +
              'and if so, in how many minutes from the end of the call.\n' +
              'Rules:\n' +
              '- Only count a request made by the USER (not the agent offering).\n' +
              '- "in an hour" = 60, "in half an hour" = 30, "later tonight" ≈ 180, ' +
              '"tomorrow morning" ≈ 720, "in a couple hours" = 120.\n' +
              '- If the user did NOT clearly ask for a callback, return minutes 0.\n' +
              'Respond with STRICT JSON only: {"callback": boolean, "minutes": number}.\n\n' +
              'Transcript:\n' + transcript.slice(0, 6000),
          },
        ],
      });

      const text = response.content
        .map((b: any) => (b.type === 'text' ? b.text : ''))
        .join('')
        .trim();
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) return null;
      const parsed = JSON.parse(match[0]) as { callback?: boolean; minutes?: number };
      if (!parsed.callback || !parsed.minutes || parsed.minutes <= 0) return null;
      return Math.round(parsed.minutes);
    } catch (err) {
      logger.warn('Callback extraction failed:', err);
      return null;
    }
  }
}

export default new CallbackService();
