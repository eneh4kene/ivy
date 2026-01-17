# Ivy Frontend - Comprehensive Implementation Plan

**Target:** React/Next.js web application for Ivy accountability platform
**Timeline:** 3-4 weeks for MVP
**Status:** Planning Complete ✅

---

## 🎯 Overview

Build a modern, responsive web application that allows users to:
- Authenticate via magic link
- View comprehensive stats dashboard
- Plan and track workouts
- Monitor streaks and donations
- Log transformation scores
- Record life markers
- Manage profile and settings

---

## 🏗️ Technology Stack

### Core Framework
- **Next.js 14** (App Router)
  - Server-side rendering
  - API routes for BFF pattern
  - Built-in optimization

### State Management
- **Zustand** or **React Query**
  - Lightweight state management
  - Automatic caching and refetching
  - Optimistic updates

### UI Framework
- **Tailwind CSS** - Styling
- **shadcn/ui** - Component library
- **Framer Motion** - Animations
- **Recharts** - Charts and graphs

### Forms & Validation
- **React Hook Form**
- **Zod** (matching backend validation)

### API Client
- **Axios** with interceptors
- JWT token management
- Request/response types from backend

---

## 📱 Application Structure

```
frontend/
├── app/
│   ├── (auth)/              # Auth layout
│   │   ├── login/
│   │   ├── verify/
│   │   └── onboarding/
│   ├── (dashboard)/         # Main app layout
│   │   ├── dashboard/       # Overview
│   │   ├── workouts/        # Workout management
│   │   ├── donations/       # Donation tracking
│   │   ├── transformation/  # Transformation journal
│   │   └── settings/        # User settings
│   ├── layout.tsx
│   └── page.tsx             # Landing page
├── components/
│   ├── ui/                  # shadcn components
│   ├── layout/              # Layout components
│   ├── features/            # Feature-specific components
│   └── shared/              # Reusable components
├── lib/
│   ├── api/                 # API client
│   ├── hooks/               # Custom hooks
│   ├── store/               # State management
│   ├── utils/               # Utilities
│   └── types/               # TypeScript types
├── public/
│   └── assets/              # Images, icons
└── styles/
    └── globals.css          # Global styles
```

---

## 🎨 Pages & Features

### 1. Landing Page (`/`)
**Purpose:** Marketing page to convert visitors

**Sections:**
- Hero: "AI accountability that calls you"
- Problem: Why fitness apps fail (4% retention)
- Solution: Proactive calls + charity donations
- How it works: 3-step process
- Pricing tiers: PRO, ELITE, CONCIERGE
- Social proof: Testimonials (when available)
- CTA: "Start your accountability journey"

**Components:**
- `<Hero />`
- `<HowItWorks />`
- `<PricingCards />`
- `<Testimonials />`
- `<FAQ />`
- `<CTASection />`

---

### 2. Authentication Flow

#### a. Login Page (`/login`)
**Purpose:** Magic link authentication

**UI:**
```
┌─────────────────────────────────┐
│  Welcome to Ivy                 │
│                                 │
│  Enter your email:              │
│  [                  ]           │
│                                 │
│  [Send Magic Link]              │
│                                 │
│  No password needed!            │
└─────────────────────────────────┘
```

**Features:**
- Email input with validation
- Rate limiting indicator
- Success message: "Check your email"
- Resend link option

**State:**
```typescript
{
  email: string;
  isLoading: boolean;
  isSuccess: boolean;
  error: string | null;
}
```

#### b. Verify Page (`/verify?token=xxx`)
**Purpose:** Process magic link and authenticate

**Flow:**
1. Extract token from URL
2. Call `POST /api/auth/verify`
3. Store JWT in localStorage/cookie
4. Redirect to dashboard or onboarding

**Loading State:** Spinner with "Verifying..."
**Error State:** "Invalid or expired link"

#### c. Onboarding Flow (`/onboarding`)
**Purpose:** Collect user goals and preferences

**Steps:**
1. **Welcome**
   - "Hey {name}! Let's get you set up"

2. **Track Selection**
   - Fitness, Meditation, Reading, Running, Yoga, etc.

3. **Goal Setting**
   - "What's your goal?" (free text)
   - Example suggestions

4. **Schedule Setup**
   - Morning call time picker
   - Evening call time picker
   - Preferred days selector

5. **Charity Selection**
   - Browse charities with impact metrics
   - Select preferred charity

6. **Minimum Mode**
   - "What's the smallest thing you can do?"
   - Example: "10-minute walk"

7. **Gift Frame** (Optional)
   - "Who are you doing this for?"
   - Example: "My kids", "My health"

