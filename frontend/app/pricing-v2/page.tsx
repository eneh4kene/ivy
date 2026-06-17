'use client'

/**
 * Pricing page — §5b one-plan "Ivy" model.
 *
 * ONE plan (PRO / "Ivy") at ~£42/mo placeholder.
 * Coach add-on + opt-in feature toggles shown as included/optional — NOT separate paid tiers.
 * 14-day trial framing.
 * No Starter/Plus/Concierge.
 *
 * MOCK DATA ONLY — all checkout calls marked // TODO(api):
 */

import { useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft, ArrowRight, Check, Mic, Users, Shield,
  Zap, Phone, MessageSquare, Heart, Target, Sparkles,
  ChevronDown, Dumbbell, Star,
} from 'lucide-react'

// ─── Price config (§9 decision 1 — placeholder pending founder COGS confirmation) ─
const IVY_PRICE = { GBP: 42, USD: 52 } as const
type Currency = 'GBP' | 'USD'
const CURRENCY_SYMBOL: Record<Currency, string> = { GBP: '£', USD: '$' }

// ─── Included features (core, always on) ─────────────────────────────────────
const CORE_FEATURES = [
  {
    icon: Mic,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    label: 'Morning voice note',
    desc: 'Record your commitment out loud every morning. Armed = protected. Unarmed = miss.',
  },
  {
    icon: Phone,
    color: 'text-sage-400',
    bg: 'bg-sage-400/10',
    label: 'Evening review call',
    desc: "Ivy calls you back. Plays your morning words. Settles the score. This is where the loop closes.",
  },
  {
    icon: Shield,
    color: 'text-ember-400',
    bg: 'bg-ember-400/10',
    label: 'Your stake, your money',
    desc: 'You set the weekly amount (min £7/wk). Follow through and keep it. Miss and it goes somewhere you\'d hate.',
  },
  {
    icon: Users,
    color: 'text-periwinkle-400',
    bg: 'bg-periwinkle-400/10',
    label: 'Ivy Circles',
    desc: '5–8 person accountability cohort. Live baton games. Witnessed stakes. Social teeth.',
  },
  {
    icon: Target,
    color: 'text-sage-400',
    bg: 'bg-sage-400/10',
    label: 'Seasons & sprints',
    desc: '12-week arcs with 3 four-week sprints. Your goal lives here. Season Close review at the end.',
  },
  {
    icon: Heart,
    color: 'text-gold-400',
    bg: 'bg-gold-400/10',
    label: 'Charity impact',
    desc: 'Your success donations go to a charity you chose. Fail and it funds somewhere you wouldn\'t.',
  },
  {
    icon: Sparkles,
    color: 'text-periwinkle-400',
    bg: 'bg-periwinkle-400/10',
    label: 'Season Close',
    desc: 'An end-of-arc ceremonial review — your arc, your impact story, Ivy\'s suggestions for next season.',
  },
  {
    icon: MessageSquare,
    color: 'text-ink-200',
    bg: 'bg-ink-700',
    label: 'Voice or text',
    desc: 'Calls or chat — your choice. Same price, same system. The morning VN stays spoken for everyone.',
  },
]

// ─── Opt-in toggles (included, user chooses to enable) ────────────────────────
const OPT_IN_FEATURES = [
  {
    id: 'circles',
    icon: Users,
    color: 'text-periwinkle-400',
    bg: 'bg-periwinkle-400/10',
    label: 'Circles & games',
    desc: 'Join a 5–8 person cohort. Play the baton, points race, and collective games. The social layer.',
    note: 'Free, opt-in',
  },
  {
    id: 'arming-chase',
    icon: Zap,
    color: 'text-ember-400',
    bg: 'bg-ember-400/10',
    label: 'Arming-chase calls',
    desc: 'If you go quiet past your window, Ivy calls you to chase. Capped at 8 calls/month.',
    note: 'Free, opt-in',
  },
  {
    id: 'on-demand',
    icon: Phone,
    color: 'text-sage-400',
    bg: 'bg-sage-400/10',
    label: 'On-demand rescue calls',
    desc: 'About to skip? Call Ivy. She doesn\'t guilt you — she negotiates a minimum that still counts.',
    note: 'Free, opt-in',
  },
]

