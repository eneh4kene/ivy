/**
 * /signup — server shell around the client form, so the shared link previews
 * as what it actually is.
 *
 * Metadata lives here rather than in a layout because the audience is carried
 * in the query string: `?as=coach` is the link a coach is sent, and a layout
 * cannot see searchParams. Sent over WhatsApp, that link used to unfurl as the
 * root card — "Put your money where your commitment is. Follow through — or it
 * goes somewhere you'd hate" — which pitches a coach a consumer staking
 * product he is not being asked to buy.
 */
import type { Metadata } from 'next'
import SignupClient from './signup-client'

export async function generateMetadata(
  { searchParams }: { searchParams: Promise<{ as?: string }> },
): Promise<Metadata> {
  const { as } = await searchParams
  if (as !== 'coach') return {}

  const title = 'Ivy for Coaches'
  const description =
    'Ivy rings your clients each evening and tells you who is slipping before they ghost you. Your own invite link, unlimited clients, and they pay their own way.'
  return {
    title,
    description,
  openGraph: {
    title,
    description,
    type: 'website',
    images: [{ url: '/og/coach.png', width: 1200, height: 630, alt: 'Ivy for Coaches' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og/coach.png'],
  },
  }
}

export default function SignupPage() {
  return <SignupClient />
}
