import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import { apiLimiter } from './middleware/rateLimiter';
import logger from './utils/logger';
import swaggerSpec from './config/swagger';
import { config } from './config';

// Import routes
import authRoutes from './api/routes/auth.routes';
import userRoutes from './api/routes/user.routes';
import workoutRoutes from './api/routes/workout.routes';
import donationRoutes from './api/routes/donation.routes';
import statsRoutes from './api/routes/stats.routes';
import webhookRoutes from './api/routes/webhook.routes';
import paymentRoutes from './api/routes/payment.routes';
import seasonsRoutes from './api/routes/seasons.routes';
import callsRoutes from './api/routes/calls.routes';
import buddyRoutes from './api/routes/buddy.routes';
import pushRoutes from './api/routes/push.routes';
import circleRoutes from './api/routes/circle.routes';
import adminRoutes from './api/routes/admin.routes';
import coachRoutes from './api/routes/coach.routes';
import inviteRoutes from './api/routes/invite.routes';
import voiceNotesRoutes from './api/controllers/voice-notes.controller';
import stakeRoutes from './api/routes/stake.routes';
import chatRoutes from './api/routes/chat.routes';

// Inngest — durable cron/event backbone
import { serve as inngestServe } from 'inngest/express';
import { inngest } from './inngest/client';
import { functions as inngestFunctions } from './inngest/functions';

const app: Application = express();

// Behind Fly's proxy (exactly one hop): trust it so req.ip is the real client
// IP from X-Forwarded-For, not the proxy address. Without this every request
// shares one IP and the per-IP rate limiters throttle the whole user base.
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    // In production, only allow whitelisted browser origins (canonical URL + any
    // CORS_EXTRA_ORIGINS, e.g. the apex domain alongside the www host).
    if (process.env.NODE_ENV === 'production') {
      const allowed = config.frontend.allowedOrigins;
      if (allowed.length === 0) {
        callback(new Error('FRONTEND_URL must be set in production'));
        return;
      }
      // No Origin header → non-browser/server-to-server caller; allow it.
      if (!origin || allowed.includes(origin)) {
        callback(null, true);
      } else {
        // Deny WITHOUT throwing: the request proceeds without CORS headers so the
        // browser blocks it cleanly. Throwing here turns the preflight into a 500.
        logger.warn(`CORS: blocked origin ${origin}`);
        callback(null, false);
      }
    } else {
      // Development: allow all origins for local testing
      callback(null, true);
    }
  },
  credentials: true,
}));

// Body parsing middleware. Capture the raw body buffer so webhook handlers that
// verify signatures over the exact bytes (Retell, Stripe) can re-hash it — JSON
// re-serialisation changes formatting and breaks signature verification.
app.use(express.json({
  verify: (req: any, _res, buf) => { req.rawBody = buf; },
}));
app.use(express.urlencoded({ extended: true }));

// Inngest endpoint — mounted BEFORE the /api rate limiter so Inngest Cloud's
// scheduler/registration calls (which can burst) aren't throttled. The signing
// key is read from INNGEST_SIGNING_KEY in the environment for request verification.
app.use(
  '/api/inngest',
  inngestServe({ client: inngest, functions: inngestFunctions })
);

// Rate limiting
app.use('/api', apiLimiter);

// Request logging
app.use((req, _res, next) => {
  logger.info(`${req.method} ${req.url}`);
  next();
});

// Health check
app.get('/health', (_req, res) => {
  const mem = process.memoryUsage();
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    memory: {
      rss: Math.round(mem.rss / 1024 / 1024) + 'MB',
      heap: Math.round(mem.heapUsed / 1024 / 1024) + 'MB',
    },
  });
});

// API Documentation
app.use(
  '/api-docs',
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'Ivy API Documentation',
  })
);

// Swagger JSON endpoint
app.get('/api-docs.json', (_req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.send(swaggerSpec);
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/workouts', workoutRoutes);
app.use('/api/donations', donationRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/seasons', seasonsRoutes);
app.use('/api/calls', callsRoutes);
app.use('/api/buddy', buddyRoutes);
app.use('/api/push', pushRoutes);
app.use('/api/circles', circleRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/coach', coachRoutes);
app.use('/api/invite', inviteRoutes);
app.use('/api/voice-notes', voiceNotesRoutes);
app.use('/api/stake', stakeRoutes);
app.use('/api/chat', chatRoutes);
app.use('/webhooks', webhookRoutes);

// 404 handler
app.use(notFoundHandler);

// Error handling middleware (must be last)
app.use(errorHandler);

export default app;
