# Ivy — API Reference
## Complete Endpoint Documentation

---

# Overview

Base URL: `https://api.ivy.com` (production) or `http://localhost:3000` (development)

All endpoints return JSON. Authentication via Bearer token in Authorization header.

---

# Authentication

## Magic Link Login

```http
POST /api/auth/magic-link
```

Sends a magic link to the user's phone (SMS) or email.

**Request:**
```json
{
  "phone": "+447700900000"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Magic link sent"
}
```

---

## Verify Magic Link

```http
POST /api/auth/verify
```

**Request:**
```json
{
  "token": "abc123..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG...",
  "user": {
    "id": "uuid",
    "phone": "+447700900000",
    "first_name": "Sarah"
  }
}
```

---

## Refresh Token

```http
POST /api/auth/refresh
```

**Request:**
```json
{
  "refresh_token": "eyJhbG..."
}
```

**Response:**
```json
{
  "access_token": "eyJhbG...",
  "refresh_token": "eyJhbG..."
}
```

---

# Users

## Create User

```http
POST /api/users
```

**Request:**
```json
{
  "phone": "+447700900000",
  "email": "sarah@example.com",
  "first_name": "Sarah",
  "last_name": "Smith",
  "timezone": "Europe/London",
  "track": "fitness",
  "weekly_goal": 3,
  "minimum_action": "15 minute walk",
  "gift_frame": "my kids",
  "why_started": "I want to have more energy",
  "charity_id": "uuid",
  "morning_window_start": "07:30",
  "morning_window_end": "08:30",
  "evening_window_start": "19:00",
  "evening_window_end": "20:00",
  "preferred_days": ["monday", "wednesday", "friday"]
}
```

**Response:**
```json
{
  "id": "uuid",
  "phone": "+447700900000",
  "first_name": "Sarah",
  "track": "fitness",
  "weekly_goal": 3,
  "subscription_type": "b2c_pro",
  "status": "active",
  "created_at": "2025-01-15T10:00:00Z"
}
```

---

## Get User

```http
GET /api/users/:id
```

**Response:**
```json
{
  "id": "uuid",
  "phone": "+447700900000",
  "email": "sarah@example.com",
  "first_name": "Sarah",
  "last_name": "Smith",
  "timezone": "Europe/London",
  "track": "fitness",
  "weekly_goal": 3,
  "minimum_action": "15 minute walk",
  "gift_frame": "my kids",
  "why_started": "I want to have more energy",
  "charity": {
    "id": "uuid",
    "name": "Mind",
    "category": "mental_health"
  },
  "subscription_type": "b2c_pro",
  "status": "active",
  "morning_window_start": "07:30",
  "morning_window_end": "08:30",
  "evening_window_start": "19:00",
  "evening_window_end": "20:00",
  "preferred_days": ["monday", "wednesday", "friday"],
  "calendar_connected": false,
  "created_at": "2025-01-15T10:00:00Z",
  "onboarded_at": "2025-01-15T10:15:00Z"
}
```

---

## Update User

```http
PATCH /api/users/:id
```

**Request:**
```json
{
  "weekly_goal": 4,
  "evening_window_start": "18:30"
}
```

**Response:**
```json
{
  "id": "uuid",
  "weekly_goal": 4,
  "evening_window_start": "18:30",
  "updated_at": "2025-01-16T10:00:00Z"
}
```

---

## Get User Stats

```http
GET /api/users/:id/stats
```

**Response:**
```json
{
  "user_id": "uuid",
  "current_streak": 12,
  "longest_streak": 23,
  "workouts_this_week": 2,
  "workouts_this_month": 8,
  "total_workouts": 45,
  "weekly_goal": 3,
  "goal_completion_rate": 0.73,
  "weeks_in_program": 12,
  "impact": {
    "total_donated": 89.50,
    "currency": "GBP",
    "charity_name": "Mind",
    "impact_equivalent": "179 helpline calls"
  },
  "transformation": {
    "energy": {
      "start": 4,
      "current": 7,
      "change_percent": 75
    },
    "mood": {
      "start": 5,
      "current": 7,
      "change_percent": 40
    },
    "health_confidence": {
      "start": 3,
      "current": 7,
      "change_percent": 133
    }
  },
  "life_markers": [
    {
      "text": "Took the stairs without getting winded",
      "recorded_at": "2025-01-10T10:00:00Z"
    },
    {
      "text": "Clothes are looser",
      "recorded_at": "2025-01-03T10:00:00Z"
    }
  ]
}
```

