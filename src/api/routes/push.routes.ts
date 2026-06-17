import { Router, Request, Response, NextFunction } from 'express'
import { authenticate, AuthRequest } from '../../middleware/auth'
import { subscribeDevice, unsubscribeDevice } from '../../services/push.service'

const router = Router()

/**
 * POST /api/push/resubscribe
 *
 * Called by the PWA Service Worker when the browser rotates the VAPID
 * push subscription (the old endpoint expires and the SW receives a
 * `pushsubscriptionchange` event with a new subscription object).
 *
 * Body: { oldEndpoint: string, newSubscription: { endpoint, keys: { p256dh, auth } } }
 *
 * The handler deactivates the old subscription and upserts the new one.
 * This is idempotent — if the old subscription is already gone, it's a no-op.
 */
router.post('/resubscribe', authenticate, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id
    const { oldEndpoint, newSubscription } = req.body

    if (!newSubscription?.endpoint || !newSubscription?.keys?.p256dh || !newSubscription?.keys?.auth) {
      res.status(400).json({ success: false, error: 'Invalid newSubscription object' })
      return
    }

    // Deactivate the old subscription (if provided and if it's ours)
    if (oldEndpoint && typeof oldEndpoint === 'string') {
      await unsubscribeDevice(oldEndpoint)
    }

    // Register the new subscription
    const userAgent = req.headers['user-agent']
    await subscribeDevice(userId, newSubscription, userAgent)

    res.json({ success: true, data: { message: 'Resubscribed' } })
  } catch (err) {
    next(err)
  }
})

router.get('/vapid-public-key', (_req: Request, res: Response): void => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) {
    res.status(503).json({ success: false, error: 'Push notifications not configured' })
    return
  }
  res.json({ success: true, data: { publicKey: key } })
})

router.post('/subscribe', authenticate, async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id
    const { subscription } = req.body

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ success: false, error: 'Invalid subscription object' })
      return
    }

    const userAgent = req.headers['user-agent']
    await subscribeDevice(userId, subscription, userAgent)
    res.json({ success: true, data: { message: 'Subscribed' } })
  } catch (err) {
    next(err)
  }
})

router.post('/unsubscribe', authenticate, async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { endpoint } = req.body
    if (!endpoint) {
      res.status(400).json({ success: false, error: 'endpoint required' })
      return
    }
    await unsubscribeDevice(endpoint)
    res.json({ success: true, data: { message: 'Unsubscribed' } })
  } catch (err) {
    next(err)
  }
})

export default router
