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
// authenticate first so region/tier are available for filtering
router.get('/charities', authenticate, donationController.getCharities);
router.get('/charities/search', authenticate, donationController.searchCharities);
router.post('/charities/import', authenticate, donationController.importCharity);
router.get('/charities/:id', authenticate, donationController.getCharityById);

// User charity selections (multi-charity wallet split)
router.get('/user-charities', authenticate, donationController.getUserCharities);
router.post('/user-charities', authenticate, donationController.setUserCharities);

/**
 * @route   GET /api/donations
 * @desc    Get user's donations with filtering
 * @access  Private
 */
router.get('/', authenticate, validate(getDonationsQuerySchema), donationController.getUserDonations);
router.get('/impact-wallet', authenticate, donationController.getImpactWallet);
router.get('/stats', authenticate, donationController.getDonationStats);
router.patch('/impact-wallet', authenticate, validate(updateImpactWalletSchema), donationController.updateImpactWallet);
router.post('/manual', authenticate, validate(createManualDonationSchema), donationController.createManualDonation);

export default router;
