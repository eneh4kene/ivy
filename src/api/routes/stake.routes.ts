/**
 * Stake config routes — Phase 1 / Gap 1 of stake rework.
 *
 * POST /api/stake/config
 *   Persists the authenticated user's stake configuration.
 *   Validates weeklyAmount >= STAKE_CONFIG.minWeeklyStake for the user's currency,
 *   forfeitMode, dislikedCharityId (required iff SAVAGE), preferredCharityId /
 *   UserCharity (success charity), and armingWindowStart / armingWindowEnd (HH:MM).
 *
 *   Saving the config persists it AND, for an onboarded user with a card on
 *   file and no open cycle, immediately opens the Foundation Run hold via the
 *   idempotent userService.startDayZeroExperience (so the stake is actually held
 *   during the 14-day trial, not just at the next Monday cron / first invoice).
 *   The Monday openStakeCyclesForActiveUsers cron still opens subsequent weekly
 *   cycles for everyone eligible.
 *
 * GET /api/stake/config
 *   Returns the current user's stake config fields.
 */

import { Router, Response, NextFunction } from 'express'
import { z } from 'zod'
import { authenticate, AuthRequest } from '../../middleware/auth'
import { validate } from '../../middleware/validate'
import { BadRequestError, NotFoundError } from '../../utils/errors'
import prisma from '../../utils/prisma'
import logger from '../../utils/logger'
import { STAKE_CONFIG, type Currency } from '../../config/pricing'
import { getStakeState, disputeSlice } from '../../services/stake.service'

const router = Router()
router.use(authenticate)

// ─── Validation helpers ──────────────────────────────────────────────────────

const HH_MM = /^\d{2}:\d{2}$/

const saveStakeConfigSchema = z.object({
  body: z.object({
    /**
     * User-set weekly stake amount. Must be >= minWeeklyStake for the user's currency.
     * Validated against STAKE_CONFIG.minWeeklyStake after we know the user's currency.
     */
    /**
     * The weekly stake, or null/0 for no stake at all.
     *
     * This route is the ONLY writer of armingWindowStart/End, and the arming
     * loop selects purely on that window — it never looks at a stake. So while
     * a positive amount was required here, skipping the stake meant no arming
     * window, which meant no morning VN, no reminders, no daily loop: the user
     * got no product. "Optional stake" was true of Ivy's language and false of
     * the plumbing.
     *
     * Allowing null/0 lets this complete as a window-and-charity setup, so the
     * daily ritual works for everyone and money stays a lever people opt into.
     */
    stakeWeeklyAmount: z
      .number()
      .nonnegative('stakeWeeklyAmount cannot be negative')
      .nullable()
      .optional(),

    forfeitMode: z.enum(['MIDDLE', 'SAVAGE'], {
      required_error: 'forfeitMode is required',
      invalid_type_error: 'forfeitMode must be MIDDLE or SAVAGE',
    }),

    /**
     * Required when forfeitMode is SAVAGE. The charity the user actively dislikes
     * (their anti-charity). Must be an active charity in the DB.
     */
    dislikedCharityId: z.string().optional().nullable(),

    /**
     * Optional: the charity that should receive corporate donations on success days.
     * Can be provided as preferredCharityId (sets User.preferredCharityId) or as a
     * UserCharity upsert (charityId -> UserCharity). We accept both names for forwards
     * compatibility; preferredCharityId takes precedence.
     */
    preferredCharityId: z.string().optional().nullable(),

    /** HH:MM — the user's chosen arming window open time */
    armingWindowStart: z
      .string()
      .regex(HH_MM, 'armingWindowStart must be HH:MM (e.g. "07:00")'),

    /** HH:MM — the user's chosen arming window deadline */
    armingWindowEnd: z
      .string()
      .regex(HH_MM, 'armingWindowEnd must be HH:MM (e.g. "09:30")'),
  }),
})

// ─── POST /api/stake/config ──────────────────────────────────────────────────

