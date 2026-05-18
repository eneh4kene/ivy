import { Request, Response, NextFunction } from 'express';
import userService from '../../services/user.service';
import prisma from '../../utils/prisma';
import { sendSuccess, sendCreated } from '../../utils/response';
import { CreateUserInput, UpdateUserInput, GetUserByIdInput } from '../../types/user.schema';
import { AuthRequest } from '../../middleware/auth';
import { serverAnalytics } from '../../lib/analytics';
import paymentService from '../../services/payment.service';
import logger from '../../utils/logger';

class UserController {
  /**
   * Create a new user
   * POST /api/users
   */
  async createUser(
    req: Request<{}, {}, CreateUserInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.createUser(req.body);

      // Initialize user resources (Impact Wallet, Streak)
      await userService.initializeUserResources(user.id, user.subscriptionTier);

      sendCreated(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user by ID
   * GET /api/users/:id
   */
  async getUserById(
    req: Request<GetUserByIdInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.getUserById(req.params.id);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current user profile
   * GET /api/users/me
   */
  async getCurrentUserProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.getUserById(req.user!.id);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update user
   * PATCH /api/users/:id
   */
  async updateUser(
    req: Request<GetUserByIdInput, {}, UpdateUserInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.updateUser(req.params.id, req.body);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update current user profile
   * PATCH /api/users/me
   */
  async updateCurrentUserProfile(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.updateUser(req.user!.id, req.body as UpdateUserInput);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Mark user as onboarded
   * POST /api/users/:id/onboard
   */
  async markAsOnboarded(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.markUserAsOnboarded(req.user!.id);

      sendSuccess(res, user);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete user (soft delete)
   * DELETE /api/users/:id
   */
  async deleteUser(
    req: Request<GetUserByIdInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const user = await userService.deleteUser(req.params.id);

      sendSuccess(res, { message: 'User deactivated successfully', user });
    } catch (error) {
      next(error);
    }
  }

  async exportMyData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          workouts: true,
          calls: { select: { id: true, callType: true, status: true, createdAt: true, duration: true } },
          donations: true,
          impactWallet: true,
          streaks: true,
          transformationScores: true,
          lifeMarkers: true,
          seasons: { include: { sprints: true } },
          impactStories: true,
          accountabilityBuddy: true,
          messages: { select: { id: true, channel: true, direction: true, createdAt: true } },
          charities: { include: { charity: { select: { id: true, name: true, category: true } } } },
          pushSubscriptions: { select: { id: true, userAgent: true, createdAt: true, isActive: true } },
        },
      })
      if (!user) { res.status(404).json({ success: false, error: 'User not found' }); return }

      const { stripeCustomerId, stripeSubscriptionId, googleCalendarRefreshToken, outlookCalendarRefreshToken, ...safeUser } = user as any
      res.setHeader('Content-Disposition', `attachment; filename="ivy-data-export-${userId}.json"`)
      res.setHeader('Content-Type', 'application/json')
      res.json({ exportedAt: new Date().toISOString(), data: safeUser })
    } catch (error) {
      next(error)
    }
  }

  async deleteMyAccount(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id

      // Cancel Stripe subscription first — fire and forget, don't block deletion if it fails
      await paymentService.cancelSubscription(userId).catch((err) =>
        logger.warn(`Stripe cancellation failed for ${userId} during account deletion:`, err)
      )

      await prisma.user.delete({ where: { id: userId } })
      serverAnalytics.identify(userId, { deleted: true })
      res.json({ success: true, data: { message: 'Account permanently deleted. All data has been erased.' } })
    } catch (error) {
      next(error)
    }
  }
}

export default new UserController();
