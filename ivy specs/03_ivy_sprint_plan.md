# Ivy — MVP Sprint Plan & Roadmap
## Engineering Execution Plan

---

# Overview

This document outlines the development plan to get Ivy to pilot-ready state. We're building for speed with quality — get real users on calls as fast as possible.

**Target**: Pilot-ready in 4-6 weeks

---

# Phase 1: Foundation (Week 1-2)

## Week 1: Core Infrastructure

### Goals
- [ ] Development environment setup
- [ ] Database schema deployed
- [ ] Basic API structure
- [ ] Retell AI proof of concept working

### Tasks

**Day 1-2: Environment Setup**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Set up repository, CI/CD pipeline | | 4 |
| Provision development database (PostgreSQL) | | 2 |
| Provision Redis | | 1 |
| Set up environment variables / secrets management | | 2 |
| Create basic Express/FastAPI structure | | 2 |

**Day 3-4: Database & Models**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Create all database migrations (see schema) | | 6 |
| Build User model and basic CRUD | | 4 |
| Build Workout model and CRUD | | 3 |
| Build Call model and CRUD | | 3 |
| Build Streak model with update logic | | 4 |

**Day 5: Retell POC**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Create Retell account, get API keys | | 1 |
| Create basic Retell agent with test prompt | | 2 |
| Make first outbound test call | | 2 |
| Handle Retell webhook (call ended) | | 3 |

### Week 1 Deliverable
✅ Can make a test call that connects, Ivy speaks, call ends, we get webhook

---

## Week 2: Call Scheduling & Core Flows

### Goals
- [ ] Call scheduling working (right user, right time)
- [ ] Morning planning flow working end-to-end
- [ ] Evening review flow working end-to-end
- [ ] Basic workout logging

### Tasks

**Day 1-2: Scheduling Infrastructure**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Set up Bull queue for scheduled jobs | | 3 |
| Build schedule_daily_calls job | | 4 |
| Build process_call_queue job | | 4 |
| Build call initiation service | | 4 |
| Test: calls fire at correct times | | 2 |

**Day 3-4: Retell Integration (Full)**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Build dynamic variable injection for Retell | | 4 |
| Implement full B2B system prompt | | 2 |
| Implement full B2C system prompt | | 2 |
| Build context snapshot generation | | 4 |
| Handle all Retell webhooks (started, ended, analyzed) | | 4 |

**Day 5: Workout Logging**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Build workout creation (from morning call) | | 3 |
| Build workout completion logging | | 3 |
| Connect completion to streak update | | 3 |
| Connect completion to donation logging | | 3 |

### Week 2 Deliverable
✅ Can schedule a user, they get morning call, plan workout, get evening call, log completion, streak updates

---

# Phase 2: Messaging & Reliability (Week 3-4)

## Week 3: WhatsApp & Rescue Flow

### Goals
- [ ] WhatsApp integration working
- [ ] Reminder nudges sending
- [ ] Quick-reply logging working
- [ ] Rescue flow (inbound) working

### Tasks

**Day 1-2: WhatsApp Setup**
| Task | Owner | Est. Hours |
|------|-------|------------|
| WhatsApp Business API setup | | 4 |
| Create message templates (get approved) | | 2 |
| Build WhatsApp send service | | 4 |
| Build WhatsApp webhook handler | | 4 |
| Test: can send and receive messages | | 2 |

**Day 3-4: Nudges & Quick Replies**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Build pre-workout reminder job | | 3 |
| Build completion confirmation message | | 2 |
| Build "done"/"skip" reply handler | | 4 |
| Build streak update message | | 2 |
| Build missed call follow-up message | | 3 |

**Day 5: Rescue Flow**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Set up inbound call handling (Retell) | | 4 |
| Build rescue call flow in prompt | | 2 |
| Test: user can call Ivy, get rescue support | | 2 |

### Week 3 Deliverable
✅ Full daily loop with WhatsApp: reminder → call → confirmation → quick reply option
✅ User can text "I want to skip" and get rescue support

