import { Router } from 'express';
import { authenticate } from '../../middleware/auth';
import seasonService from '../../services/season.service';
import { sendSuccess } from '../../utils/response';

const router = Router();

router.use(authenticate);

router.get('/', async (req: any, res, next) => {
  try {
    const seasons = await seasonService.getAllSeasons(req.user.id);
    sendSuccess(res, seasons);
  } catch (e) { next(e); }
});

router.get('/active', async (req: any, res, next) => {
  try {
    const season = await seasonService.getActiveSeason(req.user.id);
    sendSuccess(res, season);
  } catch (e) { next(e); }
});

router.get('/current-sprint', async (req: any, res, next) => {
  try {
    const sprint = await seasonService.getCurrentSprint(req.user.id);
    sendSuccess(res, sprint);
  } catch (e) { next(e); }
});

router.post('/', async (req: any, res, next) => {
  try {
    const season = await seasonService.createSeason(req.user.id, req.body);
    sendSuccess(res, season, 201);
  } catch (e) { next(e); }
});

router.post('/:id/close', async (req: any, res, next) => {
  try {
    const season = await seasonService.closeSeason(req.user.id, req.params.id);
    sendSuccess(res, season);
  } catch (e) { next(e); }
});

// POST /api/seasons/next — start Season 2, 3, etc. after Season Close
router.post('/next', async (req: any, res, next) => {
  try {
    const season = await seasonService.startNextSeason(req.user.id);
    sendSuccess(res, season, 201);
  } catch (e) { next(e); }
});

export default router;
