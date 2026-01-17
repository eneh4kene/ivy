'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAuthStore } from '@/lib/store/auth.store'
import { getTierName, getTierPrice, getTierFeatures } from '@/lib/permissions'
import type { SubscriptionTier } from '@/lib/types'

const tiers: SubscriptionTier[] = ['FREE', 'PRO', 'ELITE', 'CONCIERGE']

const tierColors: Record<SubscriptionTier, string> = {
  FREE: 'border-gray-200',
  PRO: 'border-blue-200 bg-blue-50/50',
  ELITE: 'border-purple-200 bg-purple-50/50',
  CONCIERGE: 'border-indigo-200 bg-gradient-to-br from-indigo-50 to-purple-50',
  B2B: 'border-green-200 bg-green-50/50',
}

const tierButtonVariants: Record<SubscriptionTier, 'outline' | 'default'> = {
  FREE: 'outline',
  PRO: 'default',
  ELITE: 'default',
  CONCIERGE: 'default',
  B2B: 'default',
}

export default function PricingPage() {
  const user = useAuthStore((state) => state.user)
  const currentTier = user?.subscriptionTier || 'FREE'

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Navigation */}
      <nav className="border-b bg-white">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg"></div>
            <span className="text-xl font-bold">Ivy</span>
          </Link>
          {user && (
            <Link href="/dashboard">
              <Button variant="outline">Back to Dashboard</Button>
            </Link>
          )}
        </div>
      </nav>

      {/* Header */}
      <section className="container mx-auto px-4 py-16 text-center">
        <h1 className="text-5xl font-bold mb-4">
          Choose Your{' '}
          <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            Ivy Journey
          </span>
        </h1>
        <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
          Build unshakeable habits with AI-powered accountability. Every workout completed donates to your chosen charity.
        </p>
        {user && (
          <p className="text-sm text-muted-foreground">
            Current plan: <span className="font-medium text-primary">{getTierName(currentTier)}</span>
          </p>
        )}
      </section>

      {/* Pricing Cards */}
      <section className="container mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
          {tiers.map((tier) => {
            const features = getTierFeatures(tier)
            const isCurrent = user && currentTier === tier
            const isUpgrade = user && getTierLevel(tier) > getTierLevel(currentTier)

            return (
              <Card
                key={tier}
                className={`relative ${tierColors[tier]} ${tier === 'ELITE' ? 'ring-2 ring-primary ring-offset-2' : ''}`}
              >
                {tier === 'ELITE' && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                      MOST POPULAR
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-4 right-4">
                    <span className="bg-green-600 text-white text-xs font-bold px-3 py-1 rounded-full">
                      CURRENT
                    </span>
                  </div>
                )}

                <CardHeader>
                  <CardTitle className="text-2xl">{getTierName(tier)}</CardTitle>
                  <CardDescription>
                    <div className="mt-4 mb-2">
                      <span className="text-4xl font-bold text-foreground">
                        {tier === 'FREE' ? '£0' : getTierPrice(tier).split('/')[0]}
                      </span>
                      {tier !== 'FREE' && (
                        <span className="text-muted-foreground">/month</span>
                      )}
                    </div>
                    {tier === 'PRO' && <p className="text-sm">Perfect for getting started</p>}
                    {tier === 'ELITE' && <p className="text-sm">Best value for committed individuals</p>}
                    {tier === 'CONCIERGE' && <p className="text-sm">Premium white-glove service</p>}
                  </CardDescription>
                </CardHeader>

                <CardContent>
                  <ul className="space-y-3 mb-6">
                    {features.map((feature, index) => (
                      <li key={index} className="flex items-start gap-2 text-sm">
                        <svg
                          className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>

                  {isCurrent ? (
                    <Button variant="outline" className="w-full" disabled>
                      Current Plan
                    </Button>
                  ) : isUpgrade ? (
                    <Button className="w-full" variant={tierButtonVariants[tier]}>
                      Upgrade to {getTierName(tier)}
                    </Button>
                  ) : tier === 'FREE' ? (
                    <Link href="/login" className="block">
                      <Button variant="outline" className="w-full">
                        Get Started Free
                      </Button>
                    </Link>
                  ) : (
                    <Button variant={tierButtonVariants[tier]} className="w-full">
                      Choose {getTierName(tier)}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>
      </section>

      {/* B2B Section */}
      <section className="container mx-auto px-4 pb-20">
        <Card className="max-w-4xl mx-auto bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl">Ivy for Teams</CardTitle>
            <CardDescription className="text-base">
              Boost employee wellbeing and engagement with company-sponsored accountability
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-6 mb-8">
              <div>
                <h3 className="font-semibold mb-3">Standard Plan - £25/employee/month</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 2 AI calls per week</li>
                  <li>• £15 monthly impact wallet</li>
                  <li>• Basic transformation tracking</li>
                  <li>• Admin dashboard with aggregate stats</li>
                </ul>
              </div>
              <div>
                <h3 className="font-semibold mb-3">Premium Plan - £53/employee/month</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• 4 AI calls per week</li>
                  <li>• £30 monthly impact wallet</li>
                  <li>• Full transformation tracking</li>
                  <li>• Ivy Circle (team cohorts)</li>
                  <li>• Missed call recovery</li>
                </ul>
              </div>
            </div>
            <div className="text-center">
              <Button size="lg" className="bg-green-600 hover:bg-green-700">
                Book a Demo
              </Button>
              <p className="text-sm text-muted-foreground mt-3">
                25-200 employees • 8-week seasons • Privacy-first reporting
              </p>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* FAQ */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-center mb-12">Frequently Asked Questions</h2>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold mb-2">How does the Impact Wallet work?</h3>
              <p className="text-muted-foreground">
                Your subscription funds your monthly Impact Wallet. Every completed workout donates £1-2 to your chosen charity (depending on tier). Bonus donations unlock at streak milestones.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">Can I cancel anytime?</h3>
              <p className="text-muted-foreground">
                Yes, you can cancel your subscription at any time. You&apos;ll continue to have access until the end of your billing period.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">What's the difference between Pro and Elite?</h3>
              <p className="text-muted-foreground">
                Elite includes 4 calls/week (vs 2), higher donation amounts, calendar integration, Ivy Circle community access, and full transformation tracking with life markers.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-2">How do AI calls work?</h3>
              <p className="text-muted-foreground">
                Ivy calls you at your scheduled times for conversational check-ins. Morning calls help plan your day, evening calls review progress. All calls are private and personalized to your goals.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 pb-20">
        <div className="max-w-2xl mx-auto text-center bg-primary text-primary-foreground rounded-2xl p-12">
          <h2 className="text-3xl font-bold mb-4">Ready to Build Unshakeable Habits?</h2>
          <p className="text-lg mb-8 opacity-90">
            Join hundreds of people transforming their lives while making an impact
          </p>
          {user ? (
            <Link href="/dashboard">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Go to Dashboard
              </Button>
            </Link>
          ) : (
            <Link href="/login">
              <Button size="lg" variant="secondary" className="text-lg px-8">
                Start Free Today
              </Button>
            </Link>
          )}
        </div>
      </section>
    </div>
  )
}

// Helper function to get tier level for comparison
function getTierLevel(tier: SubscriptionTier): number {
  const levels: Record<SubscriptionTier, number> = {
    FREE: 0,
    PRO: 1,
    ELITE: 2,
    CONCIERGE: 3,
    B2B: 2,
  }
  return levels[tier]
}
