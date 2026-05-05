'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const CALENDAR_PROVIDERS = [
  { id: 'google', name: 'Google Calendar', icon: '📅' },
  { id: 'outlook', name: 'Outlook Calendar', icon: '📆' },
]

export function CalendarIntegrationStep() {
  const handleConnect = (provider: string) => {
    // OAuth is configured post-onboarding from Settings → Integrations
    window.location.href = `/settings?connect=${provider}`
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Connect your calendar so Ivy can find the best times for workouts and calls based on your schedule.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {CALENDAR_PROVIDERS.map((provider) => (
          <Card key={provider.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-6 text-center">
              <div className="text-4xl mb-2">{provider.icon}</div>
              <p className="font-medium mb-3">{provider.name}</p>
              <Button variant="outline" className="w-full" onClick={() => handleConnect(provider.id)}>
                Connect
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">You can also set this up later</p>
            <p className="text-sm text-blue-800">
              Calendar connection is available any time from Settings. Skip this step and connect after your first call with Ivy.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
