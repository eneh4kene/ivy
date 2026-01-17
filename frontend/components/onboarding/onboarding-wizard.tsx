'use client'

import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { OnboardingFlow, OnboardingStep, getStepIndex, getNextStep, getPreviousStep, calculateProgress } from '@/lib/onboarding'

interface OnboardingWizardProps {
  flow: OnboardingFlow
  currentStep: OnboardingStep
  onNext?: () => Promise<void> | void
  onBack?: () => void
  children: React.ReactNode
  canProceed?: boolean
}

export function OnboardingWizard({
  flow,
  currentStep,
  onNext,
  onBack,
  children,
  canProceed = true,
}: OnboardingWizardProps) {
  const router = useRouter()
  const currentIndex = getStepIndex(flow, currentStep.id)
  const progress = calculateProgress(flow, currentStep.id)
  const nextStep = getNextStep(flow, currentStep.id)
  const previousStep = getPreviousStep(flow, currentStep.id)
  const isLastStep = nextStep === null

  const handleNext = async () => {
    if (onNext) {
      await onNext()
    }

    if (nextStep) {
      router.push(`/onboard/${nextStep.id}`)
    } else {
      // Onboarding complete
      router.push('/dashboard')
    }
  }

  const handleBack = () => {
    if (onBack) {
      onBack()
    }

    if (previousStep) {
      router.push(`/onboard/${previousStep.id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-50 to-white">
      {/* Progress Bar */}
      <div className="sticky top-0 z-10 bg-white border-b">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <div>
              <p className="text-sm font-medium text-indigo-600">
                Step {currentIndex + 1} of {flow.steps.length}
              </p>
              <p className="text-xs text-muted-foreground">
                {currentStep.estimatedMinutes} min
              </p>
            </div>
            <p className="text-sm text-muted-foreground">
              {flow.totalEstimatedMinutes - currentStep.estimatedMinutes} min remaining
            </p>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">{currentStep.title}</h1>
          <p className="text-lg text-muted-foreground">{currentStep.description}</p>
        </div>

        <Card>
          <CardContent className="p-8">
            {children}
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-8">
          <div>
            {previousStep && (
              <Button
                variant="outline"
                onClick={handleBack}
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Back
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!currentStep.required && !isLastStep && (
              <Button
                variant="ghost"
                onClick={handleNext}
              >
                Skip
              </Button>
            )}
            <Button
              onClick={handleNext}
              disabled={!canProceed}
              size="lg"
            >
              {isLastStep ? 'Complete Setup' : 'Continue'}
              {!isLastStep && (
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </Button>
          </div>
        </div>

        {/* Step Indicators */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {flow.steps.map((step, index) => (
            <div
              key={step.id}
              className={`h-2 rounded-full transition-all ${
                index <= currentIndex
                  ? 'bg-indigo-600 w-8'
                  : 'bg-gray-300 w-2'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
