import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireSuperAdmin, AuthRequest } from '../../middleware/auth';
import adminController from '../controllers/admin.controller';
import gameSuggestionService from '../../services/game-suggestion.service';

const router = Router();

router.use(authenticate);

// GET /api/admin/stats — aggregate company stats
router.get('/stats', adminController.getStats.bind(adminController));

// GET /api/admin/employees — employee list
router.get('/employees', adminController.getEmployees.bind(adminController));

// POST /api/admin/employees/invite — send magic link invites
router.post('/employees/invite', adminController.inviteEmployees.bind(adminController));

// GET /api/admin/reports — report data (CSV or JSON based on ?type=)
router.get('/reports', adminController.getReportData.bind(adminController));

// GET /api/admin/calls — call transcripts for review (pilot monitoring)
// Query: ?limit=30&offset=0&callType=MORNING_PLANNING&sentiment=struggling&userId=...
router.get('/calls', adminController.getCalls.bind(adminController));

// GET /api/admin/usage — AI + messaging cost breakdown for company users
// Query: ?days=30 (default 30)
router.get('/usage', adminController.getUsage.bind(adminController));

// GET /api/admin/platform-costs — full platform cost dashboard (superadmin only)
// Query: ?days=30 (max 90)
router.get('/platform-costs', requireSuperAdmin, adminController.getPlatformCosts.bind(adminController));

// ── Game Suggestions (superadmin only) ────────────────────────────────────────

router.get('/game-suggestions', requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json({ success: true, data: await gameSuggestionService.listAll() });
  } catch (err) { next(err); }
});

router.post('/game-suggestions', requireSuperAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { title, description, templateType, ivyInstruction, tracks, tags, published } = req.body;
    if (!title || !ivyInstruction) {
      res.status(400).json({ success: false, error: 'title and ivyInstruction are required' }); return;
    }
    const suggestion = await gameSuggestionService.create({
      title, description: description ?? '', templateType: templateType ?? 'custom',
      ivyInstruction, tracks, tags, published,
      createdByEmail: req.user!.email,
    });
    res.status(201).json({ success: true, data: suggestion });
  } catch (err) { next(err); }
});

router.patch('/game-suggestions/:id', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await gameSuggestionService.update(req.params.id, req.body);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

router.delete('/game-suggestions/:id', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    await gameSuggestionService.delete(req.params.id);
    res.json({ success: true, data: { message: 'Deleted' } });
  } catch (err) { next(err); }
});

export default router;
