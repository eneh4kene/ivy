'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { usersApi } from '@/lib/api'

const COMPANY_SIZES = [
  { id: '1-50', label: '1-50 employees' },
  { id: '51-200', label: '51-200 employees' },
  { id: '201-500', label: '201-500 employees' },
  { id: '501-1000', label: '501-1000 employees' },
  { id: '1000+', label: '1000+ employees' },
]

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Retail',
  'Manufacturing', 'Professional Services', 'Non-profit', 'Other',
]

export function CompanyInfoStep() {
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState<string | null>(null)
  const [industry, setIndustry] = useState('')
  const [goals, setGoals] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSave = async () => {
    if (!companyName.trim()) { setError('Company name is required'); return }
    setSaving(true)
    setError(null)
    try {
      // Save wellness goal to user profile (maps to goal field)
      await usersApi.updateProfile({
        goal: goals || `${companyName} team wellness`,
      })
      setSaved(true)
    } catch (err: any) {
      setError(err.message ?? 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Tell us about your organization to help us tailor the Ivy program for your team.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-base font-semibold">Company Name</Label>
          <Input
            id="companyName"
            placeholder="Acme Corporation"
            value={companyName}
            onChange={(e) => { setCompanyName(e.target.value); setSaved(false) }}
            className="text-base"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">Company Size</Label>
          <div className="grid gap-2 md:grid-cols-2">
            {COMPANY_SIZES.map((size) => (
              <Card
                key={size.id}
                className={`cursor-pointer transition-all hover:shadow-md ${companySize === size.id ? 'ring-2 ring-indigo-600 bg-indigo-50' : 'hover:bg-accent/50'}`}
                onClick={() => { setCompanySize(size.id); setSaved(false) }}
              >
                <CardContent className="p-3 flex items-center justify-between">
                  <span className="font-medium">{size.label}</span>
                  {companySize === size.id && (
                    <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="industry" className="text-base font-semibold">Industry</Label>
          <select
            id="industry"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            value={industry}
            onChange={(e) => { setIndustry(e.target.value); setSaved(false) }}
          >
            <option value="">Select an industry</option>
            {INDUSTRIES.map((ind) => <option key={ind} value={ind}>{ind}</option>)}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goals" className="text-base font-semibold">Company wellness goals</Label>
          <Textarea
            id="goals"
            placeholder="e.g., Improve employee engagement, reduce burnout, build healthier habits across the team…"
            value={goals}
            onChange={(e) => { setGoals(e.target.value); setSaved(false) }}
            rows={4}
            className="text-base resize-none"
          />
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <Button onClick={handleSave} disabled={saving || !companyName.trim()} className="w-full">
          {saving ? 'Saving…' : saved ? '✓ Saved' : 'Save Company Info'}
        </Button>
      </div>
    </div>
  )
}
