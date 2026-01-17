'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { SubscriptionTier } from '@/lib/types'
import { getTierName } from '@/lib/permissions'

interface CompleteStepProps {
  tier: SubscriptionTier
}

export function CompleteStep({ tier }: CompleteStepProps) {
  const tierName = getTierName(tier)
  const isBusiness = tier === 'B2B'

  return (
    <div className="space-y-6">
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-6">
          <svg className="w-10 h-10 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>

        <h2 className="text-3xl font-bold mb-3">
          {isBusiness ? 'Your Program is Live!' : 'You\'re All Set!'}
        </h2>

        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          {isBusiness
            ? 'Your company wellness program is now active. Employees can start their 8-week journeys immediately.'
            : `Welcome to Ivy ${tierName}! Your personalized wellness journey starts now.`
          }
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-lg">📅</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">
                  {isBusiness ? 'Monitor Progress' : 'Week 1 Starts Now'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isBusiness
                    ? 'View company-wide participation, consistency, and wellness trends in your admin dashboard.'
                    : 'Your first workouts and AI coaching calls are ready. Check your dashboard to get started.'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-lg">{isBusiness ? '👥' : '❤️'}</span>
              </div>
              <div>
                <h3 className="font-semibold mb-1">
                  {isBusiness ? 'Employee Support' : 'Make an Impact'}
                </h3>
                <p className="text-sm text-muted-foreground">
                  {isBusiness
                    ? 'Your team has access to support resources. Encourage them to reach out if they need help.'
                    : 'Every completed workout earns £1 for your chosen charity. You\'re doing good while feeling good.'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {!isBusiness && (tier === 'ELITE' || tier === 'CONCIERGE') && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">👫</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Ivy Circle</h3>
                    <p className="text-sm text-muted-foreground">
                      You've been matched with your accountability cohort. Check in with your pair and group regularly.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">📊</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Track Your Transformation</h3>
                    <p className="text-sm text-muted-foreground">
                      Monitor your energy, mood, and health confidence scores over time in the Transformation tab.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {tier === 'CONCIERGE' && (
          <>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">🎯</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Human Review Scheduled</h3>
                    <p className="text-sm text-muted-foreground">
                      Your first coaching session is booked. A real human will review your progress and provide guidance.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center flex-shrink-0">
                    <span className="text-lg">💬</span>
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Monthly Strategy Calls</h3>
                    <p className="text-sm text-muted-foreground">
                      Your recurring check-ins are set. We'll help you refine your approach and stay on track.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-6 border border-indigo-200 text-center">
        <h3 className="font-semibold mb-2">What happens next?</h3>
        <p className="text-sm text-muted-foreground mb-6">
          {isBusiness
            ? 'Head to your admin dashboard to view company stats, manage employees, and track program engagement.'
            : 'Go to your dashboard to see this week\'s workouts, schedule your first AI call, and start your journey.'
          }
        </p>
        <Link href={isBusiness ? '/admin' : '/dashboard'}>
          <Button size="lg" className="w-full md:w-auto">
            {isBusiness ? 'View Admin Dashboard' : 'Go to My Dashboard'}
            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
          </Button>
        </Link>
      </div>

      {!isBusiness && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div>
              <p className="text-sm font-medium text-blue-900 mb-1">Remember</p>
              <p className="text-sm text-blue-800">
                Consistency is key. Even small daily actions compound into big transformations over 8 weeks. Ivy is here to support you every step of the way.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