// ─── FAQ ──────────────────────────────────────────────────────────────────────
const FAQ = [
  {
    q: 'How does the stake work?',
    a: "You set a weekly stake (minimum £7/wk, your choice). Ivy authorises the amount upfront — it's earmarked, not charged. Show up each day and the money is released back to you. Miss a day and that day's slice is captured and sent to a charity you'd hate to fund. It's your money, your risk, and that's exactly why it works.",
  },
  {
    q: 'What is a morning voice note?',
    a: "Every morning you record a short spoken note — \"what I'm taking on today.\" That's how you arm your stake. Unarmed = missed day = forfeit. The VN is the mechanic, not just a feature. Even if you prefer text check-ins in the evening, the morning VN is always spoken — saying it out loud is the commitment.",
  },
  {
    q: 'How does the 14-day trial work?',
    a: 'You get the full Ivy system — real morning VN, real evening review, real stake — for 14 days. No card required to start. You do need to set a stake (that\'s the thing being trialled). If you don\'t convert by day 14, access lapses.',
  },
  {
    q: 'What are the opt-in features?',
    a: "Circles, arming-chase calls, and on-demand rescue calls are all included in the one plan and cost nothing extra — but they're off by default. You switch them on in settings. Arming-chase is capped at 8 calls/month so a bad week doesn't rack up hidden costs.",
  },
  {
    q: 'What is the coach add-on?',
    a: "You can add a certified coach from Ivy's pool at any time. Ivy takes 0% — the coach bills you directly at their own rate. Ivy provides the between-session accountability layer; the coach provides the human expertise. Two separate things, working together.",
  },
  {
    q: 'Can I cancel anytime?',
    a: 'Yes. Cancel in settings, access until your billing period ends, no fees.',
  },
]

// ─── Components ───────────────────────────────────────────────────────────────

