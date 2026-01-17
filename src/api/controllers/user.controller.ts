import { Request, Response, NextFunction } from 'express';
import userService from '../../services/user.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import { CreateUserInput, UpdateUserInput, GetUserByIdInput } from '../../types/user.schema';
import { AuthRequest } from '../../middleware/auth';

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
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const user = await userService.getUserById(req.user.id);

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
    req: AuthRequest<{}, {}, UpdateUserInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const user = await userService.updateUser(req.user.id, req.body);

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
    req: AuthRequest<GetUserByIdInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const user = await userService.markUserAsOnboarded(req.user.id);

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
}

export default new UserController();
