/**
 * Jest global setup — runs before any test suite is imported.
 * Sets minimum environment variables so env.ts / config/index.ts don't exit(1).
 * No real credentials — tests mock all external services.
 */

// Minimum env vars required by zod schema in src/config/env.ts
process.env.NODE_ENV = 'test'
process.env.PORT = '3000'
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/ivy_test'
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long-for-jest'
process.env.JWT_EXPIRES_IN = '7d'
process.env.MAGIC_LINK_EXPIRES_IN = '15m'
process.env.STRIPE_SECRET_KEY = 'sk_test_dummy_key_for_unit_tests_only'
process.env.STRIPE_PUBLISHABLE_KEY = 'pk_test_dummy'
process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_dummy_at_least_32_chars_long_for_jest'
process.env.RETELL_API_KEY = 'test_retell_key'
process.env.TWILIO_ACCOUNT_SID = 'ACtest'
process.env.TWILIO_AUTH_TOKEN = 'test_auth_token'
process.env.TWILIO_PHONE_NUMBER = '+15005550006'
process.env.FRONTEND_URL = 'http://localhost:3001'
process.env.API_BASE_URL = 'http://localhost:3000'
process.env.LOG_LEVEL = 'error' // suppress logs in tests
