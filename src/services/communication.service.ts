import prisma from '../utils/prisma'
import logger from '../utils/logger'
import messagingService from './messaging.service'
import { sendPushToUser, pushTemplates } from './push.service'

export type InteractionType =
  | 'MORNING_CHECKIN'
  | 'EVENING_CHECKIN'
  | 'RESCUE'
  | 'MISSED_CALL'
  | 'STREAK_MILESTONE'
  | 'SPRINT_END'
  | 'SEASON_CLOSE'
  | 'BATON_WINDOW'
  | 'IMPACT_STORY'

export type ChannelDecision =
  | 'CALL'
  | 'TEXT'
  | 'TEXT_WITH_CALL_OFFER'  // text first, include "mind if I call?"
  | 'PUSH_ONLY'

interface RouteResult {
  channel: ChannelDecision
  reason: string
}

// Moments significant enough that voice adds real value — Ivy asks text users first
const SIGNIFICANT_MOMENTS: InteractionType[] = [
  'RESCUE',
  'SEASON_CLOSE',
  'STREAK_MILESTONE',
  'SPRINT_END',
]

export async function routeInteraction(
  userId: string,
  interactionType: InteractionType
): Promise<RouteResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { commStyle: true, firstName: true },
  })

  if (!user) return { channel: 'TEXT', reason: 'user_not_found' }

  const isSignificant = SIGNIFICANT_MOMENTS.includes(interactionType)
  const recentMissed = await countRecentMissedCalls(userId, 3)
  const warmingUp = await isTextUserWarmingUp(userId)

  switch (user.commStyle) {
    case 'CALLS':
      // Always call. If 3+ missed recently, offer to switch to texts.
      if (recentMissed >= 3) {
        await sendTextualNudge(userId, 'calls_not_landing')
      }
      return { channel: 'CALL', reason: 'user_prefers_calls' }

    case 'TEXTS':
      // Significant moments: ask before calling
      if (isSignificant) {
        return { channel: 'TEXT_WITH_CALL_OFFER', reason: 'significant_moment' }
      }
      // Occasionally offer a call based on context
      if (warmingUp) {
        return { channel: 'TEXT_WITH_CALL_OFFER', reason: 'warming_up' }
      }
      return { channel: 'TEXT', reason: 'user_prefers_texts' }

    case 'ADAPTIVE':
    default:
      // Significant moments always call
      if (isSignificant) return { channel: 'CALL', reason: 'significant_moment' }
      // If 2+ missed calls recently, drift to text
      if (recentMissed >= 2) {
        return { channel: 'TEXT', reason: 'missed_calls_fallback' }
      }
      return { channel: 'CALL', reason: 'adaptive_default' }
  }
}

// Fires the right outbound interaction based on routing decision
export async function dispatchInteraction(
  userId: string,
  interactionType: InteractionType,
  context?: Record<string, unknown>
): Promise<void> {
  const { channel, reason } = await routeInteraction(userId, interactionType)

  logger.info(`dispatch:${interactionType} → ${channel} (${reason}) for user ${userId}`)

  switch (channel) {
    case 'CALL': {
      const callTypeMap: Partial<Record<InteractionType, string>> = {
        RESCUE: 'RESCUE',
        SEASON_CLOSE: 'SEASON_CLOSE',
        SPRINT_END: 'SEASON_CLOSE',
        MORNING_CHECKIN: 'MORNING_PLANNING',
        EVENING_CHECKIN: 'EVENING_REVIEW',
        STREAK_MILESTONE: 'EVENING_REVIEW',
      }
      const callType = (callTypeMap[interactionType] ?? 'RESCUE') as any
      const scheduledAt = new Date(Date.now() + 2 * 60 * 1000)
      const { default: callService } = await import('./call.service')
      await callService.scheduleCall(userId, callType, scheduledAt, context as Record<string, any>)
      break
    }

    case 'TEXT':
      await sendTextCheckin(userId, interactionType, context)
      break

    case 'TEXT_WITH_CALL_OFFER':
      await sendTextCheckin(userId, interactionType, context, true)
      break

    case 'PUSH_ONLY':
      await sendPushForInteraction(userId, interactionType)
      break
  }
}

// Fires when a call drops before it could complete (duration < 45s, abnormal disconnect).
// Message is aware of what kind of call was interrupted.
export async function handleDroppedCall(userId: string, callType: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, phone: true },
  })
  if (!user?.phone) return

  const name = user.firstName ? ` ${user.firstName}` : ''

  const messages: Record<string, string> = {
    MORNING_PLANNING:
      `Hey${name}, looks like we got cut off — what's the plan today? Activity + time. Just reply here.`,
    EVENING_REVIEW:
      `Hey${name}, we got cut off — did you get it done today? Just reply here.`,
    RESCUE:
      `Hey${name} — we got cut off. Are you okay? Talk to me here.`,
    WEEKLY_PLANNING:
      `Hey${name}, we got cut off on your weekly planning — which days are you working out this week?`,
    SEASON_CLOSE:
      `Hey${name}, we got cut off on your season close — that deserves a proper ending. Reply CALL and I'll ring you back.`,
    MONTHLY_CHECKIN:
      `Hey${name}, we got cut off — quick one: energy and mood this week, 1-10? Reply here.`,
    ONBOARDING:
      `Hey${name}, we got cut off during setup — head back to the app to finish getting started.`,
  }

  const message = messages[callType] ?? `Hey${name}, looks like we got cut off. Talk to me here.`

  await messagingService.sendMessage(userId, message, 'nudge')
  logger.info(`Dropped call follow-up sent to ${userId} (${callType})`)
}

