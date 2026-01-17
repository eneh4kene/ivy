import { Router } from 'express';
import donationController from '../controllers/donation.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  getDonationsQuerySchema,
  createManualDonationSchema,
  updateImpactWalletSchema,
} from '../../types/donation.schema';

const router = Router();

/**
 * @route   GET /api/donations/charities
 * @desc    Get all active charities
 * @access  Public
 */
router.get('/charities', donationController.getCharities);

/**
 * @route   GET /api/donations/charities/:id
 * @desc    Get charity by ID
 * @access  Public
 */
router.get('/charities/:id', donationController.getCharityById);

// All routes below require authentication
router.use(authenticate);

/**
 * @route   GET /api/donations
 * @desc    Get user's donations with filtering
 * @access  Private
 */
router.get(
  '/',
  validate(getDonationsQuerySchema),
  donationController.getUserDonations
);

/**
 * @route   GET /api/donations/impact-wallet
 * @desc    Get user's Impact Wallet details
 * @access  Private
 */
router.get('/impact-wallet', donationController.getImpactWallet);

/**
 * @route   GET /api/donations/stats
 * @desc    Get user's donation statistics
 * @access  Private
 */
router.get('/stats', donationController.getDonationStats);

/**
 * @route   PATCH /api/donations/impact-wallet
 * @desc    Update Impact Wallet limits
 * @access  Private (Admin in future)
 */
router.patch(
  '/impact-wallet',
  validate(updateImpactWalletSchema),
  donationController.updateImpactWallet
);

/**
 * @route   POST /api/donations/manual
 * @desc    Create manual donation (admin only)
 * @access  Private (Admin in future)
 */
router.post(
  '/manual',
  validate(createManualDonationSchema),
  donationController.createManualDonation
);

export default router;
