/**
 * The link a coach sends their own clients. It is the most-shared URL in the
 * product and it used to unfurl as "put your money where your commitment is" —
 * a stranger's first impression of their coach's recommendation being a demand
 * for money, before anyone had explained anything.
 *
 * Deliberately does not name the coach: the token is in the URL, and resolving
 * it here would leak who coaches whom to anyone the link is forwarded to.
 */
import type { Metadata } from 'next'

const title = 'Join your coach on Ivy'
const description =
  'Your coach uses Ivy to keep the days between sessions honest — a short call each evening to say how it went and what is next.'

export const metadata: Metadata = {
  title,
  description,
  openGraph: {
    title,
    description,
    type: 'website',
    images: [{ url: '/og/invite.png', width: 1200, height: 630, alt: 'Join your coach on Ivy' }],
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
    images: ['/og/invite.png'],
  },
}

export default function InviteLayout({ children }: { children: React.ReactNode }) {
  return children
}