**Progress:** Step indicator (1/7, 2/7, etc.)
**Navigation:** Previous/Next buttons
**Completion:** Redirect to dashboard

---

### 3. Dashboard (`/dashboard`)
**Purpose:** Central hub showing all key metrics

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Ivy Dashboard          [Profile] [Settings]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Welcome back, Alice! 👋                        │
│  You're on a 5-day streak 🔥                    │
│                                                 │
├──────────────┬──────────────┬──────────────────┤
│ Current      │ Workouts     │ Total            │
│ Streak       │ This Week    │ Donated          │
│   5 days     │    3/4       │   £45.75         │
└──────────────┴──────────────┴──────────────────┘

┌─────────────────────────────────────────────────┐
│  This Week's Progress                           │
│  ●●●○○○○  3/7 days completed                    │
│                                                 │
│  Mon ✓  Tue ✓  Wed ✓  Thu ○  Fri ○  Sat ○     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Upcoming                                       │
│  📞 Evening check-in - Today at 8:00 PM         │
│  💪 Tomorrow's workout - Plan at 7:00 AM        │
└─────────────────────────────────────────────────┘

┌──────────────────────┬──────────────────────────┐
│  Quick Actions       │  Recent Activity         │
│  [Plan Workout]      │  • Completed 30min run   │
│  [Log Completion]    │  • +£1 to charity        │
│  [Skip Today]        │  • Streak: 4 → 5 days    │
└──────────────────────┴──────────────────────────┘
```

**Components:**
- `<StatsGrid />` - Key metrics cards
- `<WeeklyProgress />` - Week view calendar
- `<UpcomingCalls />` - Scheduled calls list
- `<QuickActions />` - Button shortcuts
- `<ActivityFeed />` - Recent events

**Data Fetched:**
- `GET /api/stats` - Overall stats
- `GET /api/stats/weekly` - Week summary
- `GET /api/workouts?status=PLANNED` - Upcoming workouts

---

### 4. Workouts Page (`/workouts`)
**Purpose:** Plan, view, and manage workouts

#### a. Workout Planner Tab
```
┌─────────────────────────────────────────────────┐
│  Plan Your Workout                              │
│                                                 │
│  Date: [Calendar Picker]                        │
│  Time: [Time Picker]                            │
│  Activity: [30 min run_________]                │
│  Duration: [30] minutes                         │
│                                                 │
│  [Schedule Workout]                             │
└─────────────────────────────────────────────────┘
```

**Form Fields:**
- Date picker (default: today)
- Time picker (optional)
- Activity input (autocomplete from history)
- Duration input (minutes)

**Validation:**
- Date must be today or future
- Activity required
- Duration > 0

#### b. Workout History Tab
```
┌─────────────────────────────────────────────────┐
│  Workout History           [Filters ▼]          │
│                                                 │
│  Today                                          │
│  ✓ 30 min run - 7:30 AM (Completed)            │
│    +£1 donated to Against Malaria Foundation   │
│                                                 │
│  Yesterday                                      │
│  ✓ Yoga session - 8:00 AM (Completed)          │
│    +£1 donated • Streak: 3 → 4 days            │
│                                                 │
│  2 days ago                                     │
│  ○ Rest day (Skipped)                           │
│    Streak reset to 0                            │
└─────────────────────────────────────────────────┘
```

**Features:**
- Infinite scroll or pagination
- Filters: Status, Date range
- Status badges (color-coded)
- Completion flow for planned workouts

#### c. Workout Detail Modal
```
┌─────────────────────────────────────────────────┐
│  30 min run - Today at 7:30 AM          [×]    │
├─────────────────────────────────────────────────┤
│                                                 │
│  Status: Planned                                │
│  Planned: Today at 7:30 AM                      │
│                                                 │
│  [Mark as Completed]  [Mark as Partial]         │
│  [Skip Workout]                                 │
│                                                 │
│  Or edit:                                       │
│  Activity: [30 min run_______]                  │
│  Time: [07:30]                                  │
│                                                 │
│  [Update]  [Delete]                             │
└─────────────────────────────────────────────────┘
```

**Actions:**
- Complete workout → `POST /api/workouts/:id/complete`
- Skip workout → Show skip reason modal
- Edit workout → `PATCH /api/workouts/:id`
- Delete workout → `DELETE /api/workouts/:id`

---

### 5. Donations Page (`/donations`)
**Purpose:** Track impact and donations

**Layout:**
```
┌─────────────────────────────────────────────────┐
│  Your Impact 🌍                                 │
├─────────────────────────────────────────────────┤
│                                                 │
│  Lifetime Donated: £45.75                       │
│  This Month: £8.50 / £20.00                     │
│  ████████░░ 42% used                            │
│                                                 │
│  Today: £2.00 / £3.00 daily cap                 │
│  ██████████░ 67% used                           │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Your Charity                                   │
│  Against Malaria Foundation                     │
│  🦟 2 nets per £1                               │
│                                                 │
│  Your donations have provided ~91 nets!         │
│  [Change Charity]                               │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│  Donation History                               │
│                                                 │
│  Today                                          │
│  £1.00 - Workout completion                     │
│  £1.00 - Workout completion                     │
│                                                 │
│  Yesterday                                      │
│  £3.00 - 7-day streak bonus 🎉                  │
│  £1.00 - Workout completion                     │
└─────────────────────────────────────────────────┘
```

**Components:**
- `<ImpactWalletCard />` - Spending limits with progress bars
- `<CharityCard />` - Current charity with impact calculation
- `<DonationHistory />` - List of all donations
- `<DonationChart />` - Monthly donation graph

**Data:**
- `GET /api/donations/impact-wallet`
- `GET /api/donations`
- `GET /api/donations/stats`

---

### 6. Transformation Page (`/transformation`)
**Purpose:** Log and view transformation journey

#### a. Log Scores Tab
```
┌─────────────────────────────────────────────────┐
│  How are you feeling this week?                 │
│                                                 │
│  Energy Level (1-10)                            │
│  ●○○○○○○○○○  1 ... 10                           │
│                                                 │
│  Mood (1-10)                                    │
│  ●○○○○○○○○○  1 ... 10                           │
│                                                 │
│  Health Confidence (1-10)                       │
│  ●○○○○○○○○○  1 ... 10                           │
│                                                 │
│  Notes (optional):                              │
│  [                                      ]       │
│                                                 │
│  [Log Scores]                                   │
└─────────────────────────────────────────────────┘
```

**UI:** Slider inputs with emoji feedback
**Action:** `POST /api/stats/transformation`

#### b. Progress Tab
```
┌─────────────────────────────────────────────────┐
│  Your Transformation Journey                    │
│                                                 │
│  Energy Score                                   │
│  Started: 4 → Now: 7  (+75% ⬆)                  │
│  [Line Chart showing progression]              │
│                                                 │
│  Mood Score                                     │
│  Started: 5 → Now: 8  (+60% ⬆)                  │
│  [Line Chart showing progression]              │
│                                                 │
│  Health Confidence                              │
│  Started: 3 → Now: 7  (+133% ⬆)                 │
│  [Line Chart showing progression]              │
└─────────────────────────────────────────────────┘
```

**Charts:** Line graphs using Recharts
**Trend Indicators:** Arrows and percentages
**Data:** `GET /api/stats/transformation`

#### c. Life Markers Tab
```
┌─────────────────────────────────────────────────┐
│  Life Markers                                   │
│  Record transformation moments                  │
│                                                 │
│  What did you notice?                           │
│  [I took the stairs without thinking___]        │
│                                                 │
│  Category:                                      │
│  ○ Physical  ○ Mental  ○ Social  ○ Professional │
│                                                 │
│  Significance:                                  │
│  ○ Small  ○ Medium  ○ Major                     │
│                                                 │
│  [Add Life Marker]                              │
│                                                 │
│  ───────────────────────────────────────        │
│                                                 │
│  Recent Markers:                                │
│  🏃 I ran for the bus and didn't get winded     │
│     Physical • Medium • 3 days ago              │
│                                                 │
│  💭 Felt calm during a stressful meeting        │
│     Mental • Small • 1 week ago                 │
└─────────────────────────────────────────────────┘
```

**Form:**
- Marker description (required)
- Category selection
- Significance level

**List:**
- Grouped by date
- Filter by category/significance
- Icons for each category

**Data:**
- `POST /api/stats/life-markers`
- `GET /api/stats/life-markers`

---

### 7. Settings Page (`/settings`)
**Purpose:** Manage profile and preferences

**Tabs:**
- Profile
- Schedule
- Notifications
- Subscription
- Account

#### Profile Tab
```
┌─────────────────────────────────────────────────┐
│  Profile                                        │
│                                                 │
│  First Name: [Alice______]                      │
│  Last Name:  [Johnson____]                      │
│  Email:      alice@example.com (verified)       │
│  Phone:      [+44 7700 900001]                  │
│  Timezone:   [Europe/London ▼]                  │
│                                                 │
│  [Update Profile]                               │
└─────────────────────────────────────────────────┘
```

#### Schedule Tab
```
┌─────────────────────────────────────────────────┐
│  Call Schedule                                  │
│                                                 │
│  Morning Call:  [07:00 ▼]  ☑ Enabled           │
│  Evening Call:  [20:00 ▼]  ☑ Enabled           │
│                                                 │
│  Call Frequency:  [3] calls per week            │
│                                                 │
│  Preferred Days:                                │
│  ☑ Mon  ☑ Tue  ☐ Wed  ☑ Thu  ☐ Fri  ☐ Sat  ☐ Sun  │
│                                                 │
│  [Update Schedule]                              │
└─────────────────────────────────────────────────┘
```

#### Subscription Tab
```
┌─────────────────────────────────────────────────┐
│  Subscription                                   │
│                                                 │
│  Current Plan: PRO (£99/month)                  │
│  Status: Active                                 │
│  Next billing: Feb 1, 2024                      │
│                                                 │
│  [Upgrade to ELITE]  [Manage Subscription]      │
│                                                 │
│  Impact Wallet:                                 │
│  Monthly Limit: £20                             │
│  Daily Cap: £3                                  │
└─────────────────────────────────────────────────┘
```

---

## 🧩 Key Components

### Reusable UI Components

#### 1. `<StatCard />`
Display a single metric with icon and trend

```typescript
interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: { value: number; direction: 'up' | 'down' | 'stable' };
  subtitle?: string;
}
```

#### 2. `<ProgressBar />`
Visual progress indicator

```typescript
interface ProgressBarProps {
  current: number;
  max: number;
  label?: string;
  color?: 'green' | 'blue' | 'orange';
  showPercentage?: boolean;
}
```

#### 3. `<StreakBadge />`
Display current streak with fire emoji

```typescript
interface StreakBadgeProps {
  days: number;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}
