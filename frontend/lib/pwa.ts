'use client'

/**
 * Small client-only helpers for PWA install / display-mode detection.
 *
 * These gate the install prompt (lib → components/pwa/InstallPrompt) and the
 * post-stake "enable notifications" card: on iOS, web push only works once the
 * app has been added to the Home Screen (standalone display mode), so the UX
 * branches on whether we're already installed.
 */

/** True when running as an installed PWA (standalone), not a browser tab. */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    // iOS Safari exposes this non-standard flag when launched from Home Screen.
    (window.navigator as any).standalone === true
  )
}

/** True on iPhone / iPad / iPod (incl. iPadOS, which masquerades as Mac). */
export function isIOS(): boolean {
  if (typeof window === 'undefined') return false
  const ua = window.navigator.userAgent
  const iOSDevice = /iphone|ipad|ipod/i.test(ua)
  // iPadOS 13+ reports as "Macintosh" but is touch-capable.
  const iPadOS = /Macintosh/i.test(ua) && navigator.maxTouchPoints > 1
  return iOSDevice || iPadOS
}

/** True on Safari (the only iOS browser engine that can install to Home Screen). */
export function isIOSSafari(): boolean {
  if (!isIOS()) return false
  const ua = window.navigator.userAgent
  // Exclude in-app browsers / Chrome-iOS (CriOS) / Firefox-iOS (FxiOS) which
  // can't add to Home Screen.
  return !/crios|fxios|edgios/i.test(ua)
}
