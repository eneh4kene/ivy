import { Request, Response, NextFunction } from 'express';
import authService from '../../services/auth.service';
import { sendSuccess } from '../../utils/response';
import { SendMagicLinkInput, VerifyMagicLinkInput } from '../../types/auth.schema';

class AuthController {
  /**
   * @swagger
   * /api/auth/magic-link:
   *   post:
   *     summary: Send magic link for passwordless authentication
   *     description: Sends a magic link to the user's email for passwordless login. If the email doesn't exist, creates a new user account.
   *     tags: [Authentication]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - email
   *             properties:
   *               email:
   *                 type: string
   *                 format: email
   *                 example: user@example.com
   *                 description: User's email address
   *     responses:
   *       200:
   *         description: Magic link sent successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     message:
   *                       type: string
   *                       example: Magic link sent to your email
   *       400:
   *         description: Invalid email format
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
   *       429:
   *         description: Too many requests - rate limit exceeded
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
   * @swagger
   * /api/auth/verify:
   *   post:
   *     summary: Verify magic link token
   *     description: Verifies the magic link token from email and returns a JWT access token for authenticated requests.
   *     tags: [Authentication]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - token
   *             properties:
   *               token:
   *                 type: string
   *                 example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *                 description: Magic link token from email
   *     responses:
   *       200:
   *         description: Token verified successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   type: object
   *                   properties:
   *                     accessToken:
   *                       type: string
   *                       example: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   *                       description: JWT access token for authenticated requests
   *                     user:
   *                       $ref: '#/components/schemas/User'
   *       400:
   *         description: Invalid or expired token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
   * @swagger
   * /api/auth/me:
   *   get:
   *     summary: Get current authenticated user
   *     description: Returns the profile information of the currently authenticated user.
   *     tags: [Authentication]
   *     security:
   *       - BearerAuth: []
   *     responses:
   *       200:
   *         description: User profile retrieved successfully
   *         content:
   *           application/json:
   *             schema:
   *               type: object
   *               properties:
   *                 success:
   *                   type: boolean
   *                   example: true
   *                 data:
   *                   $ref: '#/components/schemas/User'
   *       401:
   *         description: Unauthorized - Invalid or missing token
   *         content:
   *           application/json:
   *             schema:
   *               $ref: '#/components/schemas/Error'
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
