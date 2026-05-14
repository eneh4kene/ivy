import { Router, Request, Response, NextFunction } from 'express';
import userController from '../controllers/user.controller';
import { validate } from '../../middleware/validate';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createUserSchema, updateUserSchema, getUserByIdSchema } from '../../types/user.schema';
import phoneVerifyService from '../../services/phone-verify.service';

const router = Router();

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Public
 */
router.post(
  '/',
  validate(createUserSchema),
  userController.createUser
);

/**
 * @route   GET /api/users/me
 * @desc    Get current user profile
 * @access  Private
 */
router.get(
  '/me',
  authenticate,
  userController.getCurrentUserProfile
);

/**
 * @route   PATCH /api/users/me
 * @desc    Update current user profile
 * @access  Private
 */
router.patch(
  '/me',
  authenticate,
  validate(updateUserSchema),
  userController.updateCurrentUserProfile
);

/**
 * @route   POST /api/users/me/onboard
 * @desc    Mark current user as onboarded
 * @access  Private
 */
router.post(
  '/me/onboard',
  authenticate,
  userController.markAsOnboarded
);

/**
 * @route   GET /api/users/me/export
 * @desc    GDPR data export — returns all user data as JSON
 * @access  Private
 */
router.get(
  '/me/export',
  authenticate,
  userController.exportMyData
);

/**
 * @route   DELETE /api/users/me
 * @desc    GDPR hard delete — permanently erases account and all data
 * @access  Private
 */
router.delete(
  '/me',
  authenticate,
  userController.deleteMyAccount
);

/**
 * @route   POST /api/users/phone/request-otp
 * @desc    Send a 6-digit OTP to a new phone number for verification
 * @access  Private
 */
router.post(
  '/phone/request-otp',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { phone } = req.body;
      if (!phone) { res.status(400).json({ success: false, error: 'phone is required' }); return; }
      await phoneVerifyService.requestOtp(req.user!.id, phone);
      res.json({ success: true, data: { message: 'Verification code sent' } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   POST /api/users/phone/verify
 * @desc    Verify OTP and update phone number
 * @access  Private
 */
router.post(
  '/phone/verify',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code } = req.body;
      if (!code) { res.status(400).json({ success: false, error: 'code is required' }); return; }
      const newPhone = await phoneVerifyService.verifyOtp(req.user!.id, code);
      res.json({ success: true, data: { phone: newPhone } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   GET /api/users/:id
 * @desc    Get user by ID
 * @access  Private
 */
router.get(
  '/:id',
  authenticate,
  validate(getUserByIdSchema),
  userController.getUserById
);

/**
 * @route   PATCH /api/users/:id
 * @desc    Update user
 * @access  Private
 */
router.patch(
  '/:id',
  authenticate,
  validate(getUserByIdSchema),
  validate(updateUserSchema),
  userController.updateUser
);

/**
 * @route   DELETE /api/users/:id
 * @desc    Delete user (soft delete)
 * @access  Private
 */
router.delete(
  '/:id',
  authenticate,
  validate(getUserByIdSchema),
  userController.deleteUser
);

export default router;
