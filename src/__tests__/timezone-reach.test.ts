/**
 * Can a member in this timezone actually be reached?
 *
 * The scheduler computes a member's evening slot in their own timezone and
 * skips it when it has already passed. That is correct. What was wrong was
 * running it once a day at 00:00 UTC: at that instant it is already 20:00 in
 * New York and 19:00 in Chicago, so an East or Central US member's evening
 * call was always in the past and always skipped — not late, never scheduled,
 * on any day. Denver and Los Angeles fell inside the window and worked, which
 * is exactly why nobody noticed.
 *
 * Found before onboarding two US clients, not after.
 */
import { fromZonedTime } from 'date-fns-tz';
import { isBefore } from 'date-fns';

/** Mirrors scheduleDailyCalls: local calendar day → local HH:MM → UTC instant. */
const slotFor = (now: Date, tz: string, hhmm: string) =>
  fromZonedTime(`${now.toLocaleDateString('en-CA', { timeZone: tz })}T${hhmm}:00`, tz);

const wouldSchedule = (now: Date, tz: string, hhmm: string) =>
  isBefore(now, slotFor(now, tz, hhmm));

/** The hourly cron: every UTC hour of the member's day. */
const reachableAtSomeHour = (tz: string, hhmm: string, dayUtc: string) =>
  Array.from({ length: 24 }, (_, h) =>
    new Date(`${dayUtc}T${String(h).padStart(2, '0')}:00:00Z`),
  ).some((t) => wouldSchedule(t, tz, hhmm));

const US = ['America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles'];
const ZONES = ['Europe/London', ...US, 'Asia/Kolkata', 'Australia/Sydney'];
const TIMES = ['18:00', '19:00', '20:00', '21:00'];

describe('a once-daily 00:00 UTC run cannot reach everyone', () => {
  const midnightUtc = new Date('2026-09-03T00:00:00Z');

  it('silently drops Eastern and Central US members — the regression this guards', () => {
    expect(wouldSchedule(midnightUtc, 'America/New_York', '20:00')).toBe(false);
    expect(wouldSchedule(midnightUtc, 'America/Chicago', '19:00')).toBe(false);
  });

  it('worked for London, which is why it looked healthy', () => {
    expect(wouldSchedule(midnightUtc, 'Europe/London', '20:00')).toBe(true);
  });
});

describe('the hourly cron reaches every timezone we might sell into', () => {
  // Both sides of the US DST boundary: the offsets move, the guarantee cannot.
  for (const day of ['2026-09-03', '2026-01-15']) {
    for (const tz of ZONES) {
      for (const hhmm of TIMES) {
        it(`${tz} @ ${hhmm} on ${day}`, () => {
          expect(reachableAtSomeHour(tz, hhmm, day)).toBe(true);
        });
      }
    }
  }
});

/**
 * The dedup guard has to bound the member's OWN day. On a UTC day it bounded a
 * different 24 hours for everyone west of Greenwich — a US evening call lands
 * near midnight UTC, so it fell into the next server day and blocked the
 * following day's scheduling.
 */
describe('the local-day dedup window', () => {
  const windowFor = (now: Date, tz: string) => {
    const localDay = now.toLocaleDateString('en-CA', { timeZone: tz });
    return {
      start: fromZonedTime(`${localDay}T00:00:00`, tz),
      end: fromZonedTime(`${localDay}T23:59:59.999`, tz),
    };
  };

  it('contains that member\'s own evening call', () => {
    // 04:00 UTC = midnight in New York: the run that schedules their day.
    const now = new Date('2026-09-03T04:00:00Z');
    const tz = 'America/New_York';
    const { start, end } = windowFor(now, tz);
    const slot = slotFor(now, tz, '20:00');
    expect(slot >= start && slot <= end).toBe(true);
  });

  it('does not swallow the NEXT day, which a UTC window did', () => {
    const tz = 'America/New_York';
    const today = new Date('2026-09-03T04:00:00Z');
    const tomorrow = new Date('2026-09-04T04:00:00Z');
    // Today's 20:00 EDT is 2026-09-04T00:00Z — inside the UTC day that
    // tomorrow's run would have checked, so it used to block it.
    expect(slotFor(today, tz, '20:00').toISOString()).toBe('2026-09-04T00:00:00.000Z');
    const { start } = windowFor(tomorrow, tz);
    expect(slotFor(today, tz, '20:00') < start).toBe(true);
  });
});
