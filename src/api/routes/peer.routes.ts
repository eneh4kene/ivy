import { Router } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import peerMessageService from '../../services/peer-message.service';
import { sendSuccess } from '../../utils/response';

const router = Router();
router.use(authenticate);

// GET /api/peer/partner — who this user may write to, and whether they still can.
router.get('/partner', async (req: AuthRequest, res, next) => {
  try {
    sendSuccess(res, await peerMessageService.getPartner(req.user!.id));
  } catch (e) {
    next(e);
  }
});

// GET /api/peer/messages — notes received, newest first.
router.get('/messages', async (req: AuthRequest, res, next) => {
  try {
    sendSuccess(res, await peerMessageService.inbox(req.user!.id, Number(req.query.limit) || 20));
  } catch (e) {
    next(e);
  }
});

// POST /api/peer/messages — send a note to your pair partner.
// Refusals are ordinary product states, so they come back as 4xx with a code
// the client can phrase, never as a generic failure.
router.post('/messages', async (req: AuthRequest, res, next) => {
  try {
    const result = await peerMessageService.sendToPartner(req.user!.id, req.body?.content);
    if (result.ok) {
      sendSuccess(res, result, 201);
      return;
    }
    const status = result.reason === 'rate_limited' ? 429 : result.reason === 'no_partner' ? 404 : 400;
    res.status(status).json({ success: false, error: result.reason });
  } catch (e) {
    next(e);
  }
});

// POST /api/peer/block — { targetId }. Stops contact; never touches the game.
router.post('/block', async (req: AuthRequest, res, next) => {
  try {
    const { targetId } = req.body ?? {};
    if (!targetId) {
      res.status(400).json({ success: false, error: 'targetId required' });
      return;
    }
    sendSuccess(res, await peerMessageService.blockMember(req.user!.id, targetId));
  } catch (e) {
    next(e);
  }
});

// DELETE /api/peer/block/:targetId
router.delete('/block/:targetId', async (req: AuthRequest, res, next) => {
  try {
    sendSuccess(res, await peerMessageService.unblockMember(req.user!.id, req.params.targetId));
  } catch (e) {
    next(e);
  }
});

// POST /api/peer/report — { targetId, reason, peerMessageId? }. Pages a human.
router.post('/report', async (req: AuthRequest, res, next) => {
  try {
    const { targetId, reason, peerMessageId } = req.body ?? {};
    if (!targetId) {
      res.status(400).json({ success: false, error: 'targetId required' });
      return;
    }
    sendSuccess(res, await peerMessageService.reportMember(req.user!.id, targetId, reason, peerMessageId));
  } catch (e) {
    next(e);
  }
});

export default router;
