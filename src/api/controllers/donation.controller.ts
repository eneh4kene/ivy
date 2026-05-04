import { Request, Response, NextFunction } from 'express';
import donationService from '../../services/donation.service';
import { searchNonprofit } from '../../services/every-org.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  GetDonationsQueryInput,
  CreateManualDonationInput,
  UpdateImpactWalletInput,
} from '../../types/donation.schema';
import { AuthRequest } from '../../middleware/auth';

class DonationController {
  /**
   * Get user's donations
   * GET /api/donations
   */
  async getUserDonations(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const result = await donationService.getUserDonations(req.user.id, req.query as GetDonationsQueryInput);

      sendSuccess(res, result.donations, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's Impact Wallet
   * GET /api/donations/impact-wallet
   */
  async getImpactWallet(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const wallet = await donationService.getImpactWallet(req.user.id);

      sendSuccess(res, wallet);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get donation statistics
   * GET /api/donations/stats
   */
  async getDonationStats(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const stats = await donationService.getDonationStats(req.user.id);

      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update Impact Wallet limits
   * PATCH /api/donations/impact-wallet
   */
  async updateImpactWallet(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const wallet = await donationService.updateImpactWallet(req.user.id, req.body as UpdateImpactWalletInput);

      sendSuccess(res, wallet);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create manual donation (admin)
   * POST /api/donations/manual
   */
  async createManualDonation(
    req: Request<{}, {}, CreateManualDonationInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const donation = await donationService.createManualDonation(req.body);

      sendCreated(res, donation);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get all charities
   * GET /api/donations/charities
   */
  async getCharities(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const region = (req.query.region as string) || 'GB'
      const track = req.query.track as string | undefined
      const charities = await donationService.getCharitiesForUser(region, track)
      sendSuccess(res, charities)
    } catch (error) {
      next(error)
    }
  }

  async searchCharities(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const tier = req.user?.subscriptionTier
      if (tier !== 'CONCIERGE') {
        res.status(403).json({ success: false, error: 'Charity search is available on Ivy Concierge' })
        return
      }
      const q = req.query.q as string
      if (!q || q.trim().length < 2) {
        res.status(400).json({ success: false, error: 'Search query required (min 2 characters)' })
        return
      }
      const results = await searchNonprofit(q.trim())
      sendSuccess(res, results)
    } catch (error) {
      next(error)
    }
  }

  /**
   * Get charity by ID
   * GET /api/donations/charities/:id
   */
  async getCharityById(
    req: Request<{ id: string }>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const charity = await donationService.getCharityById(req.params.id);

      sendSuccess(res, charity);
    } catch (error) {
      next(error);
    }
  }
}

export default new DonationController();
