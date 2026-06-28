'use client'

import { useEffect, useState } from 'react'
import { formatCurrency, formatDate } from '@/lib/utils'
import api from '@/lib/api'
import type { Donation, ImpactWallet, Charity } from '@/lib/types'
import { Heart, TrendingUp, Wallet, Calendar, Sparkles } from 'lucide-react'

function Skeleton({ className }: { className: string }) {
  return <div className={`rounded-lg bg-muted animate-pulse ${className}`} />
}

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [impactWallet, setImpactWallet] = useState<ImpactWallet | null>(null)
  const [charities, setCharities] = useState<Charity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      api.donations.getAll(),
      api.donations.getImpactWallet(),
      api.donations.getCharities(),
    ]).then(([d, w, c]) => {
      setDonations(d)
      setImpactWallet(w)
      setCharities(c)
    }).catch(console.error)
      .finally(() => setIsLoading(false))
  }, [])

  const walletPercent = impactWallet
    ? Math.min((impactWallet.currentMonth.totalDonated / impactWallet.wallet.monthlyLimit) * 100, 100)
    : 0

  const donationTypeLabel = (type: string) => type.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="p-6 sm:p-8 pb-28 max-w-lg sm:max-w-2xl mx-auto">
      <div className="mb-8 animate-fade-in">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Impact & Donations</h1>
        <p className="text-muted-foreground text-sm">Your charitable impact at a glance</p>
      </div>

      {/* Impact Wallet Hero */}
      <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-6 sm:p-8 mb-6 overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-3xl" />
        <div className="relative">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center glow-sm">
              <Heart className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold">Impact Wallet</h2>
              <p className="text-xs text-muted-foreground">Monthly donation budget</p>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-6 w-48" />
              <Skeleton className="h-3 w-full rounded-full" />
              <div className="grid grid-cols-3 gap-4">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </div>
            </div>
          ) : (
            <>
              {/* Progress */}
              <div className="mb-6">
                <div className="flex justify-between items-baseline mb-3">
                  <span className="text-sm font-medium">
                    {formatCurrency(impactWallet?.currentMonth.totalDonated || 0)}
                    <span className="text-muted-foreground font-normal"> of {formatCurrency(impactWallet?.wallet.monthlyLimit || 0)}</span>
                  </span>
                  <span className="text-xs text-muted-foreground">{walletPercent.toFixed(0)}% used</span>
                </div>
                <div className="w-full bg-muted/60 rounded-full h-3 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-primary to-sage-400 h-full rounded-full transition-all duration-1000"
                    style={{ width: `${walletPercent}%` }}
                  />
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Remaining', value: formatCurrency(impactWallet?.currentMonth.remaining || 0), color: 'text-primary' },
                  { label: 'Today', value: formatCurrency(impactWallet?.today?.totalDonated || 0), color: 'text-foreground' },
                  { label: 'Lifetime', value: formatCurrency(impactWallet?.wallet.lifetimeDonated || 0), color: 'text-foreground' },
                ].map((s) => (
                  <div key={s.label} className="bg-background/50 border border-border/50 rounded-xl p-4">
                    <p className="text-xs text-muted-foreground mb-1.5">{s.label}</p>
                    <p className={`text-xl font-bold tabular-nums tracking-tight ${s.color}`}>{s.value}</p>
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-6 mt-4 text-xs text-muted-foreground">
                <span>Daily cap: <strong className="text-foreground">{formatCurrency(impactWallet?.wallet.dailyCap || 0)}</strong></span>
                <span>Monthly limit: <strong className="text-foreground">{formatCurrency(impactWallet?.wallet.monthlyLimit || 0)}</strong></span>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4 sm:gap-6">
        {/* Donation History */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Donation History</h2>
              <p className="text-xs text-muted-foreground mt-0.5">All your contributions</p>
            </div>
            <TrendingUp className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 p-3 rounded-xl border border-border">
                    <Skeleton className="w-10 h-10 rounded-xl" />
                    <div className="flex-1 space-y-1.5">
                      <Skeleton className="h-3.5 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                    <Skeleton className="h-5 w-16" />
                  </div>
                ))}
              </div>
            ) : donations.length === 0 ? (
              <div className="py-12 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                  <Heart className="w-7 h-7 text-muted-foreground/40" />
                </div>
                <p className="font-medium text-sm mb-1">No donations yet</p>
                <p className="text-xs text-muted-foreground">Complete workouts to start making an impact!</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {donations.map((donation) => (
                  <div key={donation.id} className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-border/80 hover:bg-accent/20 transition-all">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <Heart className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{donation.charity.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(donation.createdAt)}
                        </span>
                        <span className="text-[10px] bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          {donationTypeLabel(donation.donationType)}
                        </span>
                      </div>
                    </div>
                    <p className="text-sm font-bold text-primary tabular-nums flex-shrink-0">
                      {formatCurrency(donation.amount)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Featured Charities */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Featured Charities</h2>
              <p className="text-xs text-muted-foreground mt-0.5">Making a real difference</p>
            </div>
            <Sparkles className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="p-4">
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="p-4 rounded-xl border border-border space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-2/3" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {charities.slice(0, 4).map((charity) => (
                  <div key={charity.id} className="p-4 rounded-xl border border-border hover:border-primary/20 hover:bg-primary/3 transition-all cursor-pointer group">
                    <h3 className="text-sm font-semibold mb-1 group-hover:text-primary transition-colors">{charity.name}</h3>
                    <p className="text-xs text-muted-foreground mb-2.5 leading-relaxed line-clamp-2">{charity.description}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-medium bg-primary/10 text-primary border border-primary/15 px-2 py-0.5 rounded-md">
                        {charity.category}
                      </span>
                      <span className="text-xs text-muted-foreground">{charity.impactMetric}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
