import { Router, Response, NextFunction } from 'express';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { UnauthorizedError } from '../../utils/errors';
import coachService from '../../services/coach.service';
import prisma from '../../utils/prisma';

const router = Router();
router.use(authenticate);

// Gate: only COACH tier accounts
function requireCoach(req: AuthRequest, _res: Response, next: NextFunction) {
  if (req.user?.subscriptionTier !== 'COACH') {
    return next(new UnauthorizedError('Coach account required'));
  }
  next();
}

// ─── Coach marketplace (consumer-facing) ─────────────────────────────────────
//
// GET /api/coach/marketplace
//   Returns all active Ivy coaches (COACH-tier users who have a CoachProfile).
//   Fields returned are what the schema actually has; fields the mock uses that
//   are NOT in the schema are flagged in comments below.
//
// GET /api/coach/marketplace/:id
//   Returns a single coach profile for the detail page.
//
// No COACH gate — these are consumer-facing endpoints; any authenticated user
// can browse the marketplace.

router.get('/marketplace', async (_req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const coaches = await prisma.user.findMany({
      where: {
        subscriptionTier: 'COACH',
        isActive: true,
        coachProfile: { isNot: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        coachProfile: {
          select: {
            programmeName: true,
            discipline: true,
            coachingStyle: true,
            programmeNotes: true,
            whitelabelEnabled: true,
            brandName: true,
            brandLogoUrl: true,
          },
        },
      },
      orderBy: { firstName: 'asc' },
    });

    // Map to the consumer-facing shape.
    // Fields NOT on the schema (flagged with MOCKED):
    //   - tagline, bio, specialties, hourlyRate, currency, rating, reviewCount,
    //     activeClients, yearsCoaching, credentials, ivyVetted, available,
    //     responseHours, testimonials, billingNote
    // These remain mocked until the schema carries them (see schema TODO below).
    const data = coaches.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      displayName: `${c.firstName} ${c.lastName}`,
      // REAL: profileImage from User
      photoUrl: c.profileImage ?? null,
      // REAL: programmeName from CoachProfile — used as the programme description
      programmeName: c.coachProfile?.programmeName ?? null,
      // REAL: coachingStyle from CoachProfile
      coachingStyle: c.coachProfile?.coachingStyle ?? null,
      // MOCKED — not in schema; hourlyRate requires a new CoachProfile field
      hourlyRate: null,
      // MOCKED — not in schema; rating/reviewCount require a CoachReview model
      rating: null,
      reviewCount: null,
      // ivyVetted defaults to true for all COACH-tier users (platform vetting is the gate)
      ivyVetted: true,
    }));

    res.json({ success: true, data });
  } catch (err) { next(err); }
});

router.get('/marketplace/:id', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { NotFoundError } = await import('../../utils/errors');
    const coach = await prisma.user.findFirst({
      where: {
        id: req.params.id,
        subscriptionTier: 'COACH',
        isActive: true,
        coachProfile: { isNot: null },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        profileImage: true,
        coachProfile: {
          select: {
            programmeName: true,
            discipline: true,
            coachingStyle: true,
            programmeNotes: true,
          },
        },
      },
    });

    if (!coach) throw new NotFoundError('Coach not found');

    res.json({
      success: true,
      data: {
        id: coach.id,
        firstName: coach.firstName,
        lastName: coach.lastName,
        displayName: `${coach.firstName} ${coach.lastName}`,
        photoUrl: coach.profileImage ?? null,
        programmeName: coach.coachProfile?.programmeName ?? null,
        coachingStyle: coach.coachProfile?.coachingStyle ?? null,
        programmeNotes: coach.coachProfile?.programmeNotes ?? null,
        // MOCKED — not in schema: hourlyRate, rating, reviewCount, credentials, specialties
        hourlyRate: null,
        rating: null,
        reviewCount: null,
        ivyVetted: true,
      },
    });
  } catch (err) { next(err); }
});

// ─── Coach-account routes (COACH tier only) ───────────────────────────────────

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

// PATCH /api/coach/clients/:id/programme-areas
router.patch('/clients/:id/programme-areas', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { areas } = req.body;
    if (!Array.isArray(areas)) { res.status(400).json({ success: false, error: 'areas must be an array' }); return; }
    const updated = await coachService.updateProgrammeAreas(req.user!.id, req.params.id, areas);
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

// GET /api/coach/invite-link — get (or generate) the coach's shareable invite token
router.get('/invite-link', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = await coachService.getOrCreateInviteToken(req.user!.id);
    res.json({ success: true, data: { token, url: `${process.env.FRONTEND_URL}/invite/${token}` } });
  } catch (err) { next(err); }
});

// POST /api/coach/invite-link/reset — regenerate (invalidates old link)
router.post('/invite-link/reset', requireCoach, async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const token = await coachService.resetInviteToken(req.user!.id);
    res.json({ success: true, data: { token, url: `${process.env.FRONTEND_URL}/invite/${token}` } });
  } catch (err) { next(err); }
});

export default router;
