'use client'

/**
 * EnablePushCard — the "turn on morning reminders" step shown right after a
 * stake is armed (StakeSetupScreen → DoneScreen). The whole stake loop hinges
 * on the user arming each morning, so a push reminder is the highest-leverage
 * thing to enable at this exact moment.
 *
 * Branches:
 *   - iOS in a browser tab → push is impossible until the app is on the Home
 *     Screen, so we show Add-to-Home-Screen instructions instead of a dead button.
 *   - already subscribed → quiet confirmation.
 *   - permission denied → tell them to re-enable in browser settings.
 *   - otherwise → the enable button (calls Notification.requestPermission()).
 */

import { useState } from 'react'
import { Bell, BellRing, Share, Plus, Check } from 'lucide-react'
import { usePushNotifications } from '@/hooks/usePushNotifications'
import { isIOS, isStandalone } from '@/lib/pwa'

export function EnablePushCard() {
  const { permission, isSubscribed, isLoading, subscribe } = usePushNotifications()
  // Snapshot install state once on mount (these don't change without a reload).
  const [iosTab] = useState(() => isIOS() && !isStandalone())

  // Already on — quiet confirmation, no action needed.
  if (isSubscribed && permission === 'granted') {
    return (
      <div className="surface rounded-2xl px-4 py-3 flex items-center gap-3 w-full">
        <div className="w-9 h-9 rounded-xl bg-sage-400/12 flex items-center justify-center shrink-0">
          <Check className="w-4 h-4 text-sage-400" />
        </div>
        <p className="text-sm text-ink-200">
          Morning reminders are <span className="text-sage-400 font-medium">on</span>. We'll nudge you to arm each day.
        </p>
      </div>
    )
  }

  // iOS browser tab — push only works once installed to the Home Screen.
  if (iosTab) {
    return (
      <div className="glass rounded-2xl p-4 space-y-3 w-full text-left">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gold-400/12 flex items-center justify-center shrink-0">
            <Bell className="w-4 h-4 text-gold-300" />
          </div>
          <p className="text-sm font-medium text-ink-50">Get your morning reminder</p>
        </div>
        <p className="text-xs text-ink-300 leading-relaxed">
          On iPhone, add Ivy to your Home Screen to receive daily arming reminders:
        </p>
        <ol className="space-y-2 text-xs text-ink-200">
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">1</span>
            Tap the <Share className="w-3.5 h-3.5 inline text-periwinkle-400" /> Share button in Safari
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">2</span>
            Choose <span className="text-ink-50 font-medium">Add to Home Screen</span> <Plus className="w-3.5 h-3.5 inline text-ink-300" />
          </li>
          <li className="flex items-center gap-2">
            <span className="w-5 h-5 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">3</span>
            Open Ivy from your Home Screen, then turn on reminders
          </li>
        </ol>
      </div>
    )
  }

  // Denied — can't re-prompt programmatically; point them at browser settings.
  if (permission === 'denied') {
    return (
      <div className="surface rounded-2xl px-4 py-3 flex items-start gap-3 w-full text-left">
        <div className="w-9 h-9 rounded-xl bg-ink-700 flex items-center justify-center shrink-0">
          <Bell className="w-4 h-4 text-ink-400" />
        </div>
        <p className="text-xs text-ink-300 leading-relaxed">
          Notifications are blocked. To get your morning reminder, enable notifications
          for Ivy in your browser settings.
        </p>
      </div>
    )
  }

  // Default path — the enable button.
  return (
    <button
      onClick={subscribe}
      disabled={isLoading || permission === 'unsupported'}
      className="w-full glass-gold rounded-2xl px-4 py-3.5 flex items-center gap-3 text-left hover:bg-gold-400/10 transition-all active:scale-[0.98] disabled:opacity-60"
    >
      <div className="w-9 h-9 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
        {isLoading
          ? <span className="w-4 h-4 rounded-full border-2 border-gold-300/40 border-t-gold-300 animate-spin" />
          : <BellRing className="w-4 h-4 text-gold-300" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink-50">Turn on morning reminders</p>
        <p className="text-2xs text-ink-400 mt-0.5">
          {permission === 'unsupported'
            ? 'Not supported on this browser'
            : "We'll nudge you to arm before your deadline"}
        </p>
      </div>
    </button>
  )
}
