import { Router } from 'express';
import userController from '../controllers/user.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import { createUserSchema, updateUserSchema, getUserByIdSchema } from '../../types/user.schema';

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
