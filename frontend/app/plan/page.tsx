'use client'

/**
 * /plan — the programme a coach set for this user, read-only. Rendered as a
 * nav tab only for users under a coach (BottomNav checks coachId). Areas are
 * written by the coach console or by Ivy applying ponder-call decisions; each
 * carries updatedAt/updatedBy so changes are visible ("updated today · via
 * your coach's ponder call with Ivy").
 */

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { ClipboardList, Sparkles } from 'lucide-react'
import { useAuthStore } from '@/lib/store/auth.store'

function timeAgo(iso?: string): string | null {
  if (!iso) return null
  const then = new Date(iso).getTime()
  if (isNaN(then)) return null
  const days = Math.floor((Date.now() - then) / 86_400_000)
  if (days <= 0) return 'today'
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  const weeks = Math.floor(days / 7)
  return weeks === 1 ? 'a week ago' : `${weeks} weeks ago`
}

export default function PlanPage() {
  const router = useRouter()
  const { user, fetchUser } = useAuthStore()

  // Fresh data on open — programme changes land server-side (coach console,
  // ponder calls) and this surface is where the user goes to see them.
  useEffect(() => {
    fetchUser().catch(() => {})
  }, [fetchUser])

  // Not coached → this tab shouldn't exist for you.
  useEffect(() => {
    if (user && !user.coachId) router.replace('/home')
  }, [user, router])

  if (!user || !user.coachId) return null

  const coachLabel =
    user.coach?.coachProfile?.whitelabelEnabled && user.coach.coachProfile.brandName
      ? user.coach.coachProfile.brandName
      : user.coach?.firstName ?? 'Your coach'
  const programmeName = user.coach?.coachProfile?.programmeName

  const areas = (user.programmeAreas ?? []).slice().sort((a, b) =>
    (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''),
  )

  return (
    <div className="min-h-dvh mesh-bg-subtle pb-24">
      <div className="max-w-lg mx-auto px-4">

        <div className="pt-safe-t pt-6 pb-5">
          <h1 className="font-display text-2xl font-semibold text-ink-50 leading-tight">
            {programmeName ?? 'Your plan'}
          </h1>
          <p className="text-xs text-ink-400 mt-0.5">
            Set by {coachLabel} · Ivy holds you to it every day
          </p>
        </div>

        {areas.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 rounded-2xl bg-ink-700 border border-ink-600 flex items-center justify-center mx-auto mb-4">
              <ClipboardList className="w-6 h-6 text-ink-400" />
            </div>
            <p className="text-sm font-semibold text-ink-200 mb-1">No programme areas yet</p>
            <p className="text-xs text-ink-400 leading-relaxed max-w-xs mx-auto">
              {coachLabel} hasn&rsquo;t set your programme up yet — once they do,
              every area lands here and Ivy starts weaving it into your calls.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {areas.map((a, i) => {
              const ago = timeAgo(a.updatedAt)
              return (
                <div
                  key={a.id}
                  className="rounded-2xl surface p-4 animate-fade-in"
                  style={{ animationDelay: `${i * 40}ms` }}
                >
                  <div className="flex items-center justify-between gap-2 mb-1.5">
                    <p className="text-sm font-semibold text-ink-50">{a.area}</p>
                    {ago && (
                      <span className="flex items-center gap-1 text-2xs text-ink-500 shrink-0">
                        {a.updatedBy === 'ivy' && <Sparkles className="w-3 h-3 text-gold-400/70" />}
                        {ago}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-ink-300 leading-relaxed">{a.instruction}</p>
                </div>
              )
            })}
            <p className="text-center text-2xs text-ink-500 pt-2 leading-relaxed">
              <Sparkles className="w-3 h-3 inline -mt-px text-gold-400/70" /> = adjusted by
              Ivy from {coachLabel}&rsquo;s session notes
            </p>
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  )
}
