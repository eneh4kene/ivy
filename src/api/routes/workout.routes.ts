import { Router } from 'express';
import workoutController from '../controllers/workout.controller';
import { validate } from '../../middleware/validate';
import { authenticate } from '../../middleware/auth';
import {
  createWorkoutSchema,
  updateWorkoutSchema,
  completeWorkoutSchema,
  getWorkoutByIdSchema,
  getWorkoutsQuerySchema,
} from '../../types/workout.schema';

const router = Router();

// All workout routes require authentication
router.use(authenticate);

/**
 * @route   POST /api/workouts
 * @desc    Create a new workout plan
 * @access  Private
 */
router.post(
  '/',
  validate(createWorkoutSchema),
  workoutController.createWorkout
);

/**
 * @route   GET /api/workouts
 * @desc    Get user's workouts with filtering
 * @access  Private
 */
router.get(
  '/',
  validate(getWorkoutsQuerySchema),
  workoutController.getUserWorkouts
);

/**
 * @route   GET /api/workouts/:id
 * @desc    Get workout by ID
 * @access  Private
 */
router.get(
  '/:id',
  validate(getWorkoutByIdSchema),
  workoutController.getWorkoutById
);

/**
 * @route   PATCH /api/workouts/:id
 * @desc    Update workout
 * @access  Private
 */
router.patch(
  '/:id',
  validate(getWorkoutByIdSchema),
  validate(updateWorkoutSchema),
  workoutController.updateWorkout
);

/**
 * @route   POST /api/workouts/:id/complete
 * @desc    Mark workout as completed/partial/skipped
 * @access  Private
 */
router.post(
  '/:id/complete',
  validate(getWorkoutByIdSchema),
  validate(completeWorkoutSchema),
  workoutController.completeWorkout
);

/**
 * @route   DELETE /api/workouts/:id
 * @desc    Delete workout
 * @access  Private
 */
router.delete(
  '/:id',
  validate(getWorkoutByIdSchema),
  workoutController.deleteWorkout
);

export default router;
