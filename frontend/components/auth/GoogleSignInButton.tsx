'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuthStore } from '@/lib/store/auth.store'
import { postLoginDestination } from '@/lib/auth-routing'

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID
const GSI_SRC = 'https://accounts.google.com/gsi/client'

declare global {
  interface Window {
    google?: any
  }
}

interface Props {
  /** Region hint for new SSO accounts (from the signup form). */
  region?: 'GB' | 'US'
  tcpaConsent?: boolean
  /** Coach-intent signup (from /signup?as=coach) — persisted on new accounts. */
  role?: 'coach'
  onError?: (message: string) => void
}

export function GoogleSignInButton({ region, tcpaConsent, role, onError }: Props) {
  const router = useRouter()
  const loginWithGoogle = useAuthStore((s) => s.loginWithGoogle)
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  // Keep the latest opts in a ref so the GIS callback (registered once) always
  // reads current values without re-initializing.
  const optsRef = useRef({ region, tcpaConsent, role })
  optsRef.current = { region, tcpaConsent, role }

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return

    const handleCredential = async (response: { credential?: string }) => {
      if (!response?.credential) {
        onError?.('Google sign-in was cancelled.')
        return
      }
      try {
        const { isNewUser, user } = await loginWithGoogle(response.credential, {
          region: optsRef.current.region,
          tcpaConsent: optsRef.current.tcpaConsent,
          role: optsRef.current.role,
        })
        router.push(postLoginDestination(user, isNewUser))
      } catch (err: any) {
        onError?.(err?.message || 'Could not sign in with Google. Please try again.')
      }
    }

    const init = () => {
      if (!window.google?.accounts?.id || !containerRef.current) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleCredential,
      })
      window.google.accounts.id.renderButton(containerRef.current, {
        theme: 'outline',
        size: 'large',
        text: 'continue_with',
        shape: 'pill',
        logo_alignment: 'center',
        width: containerRef.current.clientWidth || 300,
      })
      setReady(true)
    }

    // Load the GIS script once, then init.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GSI_SRC}"]`)
    if (existing && window.google?.accounts?.id) {
      init()
    } else if (existing) {
      existing.addEventListener('load', init, { once: true })
    } else {
      const script = document.createElement('script')
      script.src = GSI_SRC
      script.async = true
      script.defer = true
      script.addEventListener('load', init, { once: true })
      document.head.appendChild(script)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!GOOGLE_CLIENT_ID) return null

  return (
    <div className="w-full">
      <div ref={containerRef} className="flex justify-center w-full" />
      {!ready && (
        <div className="h-10 w-full rounded-full bg-muted/40 animate-pulse" />
      )}
    </div>
  )
}
