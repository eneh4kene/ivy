'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'
import { circlesApi } from '@/lib/api'
import { Users, Target, TrendingUp, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function IvyCircleSetupStep() {
  const { user } = useAuthStore()
  const [circles, setCircles] = useState<any[]>([])
  const [seasonTheme, setSeasonTheme] = useState('')
  const [sprintPledge, setSprintPledge] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    circlesApi.getMy()
      .then(setCircles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  const primaryCircle = circles[0]?.circle ?? null

  const handleSave = async () => {
    if (!primaryCircle) return
    setSaving(true)
    try {
      const promises = []
      if (seasonTheme.trim()) {
        promises.push(circlesApi.update(primaryCircle.id, { seasonTheme: seasonTheme.trim() }))
      }
      if (sprintPledge.trim()) {
        promises.push(circlesApi.setSprintGoal(primaryCircle.id, {
          sprintNumber: 1,
          pledge: sprintPledge.trim(),
          theme: 'Sprint 1',
        }))
      }
      await Promise.all(promises)
      setSaved(true)
    } catch (e) {
      console.error(e)
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-16 rounded-xl bg-muted/40 animate-pulse" />)}</div>
  }

  return (
    <div className="space-y-6">

      {primaryCircle ? (
        // User has been assigned to a Circle
        <div className="space-y-5">
          <div className="flex items-center gap-3 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/5">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <p className="text-sm font-semibold">{primaryCircle.name}</p>
              <p className="text-xs text-muted-foreground">
                {primaryCircle.members?.length ?? 0} members · {primaryCircle.track} track
              </p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              What's your Circle's season theme?
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              A shared name that gives your group identity. Optional — your group can set this together.
            </p>
            <input
              type="text"
              placeholder="e.g. Operation Ironman, The Comeback Season..."
              value={seasonTheme}
              onChange={(e) => setSeasonTheme(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">
              What's your group's Sprint 1 pledge?
            </label>
            <p className="text-xs text-muted-foreground mb-2">
              A collective commitment your Circle holds each other to this sprint.
            </p>
            <input
              type="text"
              placeholder="e.g. We all hit 80% consistency, We train at least 4 days a week..."
              value={sprintPledge}
              onChange={(e) => setSprintPledge(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {(seasonTheme || sprintPledge) && !saved && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-medium"
            >
              {saving ? 'Saving...' : 'Set Circle Goals'}
            </Button>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Circle goals set — Ivy will reference these in every call
            </div>
          )}
        </div>
      ) : (
        // Not yet matched to a Circle
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ivy Circles are groups of 6–8 people on the same track, matched by consistency score.
            Your Circle stays together for a full season — three sprints, twelve weeks.
          </p>

          <div className="space-y-3">
            {[
              { icon: Users, title: 'Sprint sessions', desc: 'One group session at the end of each sprint — wins, honest round, data review, next sprint pledge.' },
              { icon: Target, title: 'Shared season theme', desc: 'Your Circle names the season. Ivy references it in every individual call.' },
              { icon: TrendingUp, title: 'Group consistency', desc: 'Ivy tells you where you stand relative to your group — motivating without being punishing.' },
            ].map(({ icon: Icon, title, desc }) => (
              <div key={title} className="flex items-start gap-3 p-4 rounded-xl border border-border">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium">{title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          <div className="px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800 text-xs text-zinc-400 leading-relaxed">
            You'll be matched to a Circle within 24 hours of your first season starting. Ivy will notify you when your group is ready.
          </div>
        </div>
      )}
    </div>
  )
}
