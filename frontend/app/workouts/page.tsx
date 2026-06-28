'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { formatDate, formatTime } from '@/lib/utils'
import api from '@/lib/api'
import type { Workout, CreateWorkoutInput } from '@/lib/types'
import { Plus, Zap, CheckCircle2, Clock, SkipForward, Dumbbell, X, Calendar, Timer } from 'lucide-react'

const statusConfig: Record<string, { label: string; color: string; dot: string }> = {
  COMPLETED: { label: 'Completed', color: 'text-sage-400', dot: 'bg-sage-400' },
  PLANNED: { label: 'Planned', color: 'text-periwinkle-400', dot: 'bg-periwinkle-400' },
  SKIPPED: { label: 'Skipped', color: 'text-muted-foreground', dot: 'bg-muted-foreground' },
  PARTIAL: { label: 'Partial', color: 'text-gold-400', dot: 'bg-gold-400' },
}

function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 p-4 rounded-xl border border-border">
      <div className="skeleton w-3 h-3 rounded-full" />
      <div className="flex-1 space-y-2">
        <div className="skeleton h-4 w-36" />
        <div className="skeleton h-3 w-48" />
      </div>
      <div className="skeleton h-8 w-24 rounded-lg" />
    </div>
  )
}

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  useEffect(() => { fetchWorkouts() }, [])

  const fetchWorkouts = async () => {
    try {
      const data = await api.workouts.getAll()
      setWorkouts(data)
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await api.workouts.complete(id, { status: 'COMPLETED' })
      fetchWorkouts()
    } catch (error) { console.error(error) }
  }

  const handleSkip = async (id: string, reason: string) => {
    try {
      await api.workouts.complete(id, { status: 'SKIPPED', skippedReason: reason })
      fetchWorkouts()
    } catch (error) { console.error(error) }
  }

  const completed = workouts.filter(w => w.status === 'COMPLETED').length
  const planned = workouts.filter(w => w.status === 'PLANNED').length
  const rate = workouts.length > 0 ? Math.round((completed / workouts.length) * 100) : 0

  return (
    <div className="p-6 sm:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between mb-8 animate-fade-in pl-12 md:pl-0">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-1">Workouts</h1>
          <p className="text-muted-foreground text-sm">Plan and track your fitness journey</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="w-4 h-4 mr-1.5" />
          Plan workout
        </Button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
        {[
          { label: 'Total', value: isLoading ? '—' : String(workouts.length), icon: Dumbbell, color: 'text-foreground' },
          { label: 'Completed', value: isLoading ? '—' : String(completed), icon: CheckCircle2, color: 'text-sage-400' },
          { label: 'Planned', value: isLoading ? '—' : String(planned), icon: Clock, color: 'text-periwinkle-400' },
          { label: 'Success Rate', value: isLoading ? '—' : `${rate}%`, icon: Zap, color: rate >= 70 ? 'text-primary' : 'text-gold-400' },
        ].map((s) => (
          <div key={s.label} className="bg-card border border-border rounded-xl p-4 hover:border-border/80 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-muted-foreground font-medium">{s.label}</span>
              <s.icon className={`w-4 h-4 ${s.color}`} />
            </div>
            <p className={`text-2xl font-bold tabular-nums tracking-tight ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Workouts list */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        <div className="p-5 border-b border-border">
          <h2 className="font-semibold">Your Workouts</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Manage your schedule and track progress</p>
        </div>

        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : workouts.length === 0 ? (
            <div className="py-16 text-center">
              <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
                <Dumbbell className="w-8 h-8 text-muted-foreground/40" />
              </div>
              <p className="font-medium mb-1">No workouts yet</p>
              <p className="text-sm text-muted-foreground mb-5">Start by planning your first workout session</p>
              <Button onClick={() => setShowModal(true)}>
                <Plus className="w-4 h-4 mr-1.5" />
                Plan first workout
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {workouts.map((workout) => {
                const status = statusConfig[workout.status] || statusConfig.PLANNED
                return (
                  <div
                    key={workout.id}
                    className="flex items-center gap-4 p-4 rounded-xl border border-border hover:border-border/80 hover:bg-accent/30 transition-all group"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${status.dot}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-sm truncate">{workout.activity}</p>
                        {workout.isMinimum && (
                          <span className="text-[10px] bg-gold-400/15 text-gold-400 border border-gold-400/20 px-1.5 py-0.5 rounded font-medium flex-shrink-0">
                            Min
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDate(workout.plannedDate)}
                        </span>
                        {workout.plannedTime && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {formatTime(workout.plannedTime)}
                          </span>
                        )}
                        {workout.duration && (
                          <span className="flex items-center gap-1">
                            <Timer className="w-3 h-3" />
                            {workout.duration}min
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2 flex-shrink-0">
                      {workout.status === 'PLANNED' ? (
                        <>
                          <Button
                            size="sm"
                            onClick={() => handleComplete(workout.id)}
                            className="h-8"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                            Done
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8"
                            onClick={() => {
                              const reason = prompt('Reason for skipping?')
                              if (reason) handleSkip(workout.id, reason)
                            }}
                          >
                            <SkipForward className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      ) : (
                        <span className={`text-xs font-medium px-2.5 py-1 rounded-lg bg-muted ${status.color}`}>
                          {status.label}
                        </span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {showModal && (
        <PlanWorkoutModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); fetchWorkouts() }}
        />
      )}
    </div>
  )
}

function PlanWorkoutModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [formData, setFormData] = useState<CreateWorkoutInput>({
    plannedDate: new Date().toISOString().split('T')[0],
    activity: '',
    duration: undefined,
    isMinimum: false,
  })
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      await api.workouts.create(formData)
      onSuccess()
    } catch (error) {
      console.error(error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-card border border-border rounded-2xl shadow-2xl shadow-black/40 animate-scale-in">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="font-bold text-lg tracking-tight">Plan Workout</h2>
            <p className="text-xs text-muted-foreground mt-0.5">Schedule your next session</p>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg hover:bg-accent flex items-center justify-center transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium">Activity *</label>
            <Input
              placeholder="e.g., Running, Gym, Yoga"
              value={formData.activity}
              onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Date *</label>
              <Input
                type="date"
                value={formData.plannedDate}
                onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium">Time</label>
              <Input
                type="time"
                value={formData.plannedTime || ''}
                onChange={(e) => setFormData({ ...formData, plannedTime: e.target.value })}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium">Duration (minutes)</label>
            <Input
              type="number"
              placeholder="30"
              value={formData.duration || ''}
              onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || undefined })}
            />
          </div>

          <label className="flex items-center gap-3 p-3.5 rounded-xl border border-border hover:bg-accent/30 cursor-pointer transition-colors">
            <input
              type="checkbox"
              checked={formData.isMinimum}
              onChange={(e) => setFormData({ ...formData, isMinimum: e.target.checked })}
              className="w-4 h-4 accent-primary rounded"
            />
            <div>
              <p className="text-sm font-medium">Minimum commitment</p>
              <p className="text-xs text-muted-foreground">This is the bare minimum I'll do</p>
            </div>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="submit" className="flex-1" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  Planning…
                </span>
              ) : 'Plan Workout'}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
