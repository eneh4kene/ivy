# Ivy Backend API

AI-powered voice accountability platform backend built with Node.js, TypeScript, Express, and Prisma.

## Overview

Ivy is a voice-first accountability platform that helps people build consistent habits through:
- Proactive AI-powered phone calls (via Retell AI)
- WhatsApp messaging and nudges
- Charity donations for completed commitments
- Transformation tracking (energy, mood, life markers)
- Streak bonuses and Impact Wallet system

## Tech Stack

- **Runtime:** Node.js 18+
- **Language:** TypeScript 5.x
- **Framework:** Express.js
- **Database:** PostgreSQL with Prisma ORM
- **Cache/Queue:** Redis + Bull
- **Authentication:** Magic Links + JWT
- **Validation:** Zod
- **Voice AI:** Retell AI
- **Telephony:** Twilio
- **Messaging:** WhatsApp Business API
- **Payments:** Stripe
- **Logging:** Winston

## Project Structure

```
src/
├── api/
│   ├── controllers/     # Request handlers
│   ├── routes/          # Express route definitions
├── config/              # Configuration files
├── middleware/          # Express middleware (auth, validation, errors)
├── services/            # Business logic layer
├── types/               # TypeScript types and Zod schemas
├── utils/               # Helper functions and utilities
├── app.ts               # Express app setup
└── index.ts             # Server entry point

prisma/
├── schema.prisma        # Database schema
└── seed.ts              # Seed data for development
```

## Getting Started

### Prerequisites

- Node.js >= 18.0.0
- PostgreSQL >= 14
- Redis (for queues and caching)
- npm or yarn

### Installation

1. **Clone the repository and install dependencies:**

```bash
npm install
```

2. **Set up environment variables:**

Copy `.env.example` to `.env` and fill in your values:

```bash
cp .env.example .env
```

Required environment variables:
- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Secret key for JWT tokens (min 32 chars)
- `FRONTEND_URL` - Your frontend URL for magic link redirects
- `REDIS_HOST` - Redis host (default: localhost)
- `REDIS_PORT` - Redis port (default: 6379)

Optional (for full functionality):
- Twilio credentials (voice/SMS)
- Retell AI API key
- WhatsApp Business API credentials
- Stripe API keys
- SMTP credentials for email
- Calendar API credentials (Google/Microsoft)

3. **Set up the database:**

Generate Prisma client and run migrations:

```bash
npm run db:generate
npm run db:migrate
```

4. **Seed the database (optional for development):**

```bash
npm run db:seed
```

This creates:
- 5 sample charities
- 3 test users (alice@example.com, bob@example.com, charlie@example.com)
- Impact Wallets and Streaks for each user
- 1 test B2B company

5. **Start the development server:**

