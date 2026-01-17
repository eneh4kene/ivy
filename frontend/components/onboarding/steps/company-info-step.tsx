'use client'

import { useState } from 'react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'

const COMPANY_SIZES = [
  { id: '1-50', label: '1-50 employees' },
  { id: '51-200', label: '51-200 employees' },
  { id: '201-500', label: '201-500 employees' },
  { id: '501-1000', label: '501-1000 employees' },
  { id: '1000+', label: '1000+ employees' },
]

const INDUSTRIES = [
  'Technology', 'Healthcare', 'Finance', 'Education', 'Retail',
  'Manufacturing', 'Professional Services', 'Non-profit', 'Other'
]

export function CompanyInfoStep() {
  const [companyName, setCompanyName] = useState('')
  const [companySize, setCompanySize] = useState<string | null>(null)
  const [industry, setIndustry] = useState('')
  const [goals, setGoals] = useState('')

  // TODO: Save company info to API

  return (
    <div className="space-y-6">
      <div className="text-center mb-8">
        <p className="text-muted-foreground">
          Tell us about your organization to help us tailor the Ivy program for your team.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-2">
          <Label htmlFor="companyName" className="text-base font-semibold">
            Company Name
          </Label>
          <Input
            id="companyName"
            placeholder="Acme Corporation"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className="text-base"
          />
        </div>

        <div className="space-y-2">
          <Label className="text-base font-semibold">Company Size</Label>
          <div className="grid gap-2 md:grid-cols-2">
            {COMPANY_SIZES.map((size) => (
              <Card
                key={size.id}
                className={`cursor-pointer transition-all hover:shadow-md ${
                  companySize === size.id
                    ? 'ring-2 ring-indigo-600 bg-indigo-50'
                    : 'hover:bg-accent/50'
                }`}
                onClick={() => setCompanySize(size.id)}
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
          <Label htmlFor="industry" className="text-base font-semibold">
            Industry
          </Label>
          <select
            id="industry"
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            value={industry}
            onChange={(e) => setIndustry(e.target.value)}
          >
            <option value="">Select an industry</option>
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>{ind}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="goals" className="text-base font-semibold">
            What are your company's wellness goals?
          </Label>
          <p className="text-sm text-muted-foreground mb-2">
            What do you hope your team will achieve through the Ivy program?
          </p>
          <Textarea
            id="goals"
            placeholder="e.g., Improve employee engagement, reduce burnout, build healthier habits across the team..."
            value={goals}
            onChange={(e) => setGoals(e.target.value)}
            rows={4}
            className="text-base resize-none"
          />
        </div>
      </div>

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4">
        <div className="flex items-start gap-3">
          <svg className="w-5 h-5 text-indigo-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div>
            <p className="text-sm text-indigo-800">
              This information helps us provide better support and generate meaningful company-wide reports while keeping individual employee data completely private.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
