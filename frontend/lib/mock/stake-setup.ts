/**
 * Mock data / constants for the Stake Setup onboarding flow.
 *
 * MOCK DATA — wire to real API when backend Phase 1/2 lands.
 * All decisions backed by §2, §3, §9 of docs/product-pricing-rework.md.
 */

// ─── Stake config (§9 decisions 2, 3) ────────────────────────────────────────

export const STAKE_CONFIG = {
  minWeekly: 7,           // £7/wk hard floor (§9 decision 2)
  defaultWeekly: 14,      // suggested default (§9 decision 2)
  presets: [7, 14, 21, 28, 42] as const,
  currency: 'GBP' as const,
  currencySymbol: '£',
  cycleLengthDays: 7,
}

export function dailySlice(weekly: number): number {
  return Math.round((weekly / STAKE_CONFIG.cycleLengthDays) * 100) / 100
}

export function annualCost(weekly: number): number {
  return weekly * 52
}

// ─── Forfeit modes (§3) ───────────────────────────────────────────────────────

export type ForfeitMode = 'MIDDLE' | 'SAVAGE'

export interface ForfeitOption {
  mode: ForfeitMode
  label: string
  sublabel: string
  description: string
  teethLevel: 1 | 2     // 1 = softer, 2 = maximum
}

export const FORFEIT_OPTIONS: ForfeitOption[] = [
  {
    mode: 'MIDDLE',
    label: 'Middle',
    sublabel: 'A house charity you didn\'t choose',
    description:
      'When you slip, your stake goes to a vetted charity — not yours, not chosen by you. You lose the money and lose the good feeling. The default.',
    teethLevel: 1,
  },
  {
    mode: 'SAVAGE',
    label: 'Savage',
    sublabel: 'A cause you\'d hate to fund',
    description:
      'Pick a real charity you actively dislike. Every miss funds something that makes you wince. Maximum teeth — only choose this if you know you need a sharper edge.',
    teethLevel: 2,
  },
]

// Charity data (house pool, success charity, anti-charity) is fetched live from
// the real catalogue via donationsApi.getCharities() — see CharitySelectStep and
// ForfeitModeStep. No hardcoded charity fixtures live here.

// ─── Arming window presets ────────────────────────────────────────────────────

export interface ArmingWindowPreset {
  label: string
  start: string   // HH:MM
  end: string     // HH:MM deadline
}

export const ARMING_WINDOW_PRESETS: ArmingWindowPreset[] = [
  { label: 'Early bird',  start: '06:00', end: '08:00' },
  { label: 'Morning',     start: '07:00', end: '09:30' },
  { label: 'Mid-morning', start: '08:00', end: '10:30' },
  { label: 'Flexible',    start: '07:00', end: '12:00' },
]

// ─── Flow steps ───────────────────────────────────────────────────────────────

export type StakeSetupStep =
  | 'stake-amount'
  | 'forfeit-mode'
  | 'success-charity'
  | 'disliked-charity'   // only shown for SAVAGE
  | 'arming-window'
  | 'confirm'

export const STAKE_SETUP_STEPS: StakeSetupStep[] = [
  'stake-amount',
  'forfeit-mode',
  'success-charity',
  'arming-window',
  'confirm',
]

export function getStepsForMode(mode: ForfeitMode): StakeSetupStep[] {
  const base: StakeSetupStep[] = ['stake-amount', 'forfeit-mode', 'success-charity']
  if (mode === 'SAVAGE') base.push('disliked-charity')
  base.push('arming-window', 'confirm')
  return base
}

// ─── Default form state ───────────────────────────────────────────────────────

export interface StakeSetupState {
  weeklyAmount: number
  forfeitMode: ForfeitMode
  successCharityId: string | null
  dislikedCharityId: string | null
  // Display names captured at selection time so the Confirm summary can show the
  // chosen charity without re-fetching (the ids are real DB ids from the API).
  successCharityName?: string | null
  dislikedCharityName?: string | null
  armingWindowStart: string   // HH:MM
  armingWindowEnd: string     // HH:MM
}

export const DEFAULT_STAKE_SETUP: StakeSetupState = {
  weeklyAmount: STAKE_CONFIG.defaultWeekly,
  forfeitMode: 'MIDDLE',
  successCharityId: null,
  dislikedCharityId: null,
  successCharityName: null,
  dislikedCharityName: null,
  armingWindowStart: '07:00',
  armingWindowEnd: '09:30',
}
