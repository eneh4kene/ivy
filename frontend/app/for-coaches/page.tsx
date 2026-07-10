'use client'

/**
 * For coaches — the partner pitch. Coaches are distribution: they bring their
 * whole client book. This page speaks to their economics (flat fee, clients
 * pay their own way) and their fear (clients ghosting between sessions).
 * CTA routes into the coach-intent signup (/signup?as=coach).
 */

import Link from 'next/link'
import { ArrowRight, PhoneCall, Bell, Mic, Banknote, Link2, Sparkles } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { HeroVideoBackdrop } from '@/components/marketing/HeroVideoBackdrop'

const WHAT_IVY_DOES = [
  {
    icon: Mic,
    title: 'Works your clients every day',
    desc: 'Morning voice-note commitments, evening settle-ups, their own money staked on showing up. Your programme is the what — Ivy is the every day.',
  },
  {
    icon: Bell,
    title: 'Flags slipping clients before they ghost',
    desc: 'Repeated misses, souring sentiment, gone-quiet patterns — you hear about it while there is still time to save the relationship.',
  },
  {
    icon: PhoneCall,
    title: 'Ponder calls, every two weeks',
    desc: "Ivy rings you with what she's seeing across your book — what clients avoid, what lands — and applies your programme adjustments as you say them.",
  },
  {
    icon: Sparkles,
    title: 'Coaches in your voice',
    desc: 'Your notes, your focus areas, your style — optionally under your own brand. Ivy is your assistant coach, never a replacement.',
  },
  {
    icon: Link2,
    title: 'One link brings your clients in',
    desc: 'Your personal invite link binds every client to you automatically. They experience your programme, amplified.',
  },
  {
    icon: Banknote,
    title: 'Flat £79/month, unlimited clients',
    desc: 'Clients pay for their own Ivy. Your fee never scales with your book — the economics stay yours.',
  },
]

export default function ForCoachesPage() {
  return (
    <div className="theme-vine min-h-screen overflow-hidden">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 border-b border-ink-700/60 bg-ink-900/80 backdrop-blur-xl safe-top">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2">
            <Logo size={28} className="rounded-lg" />
            <span className="font-display text-base font-semibold text-ink-50">Ivy</span>
          </Link>
          <div className="flex items-center gap-2">
            <Link href="/login" className="text-sm text-ink-300 hover:text-ink-50 transition-colors px-3 py-2">
              Sign in
            </Link>
            <Link href="/signup?as=coach">
              <button className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-ink-900 bg-gold-400 hover:bg-gold-300 transition-colors">
                Start coaching <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero — coach-side footage: a trainer actually working a client */}
      <section className="relative pt-28 pb-14 px-4">
        <HeroVideoBackdrop sources={['/videos/hero-coach.mp4']} />
        <div
          className="pointer-events-none absolute top-10 left-1/2 -translate-x-1/2 w-[36rem] h-[36rem] rounded-full opacity-50"
          style={{ background: 'radial-gradient(circle, rgba(70,240,200,0.1) 0%, transparent 70%)' }}
        />
        <div className="max-w-3xl mx-auto text-center relative">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-gold-400/[0.08] border border-gold-400/20 mb-7">
            <span className="w-1.5 h-1.5 rounded-full bg-gold-400 pulse-gold" />
            <span className="font-mono text-[11px] font-medium text-gold-400 uppercase tracking-[0.18em]">For coaches · PTs · practitioners</span>
          </div>

          <h1 className="font-display text-5xl sm:text-6xl text-ink-50 tracking-tight leading-[1.06] mb-6">
            The assistant coach<br />
            <em className="text-gradient-gold">who never sleeps.</em>
          </h1>

          <p className="text-lg text-ink-300 max-w-xl mx-auto mb-6 leading-relaxed">
            You see your clients an hour a week. Ivy works them the other 167 —
            daily commitments in their own voice, real money on the line, and a
            report back to you before anyone ghosts.
          </p>

          <p className="inline-block font-mono text-[11px] uppercase tracking-[0.24em] text-ink-400 border border-ink-600/70 rounded-lg px-3.5 py-2 mb-9">
            Flat £79/mo · unlimited clients · clients pay their own way
          </p>

          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/signup?as=coach">
              <button className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-7 py-4 rounded-2xl font-semibold text-ink-900 bg-gold-400 hover:bg-gold-300 transition-all glow-gold active:scale-[0.98]">
                Start coaching with Ivy <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
            <Link href="/">
              <button className="w-full sm:w-auto px-7 py-4 rounded-2xl font-semibold text-ink-100 border border-ink-600 hover:border-ink-500 hover:bg-ink-800/60 transition-all">
                See the client experience
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* What Ivy does */}
      <section className="max-w-5xl mx-auto px-4 pb-24">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {WHAT_IVY_DOES.map((p) => (
            <div key={p.title} className="rounded-2xl border border-ink-700 bg-ink-800/60 p-6 hover:border-ink-600 transition-colors">
              <div className="w-11 h-11 rounded-xl bg-gold-400/10 flex items-center justify-center mb-4">
                <p.icon className="w-5 h-5 text-gold-400" />
              </div>
              <h3 className="font-display text-lg text-ink-50 mb-2">{p.title}</h3>
              <p className="text-sm text-ink-400 leading-relaxed">{p.desc}</p>
            </div>
          ))}
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
            <Link href="/" className="hover:text-ink-100 transition-colors">For members</Link>
            <Link href="/login" className="hover:text-ink-100 transition-colors">Sign in</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
