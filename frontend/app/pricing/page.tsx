'use client'

import Link from 'next/link'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAuthStore } from '@/lib/store/auth.store'
import { getTierName, getTierFeatures } from '@/lib/permissions'
import { TIER_PRICES, B2B_PRICES, IMPACT_WALLET_MONTHLY, CURRENCY_SYMBOL, formatPrice, getTierPrice as getPricingTierPrice, type Currency } from '@/lib/pricing'
import { paymentsApi } from '@/lib/api'
import type { SubscriptionTier } from '@/lib/types'
import {
  Check, Leaf, ArrowLeft, Zap, Crown, Star, Users, ArrowRight, HelpCircle,
  Phone, Shield, Calendar, Heart, TrendingUp, MessageCircle, Flame, Sparkles
} from 'lucide-react'

const paidTiers: SubscriptionTier[] = ['PRO', 'ELITE', 'CONCIERGE']

function getTierLevel(tier: SubscriptionTier): number {
  return { FREE: 0, PRO: 1, ELITE: 2, CONCIERGE: 3, B2B: 2 }[tier]
}

const tierConfig: Record<string, {
  icon: React.ElementType
  iconColor: string
  iconBg: string
  accent: string
  popular?: boolean
}> = {
  PRO: {
    icon: Leaf,
    iconColor: 'text-primary',
    iconBg: 'bg-primary/15',
    accent: 'border-border',
  },
  ELITE: {
    icon: Star,
    iconColor: 'text-blue-400',
    iconBg: 'bg-blue-500/15',
    accent: 'border-blue-500/20',
    popular: true,
  },
  CONCIERGE: {
    icon: Crown,
    iconColor: 'text-amber-400',
    iconBg: 'bg-amber-500/15',
    accent: 'border-amber-500/20',
  },
}

const universalFeatures = [
  { icon: Phone, label: 'Daily morning + evening AI calls', desc: 'Ivy calls you — no app required' },
  { icon: Zap, label: 'Rescue calls', desc: 'About to skip? Call Ivy. She negotiates a minimum that still counts.' },
  { icon: Shield, label: 'Missed call recovery', desc: 'Ivy re-attempts if you don\'t pick up' },
  { icon: MessageCircle, label: 'WhatsApp nudges', desc: 'Gentle check-ins between calls' },
  { icon: Calendar, label: 'Calendar integration', desc: 'Sync your plan to Google or Outlook' },
  { icon: TrendingUp, label: 'All 4 accountability tracks', desc: 'Fitness, Focus, Sleep, Balance — self-assigned by intent' },
  { icon: Heart, label: 'Full transformation tracking', desc: 'Energy, mood, health confidence & life markers' },
  { icon: Flame, label: 'Streak bonuses', desc: 'Bonus wallet donations unlock at 7, 30 & 90-day milestones' },
  { icon: Sparkles, label: 'Season Close', desc: 'End-of-season arc review, total charity impact, and AI-suggested goals for your next season' },
]

function getFaq(currency: Currency) {
  const sym = CURRENCY_SYMBOL[currency]
  const proWallet = IMPACT_WALLET_MONTHLY.PRO[currency]
  const eliteWallet = IMPACT_WALLET_MONTHLY.ELITE[currency]
  const conciergeWallet = IMPACT_WALLET_MONTHLY.CONCIERGE[currency]
  const proPrice = TIER_PRICES.PRO[currency]
  return [
    {
      q: 'How does the Impact Wallet work?',
      a: `Your subscription funds your monthly Impact Wallet. Every completed commitment donates to your chosen charity — ${sym}1/day on Ivy, ${sym}1.50/day on Ivy Plus, ${sym}2/day on Ivy Concierge. Money only moves on follow-through — missing a day fires nothing. Hit 7, 30, or 90-day streaks and bonus donations unlock on top of that.`
    },
    {
      q: 'What is a 14-day free trial?',
      a: 'You get the full Ivy experience — real AI calls, real impact wallet, all features — for 14 days with no card required. You only enter payment details if you decide to continue after the trial.'
    },
    {
      q: 'What are seasons and sprints?',
      a: 'A season is your 12-week overarching goal — something meaningful enough to take 3 months to achieve. Within a season are 3 sprints of 4 weeks each. Each sprint has its own focused pledge. At the end of every sprint, Ivy Plus and Concierge members get an Ivy Circle session to review progress and set the next sprint goal. At the end of the full season, every member gets a Season Close call — a ceremonial review of the whole arc, total charity impact, and Ivy\'s AI-suggested goals for the next season.'
    },
    {
      q: 'How do rescue calls work?',
      a: "When you're about to skip a commitment, you call Ivy proactively. She doesn't guilt you — instead she negotiates a minimum version that still counts. \"You planned 45 minutes. Could you do 10? That still counts as a yes today.\" This is the moment most habit apps lose users forever. Ivy has an answer for it."
    },
    {
      q: "What's the difference between Ivy and Ivy Plus?",
      a: `Ivy gives you the complete AI experience with a ${sym}${proWallet}/month impact wallet. Ivy Plus increases your wallet to ${sym}${eliteWallet}/month, adds audio impact stories, Ivy Circles sprint-end group sessions (3 per season), and a season-end 1-on-1 with a peer coach.`
    },
    {
      q: 'What are Ivy Circles?',
      a: 'Ivy Circles are 45-minute sprint-end cohort sessions — one at the end of each 4-week sprint, three per season. Ivy Plus gets peer-facilitated groups of 6-8 people. Ivy Concierge gets pro or celebrity coaches with groups of max 4. Each session reviews the sprint just finished and sets the pledge for the next.'
    },
    {
      q: 'Can I cancel anytime?',
      a: "Yes. Cancel at any time and you'll retain access until the end of your billing period. No fees, no tricks."
    },
  ]
}

