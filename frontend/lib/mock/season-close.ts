/**
 * Mock data for the Season Close / Impact Story screen.
 *
 * MOCK DATA ONLY — API wiring marked // TODO(api):
 * Reflects §8 of docs/product-pricing-rework.md (Season Close, Impact Stories).
 */

export interface SprintSummary {
  number: number
  pledge: string
  completedDays: number
  totalDays: number
  forfeited: number
  stakeAmount: number // £ at stake this sprint
}

export interface SeasonCloseData {
  seasonNumber: number
  seasonTitle: string
  seasonGoal: string
  startDate: Date
  endDate: Date
  // personal stats
  totalDaysArmed: number
  totalDaysCompleted: number
  totalDaysForfeited: number
  followThroughPct: number
  longestStreak: number
  // financial
  totalStakeKept: number          // £ returned to user
  totalStakeForfeited: number     // £ sent to house charity
  currency: 'GBP' | 'USD'
  // charity impact
  charityName: string
  charityLogoInitials: string
  charityLogoHue: number
  totalDonated: number            // £ to user's success charity
  donationCount: number
  // sprints
  sprints: SprintSummary[]
  // AI close summary
  arcSummary: string
  nextSeasonSuggestion: string
  // circle
  circleName: string
  circleCollectiveTotal: number  // group donated combined
}

// MOCK:
export const MOCK_SEASON_CLOSE: SeasonCloseData = {
  seasonNumber: 1,
  seasonTitle: 'Build the Foundation',
  seasonGoal: 'Run a 5k race by end of June',
  startDate: new Date('2026-03-17'),
  endDate: new Date('2026-06-16'),
  totalDaysArmed: 68,
  totalDaysCompleted: 62,
  totalDaysForfeited: 6,
  followThroughPct: 91,
  longestStreak: 22,
  totalStakeKept: 124,
  totalStakeForfeited: 12,
  currency: 'GBP',
  charityName: 'Médecins Sans Frontières',
  charityLogoInitials: 'MSF',
  charityLogoHue: 152,
  totalDonated: 48,
  donationCount: 62,
  sprints: [
    {
      number: 1,
      pledge: 'Run 3× per week',
      completedDays: 18,
      totalDays: 28,
      forfeited: 4,
      stakeAmount: 42,
    },
    {
      number: 2,
      pledge: 'Run 4× per week, no excuses',
      completedDays: 24,
      totalDays: 28,
      forfeited: 2,
      stakeAmount: 56,
    },
    {
      number: 3,
      pledge: 'Run 4× per week. Race prep.',
      completedDays: 20,
      totalDays: 28,
      forfeited: 0,
      stakeAmount: 56,
    },
  ],
  arcSummary:
    "You started this season not knowing if you could hold a daily commitment for 12 weeks. You showed up 91% of the time — including through a rough stretch in April where four days slipped but you pulled it back. Your longest streak was 22 days. That's not luck; that's a system working.",
  nextSeasonSuggestion:
    'Season 2: Now the baseline is there — go harder. Sub-25 5k, or extend to 10k by September.',
  circleName: 'The Morning Five',
  circleCollectiveTotal: 214,
}
