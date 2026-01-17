# Ivy Backend - Quick Start Guide

Get the Ivy backend API running in minutes!

## Prerequisites

Before you begin, make sure you have:
- ✅ Node.js 18+ installed ([download](https://nodejs.org/))
- ✅ PostgreSQL 14+ installed and running ([download](https://www.postgresql.org/download/))
- ✅ Redis installed and running (optional, but recommended) ([download](https://redis.io/download))

## Step-by-Step Setup

### 1. Install Dependencies

```bash
npm install
```

This will install all required packages including TypeScript, Express, Prisma, and more.

### 2. Set Up PostgreSQL Database

Create a new PostgreSQL database:

```bash
# Connect to PostgreSQL
psql postgres

# Create database
CREATE DATABASE ivy_db;

# Create user (optional)
CREATE USER ivy_user WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE ivy_db TO ivy_user;

# Exit
\q
```

### 3. Configure Environment Variables

The `.env` file has been created with default values. Update the `DATABASE_URL`:

```env
DATABASE_URL=postgresql://postgres:password@localhost:5432/ivy_db?schema=public
```

Replace `postgres` and `password` with your PostgreSQL username and password.

**Important:** Update the `JWT_SECRET` to a secure random string (minimum 32 characters).

### 4. Generate Prisma Client & Run Migrations

```bash
# Generate Prisma client
npm run db:generate

# Run database migrations
npm run db:migrate
```

When prompted for a migration name, you can use: `init`

### 5. Seed the Database (Optional but Recommended)

```bash
npm run db:seed
```

This creates:
- 5 sample charities (Against Malaria Foundation, GiveDirectly, etc.)
- 3 test users with different subscription tiers
- Impact Wallets and Streaks for each user
- 1 test B2B company

### 6. Start the Development Server

```bash
npm run dev
```

You should see:
```
🚀 Ivy Backend API running on port 3000
📝 Environment: development
🔗 Base URL: http://localhost:3000
```

### 7. Test the API

Open your browser or use curl:

```bash
# Health check
curl http://localhost:3000/health

# Should return:
# {"status":"ok","timestamp":"2024-01-16T...","uptime":...}
```

## Test the Authentication Flow

### 1. Create a Test User

```bash
curl -X POST http://localhost:3000/api/users \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "firstName": "Test",
    "lastName": "User",
    "track": "fitness",
    "goal": "Get fit and healthy"
  }'
```

### 2. Request a Magic Link (Requires Email Configuration)

If you have SMTP configured:

```bash
curl -X POST http://localhost:3000/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com"}'
```

### 3. Use Seeded Test Users

After running the seed script, you can use these test users:

- **alice@example.com** - PRO tier (5-day streak)
- **bob@example.com** - ELITE tier (12-day streak)
- **charlie@example.com** - FREE tier (not onboarded)

## Explore the Database

Open Prisma Studio to view and edit your database:

```bash
npm run db:studio
```

This opens a web interface at `http://localhost:5555` where you can:
- View all users, workouts, donations, etc.
- Edit records directly
- Explore relationships

## Next Steps

### Test Core Endpoints

1. **Create a Workout:**
```bash
# First, get a JWT token (you'll need to implement magic link or use a test token)
curl -X POST http://localhost:3000/api/workouts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "plannedDate": "2024-01-17T07:00:00Z",
    "activity": "30 minute run",
    "duration": 30
  }'
```

2. **Get Your Workouts:**
```bash
curl http://localhost:3000/api/workouts \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

3. **Complete a Workout:**
```bash
curl -X POST http://localhost:3000/api/workouts/WORKOUT_ID/complete \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "COMPLETED"
  }'
```

### Configure Optional Services

For full functionality, configure these services in `.env`:

1. **Email (for Magic Links)**
   - Use Gmail, SendGrid, or any SMTP provider
   - Update `SMTP_*` variables

2. **Twilio (for Voice/SMS)**
   - Sign up at [twilio.com](https://www.twilio.com)
   - Get UK phone number
   - Update `TWILIO_*` variables

3. **Retell AI (for Voice AI)**
   - Sign up at [retell.ai](https://www.retell.ai)
   - Create B2B and B2C agents
   - Update `RETELL_*` variables

4. **WhatsApp Business API**
   - Apply for access via Facebook Business
   - Update `WHATSAPP_*` variables

5. **Stripe (for Payments)**
   - Sign up at [stripe.com](https://stripe.com)
   - Get test API keys
   - Update `STRIPE_*` variables

## Common Issues

### Port 3000 Already in Use

Change the `PORT` in `.env`:
```env
PORT=3001
```

### Database Connection Error

- Ensure PostgreSQL is running: `pg_isready`
- Check your `DATABASE_URL` format
- Verify username/password are correct

### Redis Connection Error (Optional)

If you don't have Redis installed, the app will still work for basic functionality. To install Redis:

**macOS:**
```bash
brew install redis
brew services start redis
```

**Ubuntu/Debian:**
```bash
sudo apt-get install redis-server
sudo systemctl start redis
```

### Migration Errors

If migrations fail, reset the database:

```bash
# WARNING: This deletes all data
npm run db:migrate -- reset
```

## Development Tools

### Useful Commands

- `npm run lint` - Check code for errors
- `npm run lint:fix` - Auto-fix linting errors
- `npm run format` - Format code with Prettier
- `npm run build` - Build for production

### Viewing Logs

Logs are written to:
- `logs/error.log` - Error logs only
- `logs/combined.log` - All logs
- Console - Development logs

## API Documentation

All available endpoints are documented in the main [README.md](./README.md#api-endpoints)

## Project Structure

```
src/
├── api/
│   ├── controllers/     # Handle requests
│   └── routes/          # Define endpoints
├── services/            # Business logic
├── middleware/          # Auth, validation, errors
├── config/              # Environment config
├── types/               # TypeScript types + Zod schemas
├── utils/               # Helpers (logger, Prisma, errors)
└── index.ts             # Server entry point
```

## Need Help?

- Check the main [README.md](./README.md) for detailed documentation
- Review the project specifications in `ivySpecs/`
- Examine the Prisma schema in `prisma/schema.prisma`

## You're All Set! 🎉

Your Ivy backend is now running. You can:
- ✅ Create and manage users
- ✅ Plan and track workouts
- ✅ Manage streaks automatically
- ✅ Process donations via Impact Wallet
- ✅ Authenticate with magic links + JWT

Next: Build out the remaining services (donations, stats, calls, webhooks) or connect a frontend!
