'use client'

/**
 * InstallPrompt — a lightweight, dismissible "install Ivy" banner shown on the
 * consumer hub. Ivy is a stake/commitment app whose whole loop depends on a
 * daily morning reminder, and reminders are far more reliable from an installed
 * PWA — so we nudge install once the user is in the product.
 *
 * Two paths:
 *   - Android / desktop Chrome: capture the `beforeinstallprompt` event and show
 *     a one-tap Install button that triggers the native prompt.
 *   - iOS Safari: there's no programmatic install, so show an instruction sheet
 *     (Share → Add to Home Screen).
 *
 * Hidden when already installed (standalone) or recently dismissed (14-day
 * cooldown in localStorage).
 */

import { useEffect, useState } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'
import { isIOSSafari, isStandalone } from '@/lib/pwa'

const DISMISS_KEY = 'ivy_install_dismissed_at'
const COOLDOWN_MS = 14 * 24 * 60 * 60 * 1000 // 14 days

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

function recentlyDismissed(): boolean {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return ts > 0 && Date.now() - ts < COOLDOWN_MS
  } catch {
    return false
  }
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)
  const [iosSheet, setIosSheet] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (isStandalone() || recentlyDismissed()) return

    // Android / desktop Chrome: stash the event, show the Install button.
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
      setVisible(true)
    }
    window.addEventListener('beforeinstallprompt', onBeforeInstall)

    // iOS Safari: no event fires, so surface the manual instructions.
    if (isIOSSafari()) setVisible(true)

    // Hide for good once installed.
    const onInstalled = () => setVisible(false)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
    setVisible(false)
    setIosSheet(false)
  }

  const handleInstall = async () => {
    if (deferred) {
      await deferred.prompt()
      const { outcome } = await deferred.userChoice
      setDeferred(null)
      if (outcome === 'accepted') setVisible(false)
      else dismiss()
      return
    }
    // No native prompt (iOS) — open the instruction sheet.
    setIosSheet(true)
  }

  if (!visible) return null

  return (
    <>
      {/* Slim bottom banner */}
      <div
        className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 pointer-events-none"
      >
        <div className="pointer-events-auto max-w-lg mx-auto glass-gold rounded-2xl px-4 py-3 flex items-center gap-3 shadow-2xl shadow-black/40">
          <div className="w-9 h-9 rounded-xl bg-gold-400/15 flex items-center justify-center shrink-0">
            <Download className="w-4 h-4 text-gold-300" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-ink-50">Install Ivy</p>
            <p className="text-2xs text-ink-400 truncate">Add to your Home Screen for daily reminders</p>
          </div>
          <button
            onClick={handleInstall}
            className="shrink-0 px-3.5 py-2 rounded-xl text-xs font-semibold text-ink-900 bg-gold-400 hover:bg-gold-300 transition-colors active:scale-95"
          >
            Install
          </button>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 w-7 h-7 rounded-lg flex items-center justify-center text-ink-500 hover:text-ink-200 hover:bg-ink-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* iOS instruction sheet */}
      {iosSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
          onClick={dismiss}
        >
          <div
            className="w-full max-w-lg surface rounded-3xl p-5 space-y-4 page-enter"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <p className="text-base font-semibold text-ink-50">Add Ivy to your Home Screen</p>
              <button
                onClick={dismiss}
                aria-label="Close"
                className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:text-ink-200 hover:bg-ink-700 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <ol className="space-y-3 text-sm text-ink-200">
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">1</span>
                Tap the <Share className="w-4 h-4 inline text-periwinkle-400" /> Share button in Safari's toolbar
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">2</span>
                Scroll down and tap <span className="text-ink-50 font-medium">Add to Home Screen</span> <Plus className="w-4 h-4 inline text-ink-300" />
              </li>
              <li className="flex items-center gap-3">
                <span className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">3</span>
                Tap <span className="text-ink-50 font-medium">Add</span>, then open Ivy from your Home Screen
              </li>
            </ol>
          </div>
        </div>
      )}
    </>
  )
}