```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### Health Check

- `GET /health` - Server health status

### Authentication

- `POST /api/auth/magic-link` - Send magic link to email
- `POST /api/auth/verify` - Verify magic link and get JWT token
- `GET /api/auth/me` - Get current authenticated user

### Users

- `POST /api/users` - Create new user (public)
- `GET /api/users/me` - Get current user profile (private)
- `PATCH /api/users/me` - Update current user profile (private)
- `POST /api/users/me/onboard` - Mark user as onboarded (private)
- `GET /api/users/:id` - Get user by ID (private)
- `PATCH /api/users/:id` - Update user (private)
- `DELETE /api/users/:id` - Soft delete user (private)

### Workouts

- `POST /api/workouts` - Create workout plan (private)
- `GET /api/workouts` - Get user's workouts with filtering (private)
  - Query params: `status`, `startDate`, `endDate`, `page`, `limit`
- `GET /api/workouts/:id` - Get workout by ID (private)
- `PATCH /api/workouts/:id` - Update workout (private)
- `POST /api/workouts/:id/complete` - Mark workout as completed/partial/skipped (private)
- `DELETE /api/workouts/:id` - Delete workout (private)

### Donations & Impact Wallet

- `GET /api/donations/charities` - Get all active charities (public)
- `GET /api/donations/charities/:id` - Get charity by ID (public)
- `GET /api/donations` - Get user's donations with filtering (private)
  - Query params: `startDate`, `endDate`, `charityId`, `donationType`, `page`, `limit`
- `GET /api/donations/impact-wallet` - Get Impact Wallet details (private)
- `GET /api/donations/stats` - Get donation statistics (private)
- `PATCH /api/donations/impact-wallet` - Update wallet limits (private)
- `POST /api/donations/manual` - Create manual donation (admin)

### Stats & Tracking

- `GET /api/stats` - Get comprehensive user statistics (private)
- `GET /api/stats/streak` - Get current streak details (private)
- `GET /api/stats/weekly` - Get weekly summary (private)
- `GET /api/stats/monthly` - Get monthly summary (private)
- `POST /api/stats/transformation` - Log transformation scores (private)
- `GET /api/stats/transformation` - Get transformation scores with trends (private)
- `GET /api/stats/transformation/latest` - Get latest transformation score (private)
- `POST /api/stats/life-markers` - Create life marker (private)
- `GET /api/stats/life-markers` - Get life markers with filtering (private)
  - Query params: `category`, `significance`, `startDate`, `endDate`, `page`, `limit`

## Database Schema

### Core Models

- **User** - User profiles, preferences, subscription details
- **Company** - B2B company accounts for corporate wellness
- **Charity** - Available charities for donations
- **Workout** - Planned and completed workouts/commitments
- **Call** - Voice call records with Retell integration
- **Donation** - Individual donations and streak bonuses
- **ImpactWallet** - Monthly donation limits and lifetime totals
- **Streak** - Current and longest streaks, bonus tracking
- **TransformationScore** - Energy, mood, health confidence scores
- **LifeMarker** - Qualitative transformation moments
- **Message** - WhatsApp/SMS/Email communication logs
- **IvyCircle** - B2B group accountability circles

### Subscription Tiers

- **FREE** - Basic features
- **PRO** (£99/mo) - 2 calls/week, WhatsApp nudges, £20 Impact Wallet
- **ELITE** (£199/mo) - 4 calls/week, calendar sync, £30 wallet
- **CONCIERGE** (£399/mo) - Daily calls, human review, £50 wallet
- **B2B** - Company-sponsored (£25-53/employee/month)

## Features

### Streak Tracking

Workouts automatically update user streaks:
- Consecutive daily completion increases streak
- Skipping resets streak to 0
- Automatic streak bonus donations:
  - 7 days → £3 bonus
  - 30 days → £10 bonus
  - 90 days → £25 bonus

### Impact Wallet

Each user has a monthly donation budget:
- £1-2 per completed workout (tier-dependent)
- Daily caps (£3-5) and monthly limits (£20-50)
- Automatic donation processing
- Lifetime donation tracking

### Authentication Flow

1. User requests magic link via email
2. Backend generates token and sends email
3. User clicks link with token
4. Backend verifies token and returns JWT
5. Frontend stores JWT for subsequent requests

### Validation

All request inputs are validated using Zod schemas:
- Type-safe validation
- Automatic error messages
- Request body, query, and params validation

### Error Handling

Centralized error handling with custom error classes:
- `BadRequestError` (400)
- `UnauthorizedError` (401)
- `ForbiddenError` (403)
- `NotFoundError` (404)
- `ConflictError` (409)
- `ValidationError` (422)
- `InternalServerError` (500)

### Rate Limiting

Different rate limits for different endpoints:
- General API: 100 req/min
- Auth endpoints: 5 req/15min
- Call initiation: 5 req/min
- Messaging: 20 req/min

## Development

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Lint code with ESLint
- `npm run lint:fix` - Fix linting errors
- `npm run format` - Format code with Prettier
- `npm test` - Run tests
- `npm run db:generate` - Generate Prisma client
- `npm run db:migrate` - Run database migrations
- `npm run db:seed` - Seed database with test data
- `npm run db:studio` - Open Prisma Studio

### Database Migrations

Create a new migration:

```bash
npm run db:migrate -- --name description_of_change
```

Deploy migrations to production:

```bash
npm run db:migrate:deploy
```

View database in Prisma Studio:

```bash
npm run db:studio
```

## Testing

Example test user credentials (after seeding):

- **Alice** (PRO tier): `alice@example.com`
  - Track: Fitness
  - Current streak: 5 days
  - Goal: Run 5K without stopping

- **Bob** (ELITE tier): `bob@example.com`
  - Track: Meditation
  - Current streak: 12 days
  - Calendar integration enabled

- **Charlie** (FREE tier): `charlie@example.com`
  - Track: Reading
  - Not yet onboarded
  - Zero streak

## Production Deployment

### Environment Setup

1. Set up PostgreSQL database
2. Set up Redis instance
3. Configure all required environment variables
4. Set `NODE_ENV=production`

### Build and Deploy

```bash
# Install dependencies
npm ci --production=false

# Generate Prisma client
npm run db:generate

# Build TypeScript
npm run build

# Run migrations
npm run db:migrate:deploy

# Start server
npm start
```

### Health Monitoring

The `/health` endpoint returns:
```json
{
  "status": "ok",
  "timestamp": "2024-01-16T12:00:00.000Z",
  "uptime": 3600
}
```

## Security

- ✅ Helmet.js for security headers
- ✅ CORS configuration
- ✅ Rate limiting on all endpoints
- ✅ JWT-based authentication
- ✅ Input validation with Zod
- ✅ SQL injection protection (Prisma)
- ✅ Error sanitization in production

## Contributing

### Code Style

- TypeScript strict mode enabled
- ESLint + Prettier for code formatting
- Follow existing patterns in codebase

### Commit Guidelines

- Use clear, descriptive commit messages
- Reference issue numbers when applicable

## Next Steps

### ✅ Completed
1. ~~Donation/Impact Wallet endpoints~~ - COMPLETE (full CRUD, wallet tracking, charity management)
2. ~~Stats & Tracking endpoints~~ - COMPLETE (streaks, transformation scores, life markers, analytics)

### 🚧 Remaining

1. **Redis integration** - Bull queues for scheduled calls
2. **Webhook handlers** - Retell AI, WhatsApp, Stripe event processing
3. **Call scheduling service** - Automated morning/evening calls with retry logic
4. **WhatsApp messaging service** - Nudges, quick replies, and automated messaging
5. **Retell AI integration** - Dynamic prompt generation with user context
6. **Stripe integration** - Subscription management and payment processing
7. **API documentation** - Swagger/OpenAPI interactive docs
8. **Testing suite** - Unit and integration tests
9. **B2B Company dashboard** - Aggregate stats for employers
10. **Calendar integration** - Google/Microsoft calendar sync (Elite+)

## Support

For questions or issues, please refer to the project specifications in the `ivySpecs/` directory.

## License

Proprietary - All rights reserved
