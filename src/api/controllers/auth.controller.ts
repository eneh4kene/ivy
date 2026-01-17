import { Request, Response, NextFunction } from 'express';
import authService from '../../services/auth.service';
import { sendSuccess } from '../../utils/response';
import { SendMagicLinkInput, VerifyMagicLinkInput } from '../../types/auth.schema';

class AuthController {
  /**
   * Send magic link to user's email
   * POST /api/auth/magic-link
   */
  async sendMagicLink(
    req: Request<{}, {}, SendMagicLinkInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { email } = req.body;

      await authService.sendMagicLink(email);

      sendSuccess(res, {
        message: 'Magic link sent to your email',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Verify magic link token and return access token
   * POST /api/auth/verify
   */
  async verifyMagicLink(
    req: Request<{}, {}, VerifyMagicLinkInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { token } = req.body;

      const result = await authService.verifyMagicLink(token);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get current authenticated user
   * GET /api/auth/me
   */
  async getCurrentUser(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      // User is already attached by auth middleware
      sendSuccess(res, req.user);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
