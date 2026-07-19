import { notFound } from 'next/navigation'

/**
 * /lab is a design-prototype sandbox (mock data, unwired interactions).
 * It exists for local design iteration only — in production it 404s so a
 * stray link can never land a real user in a fake HUD.
 */
export default function LabLayout({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === 'production') notFound()
  return <>{children}</>
}
