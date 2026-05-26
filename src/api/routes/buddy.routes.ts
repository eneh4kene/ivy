import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import { AuthRequest } from '../../middleware/auth';
import buddyService from '../../services/buddy.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);

router.get('/', async (req: AuthRequest, res, next) => {
  try {
    const buddy = await buddyService.getBuddy(req.user!.id);
    sendSuccess(res, buddy);
  } catch (e) {
    next(e);
  }
});

router.post('/', async (req: AuthRequest, res, next) => {
  try {
    const { buddyName, buddyEmail, buddyPhone } = req.body;
    if (!buddyName || (!buddyEmail && !buddyPhone)) {
      res.status(400).json({
        success: false,
        error: {
          message: 'buddyName and at least one of buddyEmail or buddyPhone are required',
        },
      });
      return;
    }
    const buddy = await buddyService.setBuddy(req.user!.id, {
      buddyName,
      buddyEmail,
      buddyPhone,
    });
    sendSuccess(res, buddy, 201);
  } catch (e) {
    next(e);
  }
});

router.delete('/', async (req: AuthRequest, res, next) => {
  try {
    await buddyService.removeBuddy(req.user!.id);
    sendSuccess(res, { removed: true });
  } catch (e) {
    next(e);
  }
});

export default router;
