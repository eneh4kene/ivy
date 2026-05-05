'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { adminApi } from '@/lib/api'

interface Employee {
  id: string
  name: string
  email: string
  status: 'active' | 'pending' | 'inactive'
  track: string
  joinedAt: string
}

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showInviteModal, setShowInviteModal] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const load = () => {
    setIsLoading(true)
    adminApi.getEmployees()
      .then(setEmployees)
      .catch((err) => setError(err.message ?? 'Failed to load employees'))
      .finally(() => setIsLoading(false))
  }

  useEffect(load, [])

  const filteredEmployees = employees.filter(emp =>
    emp.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    emp.email.toLowerCase().includes(searchTerm.toLowerCase())
  )

  const statusCounts = {
    active: employees.filter(e => e.status === 'active').length,
    pending: employees.filter(e => e.status === 'pending').length,
    inactive: employees.filter(e => e.status === 'inactive').length,
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold mb-2">Employee Management</h1>
          {error && <p className="text-sm text-red-600">{error}</p>}
          {!error && <p className="text-muted-foreground">Manage employee enrollment and invitations</p>}
        </div>
        <Button onClick={() => setShowInviteModal(true)}>
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
          </svg>
          Invite Employees
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Employees</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold">{employees.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-green-600">{statusCounts.active}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pending</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-4xl font-bold text-orange-600">{statusCounts.pending}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Employees</CardTitle>
              <CardDescription>View enrollment status (individual performance data is private)</CardDescription>
            </div>
            <div className="w-64">
              <Input
                placeholder="Search by name or email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {filteredEmployees.map((employee) => (
              <div
                key={employee.id}
                className="flex items-center justify-between p-4 border rounded-lg hover:bg-accent/50 transition-colors"
              >
                <div className="flex items-center gap-4 flex-1">
                  <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center">
                    <span className="text-sm font-medium text-primary">
                      {employee.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{employee.name}</p>
                    <p className="text-sm text-muted-foreground">{employee.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Track</p>
                    <p className="font-medium capitalize">{employee.track}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm text-muted-foreground">Joined</p>
                    <p className="font-medium">{new Date(employee.joinedAt).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                    employee.status === 'active' ? 'bg-green-100 text-green-700' :
                    employee.status === 'pending' ? 'bg-orange-100 text-orange-700' :
                    'bg-gray-100 text-gray-700'
                  }`}>
                    {employee.status}
                  </span>
                </div>
              </div>
            ))}
            {filteredEmployees.length === 0 && !error && (
              <div className="text-center py-12 text-muted-foreground">
                {searchTerm ? `No employees found matching "${searchTerm}"` : 'No employees yet. Invite your team to get started.'}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {showInviteModal && (
        <InviteEmployeesModal
          onClose={() => setShowInviteModal(false)}
          onSuccess={load}
        />
      )}
    </div>
  )
}

function InviteEmployeesModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [emails, setEmails] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [results, setResults] = useState<{ email: string; status: string; error?: string }[] | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    const emailList = emails
      .split(/[\n,]+/)
      .map(e => e.trim())
      .filter(Boolean)

    try {
      const data = await adminApi.inviteEmployees(emailList)
      setResults(data.results)
      onSuccess()
    } catch (err: any) {
      setResults([{ email: 'all', status: 'failed', error: err.message ?? 'Request failed' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <Card className="w-full max-w-2xl">
        <CardHeader>
          <CardTitle>Invite Employees</CardTitle>
          <CardDescription>
            Send invitations to employees to join your company&apos;s Ivy program
          </CardDescription>
        </CardHeader>
        <CardContent>
          {results ? (
            <div className="space-y-3">
              {results.map((r, i) => (
                <div key={i} className={`flex items-center justify-between p-3 rounded-lg border ${r.status === 'invited' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                  <span className="text-sm font-medium">{r.email}</span>
                  <span className={`text-xs ${r.status === 'invited' ? 'text-green-700' : 'text-red-700'}`}>
                    {r.status === 'invited' ? '✓ Invite sent' : `✗ ${r.error ?? 'Failed'}`}
                  </span>
                </div>
              ))}
              <Button className="w-full mt-4" onClick={onClose}>Done</Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="emails">Email Addresses</Label>
                <textarea
                  id="emails"
                  className="flex min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  placeholder="alice@company.com&#10;bob@company.com"
                  value={emails}
                  onChange={(e) => setEmails(e.target.value)}
                  required
                />
                <p className="text-xs text-muted-foreground">One email per line or comma-separated</p>
              </div>
              <div className="flex gap-2 pt-2">
                <Button type="submit" className="flex-1" disabled={isLoading}>
                  {isLoading ? 'Sending…' : 'Send Invitations'}
                </Button>
                <Button type="button" variant="outline" onClick={onClose} disabled={isLoading}>Cancel</Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
