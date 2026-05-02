'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { getTierName, getTierPrice, getTierFeatures, getRequiredTier, type Feature } from '@/lib/permissions'
import { Lock, Check, ArrowRight } from 'lucide-react'

interface LockedFeatureProps {
  feature: Feature
  featureName: string
  description: string
  children?: React.ReactNode
}

export function LockedFeature({ feature, featureName, description, children }: LockedFeatureProps) {
  const requiredTier = getRequiredTier(feature)
  if (!requiredTier) return <>{children}</>

  const tierName = getTierName(requiredTier)
  const tierPrice = getTierPrice(requiredTier)
  const tierFeatures = getTierFeatures(requiredTier)

  return (
    <div className="flex items-center justify-center min-h-[500px] p-4">
      <div className="max-w-lg w-full">
        {/* Icon */}
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
          <Lock className="w-7 h-7 text-primary" />
        </div>

        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold tracking-tight mb-2">{featureName}</h2>
          <p className="text-muted-foreground leading-relaxed max-w-sm mx-auto">{description}</p>
        </div>

        {/* Upgrade card */}
        <div className="bg-card border border-primary/20 rounded-2xl p-6 mb-4">
          <div className="flex items-center justify-between mb-5">
            <div>
              <p className="text-xs text-muted-foreground mb-0.5">Required plan</p>
              <h3 className="text-lg font-bold text-primary">{tierName}</h3>
            </div>
            <p className="text-2xl font-bold tabular-nums tracking-tight">{tierPrice}</p>
          </div>
          <ul className="space-y-2 mb-6">
            {tierFeatures.slice(0, 6).map((item, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                <Check className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
          <div className="flex gap-2.5">
            <Link href="/pricing" className="flex-1">
              <Button className="w-full" size="lg">
                Upgrade to {tierName}
                <ArrowRight className="w-4 h-4 ml-1.5" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="lg" variant="outline">All plans</Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export function LockedFeatureInline({ feature, featureName }: { feature: Feature; featureName: string }) {
  const requiredTier = getRequiredTier(feature)
  if (!requiredTier) return null

  const tierName = getTierName(requiredTier)

  return (
    <div className="flex items-center justify-between p-4 rounded-xl border border-primary/15 bg-primary/5">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
          <Lock className="w-4 h-4 text-primary" />
        </div>
        <div>
          <p className="text-sm font-medium">{featureName}</p>
          <p className="text-xs text-muted-foreground">Requires {tierName}</p>
        </div>
      </div>
      <Link href="/pricing">
        <Button size="sm" variant="outline">Upgrade</Button>
      </Link>
    </div>
  )
}
