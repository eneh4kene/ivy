import { Request, Response, NextFunction } from 'express';
import donationService from '../../services/donation.service';
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
    req: AuthRequest<{}, {}, {}, GetDonationsQueryInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const result = await donationService.getUserDonations(req.user.id, req.query);

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
    req: AuthRequest<{}, {}, UpdateImpactWalletInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const wallet = await donationService.updateImpactWallet(req.user.id, req.body);

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
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const charities = await donationService.getCharities();

      sendSuccess(res, charities);
    } catch (error) {
      next(error);
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
