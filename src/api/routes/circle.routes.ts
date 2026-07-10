import { Router, Request, Response, NextFunction } from 'express'
import { authenticate } from '../../middleware/auth'
import circleService from '../../services/circle.service'
import { AuthRequest } from '../../middleware/auth'
import prisma from '../../utils/prisma'
import logger from '../../utils/logger'
import {
  listTemplates, createGame, createSpecGame, listGames, getGame, getActiveGame, pauseGame, endGame
} from '../controllers/circle-game.controller'
import gameSuggestionService from '../../services/game-suggestion.service'
import circleCatchupService from '../../services/circle-catchup.service'
import circleSessionService from '../../services/circle-session.service'

const router = Router()
router.use(authenticate)

// GET /api/circles/my — circles I'm in
router.get('/my', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const memberships = await circleService.getCirclesForUser(req.user!.id)
    res.json({ success: true, data: memberships })
  } catch (err) { next(err) }
})

// GET /api/circles/session/current — my circle's current session + the room
// (room content only visible once I've shared). MUST stay above /:id.
router.get('/session/current', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const session = await circleSessionService.getCurrentSession(req.user!.id)
    res.json({ success: true, data: session })
  } catch (err) { next(err) }
})

// POST /api/circles/session/share — drop my win + struggle, unlock the room
router.post('/session/share', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { win, struggle } = req.body ?? {}
    const session = await circleSessionService.submitShare(req.user!.id, String(win ?? ''), String(struggle ?? ''))
    res.json({ success: true, data: session })
  } catch (err) { next(err) }
})

// POST /api/circles/session/nudge — Ivy drafts a candidate win + struggle from
// the member's real sprint record. Editable text only; never auto-submitted.
router.post('/session/nudge', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const draft = await circleSessionService.draftShareNudge(req.user!.id)
    res.json({ success: true, data: draft })
  } catch (err) { next(err) }
})

// GET /api/circles/:id — members only (a circle's roster is not public to
// every authenticated user). 404 rather than 403 so we don't confirm a circle
// exists to non-members.
router.get('/:id', async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const isMember = await circleService.isActiveMember(req.params.id, req.user!.id)
    if (!isMember) {
      res.status(404).json({ success: false, error: 'Circle not found' }); return
    }
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

// ── Sprint Sessions ───────────────────────────────────────────────────────────

// PATCH /api/circles/sessions/:id/complete — mark session done, trigger catch-ups
router.patch('/sessions/:id/complete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { collectivePledge, highlights, participantUserIds } = req.body
    if (!collectivePledge) {
      res.status(400).json({ success: false, error: 'collectivePledge is required' }); return
    }

    const session = await prisma.circleSprintSession.update({
      where: { id: req.params.id },
      data: {
        status: 'completed',
        conductedAt: new Date(),
        collectivePledge,
        highlights: highlights ?? null,
        participantUserIds: JSON.stringify(participantUserIds ?? []),
      },
    })

    // Non-blocking — write catch-up records for absent members
    circleCatchupService.createCatchupsForAbsentees(session.id)
      .catch((err) => logger.warn('Catch-up creation failed', err))

    res.json({ success: true, data: session })
  } catch (err) { next(err) }
})

// GET /api/circles/:circleId/sessions — list sessions for a circle
router.get('/:circleId/sessions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sessions = await prisma.circleSprintSession.findMany({
      where: { circleId: req.params.circleId },
      orderBy: { scheduledAt: 'desc' },
    })
    res.json({ success: true, data: sessions })
  } catch (err) { next(err) }
})

// ── Circle Games ──────────────────────────────────────────────────────────────

// GET /api/circles/games/suggestions?track=fitness&tag=seasonal
router.get('/games/suggestions', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { track, tag } = req.query as { track?: string; tag?: string };
    const suggestions = await gameSuggestionService.listPublished(track, tag);
    res.json({ success: true, data: suggestions });
  } catch (err) { next(err); }
})

// GET /api/circles/games/templates
router.get('/games/templates', listTemplates)

// GET /api/circles/games/active — active game for calling user's circle
router.get('/games/active', getActiveGame)

// GET /api/circles/:circleId/games
router.get('/:circleId/games', listGames)

// POST /api/circles/:circleId/games
router.post('/:circleId/games', createGame)

// POST /api/circles/:circleId/games/spec — author a spec-backed game (LLM prompt or validated spec)
router.post('/:circleId/games/spec', createSpecGame)

// GET /api/circles/games/:gameId
router.get('/games/:gameId', getGame)

// PATCH /api/circles/games/:gameId/pause
router.patch('/games/:gameId/pause', pauseGame)

// PATCH /api/circles/games/:gameId/end
router.patch('/games/:gameId/end', endGame)

export default router
