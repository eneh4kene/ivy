import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../middleware/auth';
import authService from '../../services/auth.service';
import { sendSuccess } from '../../utils/response';
import { SendMagicLinkInput, VerifyMagicLinkInput, GoogleAuthInput } from '../../types/auth.schema';

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
      const { email, promoCode, plan } = req.body as { email: string; promoCode?: string; plan?: string };

      await authService.sendMagicLink(email, promoCode, plan);

      sendSuccess(res, {
        message: 'Magic link sent to your email',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Development-only endpoint to get magic link URL without email
   * ONLY WORKS IN DEVELOPMENT MODE
   */
  async getDevMagicLink(
    req: Request<{}, {}, SendMagicLinkInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (process.env.NODE_ENV !== 'development') {
        res.status(403).json({ success: false, error: 'This endpoint is only available in development mode' });
        return;
      }

      const { email } = req.body;
      const magicLinkUrl = await authService.getDevMagicLink(email);

      sendSuccess(res, {
        message: 'Magic link generated (dev mode)',
        magicLink: magicLinkUrl,
        instructions: 'Copy this URL and paste it in your browser to login'
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
  /**
   * @swagger
   * /api/auth/google:
   *   post:
   *     summary: Sign in / sign up with Google
   *     description: Verifies a Google ID token, finds-or-creates the user by verified email, and returns a JWT access token.
   *     tags: [Authentication]
   *     security: []
   *     requestBody:
   *       required: true
   *       content:
   *         application/json:
   *           schema:
   *             type: object
   *             required:
   *               - idToken
   *             properties:
   *               idToken:
   *                 type: string
   *                 description: Google ID token from Google Identity Services
   *               region:
   *                 type: string
   *                 enum: [GB, US]
   *               tcpaConsent:
   *                 type: boolean
   *     responses:
   *       200:
   *         description: Authenticated successfully
   *       401:
   *         description: Invalid Google credential
   */
  async googleAuth(
    req: Request<{}, {}, GoogleAuthInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const { idToken, region, tcpaConsent, role } = req.body;
      const result = await authService.googleSignIn(idToken, { region, tcpaConsent, role });
      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // User is already attached by auth middleware
      sendSuccess(res, req.user);
    } catch (error) {
      next(error);
    }
  }
}

export default new AuthController();
