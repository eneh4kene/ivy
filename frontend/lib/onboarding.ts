import { SubscriptionTier } from './types'

export interface OnboardingStep {
  id: string
  title: string
  description: string
  component: string
  required: boolean
  estimatedMinutes: number
}

export interface OnboardingFlow {
  tier: SubscriptionTier
  steps: OnboardingStep[]
  totalEstimatedMinutes: number
}

// FREE and PRO users get a streamlined 15-minute onboarding
const FREE_PRO_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ivy',
    description: 'Get started with your wellness journey',
    component: 'welcome',
    required: true,
    estimatedMinutes: 2,
  },
  {
    id: 'track',
    title: 'Choose Your Track',
    description: 'Select your primary wellness focus',
    component: 'track-selection',
    required: true,
    estimatedMinutes: 3,
  },
  {
    id: 'goals',
    title: 'Set Your Goals',
    description: 'Define what success looks like for you',
    component: 'goal-setting',
    required: true,
    estimatedMinutes: 5,
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your experience',
    component: 'preferences',
    required: false,
    estimatedMinutes: 3,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start your first week',
    component: 'complete',
    required: true,
    estimatedMinutes: 2,
  },
]

// ELITE users get enhanced 30-minute onboarding with calendar integration
const ELITE_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ivy Elite',
    description: 'Experience premium wellness coaching',
    component: 'welcome',
    required: true,
    estimatedMinutes: 2,
  },
  {
    id: 'track',
    title: 'Choose Your Track',
    description: 'Select your primary wellness focus',
    component: 'track-selection',
    required: true,
    estimatedMinutes: 3,
  },
  {
    id: 'health-assessment',
    title: 'Health Assessment',
    description: 'Complete your baseline wellness assessment',
    component: 'health-assessment',
    required: true,
    estimatedMinutes: 7,
  },
  {
    id: 'goals',
    title: 'Set Your Goals',
    description: 'Define what success looks like for you',
    component: 'goal-setting',
    required: true,
    estimatedMinutes: 5,
  },
  {
    id: 'calendar',
    title: 'Calendar Integration',
    description: 'Sync your schedule for optimal planning',
    component: 'calendar-integration',
    required: false,
    estimatedMinutes: 5,
  },
  {
    id: 'ivy-circle',
    title: 'Join Ivy Circle',
    description: 'Connect with your accountability cohort',
    component: 'ivy-circle-setup',
    required: false,
    estimatedMinutes: 4,
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your experience',
    component: 'preferences',
    required: false,
    estimatedMinutes: 2,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start your Elite journey',
    component: 'complete',
    required: true,
    estimatedMinutes: 2,
  },
]

// CONCIERGE users get comprehensive 45-minute onboarding with human touchpoints
const CONCIERGE_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ivy Concierge',
    description: 'Your personalized wellness transformation begins',
    component: 'welcome',
    required: true,
    estimatedMinutes: 2,
  },
  {
    id: 'track',
    title: 'Choose Your Track',
    description: 'Select your primary wellness focus',
    component: 'track-selection',
    required: true,
    estimatedMinutes: 3,
  },
  {
    id: 'health-assessment',
    title: 'Comprehensive Health Assessment',
    description: 'Complete your detailed wellness baseline',
    component: 'health-assessment',
    required: true,
    estimatedMinutes: 10,
  },
  {
    id: 'goals',
    title: 'Set Your Goals',
    description: 'Define what success looks like for you',
    component: 'goal-setting',
    required: true,
    estimatedMinutes: 7,
  },
  {
    id: 'life-markers',
    title: 'Life Markers',
    description: 'Track what matters most to you',
    component: 'life-markers-setup',
    required: true,
    estimatedMinutes: 5,
  },
  {
    id: 'calendar',
    title: 'Calendar Integration',
    description: 'Sync your schedule for optimal planning',
    component: 'calendar-integration',
    required: true,
    estimatedMinutes: 5,
  },
  {
    id: 'ivy-circle',
    title: 'Join Ivy Circle',
    description: 'Connect with your exclusive cohort',
    component: 'ivy-circle-setup',
    required: false,
    estimatedMinutes: 4,
  },
  {
    id: 'human-review',
    title: 'Schedule Human Review',
    description: 'Book your first coaching session',
    component: 'human-review-scheduling',
    required: true,
    estimatedMinutes: 5,
  },
  {
    id: 'strategy-call',
    title: 'Monthly Strategy Call',
    description: 'Set up your recurring check-ins',
    component: 'strategy-call-scheduling',
    required: true,
    estimatedMinutes: 3,
  },
  {
    id: 'preferences',
    title: 'Preferences',
    description: 'Customize your experience',
    component: 'preferences',
    required: false,
    estimatedMinutes: 2,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Start your Concierge journey',
    component: 'complete',
    required: true,
    estimatedMinutes: 2,
  },
]

