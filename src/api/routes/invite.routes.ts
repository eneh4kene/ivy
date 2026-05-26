import { Router, Request, Response, NextFunction } from 'express';
import coachService from '../../services/coach.service';

const router = Router();

// GET /api/invite/:token — fetch coach info for the landing page (public)
router.get('/:token', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const info = await coachService.resolveInviteToken(req.params.token);
    res.json({ success: true, data: info });
  } catch (err) { next(err); }
});

// POST /api/invite/:token/join — submit email, get a magic link sent
router.post('/:token/join', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;
    if (!email) { res.status(400).json({ success: false, error: 'email required' }); return; }
    await coachService.joinViaInviteToken(req.params.token, email);
    res.json({ success: true, data: { message: 'Check your email for a link to get started' } });
  } catch (err) { next(err); }
});

export default router;