---

## Get User Transformation History

```http
GET /api/users/:id/transformation
```

**Query Parameters:**
- `from`: Start date (ISO format)
- `to`: End date (ISO format)

**Response:**
```json
{
  "user_id": "uuid",
  "scores": [
    {
      "recorded_at": "2025-01-14T10:00:00Z",
      "energy_score": 7,
      "mood_score": 7,
      "health_confidence": null
    },
    {
      "recorded_at": "2025-01-07T10:00:00Z",
      "energy_score": 6,
      "mood_score": 6,
      "health_confidence": 6
    }
  ],
  "life_markers": [
    {
      "id": "uuid",
      "text": "Took the stairs without getting winded",
      "category": "capability",
      "recorded_at": "2025-01-10T10:00:00Z"
    }
  ]
}
```

---

## Pause User

```http
POST /api/users/:id/pause
```

**Request:**
```json
{
  "reason": "traveling",
  "resume_date": "2025-01-25"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "paused",
  "pause_reason": "traveling",
  "resume_date": "2025-01-25"
}
```

---

## Resume User

```http
POST /api/users/:id/resume
```

**Response:**
```json
{
  "id": "uuid",
  "status": "active"
}
```

---

# Workouts

## Create Workout (Plan)

```http
POST /api/workouts
```

**Request:**
```json
{
  "user_id": "uuid",
  "planned_activity": "Upper body weights at gym",
  "planned_time": "2025-01-16T18:00:00Z",
  "planned_duration_minutes": 45
}
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "planned_activity": "Upper body weights at gym",
  "planned_time": "2025-01-16T18:00:00Z",
  "planned_duration_minutes": 45,
  "status": "planned",
  "created_at": "2025-01-16T08:00:00Z"
}
```

---

## Get Workout

```http
GET /api/workouts/:id
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "planned_activity": "Upper body weights at gym",
  "planned_time": "2025-01-16T18:00:00Z",
  "planned_duration_minutes": 45,
  "status": "completed",
  "completed_at": "2025-01-16T19:15:00Z",
  "actual_duration_minutes": 50,
  "completion_notes": "Felt strong today",
  "logged_via": "evening_call",
  "donation": {
    "id": "uuid",
    "amount": 1.50,
    "charity_name": "Mind"
  },
  "created_at": "2025-01-16T08:00:00Z"
}
```

---

## Update Workout (Log Completion)

```http
PATCH /api/workouts/:id
```

**Request:**
```json
{
  "status": "completed",
  "actual_duration_minutes": 50,
  "completion_notes": "Felt strong today"
}
```

**Response:**
```json
{
  "id": "uuid",
  "status": "completed",
  "completed_at": "2025-01-16T19:15:00Z",
  "actual_duration_minutes": 50,
  "streak_updated": true,
  "new_streak": 13,
  "donation_logged": true,
  "donation_amount": 1.50
}
```

---

## Get User's Workouts

```http
GET /api/users/:id/workouts
```

**Query Parameters:**
- `from`: Start date
- `to`: End date
- `status`: Filter by status (planned, completed, skipped)
- `limit`: Number of results (default 20)
- `offset`: Pagination offset

**Response:**
```json
{
  "workouts": [
    {
      "id": "uuid",
      "planned_activity": "Upper body weights",
      "planned_time": "2025-01-16T18:00:00Z",
      "status": "completed",
      "completed_at": "2025-01-16T19:15:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

---

## Get Today's Workout

```http
GET /api/users/:id/workouts/today
```

**Response:**
```json
{
  "workout": {
    "id": "uuid",
    "planned_activity": "30 min run",
    "planned_time": "2025-01-16T12:30:00Z",
    "status": "planned"
  },
  "has_workout_planned": true
}
```

---

# Calls

## Initiate Call

```http
POST /api/calls/initiate
```

**Request:**
```json
{
  "user_id": "uuid",
  "call_type": "morning_planning"
}
```

**Call Types:**
- `morning_planning`
- `evening_review`
- `weekly_planning`
- `monthly_check`
- `quarterly_review`
- `rescue`
- `follow_up`
- `onboarding`

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "call_type": "morning_planning",
  "status": "initiating",
  "retell_call_id": "retell_abc123",
  "initiated_at": "2025-01-16T08:00:00Z"
}
```

---

## Get Call

