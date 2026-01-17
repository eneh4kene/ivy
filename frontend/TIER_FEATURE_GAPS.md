# Ivy Frontend: B2B & Premium Tier Feature Gaps

**Date:** January 17, 2025
**Current Status:** Generic frontend (no tier differentiation)

---

## Overview

The current frontend provides a **solid foundation** but treats all users the same. To support the B2B and premium tier user stories, we need to add:

1. **Feature gating** based on subscription tier
2. **B2B admin dashboard** for company sponsors
3. **Team/community features** (Ivy Circle)
4. **Tier-specific onboarding flows**
5. **Upgrade prompts** and marketing

---

## Gap Analysis by Feature Category

### 1. TIER-BASED FEATURE GATING ❌

**Current State:**
- All features visible to all users
- No "upgrade to unlock" messaging
- No tier badges/indicators

**Should Be:**

| Feature | FREE | PRO | ELITE | CONCIERGE | B2B Std | B2B Prem |
|---------|------|-----|-------|-----------|---------|----------|
| Workout planning | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Workout completion | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Basic stats | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Donation history | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Impact wallet | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Energy/Mood scores** | ❌ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **Health confidence** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Life markers** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Calendar sync** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ (Ent) |
| **Ivy Circle** | ❌ | ❌ | ✅ | ✅ | ❌ | ✅ |
| **Human review** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Strategy calls** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |

**What Needs to Change:**
```typescript
// Example: Transformation page should check tier
const canAccessLifeMarkers = ['ELITE', 'CONCIERGE', 'B2B'].includes(user.subscriptionTier)
const canAccessFullScoring = ['ELITE', 'CONCIERGE', 'B2B'].includes(user.subscriptionTier)

// Show locked state with upgrade CTA for lower tiers
```

---

### 2. B2B ADMIN DASHBOARD ❌ (CRITICAL)

**Current State:**
- Does not exist at all
- No company admin role or permissions
- No aggregate reporting

**Required Pages:**

#### `/admin/dashboard` - Company Overview
```
┌─────────────────────────────────────────┐
│ Season 3: Jan 15 - Mar 15 (45 days)     │
│ 125 employees enrolled                   │
│ Plan: Premium (£6,625/month)            │
└─────────────────────────────────────────┘

┌──────────────┬──────────────┬──────────┐
│ Participation│  Consistency │ Donations│
│     78%      │      65%     │  £2,340  │
│   ↑ 5%      │    ↓ 3%     │   ↑ £420 │
└──────────────┴──────────────┴──────────┘

📊 Participation Over Time
[Line graph: Week 1-6, showing % participation]

📊 Track Distribution
[Pie chart: 40% Fitness, 30% Focus, 20% Sleep, 10% Balance]

📊 Aggregate Wellbeing Trends
[Line graph: Energy, Mood, Health Confidence - anonymous averages]
```

#### `/admin/employees` - Employee Management
```
┌─────────────────────────────────────────┐
│ [+ Invite Employees]  [↓ Export CSV]    │
└─────────────────────────────────────────┘

Employee List (125 total, 98 active)
┌─────────────────────────────────────────┐
│ Name              | Status  | Track     │
│ Alice Johnson     | Active  | Fitness   │
│ Bob Smith         | Active  | Focus     │
│ Carol Davis       | Pending | -         │
└─────────────────────────────────────────┘

NOTE: Individual performance data NOT visible
Only enrollment status shown
```

#### `/admin/reports` - Reports & Exports
```
Generate Reports:
□ End of Season Summary
□ Weekly Participation Report
□ Aggregate Wellness Trends
□ Donation Impact Report

[Generate & Download]
```

#### `/admin/settings` - Company Settings
```
Company Profile
- Name: Acme Corp
- Plan: Premium (£53/employee/month)
- Seats: 125/150 used
- Season: Active (45 days remaining)

Integrations
- HRIS: Connected (BambooHR)
- SSO: Connected (Okta)
- Slack: Connected (#ivy-champions channel)
- Calendar: Not configured

Season Management
- Current: Season 3 (Jan 15 - Mar 15)
- Auto-renew: ON
- [Start New Season] [Opt Out]
```

**Database Requirements:**
- User model needs `role` field (user, admin, superadmin)
- Company model needs admin user relationships
- Need aggregate stats queries (privacy-preserving)

---

### 3. TEAM/COMMUNITY FEATURES ❌

**Current State:**
- No Ivy Circle functionality
- No cohort/team views
- No accountability pairs

**Required Pages:**

#### `/circle` - Ivy Circle Dashboard
```
Your Circle: "January Warriors" 🔥
10 members | Next call: Jan 24, 7pm GMT

┌─────────────────────────────────────────┐
│ Circle Goal: 500 Collective Workouts    │
│ Progress: 287/500 (57%)                 │
│ [███████████░░░░░░░░░]                  │
└─────────────────────────────────────────┘

Your Accountability Pair: Sarah K.
- Last workout: 2 hours ago (Running)
- Streak: 14 days
[Send Encouragement] [Schedule Check-in]

Upcoming Events
□ Jan 24, 7pm - Monthly Circle Call
□ Jan 31, 12pm - Hot Seat: Mike J.

Circle Activity
- Sarah completed morning run 🏃‍♀️
- Mike hit 30-day streak! 🎉
- Circle crossed 250 workouts milestone
```

