/**
 * Mock data for the Daily Loop screen (/daily).
 *
 * In production, these would come from the backend API.
 * Shapes reflect the data contracts implied by the product spec and existing types.
 */

export type DailyLoopPhase =
  | 'morning-unarmed'    // Before morning VN — stake on the line, needs arming
  | 'morning-recording'  // User is actively recording VN
  | 'morning-armed'      // VN submitted, armed for the day
  | 'evening-review'     // Evening chat with Ivy
  | 'evening-complete'   // Review done, day settled

export interface StakeStatus {
  weeklyAmount: number
  dailySlice: number
  currency: 'GBP' | 'USD'
  daysLeft: number
  daysCompleted: number
  daysForfeited: number
  forfeitMode: 'MIDDLE' | 'SAVAGE'
  forfeitDestination: string  // charity name
  successDestination: string  // own charity
  graceSkipsRemaining: number
  cycleEnds: Date
}

export interface VoiceNote {
  id: string
  duration: number         // seconds
  transcript: string
  recordedAt: Date
  audioUrl?: string        // mock — no real audio
}

export interface ChatMessage {
  id: string
  role: 'ivy' | 'user'
  content: string
  timestamp: Date
  status?: 'sending' | 'sent' | 'failed'
  // For Ivy messages
  isTyping?: boolean
}

export interface CircleStatus {
  name: string
  membersActive: number
  membersTotal: number
  gameActive: boolean
  gameType?: 'relay' | 'points_race' | 'collective'
  gameLabel?: string
  batonHolder?: string
  userHoldsBaton: boolean
  streak: number
}

// ─── Mock instances ──────────────────────────────────────────────────────────

export const MOCK_STAKE: StakeStatus = {
  weeklyAmount: 14,
  dailySlice: 2,
  currency: 'GBP',
  daysLeft: 4,
  daysCompleted: 2,
  daysForfeited: 0,
  forfeitMode: 'MIDDLE',
  forfeitDestination: 'British Red Cross',
  successDestination: 'Médecins Sans Frontières',
  graceSkipsRemaining: 1,
  cycleEnds: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
}

export const MOCK_VOICE_NOTE: VoiceNote = {
  id: 'vn-001',
  duration: 28,
  transcript: "Today I'm shipping the onboarding prototype and doing a 20-minute run before 7pm. That's the main thing. And I'll send the investor update before lunch.",
  recordedAt: new Date(new Date().setHours(7, 23, 0, 0)),
}

export const MOCK_CIRCLE: CircleStatus = {
  name: 'The Morning Five',
  membersActive: 4,
  membersTotal: 5,
  gameActive: true,
  gameType: 'relay',
  gameLabel: 'Baton relay',
  batonHolder: 'Marcus',
  userHoldsBaton: false,
  streak: 8,
}

// ─── Evening review mock conversation ────────────────────────────────────────
// Ivy opens with a callback to the morning VN transcript.

export const MOCK_EVENING_MESSAGES: ChatMessage[] = [
  {
    id: 'msg-1',
    role: 'ivy',
    content: "Evening. This morning you said you were going to ship the onboarding prototype and do a run before 7pm. How'd it go?",
    timestamp: new Date(new Date().setHours(18, 0, 0, 0)),
  },
  {
    id: 'msg-2',
    role: 'user',
    content: "Prototype is done and deployed. Didn't get the run in though — got pulled into a call that ran long.",
    timestamp: new Date(new Date().setHours(18, 1, 30, 0)),
  },
  {
    id: 'msg-3',
    role: 'ivy',
    content: "Good work on the prototype — that matters. The run slipping to a meeting is a pattern worth watching. Did you send the investor update?",
    timestamp: new Date(new Date().setHours(18, 1, 50, 0)),
  },
  {
    id: 'msg-4',
    role: 'user',
    content: "Yes, sent it just before noon actually. Three replies already.",
    timestamp: new Date(new Date().setHours(18, 2, 15, 0)),
  },
  {
    id: 'msg-5',
    role: 'ivy',
    content: "Three replies same day — that's a signal. I'm marking today as a partial: you delivered on the two things that moved the needle, missed the one that was yours. £2 held. What's the run plan for tomorrow?",
    timestamp: new Date(new Date().setHours(18, 2, 35, 0)),
  },
]

// ─── Morning phase mock data ──────────────────────────────────────────────────

export const MOCK_MORNING_PROMPT = "Morning. Your £2 stake is live. What's the one thing you're taking on today — say it out loud."

export const MOCK_USER_NAME = "Kezia"

export const MOCK_DAY_PROGRESS = {
  weekday: new Date().toLocaleDateString('en-GB', { weekday: 'long' }),
  dateLabel: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }),
  armingDeadline: new Date(new Date().setHours(10, 0, 0, 0)),
  armingWindowLabel: "Arm by 10:00 am",
}