function FeatureRow({
  icon: Icon,
  color,
  bg,
  label,
  desc,
}: {
  icon: React.ElementType
  color: string
  bg: string
  label: string
  desc: string
}) {
  return (
    <div className="flex items-start gap-3.5 py-3 border-b border-ink-700/60 last:border-0">
      <div className={`w-8 h-8 rounded-xl ${bg} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <div>
        <p className="text-sm font-semibold text-ink-100">{label}</p>
        <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{desc}</p>
      </div>
    </div>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-2xl border border-ink-600 overflow-hidden">
      <button
        className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-ink-800/60 transition-colors"
        onClick={() => setOpen(!open)}
      >
        <span className="text-sm font-medium text-ink-100 pr-4">{q}</span>
        <ChevronDown
          className={`w-4 h-4 text-ink-400 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4">
          <p className="text-sm text-ink-400 leading-relaxed">{a}</p>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PricingV2Page() {
  const [currency, setCurrency] = useState<Currency>('GBP')
  const sym = CURRENCY_SYMBOL[currency]
  const price = IVY_PRICE[currency]

  return (
    <div className="min-h-screen mesh-bg">
      {/* Nav */}
      <nav className="sticky top-0 z-40 border-b border-ink-700/60 bg-ink-900/80 backdrop-blur-xl safe-top">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
              <span className="font-display text-sm text-gold-400 font-semibold italic">I</span>
            </div>
            <span className="font-display text-base font-semibold text-ink-50">Ivy</span>
          </Link>
          <div className="flex items-center gap-2 p-1 rounded-full bg-ink-800 border border-ink-700">
            {(['GBP', 'USD'] as Currency[]).map((c) => (
              <button
                key={c}
                onClick={() => setCurrency(c)}
                className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                  currency === c
                    ? 'bg-ink-700 text-ink-50 shadow-sm'
                    : 'text-ink-400 hover:text-ink-200'
                }`}
              >
                {c === 'GBP' ? '🇬🇧 GBP' : '🇺🇸 USD'}
              </button>
            ))}
          </div>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-12">
        {/* Hero */}
        <div className="text-center mb-12 page-enter">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-400/08 border border-gold-400/20 mb-6">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-gold" />
            <span className="text-xs font-semibold text-gold-400 uppercase tracking-wider">One plan · Everything included</span>
          </div>

          <h1 className="font-display text-4xl sm:text-5xl text-ink-50 tracking-tight leading-tight mb-4">
            Accountability that<br />
            <em className="text-gradient-gold not-italic">has teeth.</em>
          </h1>
          <p className="text-base text-ink-400 max-w-md mx-auto leading-relaxed">
            One plan. Your entire accountability system. No gated features, no upgrade pressure — everything Ivy makes is included.
          </p>
        </div>

        {/* Pricing card */}
        <div className="relative rounded-3xl border border-gold-400/25 bg-ink-800 overflow-hidden mb-8 glow-gold">
          {/* Top gradient bar */}
          <div className="h-0.5 bg-gradient-to-r from-transparent via-gold-400 to-transparent" />

          {/* Card header */}
          <div className="px-6 pt-8 pb-6 border-b border-ink-700">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="w-8 h-8 rounded-xl bg-gold-400/10 border border-gold-400/20 flex items-center justify-center">
                    <Star className="w-4 h-4 text-gold-400" />
                  </div>
                  <p className="text-2xs font-bold uppercase tracking-widest text-gold-400">Ivy</p>
                </div>
                <div className="flex items-baseline gap-1.5 mt-2">
                  <span className="font-display text-5xl font-semibold text-ink-50 tracking-tight tabular-nums">
                    {sym}{price}
                  </span>
                  <span className="text-base text-ink-400">/mo</span>
                </div>
                <p className="text-xs text-ink-400 mt-1.5">
                  <span className="text-gold-400 font-semibold">14-day free trial</span>
                  {' · '}no card required{' · '}real system from day one
                </p>
              </div>
              {/* Pricing disclaimer */}
              <div className="text-right shrink-0 ml-4">
                <p className="text-2xs text-ink-600 font-mono leading-tight">
                  placeholder pricing<br />pending COGS review ⚑
                </p>
              </div>
            </div>

            {/* Stake note */}
            <div className="mt-5 p-3.5 rounded-xl bg-ember-400/06 border border-ember-400/15 flex gap-2.5">
              <div className="w-1 rounded-full bg-ember-400 shrink-0" />
              <p className="text-xs text-ink-300 leading-relaxed">
                <span className="text-ember-400 font-semibold">Plus your own stake</span>
                {' '}— separately, you put money on the line each week (min £7). That&apos;s not Ivy&apos;s revenue; it&apos;s yours to keep if you follow through.
              </p>
            </div>
          </div>

          {/* Core features list */}
          <div className="px-6 py-2">
            {CORE_FEATURES.map((f) => (
              <FeatureRow key={f.label} {...f} />
            ))}
          </div>

          {/* CTA */}
          <div className="px-6 pb-8 pt-4 space-y-3">
            <Link href="/onboard-consumer">
              <button className="w-full py-4 rounded-2xl font-semibold text-base text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all glow-gold active:scale-[0.98]">
                Start 14-day free trial
                <ArrowRight className="inline-block ml-2 w-4 h-4" />
              </button>
            </Link>
            <p className="text-center text-2xs text-ink-600">
              Cancel anytime · Billed monthly after trial
            </p>
          </div>
        </div>

        {/* Opt-in features */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-px flex-1 bg-ink-700" />
            <p className="text-xs font-bold uppercase tracking-widest text-ink-400">Opt-in features</p>
            <div className="h-px flex-1 bg-ink-700" />
          </div>
          <p className="text-xs text-ink-400 text-center mb-5 leading-relaxed">
            All included. All off by default. Switch on what you want in settings — none cost extra.
          </p>

          <div className="space-y-3">
            {OPT_IN_FEATURES.map((f) => (
              <div
                key={f.id}
                className="flex items-start gap-3.5 p-4 rounded-2xl border border-ink-600 bg-ink-800/60"
              >
                <div className={`w-9 h-9 rounded-xl ${f.bg} flex items-center justify-center shrink-0`}>
                  <f.icon className={`w-4.5 h-4.5 ${f.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-semibold text-ink-100">{f.label}</p>
                    <span className="text-2xs px-2 py-0.5 rounded-full bg-sage-400/12 text-sage-400 font-semibold border border-sage-400/20">
                      {f.note}
                    </span>
                  </div>
                  <p className="text-xs text-ink-400 mt-0.5 leading-relaxed">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Coach add-on */}
        <div className="mb-12 rounded-2xl border border-ink-600 bg-ink-800 overflow-hidden">
          <div className="px-5 py-4 border-b border-ink-700 flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4 text-ink-200" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-100">Coach add-on</p>
              <p className="text-xs text-ink-400">Optional · not Ivy revenue</p>
            </div>
          </div>
          <div className="px-5 py-4 space-y-2.5">
            <p className="text-xs text-ink-400 leading-relaxed">
              Add a certified coach from Ivy&apos;s pool at any time.{' '}
              <span className="text-ink-200 font-medium">Ivy takes 0%</span>
              {' '}— the coach sets their own rate and bills you directly. Ivy provides the between-session daily loop; the coach provides the expertise.
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              {[
                'Coach sets own rate',
                'You pay the coach directly',
                'Ivy takes 0%',
                'Lightweight vetting + ratings',
              ].map((tag) => (
                <span
                  key={tag}
                  className="text-2xs px-2.5 py-1 rounded-lg bg-ink-700 border border-ink-600 text-ink-300"
                >
                  {tag}
                </span>
              ))}
            </div>
            <Link href="/coaches">
              <button className="mt-1 flex items-center gap-1.5 text-xs font-semibold text-ink-200 hover:text-ink-50 transition-colors">
                Browse coaches <ArrowRight className="w-3 h-3" />
              </button>
            </Link>
          </div>
        </div>

        {/* FAQ */}
        <div className="mb-12">
          <h2 className="font-display text-xl text-ink-50 text-center mb-6">Questions</h2>
          <div className="space-y-2">
            {FAQ.map((item) => (
              <FaqItem key={item.q} q={item.q} a={item.a} />
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="relative rounded-3xl border border-gold-400/20 bg-ink-800 p-8 text-center overflow-hidden">
          <div
            className="pointer-events-none absolute -top-16 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full opacity-25"
            style={{ background: 'radial-gradient(circle, rgba(204,163,72,0.2) 0%, transparent 70%)' }}
          />
          <div className="relative">
            <h2 className="font-display text-2xl text-ink-50 mb-2">
              Put your money where your commitment is.
            </h2>
            <p className="text-sm text-ink-400 mb-6">14 days free. Real system from day one.</p>
            <Link href="/onboard-consumer">
              <button className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl font-semibold text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all glow-gold active:scale-[0.98]">
                Start free today <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
