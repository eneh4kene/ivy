'use client'

import posthog from 'posthog-js'
import { PostHogProvider as PHProvider } from 'posthog-js/react'
import { useEffect } from 'react'

export function PostHogProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST || 'https://app.posthog.com'
    if (!key) return

    posthog.init(key, {
      api_host: host,
      capture_pageview: false, // manual — we control when pages fire
      capture_pageleave: true,
      persistence: 'localStorage',
      autocapture: false, // intentional events only
      session_recording: { maskAllInputs: true }, // GDPR safe
    })
  }, [])

  return <PHProvider client={posthog}>{children}</PHProvider>
}

export { posthog }
