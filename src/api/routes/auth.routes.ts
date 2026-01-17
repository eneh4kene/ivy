import { Router } from 'express';
import authController from '../controllers/auth.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import { sendMagicLinkSchema, verifyMagicLinkSchema } from '../../types/auth.schema';

const router = Router();

/**
 * @route   POST /api/auth/magic-link
 * @desc    Send magic link to user's email
 * @access  Public
 */
router.post(
  '/magic-link',
  authLimiter,
  validate(sendMagicLinkSchema),
  authController.sendMagicLink
);

/**
 * @route   POST /api/auth/verify
 * @desc    Verify magic link token and get access token
 * @access  Public
 */
router.post(
  '/verify',
  authLimiter,
  validate(verifyMagicLinkSchema),
  authController.verifyMagicLink
);

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get('/me', authenticate, authController.getCurrentUser);

export default router;
