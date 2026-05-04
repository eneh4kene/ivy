import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth'
import circleService from '../../services/circle.service'
import { AuthRequest } from '../../middleware/auth'

const router = Router()
router.use(authenticate)

// GET /api/circles/my — circles I'm in
router.get('/my', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const memberships = await circleService.getCirclesForUser(req.user!.id)
    res.json({ success: true, data: memberships })
  } catch (err) { next(err) }
})

// GET /api/circles/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const circle = await circleService.getCircle(req.params.id)
    res.json({ success: true, data: circle })
  } catch (err) { next(err) }
})

// POST /api/circles — create a circle (Ivy Plus / Concierge / B2B admin)
router.post('/', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, track, tier, seasonTheme, companyId, maxSize } = req.body
    if (!name || !track) {
      res.status(400).json({ success: false, error: 'name and track are required' }); return
    }
    const circle = await circleService.createCircle({ name, track, tier: tier ?? 'peer', seasonTheme, companyId, maxSize })
    res.status(201).json({ success: true, data: circle })
  } catch (err) { next(err) }
})

// PATCH /api/circles/:id — update name, seasonTheme, track
router.patch('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { name, seasonTheme, track } = req.body
    const circle = await circleService.updateCircle(req.params.id, { name, seasonTheme, track })
    res.json({ success: true, data: circle })
  } catch (err) { next(err) }
})

// POST /api/circles/:id/members — join or add a member
router.post('/:id/members', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = req.body.userId ?? req.user!.id
    const role = req.body.role ?? 'member'
    const member = await circleService.addMember(req.params.id, userId, role)
    res.status(201).json({ success: true, data: member })
  } catch (err) { next(err) }
})

// DELETE /api/circles/:id/members/:userId — leave or remove
router.delete('/:id/members/:userId', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    await circleService.removeMember(req.params.id, req.params.userId)
    res.json({ success: true, data: { message: 'Removed' } })
  } catch (err) { next(err) }
})

// POST /api/circles/:id/sprint-goals — set collective sprint pledge
router.post('/:id/sprint-goals', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { sprintNumber, pledge, theme, targetMetric } = req.body
    if (!sprintNumber || !pledge) {
      res.status(400).json({ success: false, error: 'sprintNumber and pledge required' }); return
    }
    const goal = await circleService.setSprintGoal(req.params.id, {
      sprintNumber,
      pledge,
      theme,
      targetMetric,
      setByUserId: req.user!.id,
    })
    res.json({ success: true, data: goal })
  } catch (err) { next(err) }
})

// GET /api/circles/:id/sprint-goals/:sprintNumber
router.get('/:id/sprint-goals/:sprintNumber', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const goal = await circleService.getSprintGoal(req.params.id, Number(req.params.sprintNumber))
    res.json({ success: true, data: goal })
  } catch (err) { next(err) }
})

// GET /api/circles/:id/consistency — group consistency for current sprint
router.get('/:id/consistency', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const stats = await circleService.getGroupConsistency(req.params.id)
    res.json({ success: true, data: stats })
  } catch (err) { next(err) }
})

export default router
