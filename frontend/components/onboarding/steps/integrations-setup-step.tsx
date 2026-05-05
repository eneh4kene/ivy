'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

const INTEGRATIONS = [
  {
    id: 'slack',
    name: 'Slack',
    description: 'Send program updates and reminders to your team workspace',
    icon: '💬',
    benefit: 'Boost engagement with automated reminders and celebrations',
    contact: true,
  },
  {
    id: 'hris',
    name: 'HRIS (BambooHR, Workday)',
    description: 'Auto-sync employee data and streamline onboarding',
    icon: '👥',
    benefit: 'Automatically add/remove employees as they join/leave',
    contact: true,
  },
  {
    id: 'sso',
    name: 'Single Sign-On',
    description: 'Enable SSO with Okta, Azure AD, or Google Workspace',
    icon: '🔐',
    benefit: 'Simplified login experience for your team',
    contact: true,
  },
]

export function IntegrationsSetupStep() {
  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Connect your workplace tools to streamline the Ivy experience for your team. All integrations are set up by our team and are optional.
        </p>
      </div>

      <div className="space-y-4">
        {INTEGRATIONS.map((integration) => (
          <Card key={integration.id}>
            <CardContent className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-4 flex-1">
                  <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center text-2xl flex-shrink-0">
                    {integration.icon}
                  </div>
                  <div className="flex-1">
                    <h3 className="font-semibold mb-1">{integration.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">{integration.description}</p>
                    <p className="text-sm font-medium text-indigo-900">{integration.benefit}</p>
                  </div>
                </div>
                <Button variant="outline" size="sm" asChild>
                  <a href="mailto:support@ivy.app?subject=Integration%20Setup">Contact us</a>
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="text-sm text-blue-800">
            Integrations are configured by our team using OAuth 2.0. Email us after signup and we&apos;ll get you connected within one business day.
          </p>
        </div>
      </div>
    </div>
  )
}
