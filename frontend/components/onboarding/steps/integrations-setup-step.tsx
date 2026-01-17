'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const INTEGRATIONS = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send program updates and reminders to your team workspace',
    icon: '💬',
    color: 'bg-purple-100 text-purple-700',
    benefit: 'Boost engagement with automated reminders and celebrations',
  },
  {
    id: 'hris',
    name: 'HRIS (BambooHR, Workday)',
    description: 'Auto-sync employee data and streamline onboarding',
    icon: '👥',
    color: 'bg-blue-100 text-blue-700',
    benefit: 'Automatically add/remove employees as they join/leave',
  },
  {
    id: 'sso',
    name: 'Single Sign-On',
    description: 'Enable SSO with Okta, Azure AD, or Google Workspace',
    icon: '🔐',
    color: 'bg-green-100 text-green-700',
    benefit: 'Simplified login experience for your team',
  },
]

export function IntegrationsSetupStep() {
  const [connectedIntegrations, setConnectedIntegrations] = useState<string[]>([])

  const toggleIntegration = (id: string) => {
    if (connectedIntegrations.includes(id)) {
      setConnectedIntegrations(connectedIntegrations.filter(i => i !== id))
    } else {
      // TODO: Implement actual OAuth/integration flow
      setConnectedIntegrations([...connectedIntegrations, id])
    }
  }

  const isConnected = (id: string) => connectedIntegrations.includes(id)

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Connect your workplace tools to streamline the Ivy experience for your team. All integrations are optional.
        </p>
      </div>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.id} className={isConnected(integration.id) ? 'border-green-300 bg-green-50' : ''}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-2xl ${integration.color}`}>
                    {integration.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{integration.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                    <div className="flex items-start gap-2">
                      <svg className="w-4 h-4 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                      <p className="text-sm font-medium text-indigo-900">{integration.benefit}</p>
                    </div>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  {isConnected(integration.id) ? (
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-green-700">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-sm font-medium">Connected</span>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => toggleIntegration(integration.id)}
                      >
                        Disconnect
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => toggleIntegration(integration.id)}
                      variant="outline"
                    >
                      Connect
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {connectedIntegrations.length > 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            <div>
              <p className="text-sm font-medium text-green-900">
                {connectedIntegrations.length} integration{connectedIntegrations.length > 1 ? 's' : ''} connected
              </p>
              <p className="text-sm text-green-800">
                You can manage integrations anytime from your company settings.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">Privacy & Security</p>
            <p className="text-sm text-blue-800">
              All integrations use industry-standard OAuth 2.0 authentication. Ivy only requests the minimum permissions needed to function.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
