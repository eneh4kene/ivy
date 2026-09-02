/**
 * Everything under /coach — activation and the console. Same reason as
 * /for-coaches: a coach following a link should never see the member pitch.
 */
import type { Metadata } from 'next'

const title = 'Ivy for Coaches'
const description =
  'Ivy rings your clients each evening and tells you who is slipping before they ghost you. Your own invite link, unlimited clients, and they pay their own way.'

export const metadata: Metadata = { title, description, openGraph: { title, description, type: 'website' } }

export default function CoachLayout({ children }: { children: React.ReactNode }) {
  return children
}