router.post(
  '/config',
  validate(saveStakeConfigSchema),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id
      const {
        stakeWeeklyAmount,
        forfeitMode,
        dislikedCharityId,
        preferredCharityId,
        armingWindowStart,
        armingWindowEnd,
      } = req.body

      // ── Load user to check currency and existence ──────────────────────────
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { id: true, currency: true },
      })
      if (!user) throw new NotFoundError('User not found')

      const currency = (user.currency ?? 'GBP') as Currency
      const minStake = STAKE_CONFIG.minWeeklyStake[currency]

      // null / 0 / undefined all mean "no money on the line" — a valid setup,
      // not a validation failure. Normalised to null so nothing downstream has
      // to distinguish "zero" from "absent".
      const hasStake = stakeWeeklyAmount != null && stakeWeeklyAmount > 0
      const normalisedStake = hasStake ? stakeWeeklyAmount : null

      // ── Minimum stake validation (§9 decision 2) ──────────────────────────
      // Only applies to an actual stake. A stake-less setup has no minimum to
      // meet — the floor exists so a real stake is big enough to have teeth.
      if (hasStake && stakeWeeklyAmount! < minStake) {
        throw new BadRequestError(
          `stakeWeeklyAmount must be at least ${currency === 'GBP' ? '£' : '$'}${minStake}/week`,
        )
      }

      // ── Arming window sanity check ─────────────────────────────────────────
      if (armingWindowStart >= armingWindowEnd) {
        throw new BadRequestError(
          'armingWindowEnd must be later than armingWindowStart',
        )
      }

      // ── SAVAGE mode requires a dislikedCharityId ──────────────────────────
      if (forfeitMode === 'SAVAGE') {
        if (!dislikedCharityId) {
          throw new BadRequestError(
            'dislikedCharityId is required when forfeitMode is SAVAGE',
          )
        }

        // Verify charity exists and is active
        const charity = await prisma.charity.findUnique({
          where: { id: dislikedCharityId },
          select: { id: true, isActive: true },
        })
        if (!charity || !charity.isActive) {
          throw new BadRequestError(
            `dislikedCharityId "${dislikedCharityId}" is not a valid active charity`,
          )
        }
      }

      // ── Verify preferredCharityId if provided ─────────────────────────────
      if (preferredCharityId) {
        const charity = await prisma.charity.findUnique({
          where: { id: preferredCharityId },
          select: { id: true, isActive: true },
        })
        if (!charity || !charity.isActive) {
          throw new BadRequestError(
            `preferredCharityId "${preferredCharityId}" is not a valid active charity`,
          )
        }
      }

      // ── Persist stake config ───────────────────────────────────────────────
      const updateData: Record<string, unknown> = {
        stakeWeeklyAmount: normalisedStake,
        forfeitMode,
        dislikedCharityId: forfeitMode === 'SAVAGE' ? (dislikedCharityId ?? null) : null,
        armingWindowStart,
        armingWindowEnd,
      }

      // Only set preferredCharityId when provided (don't clear an existing one)
      if (preferredCharityId !== undefined) {
        updateData.preferredCharityId = preferredCharityId
      }

      const updated = await prisma.user.update({
        where: { id: userId },
        data: updateData as any,
        select: {
          id: true,
          stakeWeeklyAmount: true,
          forfeitMode: true,
          dislikedCharityId: true,
          preferredCharityId: true,
          armingWindowStart: true,
          armingWindowEnd: true,
        },
      })

      // ── Upsert UserCharity for the preferred charity ───────────────────────
      // (ensures it appears in the user's charity list at priority 0)
      if (preferredCharityId) {
        await prisma.userCharity.upsert({
          where: { userId_charityId: { userId, charityId: preferredCharityId } },
          create: { userId, charityId: preferredCharityId, priority: 0 },
          update: {},
        })
      }

      logger.info(
        `Stake config saved for user ${userId}: ` +
        `£${stakeWeeklyAmount}/wk, ${forfeitMode}, ` +
        `window ${armingWindowStart}→${armingWindowEnd}`,
      )

      // Place the stake hold NOW — not weeks from now. Saving a config used to only
      // make the user *eligible* for the Monday weekly-cron / first-invoice trigger.
      // But the 14-day trial means no invoice is paid for two weeks, so the
      // Foundation Run hold (the "£X on the line") never landed during the trial —
      // the stake was configured but never actually held. Re-run the idempotent
      // Day-Zero money half here: if the user is onboarded with a card on file and
      // has no existing cycle, it opens the Foundation Run off-session auth hold
      // immediately. Safely no-ops when there's no card yet. Fire-and-forget —
      // failures (e.g. SCA) self-report via the in-app re-auth nudge inside
      // openFoundationCycle, and must never block the config save.
      import('../../services/user.service')
        .then(({ default: userService }) => userService.startDayZeroExperience(userId))
        .catch((err) =>
          logger.warn(`Foundation Run trigger after stake-config save failed for ${userId}:`, err),
        )

      res.status(200).json({
        success: true,
        data: {
          ...updated,
          stakeWeeklyAmount: updated.stakeWeeklyAmount
            ? Number(updated.stakeWeeklyAmount)
            : null,
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /api/stake/config ───────────────────────────────────────────────────

router.get(
  '/config',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          stakeWeeklyAmount: true,
          forfeitMode: true,
          dislikedCharityId: true,
          preferredCharityId: true,
          armingWindowStart: true,
          armingWindowEnd: true,
          currency: true,
        },
      })

      if (!user) throw new NotFoundError('User not found')

      const currency = (user.currency ?? 'GBP') as Currency

      res.status(200).json({
        success: true,
        data: {
          stakeWeeklyAmount: user.stakeWeeklyAmount
            ? Number(user.stakeWeeklyAmount)
            : null,
          forfeitMode: user.forfeitMode,
          dislikedCharityId: user.dislikedCharityId,
          preferredCharityId: user.preferredCharityId,
          armingWindowStart: user.armingWindowStart,
          armingWindowEnd: user.armingWindowEnd,
          currency,
          minWeeklyStake: STAKE_CONFIG.minWeeklyStake[currency],
          defaultWeeklyStake: STAKE_CONFIG.defaultWeeklyStake[currency],
        },
      })
    } catch (err) {
      next(err)
    }
  },
)

// ─── GET /api/stake/state ────────────────────────────────────────────────────
// Composed daily/home read model: active cycle progress, config (charity names
// resolved), today's arming state (+ morning VoiceNote), and a Mon→Sun week grid.
// Safe for brand-new users (no cycle / no config / no workouts).

router.get(
  '/state',
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const state = await getStakeState(req.user!.id)
      res.status(200).json({ success: true, data: state })
    } catch (err) {
      next(err)
    }
  },
)

// ─── POST /api/stake/dispute ─────────────────────────────────────────────────
// The honest-mistake valve: "I did the thing but forgot the voice note."
// Marks the forfeited day disputed + raises a critical ops alert for human
// review. Never moves money itself.

const disputeSchema = z.object({
  body: z.object({
    workoutId: z.string({ required_error: 'workoutId is required' }).uuid(),
  }),
})

router.post(
  '/dispute',
  validate(disputeSchema),
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const result = await disputeSlice(req.user!.id, req.body.workoutId)
      res.status(200).json({ success: true, data: result })
    } catch (err) {
      next(err)
    }
  },
)

export default router
