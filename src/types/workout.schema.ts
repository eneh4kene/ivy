import { z } from 'zod';

export const createWorkoutSchema = z.object({
  body: z.object({
    plannedDate: z.string().datetime(),
    plannedTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM
    activity: z.string().min(1, 'Activity is required'),
    duration: z.number().min(1).optional(), // minutes
    isMinimum: z.boolean().default(false),
  }),
});

export const updateWorkoutSchema = z.object({
  body: z.object({
    plannedDate: z.string().datetime().optional(),
    plannedTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(),
    activity: z.string().min(1).optional(),
    duration: z.number().min(1).optional(),
    status: z.enum(['PLANNED', 'COMPLETED', 'PARTIAL', 'SKIPPED', 'MISSED']).optional(),
    skippedReason: z.string().optional(),
  }),
});

export const completeWorkoutSchema = z.object({
  body: z.object({
    status: z.enum(['COMPLETED', 'PARTIAL', 'SKIPPED']),
    skippedReason: z.string().optional(),
  }),
});

export const getWorkoutByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid workout ID'),
  }),
});

export const getWorkoutsQuerySchema = z.object({
  query: z.object({
    status: z.enum(['PLANNED', 'COMPLETED', 'PARTIAL', 'SKIPPED', 'MISSED']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
  }),
});

export type CreateWorkoutInput = z.infer<typeof createWorkoutSchema>['body'];
export type UpdateWorkoutInput = z.infer<typeof updateWorkoutSchema>['body'];
export type CompleteWorkoutInput = z.infer<typeof completeWorkoutSchema>['body'];
export type GetWorkoutByIdInput = z.infer<typeof getWorkoutByIdSchema>['params'];
export type GetWorkoutsQueryInput = z.infer<typeof getWorkoutsQuerySchema>['query'];
