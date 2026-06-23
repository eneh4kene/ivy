/**
 * Shared view-model types for the Daily Loop screen and its subcomponents.
 * (Previously these lived in lib/mock/daily-loop.ts alongside fixtures — moved
 * here so the real screens carry no dependency on mock data.)
 */

export type DailyLoopPhase =
  | 'morning-unarmed' // before morning VN — stake on the line, needs arming
  | 'morning-armed'   // VN submitted, armed for the day
  | 'evening-review'  // evening reflection

export interface VoiceNote {
  id: string
  duration: number // seconds
  transcript: string
  recordedAt: Date
}

export interface StakeStatus {
  weeklyAmount: number
  dailySlice: number
  currency: 'GBP' | 'USD'
  daysLeft: number
  daysCompleted: number
  daysForfeited: number
}
