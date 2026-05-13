import { Request, Response, NextFunction } from 'express';
import donationService from '../../services/donation.service';
import { searchNonprofit } from '../../services/every-org.service';
import prisma from '../../utils/prisma';
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

  async getUserCharities(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const charities = await prisma.userCharity.findMany({
        where: { userId: req.user!.id },
        include: { charity: true },
        orderBy: { priority: 'asc' },
      })
      sendSuccess(res, charities)
    } catch (error) { next(error) }
  }

  async setUserCharities(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { charityIds } = req.body as { charityIds: string[] }
      if (!Array.isArray(charityIds) || charityIds.length === 0) {
        res.status(400).json({ success: false, error: 'charityIds array required' }); return
      }
      const userId = req.user!.id

      // Replace all existing selections atomically
      await prisma.$transaction([
        prisma.userCharity.deleteMany({ where: { userId } }),
        ...charityIds.map((charityId, i) =>
          prisma.userCharity.create({ data: { userId, charityId, priority: i } })
        ),
        // Keep preferredCharityId in sync with the primary selection
        prisma.user.update({ where: { id: userId }, data: { preferredCharityId: charityIds[0] } }),
      ])

      sendSuccess(res, { message: 'Charities updated' })
    } catch (error) { next(error) }
  }

  /**
   * Import a charity from Every.org into our DB (upsert by everyOrgSlug).
   * POST /api/donations/charities/import
   *
   * Used when a user searches Every.org and selects a charity not in our curated list.
   * Returns the DB charity record so its ID can be used in setUserCharities.
   */
  async importCharity(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { slug, name, description, logoUrl, websiteUrl } = req.body as {
        slug: string; name: string; description?: string; logoUrl?: string; websiteUrl?: string
      }
      if (!slug || !name) {
        res.status(400).json({ success: false, error: 'slug and name are required' }); return
      }

      // Check if already imported
      const existing = await prisma.charity.findFirst({ where: { everyOrgSlug: slug } })
      if (existing) {
        sendSuccess(res, existing); return
      }

      const charity = await prisma.charity.create({
        data: {
          name,
          description: description || name,
          category: 'community',
          impactMetric: 'donations',
          impactPerPound: 'Your donation goes directly to this cause',
          everyOrgSlug: slug,
          logoUrl: logoUrl ?? null,
          website: websiteUrl ?? null,
          isActive: true,
        },
      })
      sendCreated(res, charity)
    } catch (error) { next(error) }
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