```

#### 4. `<WorkoutCard />`
Display workout with status badge

```typescript
interface WorkoutCardProps {
  workout: Workout;
  onComplete?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}
```

#### 5. `<DonationItem />`
Single donation in history list

```typescript
interface DonationItemProps {
  donation: Donation;
  showCharity?: boolean;
}
```

#### 6. `<WeekCalendar />`
Week view with workout dots

```typescript
interface WeekCalendarProps {
  workouts: Workout[];
  onDayClick?: (date: Date) => void;
}
```

---

## 🔄 State Management

### Global State (Zustand)

```typescript
// stores/auth.ts
interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
}

// stores/stats.ts
interface StatsState {
  streak: number;
  workoutsThisWeek: number;
  totalDonated: number;
  loading: boolean;
  error: string | null;
  fetchStats: () => Promise<void>;
}
```

### React Query Queries

```typescript
// hooks/useWorkouts.ts
export const useWorkouts = (filters?: WorkoutFilters) => {
  return useQuery({
    queryKey: ['workouts', filters],
    queryFn: () => api.workouts.getAll(filters),
  });
};

// hooks/useStats.ts
export const useStats = () => {
  return useQuery({
    queryKey: ['stats'],
    queryFn: () => api.stats.getOverview(),
    staleTime: 60000, // 1 minute
  });
};

