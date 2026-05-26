import { Router, Response, NextFunction } from 'express';
import userController from '../controllers/user.controller';
import { validate } from '../../middleware/validate';
import { authenticate, AuthRequest } from '../../middleware/auth';
import { createUserSchema, updateUserSchema, getUserByIdSchema } from '../../types/user.schema';
import phoneVerifyService from '../../services/phone-verify.service';
import prisma from '../../utils/prisma';

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
 * @route   POST /api/users/me/coach/accept
 * @desc    Accept a pending coach invite
 * @access  Private
 */
router.post(
  '/me/coach/accept',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { coachService } = await import('../../services/coach.service');
      await coachService.acceptCoachInvite(req.user!.id);
      const user = await import('../../services/user.service').then((m) => m.default.getUserById(req.user!.id));
      res.json({ success: true, data: user });
    } catch (err) { next(err); }
  }
);

/**
 * @route   DELETE /api/users/me/coach
 * @desc    Leave coach programme or decline pending invite
 * @access  Private
 */
router.delete(
  '/me/coach',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { coachService } = await import('../../services/coach.service');
      await coachService.leaveCoach(req.user!.id);
      res.json({ success: true, data: { message: 'Left coach programme' } });
    } catch (err) { next(err); }
  }
);

/**
 * @route   DELETE /api/users/me/telegram
 * @desc    Disconnect Telegram — clears telegramChatId
 * @access  Private
 */
router.delete(
  '/me/telegram',
  authenticate,
  async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      await prisma.user.update({ where: { id: req.user!.id }, data: { telegramChatId: null } });
      res.json({ success: true, data: { message: 'Telegram disconnected' } });
    } catch (err) { next(err); }
  }
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
