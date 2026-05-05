'use client'

import { useState } from 'react'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { adminApi } from '@/lib/api'

const INVITE_METHODS = [
  { id: 'manual', title: 'Manual Entry', description: 'Enter email addresses manually', icon: '✍️' },
  { id: 'csv', title: 'Upload CSV File', description: 'Upload a CSV file with employee emails', icon: '📄' },
]

export function EmployeeInvitesStep() {
  const [selectedMethod, setSelectedMethod] = useState<string>('manual')
  const [emails, setEmails] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<{ email: string; status: string; error?: string }[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSendInvites = async () => {
    setIsLoading(true)
    setError(null)

    let emailList: string[] = []

    if (selectedMethod === 'manual') {
      emailList = emails.split(/[\n,]+/).map(e => e.trim()).filter(Boolean)
    } else if (selectedMethod === 'csv' && file) {
      const text = await file.text()
      emailList = text.split(/[\n,]+/).map(e => e.trim().replace(/"/g, '')).filter(e => e.includes('@'))
    }

    if (emailList.length === 0) {
      setError('No valid email addresses found')
      setIsLoading(false)
      return
    }

    try {
      const data = await adminApi.inviteEmployees(emailList)
      setResults(data.results)
    } catch (err: any) {
      setError(err.message ?? 'Failed to send invites')
    } finally {
      setIsLoading(false)
    }
  }

  if (results) {
    const succeeded = results.filter(r => r.status === 'invited').length
    return (
      <div className="space-y-4">
        <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h3 className="font-semibold text-lg mb-2">{succeeded} invitation{succeeded !== 1 ? 's' : ''} sent!</h3>
          <p className="text-muted-foreground text-sm">Employees will receive an email with a unique signup link.</p>
        </div>
        <div className="space-y-2">
          {results.map((r, i) => (
            <div key={i} className={`flex items-center justify-between p-3 rounded-lg border text-sm ${r.status === 'invited' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
              <span className="font-medium">{r.email}</span>
              <span className={r.status === 'invited' ? 'text-green-700' : 'text-red-700'}>
                {r.status === 'invited' ? '✓ Sent' : `✗ ${r.error ?? 'Failed'}`}
              </span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Invite your team members to join the Ivy program. They&apos;ll receive email invitations to complete their own onboarding.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {INVITE_METHODS.map((method) => (
          <Card
            key={method.id}
            className={`cursor-pointer transition-all hover:shadow-md ${selectedMethod === method.id ? 'ring-2 ring-indigo-600 bg-indigo-50' : 'hover:bg-accent/50'}`}
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
          <textarea
            id="emails"
            className="flex min-h-[160px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            placeholder={"alice@company.com\nbob@company.com"}
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
          />
        </div>
      )}

      {selectedMethod === 'csv' && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-indigo-400 transition-colors">
          <input type="file" id="csvFile" accept=".csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          <label htmlFor="csvFile" className="cursor-pointer">
            <div className="text-4xl mb-2">📁</div>
            {file ? <p className="font-medium">{file.name}</p> : (
              <>
                <p className="font-medium mb-1">Click to upload CSV</p>
                <p className="text-sm text-muted-foreground">One email per line or comma-separated</p>
              </>
            )}
          </label>
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}

      {((selectedMethod === 'manual' && emails) || (selectedMethod === 'csv' && file)) && (
        <div className="flex justify-center">
          <Button size="lg" onClick={handleSendInvites} disabled={isLoading}>
            {isLoading ? 'Sending…' : 'Send Invitations'}
          </Button>
        </div>
      )}
    </div>
  )
}
