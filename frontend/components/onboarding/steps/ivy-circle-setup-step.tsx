'use client'

import { Card, CardContent } from '@/components/ui/card'

export function IvyCircleSetupStep() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Ivy Circle is your accountability network: a cohort of 8-12 people and a dedicated accountability pair.
        </p>
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200">
        <h3 className="font-semibold mb-4">How Ivy Circle Works</h3>
        <div className="space-y-4">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
              1
            </div>
            <div>
              <p className="font-medium">Cohort Matching</p>
              <p className="text-sm text-muted-foreground">
                You're matched with 8-12 people with similar goals and schedules for your 8-week season.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
              2
            </div>
            <div>
              <p className="font-medium">Accountability Pair</p>
              <p className="text-sm text-muted-foreground">
                Within your cohort, you're paired with one person for deeper 1-on-1 check-ins and mutual support.
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 bg-indigo-600 text-white rounded-full flex items-center justify-center flex-shrink-0 font-bold">
              3
            </div>
            <div>
              <p className="font-medium">Weekly Sharing</p>
              <p className="text-sm text-muted-foreground">
                Share goals, celebrate wins, and support each other through challenges in a private group space.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="text-2xl mb-2">👥</div>
            <h3 className="font-semibold mb-2">Your Cohort</h3>
            <p className="text-sm text-muted-foreground">
              A group of 8-12 people matched based on goals, experience level, and time zone.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="text-2xl mb-2">🤝</div>
            <h3 className="font-semibold mb-2">Your Pair</h3>
            <p className="text-sm text-muted-foreground">
              One accountability partner for personal check-ins, encouragement, and mutual support.
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
        <h3 className="font-semibold mb-2">We're Finding Your Match</h3>
        <p className="text-muted-foreground">
          You'll be notified within 24 hours when your Ivy Circle cohort and pair are ready. Check your email and dashboard.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-blue-800">
              Participation is optional but highly encouraged. Studies show accountability significantly increases completion rates.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
