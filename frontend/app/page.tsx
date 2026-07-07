'use client'

/**
 * Landing page — stake-rework model.
 *
 * The product is a commitment device: you stake your own money each week,
 * arm it every morning with a spoken voice note, and Ivy calls you in the
 * evening to settle. Follow through → keep it. Miss → it forfeits to a
 * charity you'd hate to fund.
 *
 * Warm ceremony design system (ink / gold / sage / ember / periwinkle).
 * No donate-on-success "impact wallet", no multi-tier. One plan, one price.
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowRight, Mic, Phone, Shield, Users, Target, Heart,
  Sun, Moon, Flame,
} from 'lucide-react'
import { IVY_PRICE, STAKE_MIN_WEEKLY, CURRENCY_SYMBOL, type Currency } from '@/lib/pricing'
import { Logo } from '@/components/brand/Logo'
import { IvyVine, type VineDay } from '@/components/living/IvyVine'

// The hero plant — an illustrative week, four days kept, tonight budding.
const DEMO_WEEK: VineDay[] = [
  { label: 'M', status: 'complete', isToday: false },
  { label: 'T', status: 'complete', isToday: false },
  { label: 'W', status: 'complete', isToday: false },
  { label: 'T', status: 'armed', isToday: false },
  { label: 'F', status: 'upcoming', isToday: true },
]

// ── The daily loop ────────────────────────────────────────────────────────────
const LOOP = [
  {
    icon: Sun,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    ring: 'border-gold-400/20',
    time: 'Morning',
    title: 'Arm your day',
    desc: 'Record a short voice note — out loud — committing to what you\'re taking on today. That\'s how you arm your stake. No note, no protection.',
  },
  {
    icon: Flame,
    color: 'text-ember-400',
    bg: 'bg-ember-400/10',
    ring: 'border-ember-400/20',
    time: 'All day',
    title: 'The stake holds',
    desc: 'Your own money is on the line this week. Knowing it\'s sitting there — yours to keep or lose — is what gets you off the couch.',
  },
  {
    icon: Moon,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    ring: 'border-gold-400/20',
    time: 'Evening',
    title: 'Settle the score',
    desc: 'Ivy calls you back, plays your morning words, and you settle honestly. Followed through? The money\'s yours. Missed? That slice forfeits.',
  },
]

// ── What you get ──────────────────────────────────────────────────────────────
const PILLARS = [
  {
    icon: Mic,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    title: 'Voice-note arming',
    desc: 'Saying it out loud is the commitment. Every morning, in your own voice.',
  },
  {
    icon: Shield,
    color: 'text-ember-400',
    bg: 'bg-ember-400/10',
    title: 'Real stakes',
    desc: 'Your money, your risk. Miss and it funds a charity you\'d hate. That\'s the teeth.',
  },
  {
    icon: Users,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    title: 'Ivy Circles',
    desc: '5–8 person cohorts, live baton games, witnessed stakes. Accountability with company.',
  },
  {
    icon: Target,
    color: 'text-sage-400',
    bg: 'bg-sage-400/10',
    title: 'Seasons & sprints',
    desc: '12-week arcs in 4-week sprints. A goal big enough to matter, broken into reachable steps.',
  },
  {
    icon: Phone,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    title: 'Evening review call',
    desc: 'Ivy calls you. Not a notification you swipe away — a conversation that closes the loop.',
  },
  {
    icon: Heart,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    title: 'Season Close',
    desc: 'A ceremonial end-of-arc review: your story, your impact, and Ivy\'s plan for what\'s next.',
  },
]

export default function LandingPage() {
  const [currency, setCurrency] = useState<Currency>('GBP')
  const sym = CURRENCY_SYMBOL[currency]
  const price = IVY_PRICE[currency]
  const minStake = STAKE_MIN_WEEKLY[currency]

  return (
    <div className="theme-vine min-h-screen overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-ink-700/60 bg-ink-900/80 backdrop-blur-xl safe-top">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Logo size={28} className="rounded-lg" />
            <span className="font-display text-base font-semibold text-ink-50">Ivy</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/pricing" className="hidden sm:inline-flex text-sm text-ink-300 hover:text-ink-50 transition-colors px-3 py-2">
              Pricing
            </Link>
            <Link href="/for-coaches" className="hidden sm:inline-flex text-sm text-ink-300 hover:text-ink-50 transition-colors px-3 py-2">
              For coaches
            </Link>
            <Link href="/login" className="text-sm text-ink-300 hover:text-ink-50 transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link href="/signup">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-ink-900 bg-gold-400 hover:bg-gold-300 transition-colors">
                Get started <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — the vine IS the pitch */}
      <section className="relative pt-24 sm:pt-28 pb-16 px-4">
        <div
          className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(70,240,200,0.1) 0%, transparent 70%)' }}
        />
        <div className="max-w-5xl mx-auto relative grid lg:grid-cols-[1fr_minmax(300px,380px)] gap-2 lg:gap-10 items-center">
          <div className="text-center lg:text-left order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-400/[0.08] border border-gold-400/20 mb-7">
              <span className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-gold" />
              <span className="font-mono text-[11px] font-medium text-gold-400 uppercase tracking-[0.18em]">A commitment device, not another habit app</span>
            </div>

            <h1 className="font-display text-5xl sm:text-6xl text-ink-50 tracking-tight leading-[1.06] mb-6">
              Your commitment,<br />
              <em className="text-gradient-gold">kept alive.</em>
            </h1>

            <p className="text-lg text-ink-300 max-w-xl mx-auto lg:mx-0 mb-6 leading-relaxed">
              You stake your own money on showing up. Every day you keep, your ivy grows a leaf.
              Ivy calls you each evening to settle — follow through and keep your money, miss and
              that day&apos;s slice goes to charity.
            </p>

            <p className="inline-block font-mono text-[11px] uppercase tracking-[0.24em] text-ink-400 border border-ink-600/70 rounded-lg px-3.5 py-2 mb-9">
              Miss a day <span className="text-ember-400">&amp; a leaf falls · −{sym}2.33</span>
            </p>

            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link href="/signup">
                <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-semibold text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all glow-gold active:scale-[0.98]">
                  Start 14-day free trial <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
              <Link href="/pricing">
                <button className="w-full sm:w-auto px-7 py-4 rounded-2xl font-semibold text-ink-100 border border-ink-600 hover:border-ink-500 hover:bg-ink-800/60 transition-all">
                  See the plan
                </button>
              </Link>
            </div>

            <p className="text-xs text-ink-400 mt-5">
              No card required to start · Real system from day one
            </p>
          </div>

          <div className="order-1 lg:order-2 relative">
            <IvyVine days={DEMO_WEEK} className="mx-auto h-64 sm:h-80 w-auto" />
            <p className="text-center font-display text-[15px] text-sage-300 -mt-2">
              Four days kept. Tonight&apos;s leaf is budding.
            </p>
          </div>
        </div>
      </section>

      {/* The daily loop */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl text-ink-50 tracking-tight mb-3">The daily loop</h2>
          <p className="text-ink-400 max-w-md mx-auto">Three beats a day. That&apos;s the whole machine.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {LOOP.map((step, i) => (
            <div
              key={step.title}
              className={`relative rounded-2xl border ${step.ring} bg-ink-800 p-6 overflow-hidden`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className={`w-11 h-11 rounded-xl ${step.bg} flex items-center justify-center`}>
                  <step.icon className={`w-5 h-5 ${step.color}`} />
                </div>
                <span className="font-mono text-xs text-ink-500 tabular-nums">0{i + 1}</span>
              </div>
              <p className={`text-xs font-bold uppercase tracking-widest ${step.color} mb-1`}>{step.time}</p>
              <h3 className="font-display text-lg text-ink-50 mb-2">{step.title}</h3>
              <p className="text-sm text-ink-400 leading-relaxed">{step.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pillars */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-10">
          <h2 className="font-display text-3xl text-ink-50 tracking-tight mb-3">Everything in one plan</h2>
          <p className="text-ink-400 max-w-md mx-auto">No tiers, no gated features. The whole system, from day one.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {PILLARS.map((p) => (
            <div
              key={p.title}
              className="rounded-2xl border border-ink-700 bg-ink-800/60 p-6 hover:border-ink-600 transition-colors"
            >
              <div className={`w-11 h-11 rounded-xl ${p.bg} flex items-center justify-center mb-4`}>
                <p.icon className={`w-5 h-5 ${p.color}`} />
              </div>
              <h3 className="font-display text-lg text-ink-50 mb-2">{p.title}</h3>
              <p className="text-sm text-ink-400 leading-relaxed">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Price strip */}
      <section className="max-w-3xl mx-auto px-4 pb-24">
        <div className="relative rounded-3xl border border-gold-400/25 bg-ink-800 p-8 sm:p-10 overflow-hidden glow-gold">
          <div className="h-0.5 absolute top-0 inset-x-0 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />

          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-6">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center gap-1 p-1 rounded-full bg-ink-900 border border-ink-700">
                  {(['GBP', 'USD'] as Currency[]).map((c) => (
                    <button
                      key={c}
                      onClick={() => setCurrency(c)}
                      className={`px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors ${
                        currency === c ? 'bg-ink-700 text-ink-50' : 'text-ink-400 hover:text-ink-200'
                      }`}
                    >
                      {c === 'GBP' ? '🇬🇧 GBP' : '🇺🇸 USD'}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-baseline gap-1.5">
                <span className="font-display text-5xl font-semibold text-ink-50 tracking-tight tabular-nums">{sym}{price}</span>
                <span className="text-base text-ink-400">/mo</span>
              </div>
              <p className="text-sm text-ink-400 mt-2 max-w-sm leading-relaxed">
                One plan. Everything included. Plus your own weekly stake (min {sym}{minStake}) — that&apos;s your money to keep, not Ivy&apos;s revenue.
              </p>
            </div>

            <Link href="/signup" className="shrink-0">
              <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-semibold text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all active:scale-[0.98]">
                Start free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
        <div className="text-center mt-5">
          <Link href="/pricing" className="inline-flex items-center gap-1.5 text-sm text-ink-300 hover:text-ink-50 transition-colors">
            See everything included <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-ink-700/60 safe-bottom">
        <div className="max-w-5xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Logo size={24} className="rounded-md" />
            <span className="font-display text-sm font-semibold text-ink-100">Ivy</span>
          </div>
          <p className="text-xs text-ink-500">© 2026 Ivy. All rights reserved.</p>
          <div className="flex items-center gap-4 text-xs text-ink-400">
            <Link href="/pricing" className="hover:text-ink-100 transition-colors">Pricing</Link>
            <Link href="/for-coaches" className="hover:text-ink-100 transition-colors">For coaches</Link>
            <Link href="/login" className="hover:text-ink-100 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