// hooks/useDonations.ts
export const useDonations = () => {
  return useQuery({
    queryKey: ['donations'],
    queryFn: () => api.donations.getAll(),
  });
};
```

### Mutations

```typescript
// hooks/useCreateWorkout.ts
export const useCreateWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: CreateWorkoutInput) => api.workouts.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries(['workouts']);
      queryClient.invalidateQueries(['stats']);
    },
  });
};

// hooks/useCompleteWorkout.ts
export const useCompleteWorkout = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.workouts.complete(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries(['workouts']);
      queryClient.invalidateQueries(['stats']);
      queryClient.invalidateQueries(['donations']);
    },
  });
};
```

---

## 🌐 API Client

### API Service Structure

```typescript
// lib/api/client.ts
import axios from 'axios';

const client = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000',
});

// Add auth token to requests
client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 errors
client.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default client;
```

### API Methods

```typescript
// lib/api/workouts.ts
export const workoutsApi = {
  getAll: (filters?: WorkoutFilters) =>
    client.get('/api/workouts', { params: filters }),

  getById: (id: string) =>
    client.get(`/api/workouts/${id}`),

  create: (data: CreateWorkoutInput) =>
    client.post('/api/workouts', data),

  update: (id: string, data: UpdateWorkoutInput) =>
    client.patch(`/api/workouts/${id}`, data),

  complete: (id: string, status: string) =>
    client.post(`/api/workouts/${id}/complete`, { status }),

  delete: (id: string) =>
    client.delete(`/api/workouts/${id}`),
};
```

---

## 🎨 Design System

### Colors

```css
/* Primary Colors */
--primary: #4F46E5;      /* Indigo */
--primary-hover: #4338CA;
--primary-light: #EEF2FF;

