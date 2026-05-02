import { Router, Request, Response } from 'express'
import { authenticate } from '../../middleware/auth'
import { subscribeDevice, unsubscribeDevice } from '../../services/push.service'

const router = Router()

router.get('/vapid-public-key', (_req: Request, res: Response): void => {
  const key = process.env.VAPID_PUBLIC_KEY
  if (!key) {
    res.status(503).json({ success: false, error: 'Push notifications not configured' })
    return
  }
  res.json({ success: true, data: { publicKey: key } })
})

router.post('/subscribe', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.userId
    const { subscription } = req.body

    if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
      res.status(400).json({ success: false, error: 'Invalid subscription object' })
      return
    }

    const userAgent = req.headers['user-agent']
    await subscribeDevice(userId, subscription, userAgent)
    res.json({ success: true, data: { message: 'Subscribed' } })
  } catch {
    res.status(500).json({ success: false, error: 'Failed to save subscription' })
  }
})

router.post('/unsubscribe', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const { endpoint } = req.body
    if (!endpoint) {
      res.status(400).json({ success: false, error: 'endpoint required' })
      return
    }
    await unsubscribeDevice(endpoint)
    res.json({ success: true, data: { message: 'Unsubscribed' } })
  } catch {
    res.status(500).json({ success: false, error: 'Failed to remove subscription' })
  }
})

export default router