**Features Needed:**
- Circle creation and matching
- Monthly call scheduling
- Pair messaging
- Shared goals tracking
- Activity feed
- Circle leaderboard (opt-in)

---

### 4. CALENDAR INTEGRATION UI ❌

**Current State:**
- Settings page has no calendar section
- No sync status shown
- No calendar view of workouts

**Required for Elite/Concierge:**

#### Settings → Calendar Integration
```
Calendar Integration (Elite/Concierge only)

Google Calendar
[✓ Connected] [Disconnect]
Last synced: 5 minutes ago

Outlook Calendar
[Connect]

Settings:
☑ Auto-block workout times
☑ Show workouts in calendar
☑ Send calendar invites for calls
□ Sync completed workouts
```

#### Workouts → Calendar View
```
[List View] [Calendar View]

January 2025
┌────────────────────────────────────────┐
│ Mon  Tue  Wed  Thu  Fri  Sat  Sun     │
│                  1    2    3    4      │
│      [🏃]      [💪] [🏃] [Rest]        │
│                                        │
│  5    6    7    8    9   10   11      │
│ [🏃] [💪] [🏃] [💪] [🏃] [Yoga][Rest] │
└────────────────────────────────────────┘

🏃 = Running (planned)
💪 = Gym (completed)
```

---

### 5. TIER-SPECIFIC ONBOARDING ❌

**Current State:**
- No onboarding flow at all
- New users go straight to dashboard
- No tier-specific setup

**Required Flows:**

#### FREE/PRO Onboarding (15 min)
```
Step 1: Welcome & Track Selection
Step 2: Goal Setting (simple)
Step 3: Schedule Setup (morning/evening times)
Step 4: Charity Selection
Step 5: First Workout Planning
```

#### ELITE Onboarding (30 min)
```
Step 1-5: Same as Pro
Step 6: Calendar Integration
Step 7: Obstacle Identification
Step 8: Ivy Circle Matching Preferences
Step 9: Accountability Pair Preferences
```

#### CONCIERGE Onboarding (45 min)
```
Step 1-9: Same as Elite
Step 10: Custom Escalation Rules
Step 11: Strategy Call Scheduling
Step 12: Human Coach Introduction Video
```

#### B2B Employee Onboarding (7 min)
```
Step 1: Company Verification (auto via email domain)
Step 2: Track Selection
Step 3: Charity Selection
Step 4: Simple Goal Setting
Step 5: Schedule Preferences
Step 6: Privacy Acknowledgment (data shared/not shared)
```

#### B2B Admin Onboarding (10 min)
```
Step 1: Company Profile Setup
Step 2: Season Configuration
Step 3: Plan Selection (Standard/Premium/Enterprise)
Step 4: Employee Invitation (upload CSV or manual)
Step 5: Integration Setup (optional)
Step 6: Launch Communication Templates
```

---

### 6. UPGRADE/MARKETING FLOWS ❌

**Current State:**
- Settings shows current tier
- No upgrade flow
- No feature comparison

**Required Pages:**

#### `/pricing` - Pricing & Plans
```
Choose Your Ivy Journey

┌─────────────┬─────────────┬─────────────┬─────────────┐
│    PRO      │    ELITE    │  CONCIERGE  │     B2B     │
│  £99/mo     │  £199/mo    │  £399/mo    │  Custom     │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ 2 calls/wk  │ 4 calls/wk  │ 5-7 calls   │ From £25/emp│
│ £20 wallet  │ £30 wallet  │ £50 wallet  │ Flexible    │
│ Basic track │ Full track  │ + Human     │ Team-focused│
│             │ + Calendar  │ + Strategy  │ + Analytics │
│             │ + Circle    │ + Concierge │             │
└─────────────┴─────────────┴─────────────┴─────────────┘

[Start Free Trial] [Upgrade to Pro] [Upgrade to Elite] [Book Demo]
```

#### Locked Feature States
```
// When FREE user tries to access Life Markers:

┌─────────────────────────────────────────┐
│ 🔒 Life Markers (Elite Feature)         │
│                                          │
│ Track major life moments and celebrate  │
│ wins with Life Markers - available in   │
│ Elite and Concierge plans.              │
│                                          │
│ Elite also includes:                    │
│ ✓ 4 calls per week                     │
│ ✓ Calendar integration                 │
│ ✓ Ivy Circle community                 │
│ ✓ Full transformation tracking         │
│                                          │
│ [Upgrade to Elite - £199/mo]           │
│ [View All Plans]                        │
└─────────────────────────────────────────┘
```

---

## Implementation Priority