```http
GET /api/calls/:id
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "call_type": "morning_planning",
  "direction": "outbound",
  "status": "completed",
  "started_at": "2025-01-16T08:00:05Z",
  "ended_at": "2025-01-16T08:01:23Z",
  "duration_seconds": 78,
  "outcome": "workout_planned",
  "transcript": "Ivy: Morning Sarah. Quick check-in...",
  "transcript_summary": "User planned 30 min run at 12:30pm"
}
```

---

## Get User's Calls

```http
GET /api/users/:id/calls
```

**Query Parameters:**
- `from`: Start date
- `to`: End date
- `call_type`: Filter by type
- `status`: Filter by status
- `limit`: Number of results
- `offset`: Pagination offset

**Response:**
```json
{
  "calls": [
    {
      "id": "uuid",
      "call_type": "morning_planning",
      "status": "completed",
      "started_at": "2025-01-16T08:00:05Z",
      "duration_seconds": 78
    }
  ],
  "total": 24,
  "limit": 20,
  "offset": 0
}
```

---

# Donations

## Get User's Donations

```http
GET /api/users/:id/donations
```

**Query Parameters:**
- `from`: Start date
- `to`: End date
- `limit`: Number of results
- `offset`: Pagination offset

**Response:**
```json
{
  "donations": [
    {
      "id": "uuid",
      "amount": 1.50,
      "currency": "GBP",
      "charity_name": "Mind",
      "donation_type": "completion",
      "workout_id": "uuid",
      "created_at": "2025-01-16T19:15:00Z"
    },
    {
      "id": "uuid",
      "amount": 3.00,
      "currency": "GBP",
      "charity_name": "Mind",
      "donation_type": "streak_bonus_7",
      "created_at": "2025-01-15T19:00:00Z"
    }
  ],
  "total": 45,
  "limit": 20,
  "offset": 0
}
```

---

## Get Impact Wallet

```http
GET /api/users/:id/wallet
```

**Response:**
```json
{
  "user_id": "uuid",
  "monthly_limit": 30.00,
  "per_completion": 1.50,
  "daily_cap": 4.00,
  "period_start": "2025-01-01",
  "period_end": "2025-01-31",
  "amount_used": 18.00,
  "amount_remaining": 12.00,
  "lifetime_donated": 89.50
}
```

---

## Get Impact Summary

```http
GET /api/users/:id/impact
```

**Response:**
```json
{
  "user_id": "uuid",
  "lifetime_donated": 89.50,
  "currency": "GBP",
  "charity": {
    "id": "uuid",
    "name": "Mind",
    "category": "mental_health"
  },
  "impact_equivalent": "179 helpline calls",
  "by_month": [
    {
      "month": "2025-01",
      "amount": 18.00
    },
    {
      "month": "2024-12",
      "amount": 24.50
    }
  ],
  "streak_bonuses_earned": 4,
  "streak_bonus_total": 16.00
}
```

---

# Messages

## Send Message

```http
POST /api/messages/send
```

**Request:**
```json
{
  "user_id": "uuid",
  "channel": "whatsapp",
  "message_type": "template",
  "template_id": "workout_reminder",
  "template_params": {
    "name": "Sarah",
    "time": "12:30pm",
    "activity": "run"
  }
}
```

**Response:**
```json
{
  "id": "uuid",
  "user_id": "uuid",
  "channel": "whatsapp",
  "status": "sent",
  "sent_at": "2025-01-16T12:15:00Z"
}
```

---

## Get User's Messages

```http
GET /api/users/:id/messages
```

**Query Parameters:**
- `channel`: Filter by channel (whatsapp, sms)
- `limit`: Number of results
- `offset`: Pagination offset

**Response:**
```json
{
  "messages": [
    {
      "id": "uuid",
      "direction": "outbound",
      "channel": "whatsapp",
      "content": "12:30 workout — still on? Reply 'done' when it's done.",
      "status": "delivered",
      "sent_at": "2025-01-16T12:15:00Z",
      "delivered_at": "2025-01-16T12:15:02Z"
    },
    {
      "id": "uuid",
      "direction": "inbound",
      "channel": "whatsapp",
      "content": "done",
      "status": "received",
      "sent_at": "2025-01-16T13:00:00Z"
    }
  ],
  "total": 156,
  "limit": 20,
  "offset": 0
}
```

---

# Charities

## List Charities

```http
GET /api/charities
```

