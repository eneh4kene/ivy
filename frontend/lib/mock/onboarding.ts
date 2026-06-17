/**
 * Mock data for the consumer Onboarding flow.
 *
 * MOCK DATA — wire to real API when backend lands.
 * All API touch-points marked // TODO(api):
 *
 * Flow: welcome → pick track → channel preference → stake-setup wizard
 */

export type OnboardingTrack = 'fitness' | 'focus' | 'sleep' | 'balance'
export type ChannelPreference = 'CALLS' | 'TEXTS' | 'ADAPTIVE'

export interface TrackOption {
  id: OnboardingTrack
  label: string
  headline: string
  description: string
  exampleCommit: string
  icon: string   // emoji stand-in
  hue: number    // for avatar colour
}

export const TRACK_OPTIONS: TrackOption[] = [
  {
    id: 'fitness',
    label: 'Fitness',
    headline: 'Move every day',
    description: 'Training, sport, walks — whatever counts as a win for your body.',
    exampleCommit: '"30-minute run before 7pm."',
    icon: '🏃',
    hue: 152,
  },
  {
    id: 'focus',
    label: 'Focus',
    headline: 'Deep work, shipped',
    description: 'Creative work, study, building — the thing you keep avoiding.',
    exampleCommit: '"Two hours of deep work on the pitch deck."',
    icon: '🧠',
    hue: 238,
  },
  {
    id: 'sleep',
    label: 'Sleep',
    headline: 'Protect your rest',
    description: 'Wind-down discipline, consistent bedtime, no late doom-scroll.',
    exampleCommit: '"Lights out by 10:30pm, phone face-down."',
    icon: '🌙',
    hue: 280,
  },
  {
    id: 'balance',
    label: 'Balance',
    headline: 'Everything, integrated',
    description: 'A mix of habits across energy, presence, and recovery.',
    exampleCommit: '"No Slack after 7pm, 20-minute walk, 8 hours sleep."',
    icon: '⚖️',
    hue: 44,
  },
]

export interface ChannelOption {
  id: ChannelPreference
  label: string
  headline: string
  description: string
  note?: string
  icon: string
}

export const CHANNEL_OPTIONS: ChannelOption[] = [
  {
    id: 'CALLS',
    label: 'Phone calls',
    headline: 'Ivy calls you',
    description: 'Evening review is a live phone call. Ivy\'s voice, your voice. Harder to ignore.',
    note: 'Recommended — voice creates the strongest presence.',
    icon: '📞',
  },
  {
    id: 'TEXTS',
    label: 'Text / chat',
    headline: 'Ivy messages you',
    description: 'Evening review is an in-app chat. Same questions, same accountability. No phone ring.',
    icon: '💬',
  },
  {
    id: 'ADAPTIVE',
    label: 'Let Ivy decide',
    headline: 'Adaptive',
    description: 'Ivy reads your engagement patterns and switches between calls and texts week by week.',
    icon: '🔀',
  },
]

// MOCK: onboarding state shape (mirrors what the API will store)
export interface OnboardingState {
  track: OnboardingTrack | null
  channelPreference: ChannelPreference | null
}

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  track: null,
  channelPreference: null,
}

export type ConsumerOnboardingStep = 'welcome' | 'track' | 'channel' | 'stake-setup'
