import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const envSchema = z.object({
  // Server
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(Number).default('3000'),
  // Optional — Railway doesn't know its own URL until first deploy
  API_BASE_URL: z.string().url().optional(),

  // Database
  DATABASE_URL: z.string().url(),

  // Authentication
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('7d'),
  MAGIC_LINK_EXPIRES_IN: z.string().default('15m'),

  // Twilio
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_PHONE_NUMBER: z.string().optional(),    // UK (+44) — used for GBP users
  TWILIO_PHONE_NUMBER_US: z.string().optional(), // US (+1)  — used for USD users

  // Retell AI
  RETELL_API_KEY: z.string().optional(),
  RETELL_AGENT_ID_B2B: z.string().optional(),
  RETELL_AGENT_ID_B2C: z.string().optional(),
  // SIP URI for Twilio to forward inbound calls to Retell (from Retell dashboard → Phone Numbers)
  RETELL_SIP_ENDPOINT: z.string().optional(),
  // Shared webhook signing secret (used for both outbound call webhooks and inbound call webhook)
  RETELL_WEBHOOK_SECRET: z.string().optional(),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().optional(),

  // WhatsApp (kept for reference, Telegram is now primary)
  WHATSAPP_BUSINESS_ACCOUNT_ID: z.string().optional(),
  WHATSAPP_PHONE_NUMBER_ID: z.string().optional(),
  WHATSAPP_ACCESS_TOKEN: z.string().optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().optional(),

  // Every.org — charity donation dispatch
  EVERY_ORG_API_KEY: z.string().optional(),
  EVERY_ORG_API_SECRET: z.string().optional(),

  // Cloudflare R2 — voice-note audio storage (optional; app runs without it)
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),

  // Anthropic (call insight extraction + behavioural synthesis)
  ANTHROPIC_API_KEY: z.string().optional(),

  // Stripe
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  // Coach plan price IDs — flat rate, unlimited clients
  STRIPE_PRICE_COACH_GBP: z.string().optional(),
  STRIPE_PRICE_COACH_USD: z.string().optional(),

  // Email
  SMTP_HOST: z.string().default('smtp.gmail.com'),
  SMTP_PORT: z.string().transform(Number).default('587'),
  SMTP_SECURE: z.string().transform((val) => val === 'true').default('false'),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  EMAIL_FROM: z.string().default('Ivy <noreply@ivy.com>'),

  // Calendar Integration
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_REDIRECT_URI: z.string().optional(),

  // Frontend
  FRONTEND_URL: z.string().url(),
  // Additional origins allowed through CORS (comma-separated), beyond FRONTEND_URL.
  // e.g. the apex domain when FRONTEND_URL is the www host, or Vercel preview URLs.
  CORS_EXTRA_ORIGINS: z.string().optional(),

  // Rate Limiting
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),

  // Ops alerting — see src/lib/ops-alert.ts
  // Minutes that identical alerts (severity:source:title) collapse into one roll-up.
  OPS_ALERT_THROTTLE_MIN: z.string().transform(Number).default('15'),
  // Kill switch for day-one noise: mutes Telegram only; Sentry/logs/analytics keep flowing.
  OPS_ALERTS_MUTED: z.string().transform((val) => val === 'true').default('false'),
  // Token guarding GET /health/jobs so an external uptime pinger can hit it unauthenticated.
  OPS_HEALTH_TOKEN: z.string().optional(),

  // Inngest — durable cron/event backbone (replaces the always-on node-cron worker).
  // INNGEST_ENABLED=true is the exclusive cutover switch: when set, the legacy
  // node-cron jobs in worker.ts stand down and Inngest Cloud drives the schedule.
  // Keys come from the Inngest Cloud dashboard (set as Fly secrets in production).
  // Direct (non-pooled) Neon endpoint, used ONLY by prisma migrate. Optional:
  // absent means migrations fall back to DATABASE_URL, which is correct
  // anywhere there is no pooler in front of Postgres.
  DIRECT_DATABASE_URL: z.string().url().optional(),

  INNGEST_ENABLED: z.string().transform((val) => val === 'true').default('false'),

  // Beta: a coach's clients get the full product without ever being asked for a
  // card. Defaults ON because that is the current commercial position; set it to
  // 'false' the day coach clients are expected to pay, and nothing else changes.
  BETA_COMP_COACH_CLIENTS: z.string().transform((val) => val !== 'false').default('true'),
  // The baton double: the relay offers the current holder a ×2 slice for their
  // window. Opt-in per turn, their own money, their own charity on a drop — but
  // it is still a mechanic that raises a real person's real exposure, so it
  // defaults OFF and the founder turns it on deliberately. Set 'true' to enable
  // the offer on newly seeded relays; games already running are unaffected.
  BATON_DOUBLE_ENABLED: z.string().transform((val) => val === 'true').default('false'),
  INNGEST_APP_ID: z.string().default('ivy'),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

let env: Env;

try {
  env = envSchema.parse(process.env);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error('Environment validation failed:');
    console.error(error.issues);
    process.exit(1);
  }
  throw error;
}

export default env;