---

## Week 4: Reliability & Dashboard

### Goals
- [ ] Missed call handling robust
- [ ] Retry logic working
- [ ] Basic user dashboard
- [ ] B2B admin dashboard (basic)
- [ ] Pilot-ready

### Tasks

**Day 1-2: Reliability**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Build missed call detection | | 3 |
| Build retry scheduling logic | | 4 |
| Build call failure handling | | 3 |
| Build error alerting | | 3 |
| Load test: 50 concurrent calls | | 4 |

**Day 3-4: Dashboards**
| Task | Owner | Est. Hours |
|------|-------|------------|
| Build user stats endpoint | | 4 |
| Build simple user dashboard UI | | 8 |
| Build B2B aggregate stats endpoint | | 4 |
| Build simple B2B admin dashboard UI | | 6 |

**Day 5: Pilot Prep**
| Task | Owner | Est. Hours |
|------|-------|------------|
| User onboarding flow (signup → first call) | | 6 |
| End-to-end testing | | 4 |
| Bug fixes | | 4 |
| Documentation for pilot | | 2 |

### Week 4 Deliverable
✅ System is pilot-ready
✅ Can onboard users, schedule calls, handle failures, show progress

---

# Phase 3: Enhancement (Week 5-6)

## Week 5: Transformation & Polish

### Goals
- [ ] Weekly planning call working
- [ ] Energy/mood tracking
- [ ] Weekly summaries
- [ ] Donation receipts

### Tasks

| Task | Owner | Est. Hours |
|------|-------|------------|
| Build weekly planning call flow | | 4 |
| Build transformation_scores table and API | | 4 |
| Add energy/mood capture to weekly call | | 3 |
| Build weekly summary generation | | 4 |
| Build weekly summary WhatsApp/email | | 4 |
| Build donation receipt generation | | 4 |
| Build donation receipt email | | 3 |
| Add life markers to monthly check | | 4 |

---

## Week 6: Calendar & Premium Features

### Goals
- [ ] Google Calendar integration
- [ ] Outlook Calendar integration
- [ ] Calendar-aware scheduling
- [ ] Missed-call recovery (Elite)

### Tasks

| Task | Owner | Est. Hours |
|------|-------|------------|
| Google Calendar OAuth flow | | 6 |
| Google Calendar read events | | 4 |
| Google Calendar create events | | 3 |
| Microsoft Graph OAuth flow | | 6 |
| Outlook Calendar read/write | | 4 |
| Calendar context in morning calls | | 4 |
| Auto-reschedule on conflict | | 4 |
| Missed-call recovery flow (WhatsApp + retry) | | 4 |

---

# MVP Feature Checklist

## Must Have (Pilot)

### User Management
- [ ] User signup (phone + basic info)
- [ ] User onboarding (track, goal, charity, schedule)
- [ ] User preferences storage
- [ ] User authentication (magic link)

### Calls
- [ ] Morning planning call
- [ ] Evening review call
- [ ] Call scheduling (daily job)
- [ ] Call initiation (queue processing)
- [ ] Retell webhook handling
- [ ] Call transcript storage
- [ ] Missed call detection
- [ ] Basic retry logic

### Workouts
- [ ] Create workout (from call)
- [ ] Log completion
- [ ] Log skip/rest day
- [ ] Partial completion

### Streaks
- [ ] Increment on completion
- [ ] Reset on miss
- [ ] Track longest streak

### Donations
- [ ] Impact Wallet setup
- [ ] Log donation on completion
- [ ] Track daily/monthly caps
- [ ] Lifetime total

### WhatsApp
- [ ] Send reminder messages
- [ ] Send completion confirmations
- [ ] Receive "done"/"skip" replies
- [ ] Missed call follow-up

### Dashboard
- [ ] User stats (streak, workouts, donations)
- [ ] Basic progress view

## Should Have (Week 5-6)

### Calls
- [ ] Weekly planning call
- [ ] Inbound rescue calls
- [ ] Monthly check-in

