/**
 * Mock data for the Circles screen (/circles).
 *
 * MOCK DATA — all API calls replaced with these fixtures.
 * Wire to real API by replacing MOCK_* exports with fetched data.
 *
 * Reflects §4a of docs/product-pricing-rework.md:
 *   - relay/baton game (§4a, §4b)
 *   - points_race (leaderboard)
 *   - collective (shared progress bar)
 */

export type GameType = 'relay' | 'points_race' | 'collective'
export type MemberStatus = 'armed' | 'complete' | 'missed' | 'pending'
export type GameStatus = 'active' | 'paused' | 'completed'

export interface CircleMemberMock {
  id: string
  name: string
  initials: string
  avatarHue: number        // for generated avatar colour
  status: MemberStatus
  streakDays: number
  stakeWeekly: number     // £ per week — witness stakes (§4b mechanic 1)
  stakeShared: boolean    // has opted in to "witnessed stakes"
  isCurrentUser: boolean
}

export interface BatonState {
  holderId: string        // member id currently holding baton
  windowOpensAt: Date
  windowClosesAt: Date
  livesRemaining: number
  totalLives: number
  passedAt: Date | null   // last successful pass
  batonRaisedStake: number  // extra stake-at-risk for holder (§4b mechanic 3, baton-stake)
}

export interface LeaderboardEntry {
  memberId: string
  points: number
  rank: number
}

export interface CollectiveProgress {
  target: number           // e.g. 35 completed days
  current: number
  unit: string             // "completed days" / "workouts" etc.
  daysLeft: number
  chosenCharity: string
}

export interface CircleGame {
  id: string
  name: string
  type: GameType
  status: GameStatus
  ivyInstruction: string   // plain-English rule Ivy runs
  startedAt: Date
  endsAt: Date | null
  // type-specific state
  batonState?: BatonState
  leaderboard?: LeaderboardEntry[]
  collective?: CollectiveProgress
}

export interface IvyCircleMock {
  id: string
  name: string
  seasonTheme: string
  sprintLabel: string       // e.g. "Sprint 3 · Week 2"
  members: CircleMemberMock[]
  activeGame: CircleGame | null
  nextSession: Date | null
  circleDaysArmed: number   // collective stat this week
  circleForfeitsThisWeek: number
}

// ─── Members ──────────────────────────────────────────────────────────────────

export const MOCK_MEMBERS: CircleMemberMock[] = [
  {
    id: 'u1', name: 'You (Kezia)', initials: 'KE', avatarHue: 44,
    status: 'armed', streakDays: 9, stakeWeekly: 14, stakeShared: true, isCurrentUser: true,
  },
  {
    id: 'u2', name: 'Marcus', initials: 'MA', avatarHue: 238,
    status: 'complete', streakDays: 21, stakeWeekly: 21, stakeShared: true, isCurrentUser: false,
  },
  {
    id: 'u3', name: 'Priya', initials: 'PR', avatarHue: 152,
    status: 'armed', streakDays: 6, stakeWeekly: 14, stakeShared: false, isCurrentUser: false,
  },
  {
    id: 'u4', name: 'Tom', initials: 'TO', avatarHue: 14,
    status: 'missed', streakDays: 0, stakeWeekly: 7, stakeShared: true, isCurrentUser: false,
  },
  {
    id: 'u5', name: 'Adaeze', initials: 'AD', avatarHue: 280,
    status: 'pending', streakDays: 14, stakeWeekly: 28, stakeShared: true, isCurrentUser: false,
  },
]

// ─── Baton / relay game ───────────────────────────────────────────────────────

export const MOCK_BATON_GAME: CircleGame = {
  id: 'game-relay-1',
  name: 'Sprint 3 Relay',
  type: 'relay',
  status: 'active',
  ivyInstruction:
    'Each member holds the baton for 24 hours. Complete your day\'s commitment to pass it to the next person. Drop it (miss + unarmed) and the group loses a life. 3 lives total. Last member passes it back to the first.',
  startedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000),
  endsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  batonState: {
    holderId: 'u2',    // Marcus holds the baton right now
    windowOpensAt: new Date(Date.now() - 3 * 60 * 60 * 1000),
    windowClosesAt: new Date(Date.now() + 9 * 60 * 60 * 1000),
    livesRemaining: 2,
    totalLives: 3,
    passedAt: new Date(Date.now() - 26 * 60 * 60 * 1000),
    batonRaisedStake: 5, // £5 extra on top of normal stake
  },
}

// ─── Points race leaderboard ──────────────────────────────────────────────────

export const MOCK_POINTS_RACE: CircleGame = {
  id: 'game-points-1',
  name: 'May Points Race',
  type: 'points_race',
  status: 'active',
  ivyInstruction:
    '1 point per armed day. 2 points for completing all commitments. 0 for a miss. Race runs 4 weeks. Highest points wins the title "Sprint Champion" and the circle nominates a charity for the month.',
  startedAt: new Date(Date.now() - 12 * 24 * 60 * 60 * 1000),
  endsAt: new Date(Date.now() + 16 * 24 * 60 * 60 * 1000),
  leaderboard: [
    { memberId: 'u2', points: 34, rank: 1 },
    { memberId: 'u5', points: 28, rank: 2 },
    { memberId: 'u1', points: 24, rank: 3 },  // current user
    { memberId: 'u3', points: 18, rank: 4 },
    { memberId: 'u4', points: 8,  rank: 5 },
  ],
}

// ─── Collective game ──────────────────────────────────────────────────────────

export const MOCK_COLLECTIVE: CircleGame = {
  id: 'game-collective-1',
  name: 'Circle Challenge: 100 days',
  type: 'collective',
  status: 'active',
  ivyInstruction:
    'The group needs 100 completed days collectively by the end of Sprint 3. Every member\'s completed day counts toward the total. Hitting the target means the circle\'s success-donations this sprint go to the group\'s chosen charity — Médecins Sans Frontières.',
  startedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000),
  endsAt: new Date(Date.now() + 18 * 24 * 60 * 60 * 1000),
  collective: {
    target: 100,
    current: 67,
    unit: 'completed days',
    daysLeft: 18,
    chosenCharity: 'Médecins Sans Frontières',
  },
}

// ─── Main circle ──────────────────────────────────────────────────────────────

export const MOCK_CIRCLE: IvyCircleMock = {
  id: 'circle-1',
  name: 'The Morning Five',
  seasonTheme: 'Build the foundation',
  sprintLabel: 'Sprint 3 · Week 2',
  members: MOCK_MEMBERS,
  activeGame: MOCK_BATON_GAME,   // swap to MOCK_POINTS_RACE or MOCK_COLLECTIVE to preview variants
  nextSession: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
  circleDaysArmed: 18,
  circleForfeitsThisWeek: 1,
}

// ─── Pass order for relay (derived from member order, minus the current holder) ─

export function getPassOrder(members: CircleMemberMock[], holderId: string): CircleMemberMock[] {
  const idx = members.findIndex((m) => m.id === holderId)
  if (idx === -1) return members
  return [...members.slice(idx + 1), ...members.slice(0, idx)]
}
