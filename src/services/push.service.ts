import webpush from 'web-push'
import prisma from '../utils/prisma'

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    `mailto:${process.env.VAPID_EMAIL || 'noreply@yourdomain.com'}`,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
}

export interface PushPayload {
  title: string
  body: string
  tag?: string
  url?: string
  icon?: string
  actions?: { action: string; title: string }[]
}

export async function subscribeDevice(
  userId: string,
  subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent?: string
) {
  await prisma.pushSubscription.upsert({
    where: { endpoint: subscription.endpoint },
    update: {
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      isActive: true,
      userAgent,
      updatedAt: new Date(),
    },
    create: {
      userId,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent,
    },
  })
}

export async function unsubscribeDevice(endpoint: string) {
  await prisma.pushSubscription.updateMany({
    where: { endpoint },
    data: { isActive: false },
  })
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) return

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId, isActive: true },
  })

  if (subscriptions.length === 0) return

  const message = JSON.stringify(payload)

  await Promise.allSettled(
    subscriptions.map(async (sub: { id: string; endpoint: string; p256dh: string; auth: string }) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          message
        )
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsed: new Date() },
        })
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          await prisma.pushSubscription.update({
            where: { id: sub.id },
            data: { isActive: false },
          })
        }
      }
    })
  )
}

export async function sendPushToMany(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map((id) => sendPushToUser(id, payload)))
}

// Pre-built notification templates
export const pushTemplates = {
  streakWarning: (streakDays: number): PushPayload => ({
    title: 'Don\'t break your streak 🔥',
    body: `You're on a ${streakDays}-day streak. Log today's commitment before midnight.`,
    tag: 'streak-warning',
    url: '/workouts',
  }),

  callMissed: (): PushPayload => ({
    title: 'Ivy tried to reach you',
    body: 'You missed your check-in call. Tap to log your commitment manually.',
    tag: 'missed-call',
    url: '/workouts',
  }),

  batonDrop: (name: string, hoursLeft: number): PushPayload => ({
    title: `${name} dropped the baton`,
    body: `${hoursLeft} hours left to save your team's streak.`,
    tag: 'baton-drop',
    url: '/dashboard',
  }),

  witnessDigest: (userName: string): PushPayload => ({
    title: 'Weekly digest ready',
    body: `Your weekly update for ${userName} is in.`,
    tag: 'witness-digest',
    url: '/settings#buddy',
  }),

  seasonClose: (): PushPayload => ({
    title: 'Your Season Close is ready',
    body: 'Ivy has your 12-week transformation story waiting. Tap to hear it.',
    tag: 'season-close',
    url: '/seasons',
  }),

  impactStory: (charity: string): PushPayload => ({
    title: 'Your impact landed 💚',
    body: `${charity} has a message for you about what your follow-through funded.`,
    tag: 'impact-story',
    url: '/donations',
  }),
}
