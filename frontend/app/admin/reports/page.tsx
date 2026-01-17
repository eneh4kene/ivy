'use client'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

const reports = [
  {
    name: 'End of Season Summary',
    description: 'Complete overview of participation, consistency, donations, and transformation trends',
    format: 'PDF',
    icon: '📊',
  },
  {
    name: 'Weekly Participation Report',
    description: 'Week-by-week participation rates and engagement metrics',
    format: 'CSV',
    icon: '📈',
  },
  {
    name: 'Aggregate Wellness Trends',
    description: 'Anonymous energy, mood, and health confidence trends over time',
    format: 'PDF',
    icon: '🏥',
  },
  {
    name: 'Donation Impact Report',
    description: 'Total donations by charity, impact metrics, and employee engagement',
    format: 'PDF',
    icon: '❤️',
  },
  {
    name: 'Track Distribution Analysis',
    description: 'Breakdown of employee track selections and completion rates',
    format: 'CSV',
    icon: '🎯',
  },
  {
    name: 'Employee Enrollment List',
    description: 'List of all enrolled employees with status (no performance data)',
    format: 'CSV',
    icon: '👥',
  },
]

export default function ReportsPage() {
  const handleDownload = (reportName: string) => {
    // TODO: Implement actual report generation
    console.log(`Downloading: ${reportName}`)
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Reports & Exports</h1>
        <p className="text-muted-foreground">
          Generate and download reports for your company&apos;s Ivy program
        </p>
      </div>

      {/* Quick Export */}
      <Card className="mb-8 bg-gradient-to-r from-indigo-50 to-purple-50 border-indigo-200">
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <h3 className="text-lg font-semibold mb-1">Quick Export - Current Season</h3>
              <p className="text-sm text-muted-foreground">
                Download a comprehensive report for Season 3 (Jan 15 - Mar 15)
              </p>
            </div>
            <Button size="lg">
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download Season Report
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Available Reports */}
      <div className="grid gap-6 md:grid-cols-2">
        {reports.map((report) => (
          <Card key={report.name} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-3">
                  <span className="text-3xl">{report.icon}</span>
                  <div>
                    <CardTitle className="text-lg">{report.name}</CardTitle>
                    <CardDescription className="mt-1">
                      {report.description}
                    </CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Format: {report.format}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDownload(report.name)}
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Privacy Notice */}
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
