'use client'

/**
 * pwa-install — app-wide capture of the browser's install prompt.
 *
 * Chrome fires `beforeinstallprompt` ONCE, early in page load. If the only
 * listener lives inside a screen component (as it used to, on /home), the
 * event is missed whenever the user lands anywhere else first — login,
 * onboarding, marketing — and no install UI can ever show. So the capture is
 * module-level: it runs the moment any client bundle imports this file
 * (ServiceWorkerRegister in the root layout does), stashes the event, and
 * notifies subscribers. Any surface — the home banner, the Settings row —
 * can then trigger the real native prompt whenever it wants.
 */

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'ivy_install_dismissed_at'

let deferredEvent: BeforeInstallPromptEvent | null = null
let installedFlag = false
const listeners = new Set<() => void>()

function notify() {
  listeners.forEach((fn) => fn())
}

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    deferredEvent = e as BeforeInstallPromptEvent
    notify()
  })
  window.addEventListener('appinstalled', () => {
    deferredEvent = null
    installedFlag = true
    // A fresh install wipes any old "not now" — if they ever uninstall and
    // come back, the nudge starts clean instead of being silently muted.
    try { localStorage.removeItem(DISMISS_KEY) } catch {}
    notify()
  })
}

export const pwaInstall = {
  /** True when the captured native prompt is ready to fire. */
  canPrompt: () => deferredEvent !== null,
  installedThisSession: () => installedFlag,
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** Fire the real native install sheet. Returns the user's choice. */
  async prompt(): Promise<'accepted' | 'dismissed' | 'unavailable'> {
    if (!deferredEvent) return 'unavailable'
    const ev = deferredEvent
    deferredEvent = null
    notify()
    await ev.prompt()
    const { outcome } = await ev.userChoice
    return outcome
  },
  dismissedRecently(cooldownMs = 14 * 24 * 60 * 60 * 1000): boolean {
    try {
      const ts = Number(localStorage.getItem(DISMISS_KEY) || 0)
      return ts > 0 && Date.now() - ts < cooldownMs
    } catch {
      return false
    }
  },
  markDismissed() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())) } catch {}
  },
}
