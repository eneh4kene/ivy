'use client'

export function HumanReviewSchedulingStep() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          As a Concierge member, you get human coaching sessions where an expert reviews your progress and provides personalized guidance.
        </p>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
        <h3 className="font-semibold mb-2">What to Expect</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>30-minute video call with a certified wellness coach</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Review your transformation scores, workout consistency, and AI call insights</span>
          </li>
          <li className="flex items-start gap-2">
            <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <span>Personalized recommendations to optimise your approach</span>
          </li>
        </ul>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <div className="text-4xl mb-3">📬</div>
        <h3 className="font-semibold text-lg mb-2">We&apos;ll reach out to you</h3>
        <p className="text-sm text-muted-foreground">
          Our team will contact you within 24 hours of your signup to schedule your first coaching session at a time that works for you.
        </p>
        <p className="text-xs text-muted-foreground mt-3">
          You&apos;ll also be able to book sessions from your dashboard once your account is active.
        </p>
      </div>
    </div>
  )
}
