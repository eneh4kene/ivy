'use client'

import { useState, useEffect } from 'react'
import { Phone, Clock, CheckCircle, XCircle, Zap } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { callsApi } from '@/lib/api'
import type { Call } from '@/lib/types'

const callTypeLabels: Record<string, string> = {
  MORNING_PLANNING: 'Morning Planning',
  EVENING_REVIEW: 'Evening Review',
  RESCUE: 'Rescue Call',
  WEEKLY_PLANNING: 'Weekly Planning',
  MONTHLY_CHECKIN: 'Monthly Check-in',
  ONBOARDING: 'Onboarding',
  SEASON_CLOSE: 'Season Close',
}

const statusIcon = (status: string) => {
  switch (status) {
    case 'COMPLETED': return <CheckCircle className="w-4 h-4 text-primary" />
    case 'SCHEDULED': return <Clock className="w-4 h-4 text-amber-400" />
    case 'NO_ANSWER':
    case 'MISSED':
    case 'FAILED': return <XCircle className="w-4 h-4 text-red-400" />
    default: return <Phone className="w-4 h-4 text-muted-foreground" />
  }
}

export default function CallsPage() {
  const [calls, setCalls] = useState<Call[]>([])
  const [loading, setLoading] = useState(true)
  const [rescuePending, setRescuePending] = useState(false)

  useEffect(() => {
    callsApi.getAll({ limit: 50 })
      .then(setCalls)
      .catch(() => setCalls([]))
      .finally(() => setLoading(false))
  }, [])

  const handleRescueCall = async () => {
    setRescuePending(true)
    try {
      await callsApi.requestRescueCall()
      // Refresh list
      const updated = await callsApi.getAll({ limit: 50 })
      setCalls(updated)
    } catch (e) {
      console.error(e)
    } finally {
      setRescuePending(false)
    }
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return '—'
    const m = Math.floor(seconds / 60)
    const s = seconds % 60
    return `${m}m ${s}s`
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Your Calls</h1>
          <p className="text-muted-foreground text-sm mt-1">Daily AI accountability calls</p>
        </div>
        <Button onClick={handleRescueCall} disabled={rescuePending} variant="outline" size="sm">
          <Zap className="w-4 h-4 mr-2 text-amber-400" />
          {rescuePending ? 'Requesting...' : 'Request Rescue Call'}
        </Button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => (
            <div key={i} className="h-16 rounded-xl bg-muted/50 animate-pulse" />
          ))}
        </div>
      ) : calls.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          <Phone className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p>No calls yet. Your first call will be scheduled after onboarding.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {calls.map(call => (
            <div key={call.id} className="flex items-center gap-4 p-4 rounded-xl bg-card border border-border hover:border-primary/20 transition-colors">
              <div className="flex-shrink-0">
                {statusIcon(call.status)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm">{callTypeLabels[call.callType] ?? call.callType}</p>
                <p className="text-xs text-muted-foreground">
                  {new Date(call.scheduledAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}
                </p>
              </div>
              <div className="text-right">
                {call.duration && (
                  <p className="text-xs text-muted-foreground">{formatDuration(call.duration)}</p>
                )}
                {call.sentiment && (
                  <p className="text-xs text-muted-foreground capitalize">{call.sentiment}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
