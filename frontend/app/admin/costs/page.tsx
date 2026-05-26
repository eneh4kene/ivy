'use client'

import { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { adminApi } from '@/lib/api'
import { useAuthStore } from '@/lib/store/auth.store'
import { isSuperAdmin } from '@/lib/permissions'

type CostData = Awaited<ReturnType<typeof adminApi.getPlatformCosts>>

const SERVICE_COLOURS: Record<string, string> = {
  retell: 'bg-violet-500',
  twilio: 'bg-blue-500',
  openai: 'bg-emerald-500',
  postmark: 'bg-amber-500',
  telegram: 'bg-sky-400',
}

const SERVICE_LABELS: Record<string, string> = {
  retell: 'Retell AI',
  twilio: 'Twilio',
  openai: 'OpenAI (Whisper)',
  postmark: 'Postmark',
  telegram: 'Telegram',
}

function fmt(n: number) {
  return `£${n.toFixed(2)}`
}

function pct(part: number, total: number) {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}

export default function CostDashboardPage() {
  const user = useAuthStore((s) => s.user)
  const [days, setDays] = useState(30)
  const [data, setData] = useState<CostData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setData(await adminApi.getPlatformCosts(days))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load cost data')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => { load() }, [load])

  if (!isSuperAdmin(user)) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">Superadmin access required.</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-violet-600" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 font-medium">{error}</p>
        <button onClick={load} className="mt-3 text-sm underline text-muted-foreground">Retry</button>
      </div>
    )
  }

  if (!data) return null

  // Aggregate per-service totals for the summary row
  const serviceTotals: Record<string, number> = {}
  for (const row of data.byService) {
    serviceTotals[row.service] = (serviceTotals[row.service] ?? 0) + row.totalCostGbp
  }

  // Daily chart — max value for bar scaling
  const maxDay = Math.max(...data.byDay.map((d) => d.totalCostGbp), 0.01)

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Platform Costs</h1>
          <p className="text-muted-foreground mt-1">
            API spend across all services · superadmin only
          </p>
        </div>
        <div className="flex gap-2">
          {[7, 30, 90].map((d) => (
            <button
              key={d}
              onClick={() => setDays(d)}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                days === d
                  ? 'bg-violet-600 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total ({days}d)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(data.totalCostGbp)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Daily alert threshold: {fmt(data.alertThresholdGbp)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Retell AI (voice)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(serviceTotals['retell'] ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pct(serviceTotals['retell'] ?? 0, data.totalCostGbp)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Twilio (SMS/calls)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(serviceTotals['twilio'] ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pct(serviceTotals['twilio'] ?? 0, data.totalCostGbp)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">OpenAI (Whisper)</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{fmt(serviceTotals['openai'] ?? 0)}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {pct(serviceTotals['openai'] ?? 0, data.totalCostGbp)}% of total
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Daily spend chart */}
      {data.byDay.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Daily Spend</CardTitle>
            <CardDescription>Last {days} days · hover a bar for the date</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-40">
              {data.byDay.map((day) => (
                <div
                  key={day.date}
                  className="flex-1 flex flex-col items-center gap-1 group relative"
                  title={`${day.date}: ${fmt(day.totalCostGbp)}`}
                >
                  <div
                    className="w-full bg-violet-500 rounded-t hover:bg-violet-400 transition-colors"
                    style={{ height: `${Math.max((day.totalCostGbp / maxDay) * 100, 2)}%` }}
                  />
                  {/* Tooltip */}
                  <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 hidden group-hover:block z-10 bg-gray-900 text-white text-xs rounded px-2 py-1 whitespace-nowrap">
                    {day.date}<br />{fmt(day.totalCostGbp)}
                  </div>
                </div>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2">
              <span>{data.byDay[0]?.date}</span>
              <span>{data.byDay[data.byDay.length - 1]?.date}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Service breakdown */}
      <Card>
        <CardHeader>
          <CardTitle>By Service & Operation</CardTitle>
          <CardDescription>Ranked by cost, last {days} days</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.byService.map((row) => (
              <div key={`${row.service}/${row.operation}`} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${SERVICE_COLOURS[row.service] ?? 'bg-gray-400'}`}
                    />
                    <span className="font-medium">
                      {SERVICE_LABELS[row.service] ?? row.service}
                    </span>
                    <span className="text-muted-foreground text-xs">/{row.operation}</span>
                  </div>
                  <div className="flex items-center gap-6 text-right">
                    <span className="text-muted-foreground text-xs w-20">
                      {row.totalUnits.toFixed(1)} units
                    </span>
                    <span className="text-muted-foreground text-xs w-12">
                      {row.count} calls
                    </span>
                    <span className="font-semibold w-16">{fmt(row.totalCostGbp)}</span>
                  </div>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div
                    className={`h-1.5 rounded-full ${SERVICE_COLOURS[row.service] ?? 'bg-gray-400'}`}
                    style={{ width: `${pct(row.totalCostGbp, data.totalCostGbp)}%` }}
                  />
                </div>
              </div>
            ))}
            {data.byService.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-6">No usage logged in this period.</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Top users */}
      {data.topUsers.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Top Users by Cost</CardTitle>
            <CardDescription>Top 20 · last {days} days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 font-medium">User</th>
                    <th className="pb-2 font-medium">Tier</th>
                    <th className="pb-2 font-medium text-right">Cost</th>
                    <th className="pb-2 font-medium text-right">% of total</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topUsers.map((u, i) => (
                    <tr key={u.userId ?? i} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2">
                        <p className="font-medium">{u.name || '—'}</p>
                        <p className="text-xs text-muted-foreground">{u.email}</p>
                      </td>
                      <td className="py-2">
                        <span className="text-xs bg-gray-100 rounded px-1.5 py-0.5">{u.tier}</span>
                      </td>
                      <td className="py-2 text-right font-semibold">{fmt(u.totalCostGbp)}</td>
                      <td className="py-2 text-right text-muted-foreground">
                        {pct(u.totalCostGbp, data.totalCostGbp)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
