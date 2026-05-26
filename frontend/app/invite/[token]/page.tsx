'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { inviteApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Leaf, CheckCircle2, XCircle } from 'lucide-react'

type Info = {
  coachName: string
  programmeName: string
  displayName: string | null
  logoUrl: string | null
}

type PageState = 'loading' | 'ready' | 'submitted' | 'invalid'

export default function InvitePage() {
  const { token } = useParams<{ token: string }>()
  const [state, setState] = useState<PageState>('loading')
  const [info, setInfo] = useState<Info | null>(null)
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    inviteApi.getInfo(token)
      .then((data) => { setInfo(data); setState('ready') })
      .catch(() => setState('invalid'))
  }, [token])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    setSubmitting(true)
    setError('')
    try {
      await inviteApi.join(token, email.trim())
      localStorage.setItem('ivy-invite-token', token)
      setState('submitted')
    } catch (err: any) {
      setError(err.response?.data?.error ?? 'Something went wrong — try again')
    } finally {
      setSubmitting(false)
    }
  }

  const brandName = info?.displayName ?? 'Ivy'
  const logoBlock = info?.logoUrl
    ? <img src={info.logoUrl} alt={brandName} className="h-9" />
    : (
      <div className="flex items-center gap-2.5">
        <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-primary" />
        </div>
        <span className="text-2xl font-bold tracking-tight">{brandName}</span>
      </div>
    )

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative animate-fade-in">
        <div className="flex justify-center mb-10">{state !== 'loading' && logoBlock}</div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/30">

          {state === 'loading' && (
            <div className="flex justify-center py-8">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {state === 'invalid' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-8 h-8 text-destructive" />
              </div>
              <h2 className="text-xl font-bold mb-2">Link not found</h2>
              <p className="text-sm text-muted-foreground">This invite link may have been reset or is invalid. Ask your coach for a fresh one.</p>
            </div>
          )}

          {state === 'ready' && info && (
            <>
              <h2 className="text-xl font-bold tracking-tight mb-1">You've been invited</h2>
              <p className="text-sm text-muted-foreground mb-6">
                <strong className="text-foreground">{info.coachName}</strong> is inviting you to join{' '}
                <strong className="text-foreground">{info.programmeName}</strong> — an accountability programme powered by Ivy.
              </p>
              <form onSubmit={handleJoin} className="space-y-3">
                <Input
                  type="email"
                  placeholder="Your email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
                {error && <p className="text-xs text-destructive">{error}</p>}
                <Button type="submit" className="w-full" disabled={submitting || !email.trim()}>
                  {submitting
                    ? <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                    : 'Get started →'}
                </Button>
              </form>
              <p className="text-xs text-muted-foreground text-center mt-4">
                Already have an Ivy account? Use your existing email — we'll log you in.
              </p>
            </>
          )}

          {state === 'submitted' && (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold mb-2">Check your email</h2>
              <p className="text-sm text-muted-foreground">
                We've sent a link to <strong className="text-foreground">{email}</strong>.
                Click it to {info?.displayName ? `join ${info.displayName}` : 'get started'}.
              </p>
            </div>
          )}

        </div>

        {info?.displayName && (
          <p className="text-center text-xs text-muted-foreground mt-5">
            Powered by <span className="text-foreground font-medium">Ivy</span>
          </p>
        )}
      </div>
    </div>
  )
}
