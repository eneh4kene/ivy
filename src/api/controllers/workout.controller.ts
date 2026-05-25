import { Response, NextFunction } from 'express';
import workoutService from '../../services/workout.service';
import { sendSuccess, sendCreated } from '../../utils/response';
import {
  CreateWorkoutInput,
  UpdateWorkoutInput,
  CompleteWorkoutInput,
  GetWorkoutsQueryInput,
} from '../../types/workout.schema';
import { AuthRequest } from '../../middleware/auth';

class WorkoutController {
  /**
   * Create a new workout
   * POST /api/workouts
   */
  async createWorkout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {

      const workout = await workoutService.createWorkout(req.user!.id, req.body as CreateWorkoutInput);

      sendCreated(res, workout);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get workout by ID
   * GET /api/workouts/:id
   */
  async getWorkoutById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {

      const workout = await workoutService.getWorkoutById(req.params.id, req.user!.id);

      sendSuccess(res, workout);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get user's workouts
   * GET /api/workouts
   */
  async getUserWorkouts(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {

      const result = await workoutService.getUserWorkouts(req.user!.id, req.query as GetWorkoutsQueryInput);

      sendSuccess(res, result.workouts, 200, result.meta);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update workout
   * PATCH /api/workouts/:id
   */
  async updateWorkout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {

      const workout = await workoutService.updateWorkout(req.params.id, req.user!.id, req.body as UpdateWorkoutInput);

      sendSuccess(res, workout);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Complete workout
   * POST /api/workouts/:id/complete
   */
  async completeWorkout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {

      const workout = await workoutService.completeWorkout(req.params.id, req.user!.id, req.body as CompleteWorkoutInput);

      sendSuccess(res, workout);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Delete workout
   * DELETE /api/workouts/:id
   */
  async deleteWorkout(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {

      await workoutService.deleteWorkout(req.params.id, req.user!.id);

      sendSuccess(res, { message: 'Workout deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
}

export default new WorkoutController();
