'use client'

/**
 * Route-level error boundary. Without this, an unhandled render error anywhere
 * under the app shows Next.js's opaque "Application error: a client-side
 * exception has occurred" with no message — impossible to diagnose remotely.
 *
 * This surfaces the actual error text + digest, and offers a "hard reset" that
 * clears the PWA service worker + caches before reloading. A stale service
 * worker serving old chunk hashes after a deploy is a common cause of a
 * client-side exception on the first client-side navigation (e.g. the post-SSO
 * router.push), so the reset path addresses that directly.
 */

import { useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Route error boundary caught:', error)
  }, [error])

  const hardReset = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations()
        await Promise.all(regs.map((r) => r.unregister()))
      }
      if (typeof caches !== 'undefined') {
        const keys = await caches.keys()
        await Promise.all(keys.map((k) => caches.delete(k)))
      }
    } catch {
      // ignore — best-effort cleanup
    } finally {
      window.location.href = '/home'
    }
  }

  const isChunkError = /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module/i.test(
    `${error?.name} ${error?.message}`,
  )

  return (
    <div className="theme-arcade min-h-[100dvh] bg-background flex items-center justify-center p-6">
      <div className="w-full max-w-sm text-center">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-ember-400/10 border border-ember-400/25 flex items-center justify-center mb-5">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="font-display text-xl text-ink-50 tracking-tight mb-2">Something broke</h1>
        <p className="text-sm text-ink-400 leading-relaxed mb-4">
          {isChunkError
            ? 'The app updated since this tab loaded. A quick refresh pulls the new version.'
            : 'An unexpected error stopped the page from loading.'}
        </p>

        {/* The real error text — this is what makes remote diagnosis possible. */}
        <pre className="text-left text-2xs text-ember-300 bg-ink-900/60 border border-ink-700 rounded-xl p-3 mb-5 overflow-auto max-h-40 whitespace-pre-wrap break-words">
          {error?.message || 'Unknown error'}
          {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
        </pre>

        <div className="space-y-2">
          <button
            onClick={() => reset()}
            className="w-full py-3.5 rounded-2xl bg-gold-400 text-ink-900 font-semibold text-sm hover:bg-gold-300 transition-colors"
          >
            Try again
          </button>
          <button
            onClick={hardReset}
            className="w-full py-3 rounded-2xl text-sm text-ink-300 surface hover:bg-ink-700 transition-colors"
          >
            Clear cache &amp; reload
          </button>
        </div>
      </div>
    </div>
  )
}
