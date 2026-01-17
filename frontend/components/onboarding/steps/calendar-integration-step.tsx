'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const CALENDAR_PROVIDERS = [
  { id: 'google', name: 'Google Calendar', icon: '📅', color: 'bg-blue-100 text-blue-700' },
  { id: 'outlook', name: 'Outlook Calendar', icon: '📆', color: 'bg-purple-100 text-purple-700' },
  { id: 'apple', name: 'Apple Calendar', icon: '🍎', color: 'bg-gray-100 text-gray-700' },
]

export function CalendarIntegrationStep() {
  const [selectedProvider, setSelectedProvider] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  const handleConnect = () => {
    // TODO: Implement actual calendar OAuth flow
    setIsConnected(true)
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Connect your calendar so Ivy can find the best times for workouts and calls based on your schedule.
        </p>
      </div>

      {!isConnected ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {CALENDAR_PROVIDERS.map((provider) => (
              <Card
                key={provider.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedProvider === provider.id
                    ? 'ring-2 ring-indigo-600 bg-indigo-50'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => setSelectedProvider(provider.id)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-2">{provider.icon}</div>
                  <p className="font-medium">{provider.name}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedProvider && (
            <div className="text-center">
              <Button size="lg" onClick={handleConnect}>
                Connect {CALENDAR_PROVIDERS.find(p => p.id === selectedProvider)?.name}
              </Button>
            </div>
          )}
        </>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-2">Calendar Connected!</h3>
          <p className="text-muted-foreground">
            Ivy can now optimize your workout and call scheduling based on your availability.
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">Privacy & Permissions</p>
            <p className="text-sm text-blue-800">
              Ivy only reads your calendar availability (free/busy). We never access event details or personal information.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
