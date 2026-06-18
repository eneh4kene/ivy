'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { usersApi, authApi } from '@/lib/api'
import { GoogleSignInButton } from '@/components/auth/GoogleSignInButton'
import { Leaf, ArrowRight, Mail, AlertCircle, CheckCircle2, Sparkles } from 'lucide-react'
import type { Currency } from '@/lib/pricing'

type Region = 'GB' | 'US'

function SignupForm() {
  const searchParams = useSearchParams()
  const promoCode = searchParams.get('promo') ?? undefined
  const plan = searchParams.get('plan') ?? undefined

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [region, setRegion] = useState<Region>('GB')
  const [tcpaConsent, setTcpaConsent] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const currency: Currency = region === 'US' ? 'USD' : 'GBP'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (region === 'US' && !tcpaConsent) {
      setError('TCPA consent is required for US users.')
      return
    }

    setIsLoading(true)
    try {
      // Create user account
      await usersApi.createUser({
        firstName,
        lastName,
        email,
        track: 'fitness',
        goal: '',
        region,
        currency,
        ...(region === 'US' && { tcpaConsent }),
      })
      // Send magic link with promo code and plan if present
      await authApi.sendMagicLink({ email, promoCode, plan })
      setEmailSent(true)
    } catch (err: any) {
      // If user already exists (conflict), just send a magic link
      if (err?.response?.status === 409 || err?.message?.toLowerCase().includes('already exists')) {
        try {
          await authApi.sendMagicLink({ email, promoCode, plan })
          setEmailSent(true)
          return
        } catch (linkErr: any) {
          setError(linkErr.message || 'Something went wrong. Please try again.')
          return
        }
      }
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background mesh-bg flex items-center justify-center p-4">
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-primary/8 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-sm relative animate-fade-in">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-10">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center glow-sm">
            <Leaf className="w-5 h-5 text-primary" />
          </div>
          <span className="text-2xl font-bold tracking-tight text-gradient">Ivy</span>
        </div>

        {/* Card */}
        <div className="bg-card border border-border rounded-2xl p-8 shadow-2xl shadow-black/30">
          {!emailSent ? (
            <>
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-xs font-medium text-primary uppercase tracking-wider">Free to start</span>
                </div>
                <h1 className="text-2xl font-bold tracking-tight mb-1.5">Create your account</h1>
                <p className="text-sm text-muted-foreground">Enter your details and we'll send you a sign-up link — no password needed</p>
                {promoCode && (
                  <div className="mt-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-primary/10 border border-primary/20">
                    <Sparkles className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                    <span className="text-xs text-primary font-medium">Promo code <strong>{promoCode}</strong> will be applied at checkout</span>
                  </div>
                )}
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Name */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">First name</label>
                    <Input
                      placeholder="Jane"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-foreground/80">Last name</label>
                    <Input
                      placeholder="Smith"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      required
                      disabled={isLoading}
                    />
                  </div>
                </div>

                {/* Email */}
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-sm font-medium text-foreground/80">
                    Email address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={isLoading}
                      autoComplete="email"
                    />
                  </div>
                </div>

                {/* Region selector */}
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-foreground/80">Your region</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setRegion('GB')}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        region === 'GB'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:border-border/80'
                      }`}
                    >
                      🇬🇧 United Kingdom
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRegion('US'); setTcpaConsent(false) }}
                      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                        region === 'US'
                          ? 'border-primary bg-primary/10 text-foreground'
                          : 'border-border bg-transparent text-muted-foreground hover:border-border/80'
                      }`}
                    >
                      🇺🇸 United States
                    </button>
                  </div>
                </div>

                {/* TCPA consent (US only) */}
                {region === 'US' && (
                  <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      required
                      className="mt-0.5 flex-shrink-0"
                      checked={tcpaConsent}
                      onChange={e => setTcpaConsent(e.target.checked)}
                    />
                    <span>
                      I consent to receive automated AI phone calls from Ivy as part of my accountability programme.
                      I understand these calls will be made using automated technology and I can opt out at any time.{' '}
                      <span className="text-foreground">Required for US users under TCPA.</span>
                    </span>
                  </label>
                )}

                {error && (
                  <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-destructive/8 border border-destructive/20 text-sm text-destructive">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <span>{error}</span>
                  </div>
                )}

                <Button
                  type="submit"
                  className="w-full mt-2"
                  size="lg"
                  disabled={isLoading || !email || !firstName || !lastName || (region === 'US' && !tcpaConsent)}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Creating account…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Get started free
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>

                <p className="text-xs text-muted-foreground text-center pt-1">
                  By signing up you agree to our{' '}
                  <a href="/terms" className="underline underline-offset-2 hover:text-foreground transition-colors">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" className="underline underline-offset-2 hover:text-foreground transition-colors">Privacy Policy</a>.
                  No credit card required.
                </p>
              </form>

              <div className="flex items-center gap-3 my-6">
                <div className="h-px flex-1 bg-border" />
                <span className="text-xs text-muted-foreground uppercase tracking-wider">or</span>
                <div className="h-px flex-1 bg-border" />
              </div>

              <GoogleSignInButton region={region} tcpaConsent={tcpaConsent} onError={setError} />

              <p className="text-center text-sm text-muted-foreground mt-6">
                Already have an account?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign in
                </Link>
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">Check your inbox</h2>
              <p className="text-sm text-muted-foreground mb-1">We sent your sign-up link to</p>
              <p className="text-sm font-semibold text-foreground mb-6 break-all">{email}</p>

              <div className="p-4 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground space-y-1.5 mb-6 text-left">
                <p>Click the link in your email to create your account</p>
                <p>The link expires in 15 minutes</p>
                <p>Check your spam if you don't see it</p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setEmailSent(false); setEmail(''); setFirstName(''); setLastName('') }}
              >
                Use a different email
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/" className="hover:text-foreground transition-colors">
            Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function SignupPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <SignupForm />
    </Suspense>
  )
}
