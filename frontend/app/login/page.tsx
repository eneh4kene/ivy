'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuthStore } from '@/lib/store/auth.store'
import { Leaf, ArrowRight, Mail, AlertCircle, CheckCircle2 } from 'lucide-react'

export default function LoginPage() {
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [emailSent, setEmailSent] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      await login(email)
      setEmailSent(true)
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background mesh-bg flex items-center justify-center p-4">
      {/* Background glow */}
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
              <div className="mb-8">
                <h1 className="text-2xl font-bold tracking-tight mb-1.5">Welcome back</h1>
                <p className="text-sm text-muted-foreground">Enter your email to receive a sign-in link</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
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
                  disabled={isLoading || !email}
                >
                  {isLoading ? (
                    <span className="flex items-center gap-2">
                      <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      Sending link…
                    </span>
                  ) : (
                    <span className="flex items-center gap-2">
                      Send magic link
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  )}
                </Button>
              </form>

              <p className="text-center text-sm text-muted-foreground mt-6">
                Don&apos;t have an account?{' '}
                <Link href="/login" className="text-primary hover:underline font-medium">
                  Sign up free
                </Link>
              </p>
            </>
          ) : (
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary/15 border border-primary/25 flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold tracking-tight mb-2">Check your inbox</h2>
              <p className="text-sm text-muted-foreground mb-1">
                We sent a sign-in link to
              </p>
              <p className="text-sm font-semibold text-foreground mb-6 break-all">{email}</p>

              <div className="p-4 rounded-xl bg-muted/50 border border-border text-xs text-muted-foreground space-y-1.5 mb-6 text-left">
                <p>✓ Click the link in your email to sign in</p>
                <p>✓ The link expires in 15 minutes</p>
                <p>✓ Check your spam if you don't see it</p>
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => { setEmailSent(false); setEmail('') }}
              >
                Use a different email
              </Button>
            </div>
          )}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to home
          </Link>
        </p>
      </div>
    </div>
  )
}
