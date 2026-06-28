/**
 * Ivy in-app chat routes.
 *
 *   GET  /api/chat          → full IN_APP thread (oldest → newest) + marks read
 *   GET  /api/chat/unread   → unread Ivy-message count (nav badge)
 *   POST /api/chat          → { content } send a message, returns Ivy's reply
 *   POST /api/chat/action   → { action, at? } tap an Ivy action card (handoff)
 *
 * All authenticated. The reply engine lives in chat.service.
 */

import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import chatService from '../../services/chat.service'

const router = Router()
router.use(authenticate)

router.get('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.user!.id
    const thread = await chatService.getThread(userId)
    await chatService.markRead(userId)
    res.json({ success: true, data: thread })
  } catch (err) {
    next(err)
  }
})

router.get('/unread', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const count = await chatService.getUnreadCount(req.user!.id)
    res.json({ success: true, data: { count } })
  } catch (err) {
    next(err)
  }
})

const sendSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'content is required').max(2000),
  }),
})

router.post('/', validate(sendSchema), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const reply = await chatService.sendUserMessage(req.user!.id, req.body.content)
    res.status(201).json({ success: true, data: reply })
  } catch (err) {
    next(err)
  }
})

const actionSchema = z.object({
  body: z.object({
    action: z.enum(['call_now', 'schedule', 'just_text']),
    at: z.string().datetime().optional(),
  }),
})

router.post('/action', validate(actionSchema), async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { action, at } = req.body
    const msg = await chatService.handleAction(req.user!.id, action, { at })
    res.json({ success: true, data: msg })
  } catch (err) {
    next(err)
  }
})

export default router
