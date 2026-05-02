import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import callService from '../../services/call.service';
import { sendSuccess } from '../../utils/response';

const router = Router();

router.use(authenticate);

// GET /api/calls — list calls for current user
router.get('/', async (req: any, res, next) => {
  try {
    const { limit = 20, offset = 0 } = req.query;
    const calls = await callService.getCallsForUser(req.user.userId, Number(limit), Number(offset));
    sendSuccess(res, calls);
  } catch (e) { next(e); }
});

// GET /api/calls/upcoming — upcoming scheduled calls
router.get('/upcoming', async (req: any, res, next) => {
  try {
    const calls = await callService.getUpcomingCallsForUser(req.user.userId);
    sendSuccess(res, calls);
  } catch (e) { next(e); }
});

// POST /api/calls/rescue — user initiates a rescue call
router.post('/rescue', async (req: any, res, next) => {
  try {
    const call = await callService.scheduleRescueCall(req.user.userId);
    sendSuccess(res, call, 201);
  } catch (e) { next(e); }
});

export default router;
