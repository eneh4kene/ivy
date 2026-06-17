/**
 * Mock data for the Home / Dashboard screen.
 *
 * MOCK DATA ONLY — all production data comes from the API.
 * Shapes reflect docs/product-pricing-rework.md §2, §4a, §5b.
 * All API wiring points marked // TODO(api):
 */

export type DayStatus = 'armed' | 'complete' | 'forfeited' | 'grace' | 'upcoming'

export interface WeekDay {
  label: string         // Mon, Tue …
  status: DayStatus
  isToday: boolean
}

export interface DashboardStake {
  weeklyAmount: number
  dailySlice: number
  currency: 'GBP' | 'USD'
  daysArmed: number
  daysCompleted: number
  daysForfeited: number
  graceUsed: number
  graceTotal: number
  cycleEndsAt: Date
  forfeitMode: 'MIDDLE' | 'SAVAGE'
  forfeitDestination: string
  successDestination: string
  amountSafe: number       // week slice * daysCompleted
  amountAtRisk: number     // week slice * daysRemaining
}

export interface DashboardSeason {
  title: string
  seasonNumber: number
  goal: string
  sprintLabel: string
  sprintNumber: number
  seasonProgressPct: number
  sprintProgressPct: number
  daysLeftInSprint: number
  sprintPledge: string
}

export interface DashboardCircle {
  name: string
  membersActive: number
  membersTotal: number
  gameLabel: string
  userHoldsBaton: boolean
  nextPassDeadline?: Date
  circleDaysArmedThisWeek: number
}

export interface ImpactTotals {
  lifetimeDonated: number       // £ donated on successes
  lifetimeSavedFromForfeits: number  // £ user kept by succeeding
  currency: 'GBP' | 'USD'
  charityName: string
  charityLogoInitials: string
  donationCount: number
}

// ─── Mock values ──────────────────────────────────────────────────────────────

// MOCK: today's arming/stake status
export const MOCK_DASHBOARD_STAKE: DashboardStake = {
  weeklyAmount: 14,
  dailySlice: 2,
  currency: 'GBP',
  daysArmed: 3,
  daysCompleted: 2,
  daysForfeited: 0,
  graceUsed: 0,
  graceTotal: 1,
  cycleEndsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
  forfeitMode: 'MIDDLE',
  forfeitDestination: 'British Red Cross',
  successDestination: 'Médecins Sans Frontières',
  amountSafe: 4,
  amountAtRisk: 8,
}

// MOCK: week at a glance dots
export const MOCK_WEEK_DAYS: WeekDay[] = [
  { label: 'Mon', status: 'complete',  isToday: false },
  { label: 'Tue', status: 'complete',  isToday: false },
  { label: 'Wed', status: 'armed',     isToday: true  },
  { label: 'Thu', status: 'upcoming',  isToday: false },
  { label: 'Fri', status: 'upcoming',  isToday: false },
  { label: 'Sat', status: 'upcoming',  isToday: false },
  { label: 'Sun', status: 'upcoming',  isToday: false },
]

// MOCK: current streak
export const MOCK_STREAK = {
  current: 9,
  longest: 22,
  graceRemaining: 1,
}

// MOCK: season / sprint context
export const MOCK_SEASON: DashboardSeason = {
  title: 'Build the Foundation',
  seasonNumber: 1,
  goal: 'Run a 5k race by end of June',
  sprintLabel: 'Sprint 3 of 3',
  sprintNumber: 3,
  seasonProgressPct: 72,
  sprintProgressPct: 38,
  daysLeftInSprint: 17,
  sprintPledge: 'Run 4 times per week. No excuses.',
}

// MOCK: circle snapshot
export const MOCK_DASHBOARD_CIRCLE: DashboardCircle = {
  name: 'The Morning Five',
  membersActive: 4,
  membersTotal: 5,
  gameLabel: 'Baton relay · Sprint 3',
  userHoldsBaton: false,
  nextPassDeadline: new Date(Date.now() + 9 * 60 * 60 * 1000),
  circleDaysArmedThisWeek: 18,
}

// MOCK: lifetime impact
export const MOCK_IMPACT: ImpactTotals = {
  lifetimeDonated: 48,
  lifetimeSavedFromForfeits: 126,
  currency: 'GBP',
  charityName: 'Médecins Sans Frontières',
  charityLogoInitials: 'MSF',
  donationCount: 24,
}

export const MOCK_DASHBOARD_USER = {
  firstName: 'Kezia',
  isArmedToday: true,
}
