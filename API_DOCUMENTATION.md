# Ivy API Documentation

**Base URL**: `http://localhost:3001` (development) | `https://api.tryivy.com` (production)

**Swagger UI**: `http://localhost:3001/api-docs`

**OpenAPI Spec**: `http://localhost:3001/api-docs.json`

---

## Overview

Complete REST API for the Ivy wellness accountability platform with AI voice calls, donation tracking, and tier-based subscriptions.

### Key Features

- 🔐 **JWT Authentication** with magic links (passwordless)
- 👥 **User Management** with role-based access control
- 💳 **Stripe Integration** for subscription management
- 🏋️ **Workout Tracking** with completion and donation triggers
- 📞 **Retell AI Integration** for voice accountability calls
- ❤️ **Donation System** (£1 per workout to charity)
- 📊 **Transformation Scores** (energy, mood, health confidence)
- 🏢 **B2B Features** with company admin dashboards

### Subscription Tiers

| Tier | Price | Features |
|------|-------|----------|
| **FREE** | £0/month | Basic workouts, donations |
| **PRO** | £29/month | + Energy/mood tracking |
| **ELITE** | £49/month | + Health confidence, Ivy Circle, calendar sync |
| **CONCIERGE** | £99/month | + Human review, strategy calls, life markers |
| **B2B** | £53/employee/month | Company programs with admin dashboard |

---

## Authentication

### Magic Link Flow

1. **Request Magic Link**: `POST /api/auth/magic-link`
   ```json
   {
     "email": "user@example.com"
   }
   ```

2. **Verify Token**: `POST /api/auth/verify`
   ```json
   {
     "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
   }
   ```

   Response:
   ```json
   {
     "success": true,
     "data": {
       "accessToken": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
       "user": { /* User object */ }
     }
   }
   ```

3. **Use Access Token** in subsequent requests:
   ```
   Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
   ```

---

## API Endpoints

### Authentication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/auth/magic-link` | Send magic link to email | No |
| POST | `/api/auth/verify` | Verify magic link token | No |
| GET | `/api/auth/me` | Get current user profile | Yes |

### Users

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/users/profile` | Get user profile | Yes |
| PUT | `/api/users/profile` | Update user profile | Yes |
| GET | `/api/users/preferences` | Get user preferences | Yes |
| PUT | `/api/users/preferences` | Update preferences | Yes |
| POST | `/api/users/onboarding` | Complete onboarding | Yes |
| GET | `/api/users/subscription` | Get subscription details | Yes |

### Workouts

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/workouts` | Get user's workouts | Yes |
| POST | `/api/workouts` | Create new workout | Yes |
| GET | `/api/workouts/:id` | Get workout by ID | Yes |
| PUT | `/api/workouts/:id` | Update workout | Yes |
| POST | `/api/workouts/:id/complete` | Mark workout as complete | Yes |
| GET | `/api/workouts/week/:weekNumber` | Get workouts for specific week | Yes |
| GET | `/api/workouts/stats` | Get workout statistics | Yes |

### Stats & Transformation

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/stats/dashboard` | Get dashboard statistics | Yes |
| GET | `/api/stats/transformation-scores` | Get transformation scores | Yes (PRO+) |
| POST | `/api/stats/transformation-scores` | Record new scores | Yes (PRO+) |
| GET | `/api/stats/life-markers` | Get life markers | Yes (CONCIERGE) |
| POST | `/api/stats/life-markers` | Create life marker | Yes (CONCIERGE) |
| GET | `/api/stats/weekly-summary` | Get weekly summary | Yes |

### Donations

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| GET | `/api/donations` | Get user's donations | Yes |
| GET | `/api/donations/total` | Get total donated amount | Yes |
| GET | `/api/donations/charities` | Get available charities | Yes |
| PUT | `/api/donations/charity` | Select preferred charity | Yes |

### Webhooks

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/webhooks/stripe` | Stripe webhook events | No (Signature) |
| POST | `/webhooks/retell` | Retell webhook events | No (Signature) |

---

## Request/Response Examples

### Create Workout

**Request**: `POST /api/workouts`
```json
{
  "type": "strength",
  "duration": 30,
  "scheduledFor": "2026-01-20T10:00:00Z",
  "track": "fitness"
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "userId": "user-uuid",
    "type": "strength",
    "duration": 30,
    "completed": false,
    "scheduledFor": "2026-01-20T10:00:00Z",
    "track": "fitness",
    "createdAt": "2026-01-17T10:00:00Z",
    "updatedAt": "2026-01-17T10:00:00Z"
  }
}
```