### Transformation
- [ ] Energy/mood scoring
- [ ] Life markers capture
- [ ] Transformation trends

### Reporting
- [ ] Weekly summary
- [ ] Donation receipts

### B2B
- [ ] Company setup
- [ ] Employee invite flow
- [ ] Admin dashboard (aggregate)

## Nice to Have (Post-MVP)

### Premium Features
- [ ] Calendar integration
- [ ] Missed-call recovery (Elite)
- [ ] Escalation rules (Concierge)
- [ ] Human review workflow

### Community
- [ ] Ivy Circle setup
- [ ] Cohort management
- [ ] Group calls

### Advanced
- [ ] Quarterly transformation review
- [ ] Progress photos
- [ ] Wearable integration

---

# Technical Milestones

| Milestone | Target Date | Success Criteria |
|-----------|-------------|------------------|
| **M1: First Call** | End of Week 1 | Can make outbound call, Ivy speaks, webhook received |
| **M2: Full Loop** | End of Week 2 | Morning call → plan → evening call → log → streak updates |
| **M3: WhatsApp** | End of Week 3 | Reminders send, quick replies work, rescue flow works |
| **M4: Pilot Ready** | End of Week 4 | 10 users can onboard and use system for a week |
| **M5: Enhanced** | End of Week 6 | Weekly planning, transformation tracking, calendar |

---

# Team Allocation (Suggested)

## If 2 Engineers

| Engineer | Focus |
|----------|-------|
| **Eng 1** | Voice (Retell), Call scheduling, Call flows |
| **Eng 2** | WhatsApp, Dashboards, User management |

## If 3 Engineers

| Engineer | Focus |
|----------|-------|
| **Eng 1** | Voice (Retell), Call scheduling |
| **Eng 2** | WhatsApp, Messaging, Notifications |
| **Eng 3** | User management, Dashboards, B2B |

## If 4 Engineers

| Engineer | Focus |
|----------|-------|
| **Eng 1** | Voice (Retell integration) |
| **Eng 2** | Scheduling, Jobs, Reliability |
| **Eng 3** | WhatsApp, Messaging |
| **Eng 4** | User/Company management, Dashboards |

---

# Dependencies & Blockers

## External Dependencies

| Dependency | Lead Time | Owner |
|------------|-----------|-------|
| Retell AI account | 1 day | |
| Twilio account + UK number | 1-2 days | |
| WhatsApp Business API approval | 1-2 weeks | |
| Stripe account | 1 day | |
| Charity partnerships | 2-4 weeks | |

## Potential Blockers

| Blocker | Mitigation |
|---------|------------|
| WhatsApp approval delayed | Use SMS via Twilio as fallback |
| Retell voice quality issues | Test early, have backup voice provider |
| Calendar OAuth complexity | Defer to post-MVP if blocking |
| Charity API integration | Manual tracking initially |

---

# Daily Standups

During MVP build, recommend:
- **Time**: 10:00am daily
- **Duration**: 15 minutes
- **Format**: What I did yesterday, what I'm doing today, blockers

---

# Definition of Done

A feature is "done" when:
1. Code is written and working
2. Basic error handling in place
3. Unit tests for core logic
4. Tested manually end-to-end
5. Code reviewed and merged
6. Deployed to staging

---

# Launch Criteria

**Pilot can start when:**
- [ ] Can onboard a new user (signup → first call scheduled)
- [ ] Morning and evening calls working reliably
- [ ] Workout logging working
- [ ] Streaks updating correctly
- [ ] At least WhatsApp OR call retry working
- [ ] User can see their stats
- [ ] No critical bugs in 24 hours of testing

---

# Post-Pilot Priorities

Based on pilot feedback, likely priorities:
1. Reliability improvements (call quality, scheduling accuracy)
2. WhatsApp flow improvements
3. Dashboard enhancements
4. Weekly planning call
5. B2B admin features
6. Calendar integration

---

**Let's build.** 🚀
