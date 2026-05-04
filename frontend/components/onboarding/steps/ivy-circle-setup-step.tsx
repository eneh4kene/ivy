'use client'

import { useState, useEffect } from 'react'
import { useAuthStore } from '@/lib/store/auth.store'
import { circlesApi, usersApi } from '@/lib/api'
import { Users, User, Target, TrendingUp, CheckCircle2 } from 'lucide-react'
import { Button } from '@/components/ui/button'

export function IvyCircleSetupStep() {
  const { user } = useAuthStore()
  const [optIn, setOptIn] = useState<boolean | null>(null)
  const [circles, setCircles] = useState<any[]>([])
  const [seasonTheme, setSeasonTheme] = useState('')
  const [sprintPledge, setSprintPledge] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.circleOptIn !== undefined) setOptIn(user.circleOptIn)
    circlesApi.getMy()
      .then(setCircles)
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  const primaryCircle = circles[0]?.circle ?? null

  const handleOptInChoice = async (choice: boolean) => {
    setOptIn(choice)
    try {
      await usersApi.updateProfile({ circleOptIn: choice })
    } catch (e) {
      console.error(e)
    }
  }

  const handleSaveGoals = async () => {
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
    return <div className="space-y-3">{[1,2].map(i => <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />)}</div>
  }

  // Step 1 — opt-in question (shown if no choice made yet)
  if (optIn === null) {
    return (
      <div className="space-y-5">
        <p className="text-sm text-muted-foreground leading-relaxed">
          An Ivy Circle is a group of 6–8 people on your track, matched by consistency score.
          Your Circle stays together for a full season — three sprints, twelve weeks.
          At the end of each sprint you meet, review, and set the next collective pledge together.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div
            onClick={() => handleOptInChoice(true)}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border hover:border-emerald-500/50 hover:bg-emerald-500/5 cursor-pointer transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <Users className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">Match me to a Circle</p>
              <p className="text-xs text-muted-foreground mt-0.5">I want the group</p>
            </div>
          </div>

          <div
            onClick={() => handleOptInChoice(false)}
            className="flex flex-col items-center gap-3 p-5 rounded-xl border border-border hover:border-border/80 hover:bg-accent/20 cursor-pointer transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center">
              <User className="w-5 h-5 text-muted-foreground" />
            </div>
            <div className="text-center">
              <p className="text-sm font-semibold">I'll go solo</p>
              <p className="text-xs text-muted-foreground mt-0.5">Not right now</p>
            </div>
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          You can change this any time in settings.
        </p>
      </div>
    )
  }

  // Opted out
  if (!optIn) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3 p-4 rounded-xl border border-border bg-muted/20">
          <User className="w-5 h-5 text-muted-foreground shrink-0" />
          <div>
            <p className="text-sm font-medium">Going solo</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Your daily calls, streak, and season are all yours. You can join a Circle from Settings whenever you're ready.
            </p>
          </div>
        </div>
        <button
          onClick={() => handleOptInChoice(true)}
          className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
        >
          Actually, match me to a Circle →
        </button>
      </div>
    )
  }

  // Opted in — show circle if matched, or waiting state
  return (
    <div className="space-y-5">
      {primaryCircle ? (
        <>
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
            <label className="block text-sm font-semibold mb-1.5">Season theme <span className="text-muted-foreground font-normal">(optional)</span></label>
            <p className="text-xs text-muted-foreground mb-2">A shared name your group carries across all 12 weeks.</p>
            <input
              type="text"
              placeholder="e.g. Operation Ironman, The Comeback Season..."
              value={seasonTheme}
              onChange={(e) => setSeasonTheme(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold mb-1.5">Sprint 1 collective pledge <span className="text-muted-foreground font-normal">(optional)</span></label>
            <p className="text-xs text-muted-foreground mb-2">What your group is holding each other to this sprint. Your Circle will set this together at the first session too.</p>
            <input
              type="text"
              placeholder="e.g. We all hit 80% consistency, No zero days..."
              value={sprintPledge}
              onChange={(e) => setSprintPledge(e.target.value)}
              className="w-full px-3 py-2.5 text-sm bg-muted/40 border border-border rounded-xl focus:outline-none focus:ring-1 focus:ring-emerald-500"
            />
          </div>

          {(seasonTheme || sprintPledge) && !saved && (
            <Button onClick={handleSaveGoals} disabled={saving} className="w-full bg-emerald-500 hover:bg-emerald-600 text-black font-medium">
              {saving ? 'Saving...' : 'Set Circle Goals'}
            </Button>
          )}

          {saved && (
            <div className="flex items-center gap-2 text-sm text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
              Ivy will reference these in your daily calls
            </div>
          )}
        </>
      ) : (
        <>
          <div className="px-4 py-4 rounded-xl bg-zinc-900 border border-zinc-800">
            <p className="text-sm font-medium mb-1">Finding your Circle</p>
            <p className="text-xs text-zinc-400 leading-relaxed">
              You'll be matched with people on the same track with a similar consistency score.
              Ivy will notify you within 24 hours when your group is ready.
            </p>
          </div>

          <div className="space-y-3">
            {[
              { icon: Target, text: 'Your group sets a collective sprint pledge at each session' },
              { icon: TrendingUp, text: 'Ivy tells you where you stand in your group — motivating, not punishing' },
              { icon: Users, text: 'Same group for a full season — bonds form by sprint 3' },
            ].map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3 text-xs text-muted-foreground">
                <Icon className="w-3.5 h-3.5 shrink-0" />
                {text}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
