'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getTierName, getTierPrice, getTierFeatures, getRequiredTier, type Feature } from '@/lib/permissions'
import type { SubscriptionTier } from '@/lib/types'

interface LockedFeatureProps {
  feature: Feature
  featureName: string
  description: string
  children?: React.ReactNode
}

export function LockedFeature({ feature, featureName, description, children }: LockedFeatureProps) {
  const requiredTier = getRequiredTier(feature)

  if (!requiredTier) {
    // No tier requirement, show children if provided
    return <>{children}</>
  }

  const tierName = getTierName(requiredTier)
  const tierPrice = getTierPrice(requiredTier)
  const tierFeatures = getTierFeatures(requiredTier)

  return (
    <div className="flex items-center justify-center min-h-[400px] p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
              <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
          </div>
          <CardTitle className="text-2xl">
            {featureName}
          </CardTitle>
          <CardDescription className="text-base mt-2">
            {description}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Feature Preview */}
            {children && (
              <div className="relative">
                <div className="absolute inset-0 bg-gradient-to-b from-transparent via-white/50 to-white backdrop-blur-sm z-10 flex items-center justify-center">
                  <div className="bg-white px-6 py-3 rounded-full shadow-lg border-2 border-primary">
                    <span className="text-sm font-medium text-primary">Upgrade to unlock</span>
                  </div>
                </div>
                <div className="opacity-30 pointer-events-none">
                  {children}
                </div>
              </div>
            )}

            {/* Tier Information */}
            <div className="bg-gradient-to-br from-primary/5 to-primary/10 rounded-lg p-6 border border-primary/20">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold">{tierName}</h3>
                  <p className="text-sm text-muted-foreground">Required plan</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold text-primary">{tierPrice}</p>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground mb-3">
                  {tierName} includes:
                </p>
                <ul className="space-y-2">
                  {tierFeatures.slice(0, 6).map((item, index) => (
                    <li key={index} className="flex items-start gap-2 text-sm">
                      <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* CTA Buttons */}
            <div className="flex gap-3">
              <Link href="/pricing" className="flex-1">
                <Button size="lg" className="w-full">
                  Upgrade to {tierName}
                </Button>
              </Link>
              <Link href="/pricing" className="flex-1">
                <Button size="lg" variant="outline" className="w-full">
                  View All Plans
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Inline locked feature message (for smaller sections)
 */
export function LockedFeatureInline({ feature, featureName }: { feature: Feature; featureName: string }) {
  const requiredTier = getRequiredTier(feature)

  if (!requiredTier) return null

  const tierName = getTierName(requiredTier)

  return (
    <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center">
      <div className="flex items-center justify-center gap-2 mb-2">
        <svg className="w-5 h-5 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
        <span className="font-medium">{featureName}</span>
      </div>
      <p className="text-sm text-muted-foreground mb-3">
        Available in {tierName} and above
      </p>
      <Link href="/pricing">
        <Button size="sm" variant="outline">
          Upgrade to unlock
        </Button>
      </Link>
    </div>
  )
}
