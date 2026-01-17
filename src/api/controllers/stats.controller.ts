import { Request, Response, NextFunction } from 'express';
import statsService from '../../services/stats.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  CreateTransformationScoreInput,
  GetTransformationScoresQueryInput,
  CreateLifeMarkerInput,
  GetLifeMarkersQueryInput,
} from '../../types/stats.schema';
import { AuthRequest } from '../../middleware/auth';

class StatsController {
  /**
   * Get user's comprehensive statistics
   * GET /api/stats
   */
  async getUserStats(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const stats = await statsService.getUserStats(req.user.id);

      sendSuccess(res, stats);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's current streak
   * GET /api/stats/streak
   */
  async getStreak(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const streak = await statsService.getStreak(req.user.id);

      sendSuccess(res, streak);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get weekly summary
   * GET /api/stats/weekly
   */
  async getWeeklySummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const summary = await statsService.getWeeklySummary(req.user.id);

      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get monthly summary
   * GET /api/stats/monthly
   */
  async getMonthlySummary(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const summary = await statsService.getMonthlySummary(req.user.id);

      sendSuccess(res, summary);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create transformation score
   * POST /api/stats/transformation
   */
  async createTransformationScore(
    req: AuthRequest<{}, {}, CreateTransformationScoreInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const score = await statsService.createTransformationScore(req.user.id, req.body);

      sendCreated(res, score);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get transformation scores
   * GET /api/stats/transformation
   */
  async getTransformationScores(
    req: AuthRequest<{}, {}, {}, GetTransformationScoresQueryInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const result = await statsService.getTransformationScores(req.user.id, req.query);

      sendSuccess(res, result);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get latest transformation score
   * GET /api/stats/transformation/latest
   */
  async getLatestTransformationScore(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const score = await statsService.getLatestTransformationScore(req.user.id);

      sendSuccess(res, score);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create life marker
   * POST /api/stats/life-markers
   */
  async createLifeMarker(
    req: AuthRequest<{}, {}, CreateLifeMarkerInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const marker = await statsService.createLifeMarker(req.user.id, req.body);

      sendCreated(res, marker);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get life markers
   * GET /api/stats/life-markers
   */
  async getLifeMarkers(
    req: AuthRequest<{}, {}, {}, GetLifeMarkersQueryInput>,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      if (!req.user) {
        throw new Error('User not authenticated');
      }

      const result = await statsService.getLifeMarkers(req.user.id, req.query);

      sendSuccess(res, result.markers, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }
}

export default new StatsController();
