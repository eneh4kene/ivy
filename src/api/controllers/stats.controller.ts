import { Response, NextFunction } from 'express';
import statsService from '../../services/stats.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  CreateTransformationScoreInput,
  GetTransformationScoresQueryInput,
  CreateLifeMarkerInput,
  GetLifeMarkersQueryInput,
} from '../../types/stats.schema';
import { AuthRequest } from '../../middleware/auth';

// All routes in this controller are behind the authenticate middleware —
// req.user is guaranteed to be set at this point.

class StatsController {
  async getUserStats(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await statsService.getUserStats(req.user!.id));
    } catch (err) { next(err); }
  }

  async getStreak(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await statsService.getStreak(req.user!.id));
    } catch (err) { next(err); }
  }

  async getWeeklySummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await statsService.getWeeklySummary(req.user!.id));
    } catch (err) { next(err); }
  }

  async getMonthlySummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await statsService.getMonthlySummary(req.user!.id));
    } catch (err) { next(err); }
  }

  async createTransformationScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendCreated(res, await statsService.createTransformationScore(req.user!.id, req.body as CreateTransformationScoreInput));
    } catch (err) { next(err); }
  }

  async getTransformationScores(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await statsService.getTransformationScores(req.user!.id, req.query as GetTransformationScoresQueryInput));
    } catch (err) { next(err); }
  }

  async getLatestTransformationScore(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendSuccess(res, await statsService.getLatestTransformationScore(req.user!.id));
    } catch (err) { next(err); }
  }

  async createLifeMarker(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      sendCreated(res, await statsService.createLifeMarker(req.user!.id, req.body as CreateLifeMarkerInput));
    } catch (err) { next(err); }
  }

  async getLifeMarkers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await statsService.getLifeMarkers(req.user!.id, req.query as GetLifeMarkersQueryInput);
      sendSuccess(res, result.markers, 200, result.meta);
    } catch (err) { next(err); }
  }
}

export default new StatsController();
