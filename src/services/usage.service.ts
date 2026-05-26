import prisma from '../utils/prisma'
import logger from '../utils/logger'
import { sendTelegramAdmin } from '../utils/telegram-admin'

// Approximate GBP costs per unit
const COST_PER_UNIT: Record<string, Record<string, number>> = {
  retell: {
    call: 0.09,        // per minute (~£0.09/min Retell fee + Twilio leg)
  },
  twilio: {
    call: 0.013,       // per minute outbound UK
    call_us: 0.014,    // per minute outbound US
    sms: 0.04,         // per SMS segment
  },
  openai: {
    whisper: 0.005,    // per minute transcribed (~$0.006/min ≈ £0.005/min)
  },
  postmark: {
    email: 0.0001,     // per email (Postmark)
  },
  telegram: {
    telegram_message: 0, // free
  },
}

export async function logUsage(
  service: string,
  operation: string,
  units: number,
  userId?: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const costPerUnit = COST_PER_UNIT[service]?.[operation] ?? 0
    const costGbp = units * costPerUnit

    await prisma.apiUsageLog.create({
      data: {
        userId,
        service,
        operation,
        units,
        costGbp,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    })

    // Real-time threshold crossing detection — alert on first crossing each day
    if (costGbp > 0) {
      checkThresholdCrossing(costGbp).catch(() => {})
    }
  } catch (err) {
    logger.warn('Failed to log API usage:', err)
  }
}

async function checkThresholdCrossing(costJustAdded: number): Promise<void> {
  const threshold = parseFloat(process.env.COST_ALERT_THRESHOLD_GBP ?? '15')

  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)

  const result = await prisma.apiUsageLog.aggregate({
    where: { createdAt: { gte: todayStart } },
    _sum: { costGbp: true },
  })

  const totalToday = Number(result._sum.costGbp ?? 0)
  const totalBefore = totalToday - costJustAdded

  // Only fire on the first crossing — not on every subsequent call
  if (totalToday >= threshold && totalBefore < threshold) {
    const byService = await prisma.apiUsageLog.groupBy({
      by: ['service'],
      where: { createdAt: { gte: todayStart } },
      _sum: { costGbp: true },
      orderBy: { _sum: { costGbp: 'desc' } },
    })

    const breakdown = byService
      .filter((r) => Number(r._sum.costGbp ?? 0) > 0)
      .map((r) => `  ${r.service}: £${Number(r._sum.costGbp ?? 0).toFixed(2)}`)
      .join('\n')

    await sendTelegramAdmin(
      `🚨 Ivy cost alert — daily threshold crossed\n\nToday's spend: £${totalToday.toFixed(2)}\nThreshold: £${threshold}\n\nBy service:\n${breakdown}`
    )
  }
}

export async function getUserMonthlyCost(userId: string): Promise<number> {
  const startOfMonth = new Date()
  startOfMonth.setDate(1)
  startOfMonth.setHours(0, 0, 0, 0)

  const result = await prisma.apiUsageLog.aggregate({
    where: { userId, createdAt: { gte: startOfMonth } },
    _sum: { costGbp: true },
  })

  return result._sum.costGbp ?? 0
}

export async function getServiceCostSummary(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const results = await prisma.apiUsageLog.groupBy({
    by: ['service', 'operation'],
    where: { createdAt: { gte: since } },
    _sum: { costGbp: true, units: true },
    _count: true,
  })

  return results.map((r) => ({
    service: r.service,
    operation: r.operation,
    totalCostGbp: r._sum.costGbp ?? 0,
    totalUnits: r._sum.units ?? 0,
    count: r._count,
  }))
}