// B2B onboarding focuses on company setup and employee invites
const B2B_STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: 'Welcome to Ivy for Teams',
    description: 'Set up your company wellness program',
    component: 'welcome',
    required: true,
    estimatedMinutes: 2,
  },
  {
    id: 'company-info',
    title: 'Company Information',
    description: 'Tell us about your organization',
    component: 'company-info',
    required: true,
    estimatedMinutes: 5,
  },
  {
    id: 'season-setup',
    title: 'Season Configuration',
    description: 'Configure your 8-week program cycles',
    component: 'season-setup',
    required: true,
    estimatedMinutes: 4,
  },
  {
    id: 'employee-invites',
    title: 'Invite Employees',
    description: 'Add your team members to the program',
    component: 'employee-invites',
    required: true,
    estimatedMinutes: 7,
  },
  {
    id: 'integrations',
    title: 'Integrations',
    description: 'Connect Slack, HRIS, and SSO',
    component: 'integrations-setup',
    required: false,
    estimatedMinutes: 8,
  },
  {
    id: 'admin-setup',
    title: 'Admin Access',
    description: 'Assign company administrators',
    component: 'admin-setup',
    required: true,
    estimatedMinutes: 3,
  },
  {
    id: 'complete',
    title: 'You\'re All Set!',
    description: 'Launch your company program',
    component: 'complete',
    required: true,
    estimatedMinutes: 2,
  },
]

export const ONBOARDING_FLOWS: Record<SubscriptionTier, OnboardingFlow> = {
  FREE: {
    tier: 'FREE',
    steps: FREE_PRO_STEPS,
    totalEstimatedMinutes: 15,
  },
  PRO: {
    tier: 'PRO',
    steps: FREE_PRO_STEPS,
    totalEstimatedMinutes: 15,
  },
  ELITE: {
    tier: 'ELITE',
    steps: ELITE_STEPS,
    totalEstimatedMinutes: 30,
  },
  CONCIERGE: {
    tier: 'CONCIERGE',
    steps: CONCIERGE_STEPS,
    totalEstimatedMinutes: 45,
  },
  B2B: {
    tier: 'B2B',
    steps: B2B_STEPS,
    totalEstimatedMinutes: 31,
  },
}

export function getOnboardingFlow(tier: SubscriptionTier): OnboardingFlow {
  return ONBOARDING_FLOWS[tier]
}

export function getStepIndex(flow: OnboardingFlow, stepId: string): number {
  return flow.steps.findIndex(step => step.id === stepId)
}

export function getNextStep(flow: OnboardingFlow, currentStepId: string): OnboardingStep | null {
  const currentIndex = getStepIndex(flow, currentStepId)
  if (currentIndex === -1 || currentIndex === flow.steps.length - 1) {
    return null
  }
  return flow.steps[currentIndex + 1]
}

export function getPreviousStep(flow: OnboardingFlow, currentStepId: string): OnboardingStep | null {
  const currentIndex = getStepIndex(flow, currentStepId)
  if (currentIndex <= 0) {
    return null
  }
  return flow.steps[currentIndex - 1]
}

export function calculateProgress(flow: OnboardingFlow, currentStepId: string): number {
  const currentIndex = getStepIndex(flow, currentStepId)
  if (currentIndex === -1) return 0
  return Math.round(((currentIndex + 1) / flow.steps.length) * 100)
}
