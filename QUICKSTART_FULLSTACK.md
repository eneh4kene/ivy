# Ivy Full-Stack Quick Start Guide

Get both backend and frontend running in 5 minutes!

---

## Prerequisites

- Node.js 18+ installed
- PostgreSQL running (local or cloud)
- Redis running (local or cloud)

---

## Step 1: Setup Backend

### 1.1 Navigate to project root
```bash
cd /Users/kene_eneh/ivy-1
```

### 1.2 Install dependencies
```bash
npm install
```

### 1.3 Configure environment variables
Create `.env` file (or check existing one):
```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/ivy"

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production

# Magic Link
MAGIC_LINK_SECRET=your-magic-link-secret

# API
PORT=3000
NODE_ENV=development

# Optional (for features)
RESEND_API_KEY=your-resend-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_PHONE_NUMBER=+1234567890
RETELL_API_KEY=your-retell-key
STRIPE_SECRET_KEY=your-stripe-key
```

### 1.4 Setup database
```bash
npm run db:generate  # Generate Prisma client
npm run db:migrate   # Run migrations
npm run db:seed      # Seed with sample data
```

### 1.5 Start backend
```bash
npm run dev
```

Backend should now be running on `http://localhost:3000`

Test it:
```bash
curl http://localhost:3000/health
```

---

## Step 2: Setup Frontend

### 2.1 Navigate to frontend
```bash
cd frontend
```

### 2.2 Install dependencies
```bash
npm install
```

### 2.3 Configure environment variables
Create `.env.local`:
```env
NEXT_PUBLIC_API_URL=http://localhost:3000
```

### 2.4 Start frontend
```bash
npm run dev
```

Frontend should now be running on `http://localhost:3001`

---

## Step 3: Test the Full Stack

### 3.1 Open browser
Go to `http://localhost:3001`

### 3.2 Test authentication flow
1. Click "Get Started" or "Sign In"
2. Enter email: `test@example.com`
3. Check backend logs for magic link token
4. Copy token and visit: `http://localhost:3001/verify?token=YOUR_TOKEN`
5. You should be redirected to dashboard!

### 3.3 Explore the app
- **Dashboard** - View your stats
- **Workouts** - Plan and track workouts
- **Donations** - See your impact
- **Transformation** - Log weekly scores
- **Settings** - Update preferences

---

## Quick Commands Reference

### Backend (from root directory)
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start               # Start production server
npm run db:studio       # Open Prisma Studio (database GUI)
npm run db:migrate      # Run migrations
npm run db:seed         # Seed database
```

### Frontend (from frontend/ directory)
```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start               # Start production server
npm run type-check      # Check TypeScript
npm run lint            # Run ESLint
```

---

## Development Workflow

### Two Terminal Setup
**Terminal 1 - Backend:**
```bash
cd /Users/kene_eneh/ivy-1
npm run dev
```

**Terminal 2 - Frontend:**
```bash
cd /Users/kene_eneh/ivy-1/frontend
npm run dev
```

### Testing Magic Links Locally

Since you don't have email configured yet, check backend console for magic link tokens:

**Backend logs will show:**
```
[Auth] Magic link token for test@example.com: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

**Then visit:**
```
http://localhost:3001/verify?token=YOUR_TOKEN_HERE
```

---

## Troubleshooting

### Backend won't start
- Check PostgreSQL is running: `psql -U postgres`
- Check Redis is running: `redis-cli ping`
- Verify .env file exists and has correct values

### Frontend won't start
- Check backend is running on port 3000
- Verify .env.local has correct API URL
- Clear Next.js cache: `rm -rf .next`

### Can't login
- Check backend logs for magic link token
- Verify email exists in database (check Prisma Studio)
- Check browser console for errors

### Database errors
```bash
# Reset database
npm run db:push -- --force-reset
npm run db:seed
```

---

## Testing with Sample Data

The seed script creates:
- **Users:** test@example.com, admin@ivy.com
- **Charities:** 10+ charities across categories
- **Workouts:** Sample workout history
- **Donations:** Sample donation records

**Test User:**
- Email: `test@example.com`
- No password needed (magic link auth)

---

## Production Deployment

### Backend
1. Deploy to Railway/Render/Fly.io
2. Set environment variables
3. Run migrations: `npm run db:migrate`
4. Start: `npm start`

### Frontend
1. Deploy to Vercel (recommended)
2. Set `NEXT_PUBLIC_API_URL` to your backend URL
3. Deploy: `vercel --prod`

---

## API Endpoints Overview

### Authentication
- `POST /api/auth/magic-link` - Send magic link
- `POST /api/auth/verify` - Verify token
- `GET /api/auth/me` - Get current user

### Users
- `GET /api/users/me` - Get profile
- `PATCH /api/users/me` - Update profile

### Workouts
- `GET /api/workouts` - List workouts
- `POST /api/workouts` - Create workout
- `POST /api/workouts/:id/complete` - Complete workout

### Donations
- `GET /api/donations` - List donations
- `GET /api/donations/charities` - List charities
- `GET /api/donations/impact-wallet` - Get impact wallet

### Stats
- `GET /api/stats` - Get overview
- `GET /api/stats/streak` - Get streak
- `POST /api/stats/transformation` - Log transformation score

Full API docs: See `README.md`

---

## Next Steps

1. **Run both servers** (backend + frontend)
2. **Test authentication** flow
3. **Create a workout** and complete it
4. **Check donations** are created
5. **Log transformation** scores
6. **Customize** settings

---

## Need Help?

- Check logs in both terminal windows
- Visit `http://localhost:3000/health` to verify backend
- Open browser DevTools console for frontend errors
- Check `README.md` for detailed documentation

---

## Success!

If you see:
- ✅ Backend running on :3000
- ✅ Frontend running on :3001
- ✅ Can login with magic link
- ✅ Dashboard shows stats

**You're all set! The Ivy platform is running! 🎉**

---

Built with Node.js, Express, Prisma, Next.js, and TypeScript.