### Complete Workout

**Request**: `POST /api/workouts/:id/complete`
```json
{
  "completedAt": "2026-01-20T10:30:00Z"
}
```

**Response**: `200 OK`
```json
{
  "success": true,
  "data": {
    "workout": {
      "id": "123e4567-e89b-12d3-a456-426614174000",
      "completed": true,
      "completedAt": "2026-01-20T10:30:00Z"
    },
    "donation": {
      "id": "donation-uuid",
      "amount": 1.0,
      "charityId": "charity-uuid",
      "charityName": "British Heart Foundation",
      "createdAt": "2026-01-20T10:30:00Z"
    }
  }
}
```

### Record Transformation Scores

**Request**: `POST /api/stats/transformation-scores`
```json
{
  "energyLevel": 7,
  "mood": 8,
  "healthConfidence": 6
}
```

**Response**: `201 Created`
```json
{
  "success": true,
  "data": {
    "id": "score-uuid",
    "userId": "user-uuid",
    "energyLevel": 7,
    "mood": 8,
    "healthConfidence": 6,
    "recordedAt": "2026-01-17T10:00:00Z"
  }
}
```

---

## Error Responses

All error responses follow this format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message"
  }
}
```

### Common Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Invalid input data |
| `UNAUTHORIZED` | 401 | Missing or invalid authentication |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `TIER_REQUIRED` | 403 | Feature requires higher tier |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

---

## Rate Limiting

- **Authentication endpoints**: 5 requests per 15 minutes per IP
- **General API**: 100 requests per 15 minutes per user

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1642424400
```

---

## Pagination

List endpoints support pagination with query parameters:

```
GET /api/workouts?page=1&limit=20&sortBy=createdAt&sortOrder=desc
```

Response:
```json
{
  "success": true,
  "data": {
    "items": [ /* array of items */ ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 150,
      "totalPages": 8,
      "hasMore": true
    }
  }
}
```

---

## Webhook Events

### Stripe Webhooks

**Endpoint**: `POST /webhooks/stripe`

**Events**:
- `customer.subscription.created` - New subscription started
- `customer.subscription.updated` - Subscription tier changed
- `customer.subscription.deleted` - Subscription cancelled
- `invoice.payment_succeeded` - Payment successful
- `invoice.payment_failed` - Payment failed

### Retell Webhooks

**Endpoint**: `POST /webhooks/retell`

**Events**:
- `call.started` - AI call initiated
- `call.completed` - AI call finished
- `call.failed` - AI call failed

---

## Testing

### Swagger UI

Access interactive API documentation:
```
http://localhost:3001/api-docs
```

Features:
- Try out endpoints directly in browser
- View request/response schemas
- See authentication requirements
- Download OpenAPI spec

### Example cURL Requests

**Get Magic Link**:
```bash
curl -X POST http://localhost:3001/api/auth/magic-link \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com"}'
```

**Get Current User**:
```bash
curl -X GET http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

**Create Workout**:
```bash
curl -X POST http://localhost:3001/api/workouts \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "type":"strength",
    "duration":30,
    "track":"fitness"
  }'
```

---

## Integration Guide

### 1. Authentication Flow

```typescript
// 1. Request magic link
const response = await fetch('http://localhost:3001/api/auth/magic-link', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'user@example.com' })
});

// 2. User clicks link in email, extract token from URL
const urlParams = new URLSearchParams(window.location.search);
const token = urlParams.get('token');

// 3. Verify token to get access token
const authResponse = await fetch('http://localhost:3001/api/auth/verify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ token })
});

const { data } = await authResponse.json();
const accessToken = data.accessToken;

// 4. Store token and use for subsequent requests
localStorage.setItem('accessToken', accessToken);
```

### 2. Making Authenticated Requests

```typescript
const accessToken = localStorage.getItem('accessToken');

const response = await fetch('http://localhost:3001/api/workouts', {
  method: 'GET',
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'Content-Type': 'application/json'
  }
});

const { data } = await response.json();
```

### 3. Error Handling

```typescript
async function makeApiRequest(endpoint, options) {
  try {
    const response = await fetch(endpoint, options);
    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error.message);
    }

    return data.data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}
```

---

## Support & Resources

- **Swagger UI**: http://localhost:3001/api-docs
- **OpenAPI Spec**: http://localhost:3001/api-docs.json
- **Health Check**: http://localhost:3001/health
- **GitHub**: https://github.com/eneh4kene/ivy
- **Documentation**: See README.md and QUICKSTART.md

---

**Last Updated**: 2026-01-17
**API Version**: 1.0.0
