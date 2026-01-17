'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'

const INVITE_METHODS = [
  {
    id: 'csv',
    title: 'Upload CSV File',
    description: 'Upload a CSV file with employee emails',
    icon: '📄',
  },
  {
    id: 'manual',
    title: 'Manual Entry',
    description: 'Enter email addresses manually',
    icon: '✍️',
  },
  {
    id: 'hris',
    title: 'HRIS Integration',
    description: 'Sync with your HR system (configure in integrations)',
    icon: '🔗',
  },
]

export function EmployeeInvitesStep() {
  const [selectedMethod, setSelectedMethod] = useState<string>('manual')
  const [emails, setEmails] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [inviteSent, setInviteSent] = useState(false)

  const handleSendInvites = () => {
    // TODO: Send invites via API
    setInviteSent(true)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0])
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Invite your team members to join the Ivy program. They'll receive email invitations to complete their own onboarding.
        </p>
      </div>

      {!inviteSent ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            {INVITE_METHODS.map((method) => (
              <Card
                key={method.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  selectedMethod === method.id
                    ? 'ring-2 ring-indigo-600 bg-indigo-50'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => setSelectedMethod(method.id)}
              >
                <CardContent className="p-6 text-center">
                  <div className="text-4xl mb-2">{method.icon}</div>
                  <p className="font-medium mb-1">{method.title}</p>
                  <p className="text-xs text-muted-foreground">{method.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {selectedMethod === 'manual' && (
            <div className="space-y-2">
              <Label htmlFor="emails" className="text-base font-semibold">Email Addresses</Label>
              <p className="text-sm text-muted-foreground mb-2">
                Enter email addresses (one per line or comma-separated)
              </p>
              <textarea
                id="emails"
                className="flex min-h-[200px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                placeholder={"alice@company.com\nbob@company.com\ncarol@company.com"}
                value={emails}
                onChange={(e) => setEmails(e.target.value)}
              />
            </div>
          )}

          {selectedMethod === 'csv' && (
            <div className="space-y-2">
              <Label htmlFor="csvFile" className="text-base font-semibold">Upload CSV File</Label>
              <p className="text-sm text-muted-foreground mb-2">
                CSV should have one column with email addresses
              </p>
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
                <input
                  type="file"
                  id="csvFile"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <label htmlFor="csvFile" className="cursor-pointer">
                  <div className="text-4xl mb-2">📁</div>
                  {file ? (
                    <p className="font-medium">{file.name}</p>
                  ) : (
                    <>
                      <p className="font-medium mb-1">Click to upload CSV</p>
                      <p className="text-sm text-muted-foreground">or drag and drop</p>
                    </>
                  )}
                </label>
              </div>
            </div>
          )}

          {selectedMethod === 'hris' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
              <p className="font-medium mb-2">HRIS Integration Not Configured</p>
              <p className="text-sm text-muted-foreground mb-4">
                Set up your HRIS integration in the next step to automatically sync employee data.
              </p>
              <Button variant="outline" onClick={() => setSelectedMethod('manual')}>
                Use Manual Entry Instead
              </Button>
            </div>
          )}

          {(selectedMethod === 'manual' && emails) || (selectedMethod === 'csv' && file) ? (
            <div className="flex justify-center">
              <Button size="lg" onClick={handleSendInvites}>
                Send Invitations
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
              </Button>
            </div>
          ) : null}
        </>
      ) : (
        <div className="bg-green-50 border border-green-200 rounded-lg p-8 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-2">Invitations Sent!</h3>
          <p className="text-muted-foreground mb-4">
            Your team members will receive email invitations within the next few minutes.
          </p>
          <p className="text-sm text-muted-foreground">
            You can invite more employees anytime from your admin dashboard.
          </p>
        </div>
      )}

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm font-medium text-blue-900 mb-1">What employees will receive</p>
            <p className="text-sm text-blue-800">
              Each employee gets a unique signup link to complete their personal onboarding and choose their wellness track.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
