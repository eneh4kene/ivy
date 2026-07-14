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

// ── Ops (superadmin only) ─────────────────────────────────────────────────────

// GET /api/admin/ops/events — recent ops alerts (severity/source filterable)
router.get('/ops/events', requireSuperAdmin, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = (await import('../../utils/prisma')).default;
    const { severity, source, before } = req.query as Record<string, string | undefined>;
    const limit = Math.min(Number(req.query.limit ?? 50), 200);
    const events = await prisma.opsEvent.findMany({
      where: {
        ...(severity ? { severity } : {}),
        ...(source ? { source } : {}),
        ...(before ? { createdAt: { lt: new Date(before) } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    res.json({ success: true, data: events });
  } catch (err) { next(err); }
});

// GET /api/admin/ops/jobs — heartbeat table + watchdog verdicts
router.get('/ops/jobs', requireSuperAdmin, async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const prisma = (await import('../../utils/prisma')).default;
    const { JOB_REGISTRY } = await import('../../inngest/watchdog');
    const rows = await prisma.jobHeartbeat.findMany({ orderBy: { jobName: 'asc' } });
    const byName = new Map(rows.map((r) => [r.jobName, r]));
    const now = Date.now();
    const jobs = Object.entries(JOB_REGISTRY).map(([jobName, spec]) => {
      const hb = byName.get(jobName);
      const staleMinutes = hb ? Math.round((now - hb.lastStartedAt.getTime()) / 60000) : null;
      return {
        jobName,
        allowedStalenessMin: spec.maxStalenessMin,
        staleMinutes,
        lastStatus: hb?.lastStatus ?? 'NEVER_RAN',
        lastStartedAt: hb?.lastStartedAt ?? null,
        lastFinishedAt: hb?.lastFinishedAt ?? null,
        lastError: hb?.lastError ?? null,
        verdict: !hb ? 'never_ran' : staleMinutes! > spec.maxStalenessMin ? 'overdue' : 'ok',
      };
    });
    res.json({ success: true, data: jobs });
  } catch (err) { next(err); }
});


// POST /api/admin/ops/test-alert — smoke-test the alert pipeline end to end
// (Winston + Sentry + Telegram unless OPS_ALERTS_MUTED). Body: { severity? }.
router.post('/ops/test-alert', requireSuperAdmin, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { opsAlert } = await import('../../lib/ops-alert');
    const severity = req.body?.severity === 'critical' ? 'critical' as const : 'warn' as const;
    await opsAlert({
      severity,
      source: 'ops-test',
      title: 'test_alert',
      detail: `fired by ${req.user!.email} at ${new Date().toISOString()}`,
    });
    res.json({ success: true, data: { severity, muted: process.env.OPS_ALERTS_MUTED === 'true' } });
  } catch (err) { next(err); }
});

export default router;
