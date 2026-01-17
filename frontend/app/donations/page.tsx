'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { formatCurrency, formatDate } from '@/lib/utils'
import api from '@/lib/api'
import type { Donation, ImpactWallet, Charity } from '@/lib/types'

export default function DonationsPage() {
  const [donations, setDonations] = useState<Donation[]>([])
  const [impactWallet, setImpactWallet] = useState<ImpactWallet | null>(null)
  const [charities, setCharities] = useState<Charity[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchData()
  }, [])

  const fetchData = async () => {
    try {
      const [donationsData, walletData, charitiesData] = await Promise.all([
        api.donations.getAll(),
        api.donations.getImpactWallet(),
        api.donations.getCharities(),
      ])
      setDonations(donationsData)
      setImpactWallet(walletData)
      setCharities(charitiesData)
    } catch (error) {
      console.error('Failed to fetch donations data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  const walletPercent = impactWallet
    ? (impactWallet.currentMonth.totalDonated / impactWallet.wallet.monthlyLimit) * 100
    : 0

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Impact & Donations</h1>
        <p className="text-muted-foreground">
          Track your charitable impact and donation history
        </p>
      </div>

      {/* Impact Wallet */}
      <Card className="mb-8 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
            Impact Wallet
          </CardTitle>
          <CardDescription>
            Your monthly donation budget
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            {/* Progress Bar */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">
                  {formatCurrency(impactWallet?.currentMonth.totalDonated || 0)} of{' '}
                  {formatCurrency(impactWallet?.wallet.monthlyLimit || 0)}
                </span>
                <span className="text-sm text-muted-foreground">
                  {walletPercent.toFixed(0)}% used
                </span>
              </div>
              <div className="w-full bg-white rounded-full h-4">
                <div
                  className="bg-gradient-to-r from-green-500 to-emerald-500 h-4 rounded-full transition-all"
                  style={{ width: `${Math.min(walletPercent, 100)}%` }}
                />
              </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-lg border border-green-100">
                <p className="text-sm text-muted-foreground mb-1">Remaining</p>
                <p className="text-xl font-bold text-green-600">
                  {formatCurrency(impactWallet?.currentMonth.remaining || 0)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-green-100">
                <p className="text-sm text-muted-foreground mb-1">Today</p>
                <p className="text-xl font-bold">
                  {formatCurrency(impactWallet?.today.totalDonated || 0)}
                </p>
              </div>
              <div className="bg-white p-4 rounded-lg border border-green-100">
                <p className="text-sm text-muted-foreground mb-1">Lifetime</p>
                <p className="text-xl font-bold">
                  {formatCurrency(impactWallet?.wallet.lifetimeDonated || 0)}
                </p>
              </div>
            </div>

            {/* Limits */}
            <div className="flex items-center justify-between text-sm">
              <div>
                <span className="text-muted-foreground">Daily cap:</span>
                <span className="font-medium ml-2">
                  {formatCurrency(impactWallet?.wallet.dailyCap || 0)}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground">Monthly limit:</span>
                <span className="font-medium ml-2">
                  {formatCurrency(impactWallet?.wallet.monthlyLimit || 0)}
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Donation History */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Donation History</CardTitle>
          <CardDescription>
            All your charitable contributions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {donations.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
              <p className="text-muted-foreground">No donations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Complete workouts to start making an impact!
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {donations.map((donation) => (
                <div
                  key={donation.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                      <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{donation.charity.name}</p>
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        <span>{formatDate(donation.createdAt)}</span>
                        <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                          {donation.donationType.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-green-600">
                      {formatCurrency(donation.amount)}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Featured Charities */}
      <Card>
        <CardHeader>
          <CardTitle>Featured Charities</CardTitle>
          <CardDescription>
            Organizations making a real difference
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {charities.slice(0, 4).map((charity) => (
              <div
                key={charity.id}
                className="p-4 border rounded-lg hover:border-primary transition-colors"
              >
                <h3 className="font-semibold mb-2">{charity.name}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {charity.description}
                </p>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-xs bg-primary/10 text-primary px-2 py-1 rounded">
                    {charity.category}
                  </span>
                  <span className="text-muted-foreground">
                    {charity.impactMetric}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