// Handles missed call — fires within 5 minutes of a no-answer
export async function handleMissedCall(userId: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, phone: true, commStyle: true },
  })
  if (!user?.phone) return

  const name = user.firstName ? ` ${user.firstName}` : ''
  const message = [
    `Hey${name}, bad time?`,
    ``,
    `Reply:`,
    `• CALL — try me again in 15 mins`,
    `• TEXT — let's keep it here today`,
    ``,
    `Or just tell me how today went 💬`,
  ].join('\n')

  await messagingService.sendMessage(userId, message, 'nudge')
  logger.info(`Missed call fallback text sent to ${userId}`)
}

// ─── Private helpers ────────────────────────────────────────────────────────

async function countRecentMissedCalls(userId: string, limit: number): Promise<number> {
  const recent = await prisma.call.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: { status: true },
  })
  return recent.filter((c) => ['NO_ANSWER', 'FAILED'].includes(c.status as string)).length
}

async function isTextUserWarmingUp(userId: string): Promise<boolean> {
  // Text user who has been consistent for 14+ days — good moment to suggest a call
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { commStyle: true, createdAt: true },
  })
  if (user?.commStyle !== 'TEXTS') return false

  const daysSinceSignup = Math.floor(
    (Date.now() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (daysSinceSignup < 14) return false

  // Check last 7 completions
  const recentWorkouts = await prisma.workout.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take: 7,
  })

  // Suggest a call if they've completed 5+ of the last 7
  const shouldOffer = recentWorkouts.length >= 5
  if (!shouldOffer) return false

  // Don't offer more than once every 7 days
  const lastOffer = await prisma.message.findFirst({
    where: { userId, content: { contains: 'mind if I call' } },
    orderBy: { createdAt: 'desc' },
  })
  if (!lastOffer) return true

  const daysSinceOffer = Math.floor(
    (Date.now() - lastOffer.createdAt.getTime()) / (1000 * 60 * 60 * 24)
  )
  return daysSinceOffer >= 7
}

async function sendTextCheckin(
  userId: string,
  type: InteractionType,
  context?: Record<string, unknown>,
  withCallOffer = false
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true, goal: true, minimumMode: true },
  })
  if (!user) return

  const name = user.firstName || 'there'
  let message = ''

  switch (type) {
    case 'MORNING_CHECKIN':
      message = `Morning ${name} 👋 What's your plan today?`
      break
    case 'EVENING_CHECKIN':
      message = `Hey ${name} — did you get it done today? Reply yes, no, or tell me how it went.`
      break
    case 'RESCUE':
      message = `${name}, sounds like today's a tough one. What's the smallest thing you could do that would still count as a yes? Even ${user.minimumMode || '10 minutes'} counts.`
      break
    case 'SPRINT_END':
      message = `${name}, that's the end of your sprint. Four weeks of showing up. Take a moment — what was your biggest win?`
      break
    case 'SEASON_CLOSE':
      message = `${name}, you've finished your season. 12 weeks of follow-through. I've got your full story ready.`
      break
    case 'STREAK_MILESTONE':
      message = `${name} 🔥 ${context?.streakDays ?? ''} days in a row. That's not a habit anymore — that's who you are.`
      break
    default:
      message = `Hey ${name}, checking in — how are things going today?`
  }

  if (withCallOffer) {
    message += `\n\nMind if I call instead? This feels like a moment that deserves more than a text. Reply "call me" and I'll ring you now.`
  }

  await messagingService.sendMessage(userId, message, 'nudge')
}

async function sendTextualNudge(userId: string, situation: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { firstName: true },
  })
  if (!user) return

  const name = user.firstName || 'there'

  const messages: Record<string, string> = {
    calls_not_landing: `${name}, calls haven't been landing lately. Want to switch to texts for a bit? Just reply "texts" and we'll go from there. We can always go back.`,
  }

  const message = messages[situation]
  if (message) {
    await messagingService.sendWhatsAppMessage(userId, message, 'nudge')
  }
}

async function sendPushForInteraction(userId: string, type: InteractionType): Promise<void> {
  const templates: Partial<Record<InteractionType, () => ReturnType<typeof pushTemplates.streakWarning>>> = {
    MISSED_CALL: () => pushTemplates.callMissed(),
    SEASON_CLOSE: () => pushTemplates.seasonClose(),
    IMPACT_STORY: () => pushTemplates.impactStory('your charity'),
  }
  const template = templates[type]
  if (template) await sendPushToUser(userId, template())
}
