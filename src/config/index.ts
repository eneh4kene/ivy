import env from './env';

export const config = {
  server: {
    port: env.PORT,
    env: env.NODE_ENV,
    baseUrl: env.API_BASE_URL ?? `http://localhost:${env.PORT}`,
  },
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    host: env.REDIS_HOST,
    port: env.REDIS_PORT,
    password: env.REDIS_PASSWORD,
  },
  auth: {
    jwtSecret: env.JWT_SECRET,
    jwtExpiresIn: env.JWT_EXPIRES_IN,
    magicLinkExpiresIn: env.MAGIC_LINK_EXPIRES_IN,
  },
  twilio: {
    accountSid: env.TWILIO_ACCOUNT_SID,
    authToken: env.TWILIO_AUTH_TOKEN,
    phoneNumber: env.TWILIO_PHONE_NUMBER,
    phoneNumberUs: env.TWILIO_PHONE_NUMBER_US,
  },
  retell: {
    apiKey: env.RETELL_API_KEY,
    agentIds: {
      b2b: env.RETELL_AGENT_ID_B2B,
      b2c: env.RETELL_AGENT_ID_B2C,
    },
    sipEndpoint: env.RETELL_SIP_ENDPOINT,
    webhookSecret: env.RETELL_WEBHOOK_SECRET,
  },
  telegram: {
    botToken: env.TELEGRAM_BOT_TOKEN,
  },
  whatsapp: {
    businessAccountId: env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    phoneNumberId: env.WHATSAPP_PHONE_NUMBER_ID,
    accessToken: env.WHATSAPP_ACCESS_TOKEN,
    webhookVerifyToken: env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
  },
  stripe: {
    secretKey: env.STRIPE_SECRET_KEY,
    publishableKey: env.STRIPE_PUBLISHABLE_KEY,
    webhookSecret: env.STRIPE_WEBHOOK_SECRET,
  },
  email: {
    smtp: {
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASSWORD,
      },
    },
    from: env.EMAIL_FROM,
  },
  calendar: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      redirectUri: env.GOOGLE_REDIRECT_URI,
    },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      redirectUri: env.MICROSOFT_REDIRECT_URI,
    },
  },
  frontend: {
    url: env.FRONTEND_URL,
    // Full set of browser origins allowed through CORS: the canonical URL plus
    // any extras (apex domain, preview URLs). Deduped, trailing slashes stripped.
    allowedOrigins: Array.from(
      new Set(
        [env.FRONTEND_URL, ...(env.CORS_EXTRA_ORIGINS?.split(',') ?? [])]
          .map((o) => o.trim().replace(/\/$/, ''))
          .filter(Boolean),
      ),
    ),
  },
  rateLimit: {
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
  },
  logging: {
    level: env.LOG_LEVEL,
  },
} as const;

export default config;
