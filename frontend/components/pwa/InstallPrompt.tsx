'use client'

/**
 * InstallPrompt — a lightweight, dismissible "install Ivy" banner shown on the
 * consumer hub, plus the shared pieces (hook + iOS sheet) that power the
 * permanent "Install the app" row in Settings.
 *
 * The `beforeinstallprompt` event itself is captured app-wide in
 * lib/pwa-install.ts (module-level, imported from the root layout) — this
 * component only *consumes* it. That fixes the old failure mode where the
 * event fired while the user was on /login and the /home-mounted listener
 * missed it forever.
 *
 * Paths:
 *   - Android / desktop Chrome: one-tap Install → real native sheet.
 *   - iOS Safari: no programmatic install — instruction sheet (Share → Add
 *     to Home Screen).
 *
 * Banner hides when installed (standalone) or dismissed (14-day cooldown,
 * cleared automatically on any successful install so a later uninstall
 * starts fresh). The Settings row ignores the cooldown entirely.
 */

import { useEffect, useState, useSyncExternalStore } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'
import { isIOSSafari, isStandalone } from '@/lib/pwa'
import { pwaInstall } from '@/lib/pwa-install'

/** Reactive view of the app-wide install state. */
export function usePwaInstall() {
  const canPrompt = useSyncExternalStore(
    pwaInstall.subscribe,
    () => pwaInstall.canPrompt(),
    () => false,
  )
  const installed = useSyncExternalStore(
    pwaInstall.subscribe,
    () => pwaInstall.installedThisSession(),
    () => false,
  )
  return { canPrompt, installed, prompt: pwaInstall.prompt }
}

/** iOS "Add to Home Screen" instruction sheet — shared by banner + Settings. */
export function IosInstallSheet({ onClose }: { onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm px-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg surface rounded-3xl p-5 space-y-4 page-enter"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <p className="text-base font-semibold text-ink-50">Add Ivy to your Home Screen</p>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg flex items-center justify-center text-ink-500 hover:text-ink-200 hover:bg-ink-700 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <ol className="space-y-3 text-sm text-ink-200">
          <li className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">1</span>
            <span>Tap the <Share className="w-4 h-4 inline text-gold-300" /> Share button in Safari&apos;s toolbar</span>
          </li>
          <li className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">2</span>
            <span>Scroll down and tap <span className="text-ink-50 font-medium">Add to Home Screen</span> <Plus className="w-4 h-4 inline text-ink-300" /></span>
          </li>
          <li className="flex items-center gap-3">
            <span className="w-6 h-6 rounded-full bg-ink-700 flex items-center justify-center text-2xs font-bold text-ink-300 shrink-0">3</span>
            <span>Tap <span className="text-ink-50 font-medium">Add</span>, then open Ivy from your Home Screen</span>
          </li>
        </ol>
      </div>
    </div>
  )
}

export function InstallPrompt() {
  const { canPrompt } = usePwaInstall()
  const [iosSheet, setIosSheet] = useState(false)
  const [hidden, setHidden] = useState(false)
  const [eligible, setEligible] = useState(false)

  // Client-only eligibility (standalone/dismissal read browser state).
  useEffect(() => {
    setEligible(!isStandalone() && !pwaInstall.dismissedRecently())
  }, [])

  const visible = eligible && !hidden && (canPrompt || isIOSSafari())

  const dismiss = () => {
    pwaInstall.markDismissed()
    setHidden(true)
    setIosSheet(false)
  }

  const handleInstall = async () => {
    const outcome = await pwaInstall.prompt()
    if (outcome === 'accepted') { setHidden(true); return }
    if (outcome === 'dismissed') { dismiss(); return }
    // No native prompt available (iOS) — show the manual instructions.
    setIosSheet(true)
  }

  if (!visible && !iosSheet) return null

  return (
    <>
      {visible && (
        <div className="fixed inset-x-0 bottom-0 z-40 px-3 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3 pointer-events-none">
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
      )}

      {iosSheet && <IosInstallSheet onClose={dismiss} />}
    </>
  )
}
