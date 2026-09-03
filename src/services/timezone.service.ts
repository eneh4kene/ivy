/**
 * Timezone write-back — the calls follow the person, not the account.
 *
 * Every call time in this product is stored as a LOCAL wall-clock string
 * (eveningCallTime "20:00") and resolved through the timezone on the user row.
 * That means moving the timezone alone is the whole fix: someone who lands in
 * Denver still gets their 20:00 call, at 20:00 in Denver. There is nothing to
 * renegotiate and no time for them to re-pick — which is precisely why doing
 * this automatically is safe to do and strange not to.
 *
 * Until now nothing ever updated a timezone after signup. The browser set it
 * once, a login repaired it once if it was still the Europe/London default, and
 * then it was frozen forever. A client who flew from New York to Los Angeles
 * kept being called at 17:00 their time, and Ivy — who had just been taught to
 * say "my calls don't follow you, change it in Settings" — could only apologise
 * for a system that could have simply moved.
 *
 * CONSERVATISM, mirroring commitment-time.service. A wrong write here is worse
 * than no write: it silently moves every future call to the wrong hour, which
 * is the exact failure the hourly-scheduler fix just closed.
 *   - PRESENT arrival only. "I'm in Chicago this week" writes; "I might go to
 *     Texas in October" does not. A trip announced for the future is handled by
 *     the travel prompt, not by moving them before they have gone.
 *   - The zone must survive Intl validation — a hallucinated "America/Boston"
 *     is discarded rather than stored.
 *   - Never writes the zone they are already on.
 *   - Records the move as a memory, so Ivy tells them what she did on the next
 *     call instead of it happening invisibly behind them.
 *   - Never throws into its caller.
 */
import Anthropic from '@anthropic-ai/sdk';
import prisma from '../utils/prisma';
import logger from '../utils/logger';
import { opsAlert } from '../lib/ops-alert';
import { serverAnalytics } from '../lib/analytics';
import { logUsage } from './usage.service';

/** Real IANA zones, from the runtime rather than a list we would have to maintain. */
function isRealZone(zone: string): boolean {
  try {
    // Throws RangeError on anything Intl does not recognise.
    new Intl.DateTimeFormat('en-GB', { timeZone: zone });
    return zone.includes('/');
  } catch {
    return false;
  }
}

export type TimezoneSource = 'call' | 'chat';

/**
 * Cheap gate for the chat path. A call transcript is already a rare, expensive
 * event worth one Haiku call; a chat message is not — most are "yeah" and
 * "ok". Same shape as the coach-programme extractor, which only runs when a
 * message plausibly names a client. Deliberately loose: this decides whether
 * to ASK, and Haiku still does the deciding.
 */
const MENTIONS_A_PLACE =
  /\b(land(ed|ing)?|touch(ed)?\s*down|arriv\w*|flew|flight|fly(ing)?|abroad|overseas|jet ?lag(ged)?|time ?zone|out here|over here|back home|hotel|airbnb|i'?m in|i am in|we'?re in|out in|off to|heading to|trip|travel\w*|visiting)\b/i;

export function chatMayMentionTravel(text: string): boolean {
  return MENTIONS_A_PLACE.test(text);
}

class TimezoneService {
  private client: Anthropic | null = null;

  constructor() {
    if (process.env.ANTHROPIC_API_KEY) {
      this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    } else {
      logger.warn('ANTHROPIC_API_KEY not set — timezone write-back disabled');
    }
  }

  /**
   * Read a call transcript; if the member clearly said they are NOW somewhere
   * in a different timezone, move their account so their calls land at the same
   * local hour where they actually are. Best-effort: never throws.
   */
  async captureFromTranscript(
    userId: string,
    transcript: string,
    source: TimezoneSource = 'call',
  ): Promise<{ from: string; to: string } | null> {
    if (!this.client || !transcript?.trim()) return null;

    try {
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { timezone: true, firstName: true },
      });
      if (!user) return null;
      const current = user.timezone || 'Europe/London';

      const detected = await this.extractZone(transcript, current, userId, source);
      if (!detected) return null;

      if (!isRealZone(detected)) {
        logger.warn(`Timezone write-back: "${detected}" is not a real IANA zone — discarded (user ${userId})`);
        return null;
      }
      if (detected === current) return null;

      await prisma.user.update({ where: { id: userId }, data: { timezone: detected } });

      // So the next call opens knowing it happened. A move the member never
      // hears about is a system changing their day behind their back.
      await prisma.callMemory.create({
        data: {
          userId,
          content:
            `Now in ${detected.split('/').pop()?.replace(/_/g, ' ')} — their calls were moved from ` +
            `${current.split('/').pop()?.replace(/_/g, ' ')} so they still land at their usual local time.`,
          category: 'life_event',
          source: 'call',
        },
      });

      serverAnalytics.timezoneAutoUpdated(userId, current, detected);
      logger.info(`Timezone write-back (${source}): ${userId} ${current} → ${detected}`);
      return { from: current, to: detected };
    } catch (err) {
      // A miss means their calls keep firing on the old zone — recoverable, but
      // it is the thing this service exists to prevent, so make it visible.
      await opsAlert({
        severity: 'warn',
        source: 'timezone',
        title: 'timezone_capture_failed',
        userId,
        error: err,
      });
    }
    return null;
  }

  /**
   * Ask Haiku whether the member said they are CURRENTLY somewhere in another
   * timezone. Returns an IANA zone or null. Deliberately narrow: the cost of a
   * false positive is every future call at the wrong hour.
   */
  private async extractZone(
    transcript: string,
    current: string,
    userId: string,
    source: TimezoneSource,
  ): Promise<string | null> {
    const response = await this.client!.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 24,
      messages: [
        {
          role: 'user',
          content:
            (source === 'chat'
              ? `A coaching client just sent this message. Their account timezone is "${current}":\n\n`
              : `A coaching client is on a call. Their account timezone is "${current}". Transcript:\n\n`) +
            `"${transcript.slice(0, 6000)}"\n\n` +
            `Did they say they are RIGHT NOW, or for the next few days, physically in a place ` +
            `in a DIFFERENT timezone from "${current}"?\n\n` +
            `Answer YES only if they have already arrived or are there now — ` +
            `"I'm in Chicago this week", "just landed in LA", "I'm out in Denver until Friday".\n` +
            `Answer NO for anything still ahead of them ("I fly to Texas on Thursday", ` +
            `"I've got an interview in Boston next month"), anything hypothetical, ` +
            `any place in the SAME timezone as "${current}", and any mention of somewhere ` +
            `they are not ("my brother's in Tokyo").\n\n` +
            `If YES: reply with ONLY the IANA timezone identifier, e.g. America/Chicago.\n` +
            `If NO: reply with ONLY the word NONE.`,
        },
      ],
    });

    logUsage(
      'anthropic',
      'haiku_tokens',
      (response.usage?.input_tokens ?? 0) + (response.usage?.output_tokens ?? 0),
      userId,
      { op: 'timezone_capture' },
    ).catch(() => {});

    const raw = response.content[0]?.type === 'text' ? response.content[0].text.trim() : '';
    if (!raw || /^none$/i.test(raw)) return null;
    return raw.split(/\s+/)[0].replace(/[.,"']/g, '');
  }
}

export const timezoneService = new TimezoneService();
export default timezoneService;
