'use client'

import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { formatDate, formatTime, getStatusColor } from '@/lib/utils'
import api from '@/lib/api'
import type { Workout, CreateWorkoutInput } from '@/lib/types'

export default function WorkoutsPage() {
  const [workouts, setWorkouts] = useState<Workout[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [showPlanModal, setShowPlanModal] = useState(false)
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null)

  useEffect(() => {
    fetchWorkouts()
  }, [])

  const fetchWorkouts = async () => {
    try {
      const data = await api.workouts.getAll()
      setWorkouts(data)
    } catch (error) {
      console.error('Failed to fetch workouts:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleComplete = async (id: string) => {
    try {
      await api.workouts.complete(id, { status: 'COMPLETED' })
      fetchWorkouts()
    } catch (error) {
      console.error('Failed to complete workout:', error)
    }
  }

  const handleSkip = async (id: string, reason: string) => {
    try {
      await api.workouts.complete(id, { status: 'SKIPPED', skippedReason: reason })
      fetchWorkouts()
    } catch (error) {
      console.error('Failed to skip workout:', error)
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Workouts</h1>
          <p className="text-muted-foreground">
            Plan and track your fitness journey
          </p>
        </div>
        <Button onClick={() => setShowPlanModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Plan Workout
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-4 mb-8">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Workouts
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{workouts.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completed
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {workouts.filter(w => w.status === 'COMPLETED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Planned
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {workouts.filter(w => w.status === 'PLANNED').length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Completion Rate
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {workouts.length > 0
                ? Math.round((workouts.filter(w => w.status === 'COMPLETED').length / workouts.length) * 100)
                : 0}%
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Workouts List */}
      <Card>
        <CardHeader>
          <CardTitle>Your Workouts</CardTitle>
          <CardDescription>
            Manage your workout schedule and track progress
          </CardDescription>
        </CardHeader>
        <CardContent>
          {workouts.length === 0 ? (
            <div className="text-center py-12">
              <svg className="w-16 h-16 mx-auto text-muted-foreground mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <p className="text-muted-foreground mb-4">No workouts planned yet</p>
              <Button onClick={() => setShowPlanModal(true)}>
                Plan Your First Workout
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {workouts.map((workout) => (
                <div
                  key={workout.id}
                  className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1">
                    <div className={`w-3 h-3 rounded-full ${getStatusColor(workout.status)}`} />
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-medium">{workout.activity}</p>
                        {workout.isMinimum && (
                          <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded">
                            Minimum
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>{formatDate(workout.plannedDate)}</span>
                        {workout.plannedTime && <span>{formatTime(workout.plannedTime)}</span>}
                        {workout.duration && <span>{workout.duration} min</span>}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {workout.status === 'PLANNED' && (
                      <>
                        <Button
                          size="sm"
                          onClick={() => handleComplete(workout.id)}
                        >
                          Complete
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            const reason = prompt('Reason for skipping?')
                            if (reason) handleSkip(workout.id, reason)
                          }}
                        >
                          Skip
                        </Button>
                      </>
                    )}
                    {workout.status === 'COMPLETED' && (
                      <span className="text-sm text-green-600 font-medium">
                        ✓ Completed
                      </span>
                    )}
                    {workout.status === 'SKIPPED' && (
                      <span className="text-sm text-orange-600 font-medium">
                        Skipped
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Workout Modal */}
      {showPlanModal && (
        <PlanWorkoutModal
          onClose={() => setShowPlanModal(false)}
          onSuccess={() => {
            setShowPlanModal(false)
            fetchWorkouts()
          }}
        />
      )}
    </div>
  )
}

function PlanWorkoutModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void
  onSuccess: () => void
}) {
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
      console.error('Failed to create workout:', error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Plan Workout</CardTitle>
          <CardDescription>
            Schedule your next workout session
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="activity">Activity</Label>
              <Input
                id="activity"
                placeholder="e.g., Running, Gym, Yoga"
                value={formData.activity}
                onChange={(e) => setFormData({ ...formData, activity: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.plannedDate}
                onChange={(e) => setFormData({ ...formData, plannedDate: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="time">Time (optional)</Label>
              <Input
                id="time"
                type="time"
                value={formData.plannedTime || ''}
                onChange={(e) => setFormData({ ...formData, plannedTime: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">Duration (minutes)</Label>
              <Input
                id="duration"
                type="number"
                placeholder="30"
                value={formData.duration || ''}
                onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) || undefined })}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="minimum"
                checked={formData.isMinimum}
                onChange={(e) => setFormData({ ...formData, isMinimum: e.target.checked })}
                className="rounded"
              />
              <Label htmlFor="minimum" className="cursor-pointer">
                This is my minimum commitment
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" className="flex-1" disabled={isLoading}>
                {isLoading ? 'Planning...' : 'Plan Workout'}
              </Button>
              <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
