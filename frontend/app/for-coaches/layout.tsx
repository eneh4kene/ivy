/**
 * The coach landing page speaks to a professional buying a tool for their
 * roster, not to a member staking their own money — so it must not inherit the
 * root card.
 */
import type { Metadata } from 'next'

const title = 'Ivy for Coaches'
const description =
  'Ivy rings your clients each evening and tells you who is slipping before they ghost you. Your own invite link, unlimited clients, and they pay their own way.'

export const metadata: Metadata = {
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

export default function ForCoachesLayout({ children }: { children: React.ReactNode }) {
  return children
}
