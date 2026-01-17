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

export type SendMagicLinkInput = z.infer<typeof sendMagicLinkSchema>['body'];
export type VerifyMagicLinkInput = z.infer<typeof verifyMagicLinkSchema>['body'];
