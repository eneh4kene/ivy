import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { UnauthorizedError } from '../../utils/errors';
import coachService from '../../services/coach.service';

const router = Router();
router.use(authenticate);

// Gate: only COACH tier accounts
function requireCoach(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.subscriptionTier !== 'COACH') {
    return next(new UnauthorizedError('Coach account required'));
  }
  next();
}

// GET /api/coach/profile
router.get('/profile', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await coachService.getProfile(req.user!.id);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// PATCH /api/coach/profile
router.patch('/profile', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const profile = await coachService.upsertProfile(req.user!.id, req.body);
    res.json({ success: true, data: profile });
  } catch (err) { next(err); }
});

// GET /api/coach/clients
router.get('/clients', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const clients = await coachService.getClients(req.user!.id);
    res.json({ success: true, data: clients });
  } catch (err) { next(err); }
});

// GET /api/coach/clients/:id
router.get('/clients/:id', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const client = await coachService.getClientDetail(req.user!.id, req.params.id);
    res.json({ success: true, data: client });
  } catch (err) { next(err); }
});

// PATCH /api/coach/clients/:id/notes
router.patch('/clients/:id/notes', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { coachNotes } = req.body;
    if (coachNotes === undefined) { res.status(400).json({ success: false, error: 'coachNotes required' }); return; }
    const updated = await coachService.updateClientNotes(req.user!.id, req.params.id, coachNotes);
    res.json({ success: true, data: updated });
  } catch (err) { next(err); }
});

// POST /api/coach/clients/invite
router.post('/clients/invite', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ success: false, error: 'email required' }); return; }
    const result = await coachService.inviteClient(req.user!.id, email);
    res.status(201).json({ success: true, data: result });
  } catch (err) { next(err); }
});

// DELETE /api/coach/clients/:id
router.delete('/clients/:id', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    await coachService.removeClient(req.user!.id, req.params.id);
    res.json({ success: true, data: { message: 'Client removed' } });
  } catch (err) { next(err); }
});

export default router;
