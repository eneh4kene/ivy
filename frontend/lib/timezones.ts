/**
 * Timezone detection and the picker list.
 *
 * The whole product is a scheduled ritual — an evening call at the right moment
 * — so a wrong timezone doesn't degrade the experience, it removes it. The DB
 * default is Europe/London, and nothing used to capture the real one: a New York
 * client's 19:00 call fired at 19:00 London, i.e. 2pm their time.
 *
 * Two holes fed that, which is why detection lives here rather than in one page:
 * /signup never sent a timezone, and the coach-invite path creates users
 * server-side (coach.service.joinViaInviteToken) where no browser exists at all.
 */

/** The Prisma default. A user still on this has almost certainly never set one. */
export const DEFAULT_TIMEZONE = 'Europe/London'

/**
 * The browser's IANA timezone, or the default if unavailable (very old browsers,
 * locked-down privacy modes).
 */
export function detectTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE
  } catch {
    return DEFAULT_TIMEZONE
  }
}

/**
 * Picker options. The previous list held five entries and omitted US Central and
 * Mountain entirely, so clients in Chicago, Denver or Phoenix could not select
 * their own zone at all — they had no correct answer available.
 */
export const TIMEZONE_OPTIONS: Array<{ value: string; label: string; group: string }> = [
  { value: 'Europe/London', label: 'London (GMT/BST)', group: 'UK & Europe' },
  { value: 'Europe/Dublin', label: 'Dublin (GMT/IST)', group: 'UK & Europe' },
  { value: 'Europe/Paris', label: 'Paris · Berlin · Madrid (CET)', group: 'UK & Europe' },
  { value: 'Europe/Lisbon', label: 'Lisbon (WET)', group: 'UK & Europe' },
  { value: 'Europe/Athens', label: 'Athens · Helsinki (EET)', group: 'UK & Europe' },

  { value: 'America/New_York', label: 'New York · Miami (Eastern)', group: 'United States & Canada' },
  { value: 'America/Chicago', label: 'Chicago · Houston (Central)', group: 'United States & Canada' },
  { value: 'America/Denver', label: 'Denver (Mountain)', group: 'United States & Canada' },
  { value: 'America/Phoenix', label: 'Phoenix (Mountain, no DST)', group: 'United States & Canada' },
  { value: 'America/Los_Angeles', label: 'Los Angeles · Seattle (Pacific)', group: 'United States & Canada' },
  { value: 'America/Anchorage', label: 'Anchorage (Alaska)', group: 'United States & Canada' },
  { value: 'Pacific/Honolulu', label: 'Honolulu (Hawaii)', group: 'United States & Canada' },
  { value: 'America/Toronto', label: 'Toronto (Eastern)', group: 'United States & Canada' },
  { value: 'America/Vancouver', label: 'Vancouver (Pacific)', group: 'United States & Canada' },

  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)', group: 'Rest of world' },
  { value: 'Asia/Singapore', label: 'Singapore (SGT)', group: 'Rest of world' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)', group: 'Rest of world' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)', group: 'Rest of world' },
  { value: 'Asia/Kolkata', label: 'India (IST)', group: 'Rest of world' },
  { value: 'Africa/Lagos', label: 'Lagos (WAT)', group: 'Rest of world' },
  { value: 'Africa/Johannesburg', label: 'Johannesburg (SAST)', group: 'Rest of world' },
]

export const TIMEZONE_GROUPS = ['UK & Europe', 'United States & Canada', 'Rest of world'] as const

/**
 * A detected zone may not be in the curated list (e.g. America/Detroit). Keeping
 * it selectable prevents the picker silently resetting someone's correct zone to
 * a wrong one just because it isn't an option we happened to list.
 */
export function optionsIncluding(current?: string) {
  if (!current || TIMEZONE_OPTIONS.some((o) => o.value === current)) return TIMEZONE_OPTIONS
  return [...TIMEZONE_OPTIONS, { value: current, label: current, group: 'Rest of world' }]
}

/** Local time in a zone right now — lets the user confirm at a glance. */
export function currentTimeIn(timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date())
  } catch {
    return ''
  }
}
