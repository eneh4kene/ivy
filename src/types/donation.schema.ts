import { z } from 'zod';

export const getDonationsQuerySchema = z.object({
  query: z.object({
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    charityId: z.string().uuid().optional(),
    // Phase 5: STAKE_FORFEIT and STAKE_SUCCESS added (§1 Phase 1 data model).
    // COMPLETION is deprecated but retained for historical query compatibility.
    donationType: z.enum(['COMPLETION', 'STAKE_FORFEIT', 'STAKE_SUCCESS', 'STREAK_7_DAY', 'STREAK_30_DAY', 'STREAK_90_DAY', 'MANUAL']).optional(),
    page: z.string().transform(Number).default('1'),
    limit: z.string().transform(Number).default('20'),
  }),
});

export const createManualDonationSchema = z.object({
  body: z.object({
    userId: z.string().uuid(),
    charityId: z.string().uuid(),
    amount: z.number().positive(),
    currency: z.string().default('GBP'),
  }),
});

export const getImpactWalletSchema = z.object({
  params: z.object({
    userId: z.string().uuid().optional(),
  }),
});

export const updateImpactWalletSchema = z.object({
  body: z.object({
    monthlyLimit: z.number().positive().optional(),
    dailyCap: z.number().positive().optional(),
  }),
});

export type GetDonationsQueryInput = z.infer<typeof getDonationsQuerySchema>['query'];
export type CreateManualDonationInput = z.infer<typeof createManualDonationSchema>['body'];
export type GetImpactWalletInput = z.infer<typeof getImpactWalletSchema>['params'];
export type UpdateImpactWalletInput = z.infer<typeof updateImpactWalletSchema>['body'];
