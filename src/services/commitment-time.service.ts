/**
 * Commitment-time capture — makes the spoken "when" real.
 *
 * Ivy probes for the exact time of a client's daily commitment on calls and in
 * morning voice notes, but until now that time only shaped conversation — the
 * T-60 pre-commit reminder (arming.service runPreCommitReminders) fires solely
 * off Workout.plannedTime, which only the app's plan flow wrote. So a client
 * who SAID "I'll run at 6pm" got no 5pm nudge unless they also typed it.
 *
 * This reads the transcript with Haiku and, when the user clearly stated a
 * clock time for TODAY's activity, writes it back to the workout so the
 * existing reminder machinery picks it up.
 *
 * Conservative by design, mirroring callback.service:
 * - only fires on a clearly stated time (vague "later" / "this evening" = no-op)
 * - never overwrites a time the user set explicitly (plannedTime must be null)
 * - never sets a time already past in the user's own timezone
 * - never throws into its caller
 */
import Anthropic from '@anthropic-ai/sdk'
import { formatInTimeZone, fromZonedTime } from 'date-fns-tz'
import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { opsAlert } from '../lib/ops-alert'
import { serverAnalytics } from '../lib/analytics'
import { logUsage } from './usage.service'

const HHMM_RE = /^([01]?\d|2[0-3]):([0-5]\d)$/

export type CommitmentTimeSource = 'voice_note' | 'call'

class CommitmentTimeService {
  private client: Anthropic | null = null

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
    } else {
      logger.warn('ANTHROPIC_API_KEY not set — commitment-time capture disabled')
    }
  }

  /**
   * Read a transcript; if the user stated a clock time for today's activity
   * and today's workout has no plannedTime yet, write it back so the T-60
   * pre-commit reminder fires. Best-effort: never throws.
   */
  async captureFromText(userId: string, text: string, source: CommitmentTimeSource): Promise<void> {
    if (!this.client || !text?.trim()) return

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true },
      })
      if (!user) return
      const tz = user.timezone ?? 'Europe/London'
      const todayLocal = formatInTimeZone(new Date(), tz, 'yyyy-MM-dd')

      // plannedDate is persisted as UTC-midnight of the intended calendar day
      // (see runPreCommitReminders) — match today's row in the USER'S calendar.
      // plannedTime: null is the overwrite guard: an explicitly planned time
      // (app plan flow) always wins over an extracted one.
      const workout = await prisma.workout.findFirst({
        where: {
          userId,
          status: 'PLANNED',
          plannedTime: null,
          plannedDate: {
            gte: new Date(`${todayLocal}T00:00:00Z`),
            lte: new Date(`${todayLocal}T23:59:59Z`),
          },
        },
        select: { id: true },
      })
      if (!workout) return

      const hhmm = await this.extractTime(text, userId)
      if (!hhmm) return

      // A time already past in the user's day can't be nudged and would
      // misrepresent the plan — skip. (Also protects against "tomorrow at 7am"
      // said in the evening: 07:00 today is in the past.)
      const committed = fromZonedTime(`${todayLocal}T${hhmm}:00`, tz)
      if (committed.getTime() <= Date.now()) {
        logger.info(`Commitment time ${hhmm} for user ${userId} already passed — not written`)
        return
      }

      await prisma.workout.update({
        where: { id: workout.id },
        data: { plannedTime: hhmm },
      })
      serverAnalytics.plannedTimeCaptured(userId, source)
      logger.info(`Commitment time captured (${source}): ${hhmm} → workout ${workout.id} for user ${userId}`)
    } catch (err) {
      // Failure means a nudge that should exist won't — surface it, throttled.
      await opsAlert({
        severity: 'warn',
        source: 'commitment-time',
        title: 'when_capture_failed',
        userId,
        error: err,
      })
    }
  }

  /**
   * Ask Haiku whether the user clearly stated a clock time for TODAY's
   * activity. Returns normalized "HH:MM" (24h, user-local) or null.
   */
  private async extractTime(text: string, userId: string): Promise<string | null> {
    const response = await this.client!.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 16,
      messages: [
        {
          role: 'user',
          content:
            `A coaching client just talked about their plan for TODAY. Their words:\n\n` +
            `"${text.slice(0, 4000)}"\n\n` +
            `Did they clearly state a specific clock time TODAY for doing their planned activity ` +
            `(e.g. "at 6pm", "around 5:30 after work")? Do not infer or guess. ` +
            `Vague timing ("later", "this evening", "after lunch") counts as NO. ` +
            `A time stated for a DIFFERENT day counts as NO.\n\n` +
            `If yes: reply with ONLY the time in 24-hour HH:MM format (their local time).\n` +
            `If no: reply with ONLY the word NONE.`,
        },
      ],
    })

    logUsage(
      'anthropic',
      'haiku_tokens',
      (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      userId,
      { op: 'when_capture' },
    ).catch(() => {})

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : ''
    const match = raw.match(HHMM_RE)
    if (!match) return null
    return `${match[1].padStart(2, '0')}:${match[2]}`
  }
}

export const commitmentTimeService = new CommitmentTimeService()
export default commitmentTimeService
