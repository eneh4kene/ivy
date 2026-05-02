'use client'

import { useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Leaf, Phone, Heart, Zap, ArrowRight, Star, TrendingUp, Shield, Check } from "lucide-react"
import { TIER_PRICES, IMPACT_WALLET_MONTHLY, CURRENCY_SYMBOL, type Currency } from "@/lib/pricing"

export default function LandingPage() {
  const [currency, setCurrency] = useState<Currency>('GBP')
  return (
    <div className="min-h-screen bg-background mesh-bg overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-border/50 bg-background/70 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center glow-sm">
              <Leaf className="w-4.5 h-4.5 text-primary" />
            </div>
            <span className="text-lg font-bold tracking-tight text-gradient">Ivy</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/login">
              <Button variant="ghost" size="sm" className="hidden sm:inline-flex">Sign in</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">
                Get started <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative pt-32 pb-24 px-4">
        {/* Glow orbs */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-64 h-64 bg-emerald-400/6 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center relative">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-medium mb-8 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-green" />
            AI-Powered Accountability Platform
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tighter leading-[1.05] mb-6 animate-fade-in">
            Build habits that{" "}
            <span className="text-gradient text-glow">actually stick</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 leading-relaxed animate-fade-in">
            Daily AI voice calls keep you accountable. Every workout you complete donates to your chosen charity.
            Transform your life while making an impact.
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center animate-fade-in">
            <Link href="/signup">
              <Button size="xl" variant="glow" className="w-full sm:w-auto">
                Try free for 14 days
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <Link href="/pricing">
              <Button size="xl" variant="outline" className="w-full sm:w-auto">
                View pricing
              </Button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="flex items-center justify-center gap-6 mt-12 text-sm text-muted-foreground animate-fade-in">
            <div className="flex -space-x-2">
              {['A','B','C','D'].map((l, i) => (
                <div key={i} className="w-8 h-8 rounded-full bg-primary/15 border-2 border-background flex items-center justify-center text-xs font-bold text-primary">
                  {l}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <span>Loved by 500+ members</span>
            </div>
          </div>
        </div>
      </section>

      {/* Bento features */}
      <section className="max-w-6xl mx-auto px-4 pb-24">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Large feature */}
          <div className="md:col-span-2 rounded-2xl bg-card border border-border p-8 relative overflow-hidden group hover:border-primary/30 transition-all duration-300">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl" />
            <div className="w-12 h-12 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center mb-5">
              <Phone className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-3">Daily AI Voice Calls</h3>
            <p className="text-muted-foreground leading-relaxed max-w-sm">
              Ivy calls you every morning and evening — personalised conversations that adapt to your journey, celebrate wins, and keep you focused on what matters.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/15 text-xs font-medium text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary pulse-green" />
                Live now
              </div>
              <span className="text-xs text-muted-foreground">Powered by Retell AI</span>
            </div>
          </div>

          {/* Small feature */}
          <div className="rounded-2xl bg-card border border-border p-6 group hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-5">
              <Heart className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Impact Wallet</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Every completed workout triggers a donation to your chosen charity. Build a habit, build a better world.
            </p>
          </div>

          {/* Small feature */}
          <div className="rounded-2xl bg-card border border-border p-6 group hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-5">
              <Zap className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-xl font-bold tracking-tight mb-2">Streak Bonuses</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Hit 7, 30, or 90-day streaks to unlock bonus donations. Consistency always rewarded — on every plan.
            </p>
          </div>

          {/* Medium feature */}
          <div className="md:col-span-2 rounded-2xl bg-card border border-border p-8 group hover:border-primary/30 transition-all duration-300">
            <div className="w-12 h-12 rounded-xl bg-violet-500/10 border border-violet-500/20 flex items-center justify-center mb-5">
              <TrendingUp className="w-6 h-6 text-violet-400" />
            </div>
            <h3 className="text-2xl font-bold tracking-tight mb-3">Transformation Tracking</h3>
            <p className="text-muted-foreground leading-relaxed max-w-sm">
              Weekly energy, mood, and health confidence scores. Log life markers — your milestones and breakthroughs — to see how far you've come.
            </p>
            {/* Score preview */}
            <div className="mt-6 flex gap-4">
              {[
                { label: 'Energy', val: 8.4, color: 'text-amber-400' },
                { label: 'Mood', val: 9.1, color: 'text-violet-400' },
                { label: 'Health', val: 7.7, color: 'text-primary' },
              ].map((s) => (
                <div key={s.label} className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl bg-muted/50 border border-border">
                  <span className={`text-2xl font-bold ${s.color}`}>{s.val}</span>
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Pricing preview */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="text-center mb-8">
          <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Simple, transparent pricing</h2>
          <p className="text-muted-foreground text-lg">Starting from {CURRENCY_SYMBOL[currency]}{TIER_PRICES.PRO[currency]}/month. Try free for 14 days.</p>
        </div>
        {/* Currency toggle */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-1 p-1 rounded-full bg-muted border border-border text-xs">
            <button onClick={() => setCurrency('GBP')} className={`px-3 py-1 rounded-full transition-colors ${currency === 'GBP' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>🇬🇧 GBP</button>
            <button onClick={() => setCurrency('USD')} className={`px-3 py-1 rounded-full transition-colors ${currency === 'USD' ? 'bg-background shadow text-foreground' : 'text-muted-foreground'}`}>🇺🇸 USD</button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            { name: 'Ivy', tier: 'PRO', desc: 'The complete experience', highlight: false },
            { name: 'Ivy Plus', tier: 'ELITE', desc: 'More impact, more coaching', highlight: true },
            { name: 'Ivy Concierge', tier: 'CONCIERGE', desc: 'White-glove service', highlight: false },
          ].map((t) => {
            const sym = CURRENCY_SYMBOL[currency]
            const price = TIER_PRICES[t.tier][currency]
            const wallet = IMPACT_WALLET_MONTHLY[t.tier][currency]
            const features = t.tier === 'PRO'
              ? ['Daily AI calls + rescue calls', `${sym}${wallet}/month impact wallet`, 'All 4 accountability tracks', 'Full transformation tracking']
              : t.tier === 'ELITE'
              ? ['Everything in Ivy', `${sym}${wallet}/month impact wallet`, 'Ivy Circles group cohort', 'Quarterly peer 1-on-1']
              : ['Everything in Ivy Plus', `${sym}${wallet}/month impact wallet`, 'Pro/celebrity coach circles', 'Personal video impact story']
            return (
              <div key={t.name} className={`rounded-2xl border p-5 transition-all duration-200 ${
                t.highlight
                  ? 'bg-blue-500/5 border-blue-500/25 shadow-lg shadow-blue-500/10'
                  : 'bg-card border-border hover:border-border/80'
              }`}>
                {t.highlight && (
                  <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider mb-2">Most Popular</div>
                )}
                <p className="font-semibold text-sm mb-1">{t.name}</p>
                <p className="text-2xl font-bold tracking-tight mb-1">{sym}{price}<span className="text-sm font-normal text-muted-foreground">/mo</span></p>
                <p className="text-xs text-muted-foreground mb-4">{t.desc}</p>
                <ul className="space-y-2">
                  {features.map(f => (
                    <li key={f} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Check className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )
          })}
        </div>
        <div className="text-center mt-8">
          <Link href="/pricing">
            <Button variant="outline" size="lg">See full comparison <ArrowRight className="w-4 h-4 ml-2" /></Button>
          </Link>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-3xl mx-auto px-4 pb-24">
        <div className="relative rounded-2xl border border-primary/20 bg-primary/5 p-12 text-center overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-emerald-400/5" />
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-6 glow">
              <Leaf className="w-7 h-7 text-primary" />
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Ready to transform?
            </h2>
            <p className="text-muted-foreground text-lg mb-8 max-w-md mx-auto">
              Join hundreds building unshakeable habits while making a real charitable impact.
            </p>
            <Link href="/signup">
              <Button size="xl" variant="glow">
                Try free for 14 days
                <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
            <p className="text-xs text-muted-foreground mt-3">No card required · Real calls from day one</p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="max-w-7xl mx-auto px-4 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Leaf className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium text-gradient">Ivy</span>
          </div>
          <p className="text-sm text-muted-foreground">© 2025 Ivy. All rights reserved.</p>
          <div className="flex items-center gap-1">
            <Shield className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Privacy first</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
