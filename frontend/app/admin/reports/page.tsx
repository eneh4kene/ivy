'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { adminApi } from '@/lib/api'
import client from '@/lib/api/client'

const reports = [
  { name: 'End of Season Summary', description: 'Complete overview of participation, consistency, donations, and transformation trends', type: 'summary', format: 'JSON', icon: '📊' },
  { name: 'Employee Enrollment List', description: 'List of all enrolled employees with status (no performance data)', type: 'employees', format: 'CSV', icon: '👥' },
  { name: 'Aggregate Wellness Trends', description: 'Anonymous energy, mood, and health confidence trends over time', type: 'summary', format: 'JSON', icon: '🏥' },
  { name: 'Donation Impact Report', description: 'Total donations by charity, impact metrics, and employee engagement', type: 'summary', format: 'JSON', icon: '❤️' },
]

export default function ReportsPage() {
  const [downloading, setDownloading] = useState<string | null>(null)

  const handleDownload = async (reportName: string, type: string, format: string) => {
    setDownloading(reportName)
    try {
      if (format === 'CSV') {
        // Fetch CSV directly from the API
        const response = await client.get('/api/admin/reports', {
          params: { type },
          responseType: 'blob',
        })
        const url = URL.createObjectURL(new Blob([response.data as BlobPart]))
        const a = document.createElement('a')
        a.href = url
        a.download = `ivy-${type}.csv`
        a.click()
        URL.revokeObjectURL(url)
      } else {
        const data = await adminApi.getReportData(type)
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `ivy-${type}-report.json`
        a.click()
        URL.revokeObjectURL(url)
      }
    } catch (err) {
      alert('Failed to generate report. Please try again.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Reports & Exports</h1>
        <p className="text-muted-foreground">Generate and download reports for your company&apos;s Ivy program</p>
      </div>

      {/* Quick Export */}
      <Card className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Quick Export — Season Summary</h3>
              <p className="text-sm text-muted-foreground">Download a comprehensive JSON report for the current season</p>
            </div>
            <Button
              size="lg"
              disabled={downloading === 'quick'}
              onClick={() => handleDownload('quick', 'summary', 'JSON')}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              {downloading === 'quick' ? 'Generating…' : 'Download Season Report'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Reports */}
      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.name} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start gap-3">
                <span className="text-3xl">{report.icon}</span>
                <div>
                  <CardTitle className="text-lg">{report.name}</CardTitle>
                  <CardDescription className="mt-1">{report.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Format: {report.format}</span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={downloading === report.name}
                  onClick={() => handleDownload(report.name, report.type, report.format)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  {downloading === report.name ? 'Generating…' : 'Generate'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="mt-8 bg-blue-50 border-blue-200">
        <CardContent className="p-6">
          <div className="flex items-start gap-3">
            <svg className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
            </svg>
            <div>
              <p className="font-semibold text-blue-900 mb-2">Privacy-First Reporting</p>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• All reports contain aggregate data only</li>
                <li>• Individual employee performance is never disclosed</li>
                <li>• Personal goals and call content remain private</li>
                <li>• Transformation scores are anonymized and averaged</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
