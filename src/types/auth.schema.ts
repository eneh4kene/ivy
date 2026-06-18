import { z } from 'zod';

export const sendMagicLinkSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
  }),
});

export const verifyMagicLinkSchema = z.object({
  body: z.object({
    token: z.string().min(1, 'Token is required'),
  }),
});

export const googleAuthSchema = z.object({
  body: z.object({
    idToken: z.string().min(1, 'idToken is required'),
    // Optional region hint from the signup form so new SSO users get the right
    // currency/region. Defaults to GB/GBP when omitted.
    region: z.enum(['GB', 'US']).optional(),
    tcpaConsent: z.boolean().optional(),
  }),
});

export type SendMagicLinkInput = z.infer<typeof sendMagicLinkSchema>['body'];
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkSchema>['body'];
export type GoogleAuthInput = z.infer<typeof googleAuthSchema>['body'];
