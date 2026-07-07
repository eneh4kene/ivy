import { z } from 'zod';

export const createUserSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    phone: z.string().optional(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),
    timezone: z.string().default('Europe/London'),
    region: z.enum(['GB', 'US']).default('GB'),
    currency: z.enum(['GBP', 'USD']).default('GBP'),
    track: z.string().default('fitness'),
    goal: z.string().default(''),
    preferredCharityId: z.string().uuid().optional(),
    tcpaConsent: z.boolean().optional(), // required for US users
    // Self-serve coach signup ("For coaches" page). Whitelisted — never trust
    // arbitrary roles from the client.
    role: z.enum(['user', 'coach']).optional(),
  }),
});

export const updateUserSchema = z.object({
  body: z.object({
    firstName: z.string().min(1).optional(),
    lastName: z.string().min(1).optional(),
    phone: z.string().optional(),
    timezone: z.string().optional(),
    track: z.enum(['fitness', 'focus', 'sleep', 'balance']).optional(),
    trackDetail: z.string().max(100).optional(),
    goal: z.string().optional(),
    minimumMode: z.string().optional(),
    giftFrame: z.string().optional(),
    commStyle: z.enum(['CALLS', 'TEXTS', 'ADAPTIVE']).optional(),
    circleOptIn: z.boolean().optional(),
    preferredCharityId: z.string().uuid().optional(),
    morningCallTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM
    eveningCallTime: z.string().regex(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/).optional(), // HH:MM
    callFrequency: z.number().min(1).max(7).optional(), // 1-7 calls per week
    preferredDays: z.string().optional(), // JSON array
  }),
});

export const getUserByIdSchema = z.object({
  params: z.object({
    id: z.string().uuid('Invalid user ID'),
  }),
});

export type CreateUserInput = z.infer<typeof createUserSchema>['body'];
export type UpdateUserInput = z.infer<typeof updateUserSchema>['body'];
export type GetUserByIdInput = z.infer<typeof getUserByIdSchema>['params'];
