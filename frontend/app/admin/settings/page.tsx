'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuthStore } from '@/lib/store/auth.store'

export default function AdminSettingsPage() {
  const user = useAuthStore((state) => state.user)
  const [isLoading, setIsLoading] = useState(false)

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Company Settings</h1>
        <p className="text-muted-foreground">
          Manage your company&apos;s Ivy program configuration
        </p>
      </div>

      <div className="grid gap-6 max-w-4xl">
        {/* Company Profile */}
        <Card>
          <CardHeader>
            <CardTitle>Company Profile</CardTitle>
            <CardDescription>Basic company information</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <Label>Company Name</Label>
                <Input value={user?.company?.name || 'Acme Corp'} disabled />
              </div>
              <div>
                <Label>Plan</Label>
                <Input value="Premium (£53/employee/month)" disabled />
              </div>
              <div>
                <Label>Seats</Label>
                <Input value="125/150 used" disabled />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Season Management */}
        <Card>
          <CardHeader>
            <CardTitle>Season Management</CardTitle>
            <CardDescription>Manage 8-week program seasons</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold">Season 3 (Current)</p>
                    <p className="text-sm text-muted-foreground">Jan 15 - Mar 15, 2025</p>
                  </div>
                  <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-medium">
                    Active
                  </span>
                </div>
                <p className="text-sm text-muted-foreground">45 days remaining</p>
              </div>
              <div className="flex gap-3">
                <Button variant="outline" disabled>Start New Season</Button>
                <Button variant="outline" disabled>Opt Out of Renewal</Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Seasons automatically renew unless opted out
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Integrations */}
        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Connect workplace tools</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-purple-100 rounded flex items-center justify-center">
                    <span className="text-sm font-bold text-purple-700">S</span>
                  </div>
                  <div>
                    <p className="font-medium">Slack</p>
                    <p className="text-sm text-muted-foreground">Team communication</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Connect</Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 rounded flex items-center justify-center">
                    <span className="text-sm font-bold text-blue-700">H</span>
                  </div>
                  <div>
                    <p className="font-medium">HRIS (BambooHR, Workday)</p>
                    <p className="text-sm text-muted-foreground">Auto-enrollment</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Configure</Button>
              </div>

              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-100 rounded flex items-center justify-center">
                    <span className="text-sm font-bold text-indigo-700">SSO</span>
                  </div>
                  <div>
                    <p className="font-medium">Single Sign-On</p>
                    <p className="text-sm text-muted-foreground">Okta, Azure AD</p>
                  </div>
                </div>
                <Button variant="outline" size="sm">Setup</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Billing */}
        <Card>
          <CardHeader>
            <CardTitle>Billing & Subscription</CardTitle>
            <CardDescription>Manage payment and plan</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Next billing date</p>
                  <p className="text-sm text-muted-foreground">February 1, 2025</p>
                </div>
                <p className="text-lg font-bold">£6,625/month</p>
              </div>
              <div className="flex gap-3">
                <Link href="/pricing" className="flex-1">
                  <Button variant="outline" className="w-full">View Plans</Button>
                </Link>
                <Button variant="outline" disabled>Update Payment Method</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