/* Success (Streaks, Completion) */
--success: #10B981;      /* Green */
--success-light: #D1FAE5;

/* Warning (Partial, Pending) */
--warning: #F59E0B;      /* Orange */
--warning-light: #FEF3C7;

/* Error (Missed, Failed) */
--error: #EF4444;        /* Red */
--error-light: #FEE2E2;

/* Neutral */
--gray-50: #F9FAFB;
--gray-100: #F3F4F6;
--gray-500: #6B7280;
--gray-900: #111827;
```

### Typography

```css
/* Headings */
h1: 2.5rem, font-bold, gray-900
h2: 2rem, font-semibold, gray-900
h3: 1.5rem, font-semibold, gray-800

/* Body */
body: 1rem, font-normal, gray-600
small: 0.875rem, font-normal, gray-500
```

### Spacing

```
xs: 0.25rem (4px)
sm: 0.5rem (8px)
md: 1rem (16px)
lg: 1.5rem (24px)
xl: 2rem (32px)
2xl: 3rem (48px)
```

---

## 📊 Priority Implementation Order

### Phase 1: Core (Week 1)
1. **Project Setup**
   - Next.js initialization
   - Tailwind + shadcn/ui setup
   - API client configuration
   - Type definitions from backend

2. **Authentication**
   - Login page
   - Verify page
   - Auth context/store
   - Protected routes

3. **Dashboard**
   - Stats grid
   - Weekly progress
   - Quick actions

### Phase 2: Features (Week 2)
4. **Workouts Module**
   - Workout planner
   - Workout history
   - Workout detail modal
   - Complete/skip flows

5. **Onboarding**
   - Multi-step wizard
   - Data collection
   - Completion flow

### Phase 3: Analytics (Week 3)
6. **Donations Page**
   - Impact wallet display
   - Donation history
   - Charts

7. **Transformation Page**
   - Score logging
   - Progress charts
   - Life markers

### Phase 4: Polish (Week 4)
8. **Settings**
   - Profile management
   - Schedule configuration
   - Subscription info

9. **Polish & Optimization**
   - Loading states
   - Error handling
   - Responsive design
   - Animations
   - SEO

---

## 🚀 Launch Checklist

### Pre-Launch
- [ ] Environment variables configured
- [ ] API endpoints tested
- [ ] Error boundaries implemented
- [ ] Loading states on all data fetching
- [ ] Form validation complete
- [ ] Responsive on mobile/tablet/desktop
- [ ] Accessibility (keyboard navigation, ARIA labels)
- [ ] SEO meta tags
- [ ] Analytics integration (optional)

### Performance
- [ ] Code splitting
- [ ] Image optimization
- [ ] Lazy loading
- [ ] Bundle size < 200KB initial
- [ ] Lighthouse score > 90

### Testing
- [ ] Unit tests for utilities
- [ ] Integration tests for critical flows
- [ ] E2E tests for auth and workout creation
- [ ] Manual QA on all browsers

---

## 🎯 Success Metrics

### User Engagement
- Daily active users
- Workout completion rate
- Streak retention (30-day, 90-day)
- Time spent in app

### Technical
- Page load time < 2s
- API response time < 500ms
- Error rate < 1%
- Uptime > 99.9%

---

## 📝 Next Steps

1. **Set up Next.js project**
   ```bash
   npx create-next-app@latest ivy-frontend --typescript --tailwind --app
   ```

2. **Install dependencies**
   ```bash
   npm install axios @tanstack/react-query zustand framer-motion recharts
   npm install -D @types/node
   ```

3. **Configure shadcn/ui**
   ```bash
   npx shadcn-ui@latest init
   ```

4. **Create folder structure**
   ```bash
   mkdir -p app/(auth) app/(dashboard) components/{ui,layout,features,shared} lib/{api,hooks,store,utils,types}
   ```

5. **Start with Authentication**
   - Build login page
   - Implement magic link flow
   - Set up auth context

---

## 🎨 Design Inspiration

- **Duolingo** - Streak gamification
- **Strava** - Activity tracking
- **Calm** - Minimalist dashboard
- **Superhuman** - Clean, focused UI
- **Linear** - Keyboard shortcuts, speed

---

**Frontend plan complete! Ready to build. 🚀**
