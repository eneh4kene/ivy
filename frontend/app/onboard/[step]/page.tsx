'use client'

import { useEffect, useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'
import { getOnboardingFlow, OnboardingFlow, OnboardingStep } from '@/lib/onboarding'
import { OnboardingWizard } from '@/components/onboarding/onboarding-wizard'

// Step components
import { WelcomeStep } from '@/components/onboarding/steps/welcome-step'
import { TrackSelectionStep } from '@/components/onboarding/steps/track-selection-step'
import { GoalSettingStep } from '@/components/onboarding/steps/goal-setting-step'
import { PreferencesStep } from '@/components/onboarding/steps/preferences-step'
import { CompleteStep } from '@/components/onboarding/steps/complete-step'
import { HealthAssessmentStep } from '@/components/onboarding/steps/health-assessment-step'
import { CalendarIntegrationStep } from '@/components/onboarding/steps/calendar-integration-step'
import { IvyCircleSetupStep } from '@/components/onboarding/steps/ivy-circle-setup-step'
import { HumanReviewSchedulingStep } from '@/components/onboarding/steps/human-review-scheduling-step'
import { StrategyCallSchedulingStep } from '@/components/onboarding/steps/strategy-call-scheduling-step'
import { LifeMarkersSetupStep } from '@/components/onboarding/steps/life-markers-setup-step'
import { CompanyInfoStep } from '@/components/onboarding/steps/company-info-step'
import { SeasonSetupStep } from '@/components/onboarding/steps/season-setup-step'
import { EmployeeInvitesStep } from '@/components/onboarding/steps/employee-invites-step'
import { IntegrationsSetupStep } from '@/components/onboarding/steps/integrations-setup-step'
import { AdminSetupStep } from '@/components/onboarding/steps/admin-setup-step'

export default function OnboardingStepPage() {
  const router = useRouter()
  const params = useParams()
  const user = useAuthStore((state) => state.user)
  const [flow, setFlow] = useState<OnboardingFlow | null>(null)
  const [currentStep, setCurrentStep] = useState<OnboardingStep | null>(null)

  const stepId = params.step as string

  useEffect(() => {
    if (!user) {
      router.push('/login')
      return
    }

    const onboardingFlow = getOnboardingFlow(user.subscriptionTier)
    setFlow(onboardingFlow)

    const step = onboardingFlow.steps.find(s => s.id === stepId)
    if (!step) {
      // Invalid step, redirect to first step
      router.push(`/onboard/${onboardingFlow.steps[0].id}`)
      return
    }

    setCurrentStep(step)
  }, [user, stepId, router])

  if (!flow || !currentStep) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    )
  }

  const renderStepComponent = () => {
    switch (currentStep.component) {
      case 'welcome':
        return <WelcomeStep tier={flow.tier} />
      case 'track-selection':
        return <TrackSelectionStep />
      case 'goal-setting':
        return <GoalSettingStep />
      case 'preferences':
        return <PreferencesStep />
      case 'complete':
        return <CompleteStep tier={flow.tier} />
      case 'health-assessment':
        return <HealthAssessmentStep />
      case 'calendar-integration':
        return <CalendarIntegrationStep />
      case 'ivy-circle-setup':
        return <IvyCircleSetupStep />
      case 'human-review-scheduling':
        return <HumanReviewSchedulingStep />
      case 'strategy-call-scheduling':
        return <StrategyCallSchedulingStep />
      case 'life-markers-setup':
        return <LifeMarkersSetupStep />
      case 'company-info':
        return <CompanyInfoStep />
      case 'season-setup':
        return <SeasonSetupStep />
      case 'employee-invites':
        return <EmployeeInvitesStep />
      case 'integrations-setup':
        return <IntegrationsSetupStep />
      case 'admin-setup':
        return <AdminSetupStep />
      default:
        return <div>Step not found</div>
    }
  }

  return (
    <OnboardingWizard flow={flow} currentStep={currentStep}>
      {renderStepComponent()}
    </OnboardingWizard>
  )
}