### P0 - Critical for Launch
1. **Tier-based feature gating** (can't launch without this)
2. **B2B admin dashboard** (blocking B2B sales)
3. **Basic upgrade prompts** (revenue driver)

### P1 - High Value
4. **Onboarding flows** (conversion/activation)
5. **Calendar integration UI** (Elite value prop)
6. **Pricing page** (marketing funnel)

### P2 - Important but Can Wait
7. **Ivy Circle features** (community engagement)
8. **Reports generation** (B2B admin convenience)
9. **Advanced tier comparisons** (sales optimization)

---

## Code Changes Required

### 1. Add Role-Based Access Control
```typescript
// lib/types.ts
export type UserRole = 'user' | 'admin' | 'superadmin'

export interface User {
  // ... existing fields
  role: UserRole
  companyId?: string
}

// Create permission helpers
export const canAccessFeature = (
  user: User,
  feature: 'lifeMarkers' | 'calendar' | 'circle' | 'humanReview'
): boolean => {
  const tierMap = {
    lifeMarkers: ['ELITE', 'CONCIERGE', 'B2B'],
    calendar: ['ELITE', 'CONCIERGE'],
    circle: ['ELITE', 'CONCIERGE', 'B2B'],
    humanReview: ['CONCIERGE']
  }
  return tierMap[feature].includes(user.subscriptionTier)
}
```

### 2. Create Admin Routes
```
app/
  admin/
    layout.tsx          # Admin layout with different sidebar
    dashboard/
      page.tsx          # Company overview
    employees/
      page.tsx          # Employee management
    reports/
      page.tsx          # Report generation
    settings/
      page.tsx          # Company settings
```

### 3. Add Feature Gates to Existing Pages
```typescript
// app/transformation/page.tsx
export default function TransformationPage() {
  const user = useAuthStore((state) => state.user)
  const canAccessLifeMarkers = canAccessFeature(user, 'lifeMarkers')

  if (!canAccessLifeMarkers) {
    return <LockedFeature feature="lifeMarkers" requiredTier="ELITE" />
  }

  // ... existing code
}
```

### 4. Create Onboarding Flow
```
app/
  onboard/
    layout.tsx          # Onboarding stepper layout
    [step]/
      page.tsx          # Dynamic step pages
```

---

## Backend API Gaps

Check if these endpoints exist:

### Company/Admin Endpoints
- `GET /api/admin/company/stats` - Aggregate company stats
- `GET /api/admin/company/employees` - Employee list (names only, no perf data)
- `POST /api/admin/company/invite` - Invite employees
- `GET /api/admin/reports/:type` - Generate reports
- `GET /api/admin/company/settings` - Company settings
- `PATCH /api/admin/company/settings` - Update company settings

### Circle Endpoints
- `GET /api/circles/my-circle` - Get user's circle
- `GET /api/circles/:id/members` - Circle members
- `GET /api/circles/:id/activity` - Circle activity feed
- `POST /api/circles/:id/goals` - Create circle goal
- `GET /api/circles/:id/calls` - Upcoming circle calls

### Calendar Endpoints
- `POST /api/integrations/google/connect` - Connect Google Calendar
- `POST /api/integrations/outlook/connect` - Connect Outlook
- `GET /api/integrations/calendar/status` - Check sync status
- `DELETE /api/integrations/calendar/disconnect` - Disconnect calendar

---

## Effort Estimate

### To Add Tier Gating (P0)
**Time:** 2-3 days
- Add permission helpers
- Gate existing pages
- Create `<LockedFeature>` component
- Update all feature access points

### To Build B2B Admin Dashboard (P0)
**Time:** 1 week
- Create 4 admin pages
- Build aggregate stats components
- Create employee invite flow
- Add admin navigation
- Implement reports generation

### To Add Onboarding (P1)
**Time:** 3-4 days
- Create onboarding stepper
- Build 5-10 step pages
- Add tier-specific logic
- Integrate with API

### To Add Calendar Integration (P1)
**Time:** 2-3 days
- OAuth connection flow
- Calendar settings UI
- Calendar view component
- Sync status display

### To Build Ivy Circle (P2)
**Time:** 1 week
- Circle dashboard page
- Member list component
- Activity feed
- Pair matching UI
- Circle goals tracking

**Total Estimated Time:** 3-4 weeks for complete implementation

---

## Recommendation

**Phase 1 (Week 1):** Tier gating + upgrade prompts
- Block this week
- Enables differentiated pricing
- Shows value to free/pro users

**Phase 2 (Week 2):** B2B admin dashboard MVP
- Company overview stats
- Employee list
- Basic reports
- Blocks B2B sales without this

**Phase 3 (Week 3):** Onboarding flows
- Improves activation rates
- Sets up tier expectations
- Reduces confusion

**Phase 4 (Week 4+):** Circle, Calendar, Advanced Features
- Nice-to-haves
- Can iterate based on user feedback

---

## Summary

The current frontend is a **solid foundation** but is built as a **generic single-tier app**. To support the full Ivy vision with B2B sponsors and premium tiers, we need:

1. ✅ **Already built:** Core features (workouts, donations, transformation, settings)
2. ❌ **Missing:** Tier differentiation, B2B admin, team features, onboarding
3. 🔧 **Effort:** 3-4 weeks to reach feature parity with spec

**The good news:** The architecture is sound and the API integration is clean. Adding tier features is mostly additive (new pages/components) rather than refactoring existing code.

---

Built on January 17, 2025 - Ready for tier implementation!
