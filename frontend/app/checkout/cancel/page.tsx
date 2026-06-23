'use client'

import Link from 'next/link'
import { X, ArrowRight } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

export default function CheckoutCancelPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center animate-fade-in">
        <div className="flex justify-center mb-6">
          <Logo size={56} />
        </div>

        <div className="mx-auto w-16 h-16 rounded-full bg-ink-700/60 border border-ink-600 flex items-center justify-center mb-6">
          <X className="w-7 h-7 text-ink-400" strokeWidth={2.5} />
        </div>

        <h1 className="font-display text-2xl text-ink-50 tracking-tight">Checkout cancelled</h1>
        <p className="mt-3 text-sm text-ink-400 leading-relaxed">
          No charge was made. Your stake only ever counts when you choose to put it
          on the line — pick up where you left off whenever you&apos;re ready.
        </p>

        <Link href="/pricing" className="block mt-8">
          <button className="w-full py-3.5 rounded-2xl bg-gold-400 text-ink-900 font-semibold text-sm hover:bg-gold-300 transition-colors flex items-center justify-center gap-2">
            Try again <ArrowRight className="w-4 h-4" />
          </button>
        </Link>
        <Link href="/home" className="block mt-3">
          <button className="w-full py-3.5 rounded-2xl text-sm text-ink-400 hover:text-ink-200 transition-colors">
            Back to home
          </button>
        </Link>
      </div>
    </div>
  )
}
