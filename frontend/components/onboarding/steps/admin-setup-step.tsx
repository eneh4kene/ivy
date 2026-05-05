'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { adminApi } from '@/lib/api'

interface Admin {
  email: string
  status: 'pending' | 'invited' | 'failed'
  error?: string
}

export function AdminSetupStep() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [newAdminEmail, setNewAdminEmail] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  const addAdmin = async () => {
    const email = newAdminEmail.trim().toLowerCase()
    if (!email || !email.includes('@')) return
    if (admins.some(a => a.email === email)) return

    setIsSaving(true)
    setNewAdminEmail('')

    const placeholder: Admin = { email, status: 'pending' }
    setAdmins(prev => [...prev, placeholder])

    try {
      const result = await adminApi.inviteEmployees([email])
      const outcome = result.results[0]
      setAdmins(prev => prev.map(a =>
        a.email === email
          ? { ...a, status: outcome.status === 'invited' ? 'invited' : 'failed', error: outcome.error }
          : a
      ))
    } catch (err: any) {
      setAdmins(prev => prev.map(a =>
        a.email === email ? { ...a, status: 'failed', error: err.message } : a
      ))
    } finally {
      setIsSaving(false)
    }
  }

  const removeAdmin = (email: string) => {
    setAdmins(admins.filter(a => a.email !== email))
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Assign administrators who can manage your company&apos;s Ivy program, view reports, and configure settings.
        </p>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          You are set as Super Admin by default. Additional admins receive a signup email and get full dashboard access once they complete onboarding.
        </p>
      </div>

      <div className="space-y-4">
        <Label className="text-base font-semibold">Add Administrators</Label>
        <div className="flex gap-2">
          <div className="flex-1">
            <Input
              placeholder="admin@company.com"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addAdmin()}
              type="email"
            />
          </div>
          <Button onClick={addAdmin} disabled={!newAdminEmail.trim() || isSaving}>
            {isSaving ? '…' : 'Invite'}
          </Button>
        </div>
      </div>

      {admins.length > 0 && (
        <div className="space-y-3">
          <Label className="text-base font-semibold">Administrators ({admins.length})</Label>
          {admins.map((admin) => (
            <Card key={admin.email}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="font-medium">{admin.email}</p>
                    <p className={`text-xs mt-0.5 ${
                      admin.status === 'invited' ? 'text-green-600' :
                      admin.status === 'failed' ? 'text-red-600' :
                      'text-muted-foreground'
                    }`}>
                      {admin.status === 'invited' ? '✓ Invite sent' :
                       admin.status === 'failed' ? `✗ ${admin.error ?? 'Failed'}` :
                       'Sending…'}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => removeAdmin(admin.email)}>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
