'use client'

import { useEffect } from 'react'
// Side-effect import: installs the app-wide beforeinstallprompt capture the
// moment the root layout hydrates, so the install event is never missed no
// matter which page the user lands on. See lib/pwa-install.ts.
import '@/lib/pwa-install'

/**
 * Registers the PWA service worker on the client.
 *
 * next-pwa@5's `register: true` only injects an auto-registration script into the
 * Pages Router's _app — which this App Router app does not have — so the SW is
 * built and served at /sw.js but was never actually registered in the browser.
 * That silently disabled offline support, installability, and push (the push
 * hooks await `navigator.serviceWorker.ready`, which never resolved). This
 * component performs the registration that next-pwa would otherwise inject.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!('serviceWorker' in navigator)) return
    // next-pwa disables the SW in development; don't register a stale one locally.
    if (process.env.NODE_ENV === 'development') return

    const register = () => {
      navigator.serviceWorker.register('/sw.js').catch((err) => {
        // Surface but don't crash the app if registration fails.
        console.error('[pwa] service worker registration failed', err)
      })
    }

    if (document.readyState === 'complete') {
      register()
    } else {
      window.addEventListener('load', register, { once: true })
      return () => window.removeEventListener('load', register)
    }
  }, [])

  return null
}
