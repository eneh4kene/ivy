'use client'

/**
 * Root-level error boundary — catches errors thrown in the root layout itself
 * (where app/error.tsx can't reach). Must render its own <html>/<body>.
 * Surfaces the real error text so a production "client-side exception" is
 * diagnosable instead of opaque.
 */

import { useEffect } from 'react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error('Global error boundary caught:', error)
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
      /* best-effort */
    } finally {
      window.location.href = '/home'
    }
  }

  return (
    <html lang="en">
      <body style={{ margin: 0, background: '#0b0b0f', color: '#e7e7ea', fontFamily: 'system-ui, sans-serif' }}>
        <div style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
          <div style={{ maxWidth: 360, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 28, marginBottom: 12 }}>⚠️</div>
            <h1 style={{ fontSize: 20, margin: '0 0 8px' }}>Something broke</h1>
            <p style={{ fontSize: 14, color: '#9a9aa2', margin: '0 0 16px' }}>
              An unexpected error stopped the app from loading.
            </p>
            <pre
              style={{
                textAlign: 'left',
                fontSize: 11,
                color: '#f0a',
                background: '#15151b',
                border: '1px solid #2a2a33',
                borderRadius: 12,
                padding: 12,
                marginBottom: 16,
                overflow: 'auto',
                maxHeight: 160,
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {error?.message || 'Unknown error'}
              {error?.digest ? `\n\ndigest: ${error.digest}` : ''}
            </pre>
            <button
              onClick={() => reset()}
              style={{ width: '100%', padding: '14px', borderRadius: 16, border: 0, background: '#ccA348', color: '#1a1a1f', fontWeight: 600, fontSize: 14, marginBottom: 8, cursor: 'pointer' }}
            >
              Try again
            </button>
            <button
              onClick={hardReset}
              style={{ width: '100%', padding: '12px', borderRadius: 16, border: '1px solid #2a2a33', background: 'transparent', color: '#bdbdc4', fontSize: 14, cursor: 'pointer' }}
            >
              Clear cache &amp; reload
            </button>
          </div>
        </div>
      </body>
    </html>
  )
}