export default function PricingPage() {
  const user = useAuthStore((state) => state.user)
  const currentTier = user?.subscriptionTier || 'FREE'
  const [loading, setLoading] = useState<string | null>(null)
  const [openFaq, setOpenFaq] = useState<number | null>(null)
  const [currency, setCurrency] = useState<Currency>(() => {
    if (typeof window !== 'undefined') {
      try {
        const stored = JSON.parse(localStorage.getItem('ivy-currency') || '{}')
        if (stored?.state?.currency) return stored.state.currency as Currency
      } catch { /* ignore */ }
    }
    return 'GBP'
  })

  const handleUpgrade = async (tier: SubscriptionTier) => {
    if (!user) { window.location.href = '/signup'; return }
    try {
      setLoading(tier)
      const { url } = await paymentsApi.createCheckoutSession(tier)
      window.location.href = url
    } catch (error) {
      console.error(error)
      setLoading(null)
    }
  }

  return (
    <div className="min-h-screen bg-background mesh-bg">
      {/* Nav */}
      <nav className="border-b border-border/50 bg-background/70 backdrop-blur-xl sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center glow-sm">
              <Leaf className="w-4 h-4 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gradient">Ivy</span>
          </Link>
          {user && (
            <Link href="/dashboard">
              <Button variant="outline" size="sm">
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
                Dashboard
              </Button>
            </Link>
          )}
        </div>
      </nav>

      {/* Header */}
      <section className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-green" />
          Simple, transparent pricing
        </div>
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tighter mb-4">
          Choose your{' '}
          <span className="text-gradient">Ivy journey</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-6">
          Every plan gives you the complete AI experience. What you're choosing is how much impact you want to create and how much human coaching you want alongside it.
        </p>
        {user ? (
          <p className="text-sm text-muted-foreground">
            Current plan:{' '}
            <span className="font-semibold text-primary">{getTierName(currentTier)}</span>
          </p>
        ) : (
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/8 border border-primary/20 text-sm">
            <span className="text-primary font-semibold">Try free for 14 days</span>
            <span className="text-muted-foreground">· No card required · Real calls from day one</span>
          </div>
        )}
        {/* Currency toggle */}
        <div className="flex justify-center mt-6">
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted border border-border text-xs">
            <button onClick={() => setCurrency('GBP')} className={`px-3 py-1 rounded-full transition-colors ${currency === 'GBP' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>🇬🇧 GBP</button>
            <button onClick={() => setCurrency('USD')} className={`px-3 py-1 rounded-full transition-colors ${currency === 'USD' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>🇺🇸 USD</button>
          </div>
        </div>
      </section>

      {/* Pricing Cards */}
      <section className="max-w-5xl mx-auto px-4 pb-16">
        <div className="grid sm:grid-cols-3 gap-4">
          {paidTiers.map((tier) => {
            const config = tierConfig[tier]
            const Icon = config.icon
            const features = getTierFeatures(tier, currency)
            const isCurrent = user && currentTier === tier
            const isUpgrade = user && getTierLevel(tier) > getTierLevel(currentTier)
            const price = getPricingTierPrice(tier, currency)

            return (
              <div
                key={tier}
                className={`relative rounded-2xl border p-6 transition-all duration-200 ${
                  config.popular
                    ? `bg-blue-500/5 ${config.accent} shadow-lg shadow-blue-500/10`
                    : `bg-card ${config.accent} hover:border-opacity-80`
                }`}
              >
                {config.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="bg-blue-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Most Popular
                    </span>
                  </div>
                )}
                {isCurrent && (
                  <div className="absolute -top-3 right-4">
                    <span className="bg-emerald-500 text-white text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Current
                    </span>
                  </div>
                )}

                {/* Tier header */}
                <div className="mb-5">
                  <div className={`w-10 h-10 rounded-xl ${config.iconBg} flex items-center justify-center mb-3`}>
                    <Icon className={`w-5 h-5 ${config.iconColor}`} />
                  </div>
                  <h3 className="font-bold text-lg tracking-tight">{getTierName(tier)}</h3>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-3xl font-bold tracking-tight tabular-nums">
                      {price.split('/')[0]}
                    </span>
                    <span className="text-sm text-muted-foreground">/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {tier === 'PRO' && 'The complete Ivy experience'}
                    {tier === 'ELITE' && 'More impact, more coaching'}
                    {tier === 'CONCIERGE' && 'Premium white-glove service'}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6">
                  {features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className={`w-4 h-4 flex-shrink-0 mt-0.5 ${config.iconColor}`} />
                      <span className="text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA */}
                {isCurrent ? (
                  <Button variant="outline" className="w-full" disabled>Current Plan</Button>
                ) : isUpgrade ? (
                  <Button
                    className="w-full"
                    variant={config.popular ? 'default' : 'outline'}
                    onClick={() => handleUpgrade(tier)}
                    disabled={loading === tier}
                  >
                    {loading === tier ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                        Processing…
                      </span>
                    ) : `Upgrade to ${getTierName(tier)}`}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={config.popular ? 'default' : 'outline'}
                    onClick={() => handleUpgrade(tier)}
                    disabled={loading === tier}
                  >
                    {loading === tier ? 'Processing…' : (
                      user ? `Choose ${getTierName(tier)}` : `Try ${getTierName(tier)} free`
                    )}
                  </Button>
                )}
              </div>
            )
          })}
        </div>
        <p className="text-center text-xs text-muted-foreground mt-4">
          All plans include a 14-day free trial · No card required · Cancel anytime
        </p>
      </section>

      {/* What Everyone Gets */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="rounded-2xl border border-border bg-card p-8">
          <div className="text-center mb-8">
            <h2 className="text-xl font-bold tracking-tight mb-2">What every plan includes</h2>
            <p className="text-sm text-muted-foreground">Every paid plan gives you the complete AI experience. No gated features, no broken lower tiers.</p>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {universalFeatures.map((f) => {
              const Icon = f.icon
              return (
                <div key={f.label} className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{f.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* B2B */}
      <section className="max-w-5xl mx-auto px-4 pb-20">
        <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-8 sm:p-10 overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/8 rounded-full blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Ivy for Teams</h2>
                <p className="text-sm text-muted-foreground">Your wellness budget becomes measurable real-world impact</p>
              </div>
            </div>
            <div className="grid sm:grid-cols-2 gap-6 mb-8">
              {[
                {
                  plan: 'Team', planKey: 'TEAM', walletRate: `${CURRENCY_SYMBOL[currency]}0.50/day`, wallet: `${formatPrice(15, currency)}/mo`, features: [
                    'Full AI experience for all employees',
                    `Company-funded impact wallet (${CURRENCY_SYMBOL[currency]}0.50/day)`,
                    'Ivy Impact Stories for every employee',
                    'Team analytics dashboard',
                    'Charity impact report (CSR asset)',
                  ]
                },
                {
                  plan: 'Champion', planKey: 'CHAMPION', walletRate: `${formatPrice(1, currency)}/day`, wallet: `${formatPrice(30, currency)}/mo`, features: [
                    'Everything in Team',
                    `Company-funded impact wallet (${formatPrice(1, currency)}/day)`,
                    'Employee wallet top-up option',
                    'Ivy Circles for employee cohorts',
                    'All charities available',
                  ]
                },
              ].map((plan) => (
                <div key={plan.plan} className="bg-background/50 border border-border/60 rounded-xl p-5">
                  <div className="flex items-baseline gap-1.5 mb-1">
                    <h3 className="font-bold">{plan.plan}</h3>
                    <span className="text-xl font-bold text-primary">{formatPrice(B2B_PRICES[plan.planKey][currency], currency)}</span>
                    <span className="text-xs text-muted-foreground">/employee/mo</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-4">Impact wallet: {plan.walletRate} ({plan.wallet})</p>
                  <ul className="space-y-2">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <Button size="lg" variant="glow">
                Book a Demo <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-sm text-muted-foreground">20–200 employees · 4-week seasons · Privacy-first</p>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="max-w-2xl mx-auto px-4 pb-24">
        <div className="flex items-center gap-2 mb-8 justify-center">
          <HelpCircle className="w-5 h-5 text-muted-foreground" />
          <h2 className="text-2xl font-bold tracking-tight">Frequently asked questions</h2>
        </div>
        <div className="space-y-2">
          {getFaq(currency).map((item, i) => (
            <div key={i} className="rounded-xl border border-border bg-card overflow-hidden">
              <button
                className="flex items-center justify-between w-full p-5 text-left hover:bg-accent/30 transition-colors"
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
              >
                <span className="font-medium text-sm">{item.q}</span>
                <span className={`text-muted-foreground transition-transform ${openFaq === i ? 'rotate-180' : ''}`}>
                  ▾
                </span>
              </button>
              {openFaq === i && (
                <div className="px-5 pb-5">
                  <p className="text-sm text-muted-foreground leading-relaxed">{item.a}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section className="max-w-2xl mx-auto px-4 pb-24">
        <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-10 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-400/5" />
          <div className="relative">
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3">Ready to build unshakeable habits?</h2>
            <p className="text-muted-foreground mb-6">Try Ivy free for 14 days. Real calls, real impact from day one.</p>
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" variant="glow">Go to Dashboard <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
            ) : (
              <Link href="/signup">
                <Button size="lg" variant="glow">Start free today <ArrowRight className="w-4 h-4 ml-2" /></Button>
              </Link>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