**Response:**
```json
{
  "charities": [
    {
      "id": "uuid",
      "name": "Mind",
      "description": "Mental health support",
      "category": "mental_health",
      "logo_url": "https://...",
      "impact_statement": "£1 funds one call to the helpline",
      "impact_unit": "helpline calls",
      "impact_per_pound": 2.0
    },
    {
      "id": "uuid",
      "name": "WaterAid",
      "description": "Clean water access",
      "category": "water",
      "logo_url": "https://...",
      "impact_statement": "£1 provides clean water for one day",
      "impact_unit": "days of clean water",
      "impact_per_pound": 1.0
    }
  ]
}
```

---

# B2B Admin Endpoints

## Get Company Dashboard

```http
GET /api/admin/companies/:id/dashboard
```

**Response:**
```json
{
  "company_id": "uuid",
  "company_name": "TechCo",
  "season": 2,
  "season_week": 5,
  "season_start": "2025-01-06",
  "season_end": "2025-03-02",
  "participation": {
    "enrolled": 150,
    "active": 126,
    "rate": 0.84
  },
  "consistency": {
    "average_goal_completion": 0.71,
    "employees_above_80_percent": 65,
    "employees_below_50_percent": 12
  },
  "impact": {
    "total_donated": 4287.50,
    "currency": "GBP",
    "by_charity": [
      { "name": "Mind", "amount": 1842.00 },
      { "name": "WaterAid", "amount": 1203.50 },
      { "name": "Food Bank", "amount": 892.00 }
    ]
  },
  "transformation": {
    "avg_energy_change": 0.23,
    "avg_mood_change": 0.20,
    "avg_confidence_change": 0.27
  },
  "tracks": {
    "fitness": 0.54,
    "focus": 0.28,
    "sleep": 0.12,
    "balance": 0.06
  },
  "week_over_week": {
    "participation_change": 0.02,
    "consistency_change": 0.05
  }
}
```

---

## List Company Employees

```http
GET /api/admin/companies/:id/employees
```

**Note**: Returns limited data for privacy.

**Response:**
```json
{
  "employees": [
    {
      "id": "uuid",
      "first_name": "Sarah",
      "enrolled_at": "2025-01-06T10:00:00Z",
      "status": "active",
      "track": "fitness"
    }
  ],
  "total": 150,
  "active": 126,
  "by_status": {
    "active": 126,
    "paused": 12,
    "inactive": 12
  }
}
```

---

## Invite Employee

```http
POST /api/admin/companies/:id/invite
```

**Request:**
```json
{
  "email": "employee@company.com"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Invitation sent"
}
```

---

## Generate Report

```http
GET /api/admin/companies/:id/reports
```

**Query Parameters:**
- `type`: Report type (season_summary, weekly, monthly)
- `format`: Output format (json, pdf)

**Response (JSON):**
```json
{
  "report_type": "season_summary",
  "season": 1,
  "generated_at": "2025-03-02T10:00:00Z",
  "data": {
    "participation": { ... },
    "consistency": { ... },
    "impact": { ... },
    "transformation": { ... }
  }
}
```

---

# Webhooks (Inbound)

## Retell Webhook

```http
POST /webhooks/retell
```

**Events:**
- `call_started`
- `call_ended`
- `call_analyzed`

See Retell documentation for payload structure.

---

## WhatsApp Webhook

```http
POST /webhooks/whatsapp
```

**Verification (GET):**
```http
GET /webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=xxx&hub.challenge=xxx
```

See Meta documentation for payload structure.

---

## Stripe Webhook

```http
POST /webhooks/stripe
```

**Events handled:**
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

---

# Error Responses

All errors follow this format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid phone number format",
    "details": {
      "field": "phone",
      "reason": "Must be E.164 format"
    }
  }
}
```

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `UNAUTHORIZED` | 401 | Missing or invalid token |
| `FORBIDDEN` | 403 | Not allowed to access resource |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource already exists |
| `RATE_LIMITED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |
| `SERVICE_UNAVAILABLE` | 503 | External service down |

---

# Rate Limits

| Endpoint | Limit |
|----------|-------|
| Authentication | 10/minute |
| Call initiation | 5/minute per user |
| Message sending | 20/minute per user |
| General API | 100/minute |

---

# Pagination

All list endpoints support pagination:

```http
GET /api/users/:id/workouts?limit=20&offset=40
```

Response includes:
```json
{
  "data": [...],
  "total": 150,
  "limit": 20,
  "offset": 40,
  "has_more": true
}
```

---

# Filtering

List endpoints support filtering via query parameters:

```http
GET /api/users/:id/workouts?status=completed&from=2025-01-01&to=2025-01-31
```

---

# Versioning

API version is included in the URL path (future):
```
https://api.ivy.com/v1/users
```

Current version: v1 (implicit)

---
