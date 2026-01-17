import { Router } from 'express';
import statsController from '../controllers/stats.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  createTransformationScoreSchema,
  getTransformationScoresQuerySchema,
  createLifeMarkerSchema,
  getLifeMarkersQuerySchema,
} from '../../types/stats.schema';

const router = Router();

// All stats routes require authentication
router.use(authenticate);

/**
 * @route   GET /api/stats
 * @desc    Get comprehensive user statistics
 * @access  Private
 */
router.get('/', statsController.getUserStats);

/**
 * @route   GET /api/stats/streak
 * @desc    Get user's current streak
 * @access  Private
 */
router.get('/streak', statsController.getStreak);

/**
 * @route   GET /api/stats/weekly
 * @desc    Get weekly summary
 * @access  Private
 */
router.get('/weekly', statsController.getWeeklySummary);

/**
 * @route   GET /api/stats/monthly
 * @desc    Get monthly summary
 * @access  Private
 */
router.get('/monthly', statsController.getMonthlySummary);

/**
 * @route   POST /api/stats/transformation
 * @desc    Log transformation scores (energy, mood, health confidence)
 * @access  Private
 */
router.post(
  '/transformation',
  validate(createTransformationScoreSchema),
  statsController.createTransformationScore
);

/**
 * @route   GET /api/stats/transformation
 * @desc    Get transformation scores with trends
 * @access  Private
 */
router.get(
  '/transformation',
  validate(getTransformationScoresQuerySchema),
  statsController.getTransformationScores
);

/**
 * @route   GET /api/stats/transformation/latest
 * @desc    Get latest transformation score
 * @access  Private
 */
router.get('/transformation/latest', statsController.getLatestTransformationScore);

/**
 * @route   POST /api/stats/life-markers
 * @desc    Create a life marker (transformation moment)
 * @access  Private
 */
router.post(
  '/life-markers',
  validate(createLifeMarkerSchema),
  statsController.createLifeMarker
);

/**
 * @route   GET /api/stats/life-markers
 * @desc    Get life markers with filtering
 * @access  Private
 */
router.get(
  '/life-markers',
  validate(getLifeMarkersQuerySchema),
  statsController.getLifeMarkers
);

export default router;
