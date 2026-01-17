import { z } from 'zod';

// Transformation Score Schemas
export const createTransformationScoreSchema = z.object({
  body: z.object({
    energyScore: z.number().min(1).max(10).optional(),
    moodScore: z.number().min(1).max(10).optional(),
    healthConfidence: z.number().min(1).max(10).optional(),
    notes: z.string().optional(),
  }),
});

export const getTransformationScoresQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    limit: z.string().transform(Number).default('50'),
  }),
});

// Life Marker Schemas
export const createLifeMarkerSchema = z.object({
  body: z.object({
    marker: z.string().min(1, 'Marker description is required'),
    category: z.enum(['physical', 'mental', 'social', 'professional']),
    significance: z.enum(['small', 'medium', 'major']).default('small'),
  }),
});

export const getLifeMarkersQuerySchema = z.object({
  query: z.object({
    category: z.enum(['physical', 'mental', 'social', 'professional']).optional(),
    significance: z.enum(['small', 'medium', 'major']).optional(),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
  }),
});

export type CreateTransformationScoreInput = z.infer<typeof createTransformationScoreSchema>['body'];
export type GetTransformationScoresQueryInput = z.infer<typeof getTransformationScoresQuerySchema>['query'];
export type CreateLifeMarkerInput = z.infer<typeof createLifeMarkerSchema>['body'];
export type GetLifeMarkersQueryInput = z.infer<typeof getLifeMarkersQuerySchema>['query'];
