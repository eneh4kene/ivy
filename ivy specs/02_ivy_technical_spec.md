# Ivy — Technical Specification
## Engineering Documentation v1.0

---

# Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture](#2-architecture)
3. [Core Services](#3-core-services)
4. [Database Schema](#4-database-schema)
5. [API Specifications](#5-api-specifications)
6. [Retell AI Integration](#6-retell-ai-integration)
7. [Twilio Integration](#7-twilio-integration)
8. [WhatsApp Integration](#8-whatsapp-integration)
9. [Calendar Integration](#9-calendar-integration)
10. [Stripe Integration](#10-stripe-integration)
11. [Call Flow State Machine](#11-call-flow-state-machine)
12. [Scheduled Jobs](#12-scheduled-jobs)
13. [Security & Privacy](#13-security--privacy)
14. [Monitoring & Logging](#14-monitoring--logging)
15. [Development Guidelines](#15-development-guidelines)
16. [MVP Scope](#16-mvp-scope)

---

# 1. System Overview

## 1.1 What We're Building

Ivy is a voice-based AI accountability system with two products:
- **B2B Sponsor Mode**: Company-funded accountability for employees
- **B2C Premium**: Individual subscription tiers (Pro/Elite/Concierge)

## 1.2 Core Capabilities

| Capability | Description |
|------------|-------------|
| Scheduled outbound calls | Ivy calls users at configured times |
| Inbound calls | Users can call Ivy (rescue, logging) |
| WhatsApp messaging | Nudges, reminders, async check-ins |
| Conversation context | Ivy remembers user state and history |
| Donation tracking | Impact Wallet, per-completion donations |
| Transformation tracking | Energy, mood, life markers over time |
| Dashboards | User stats, B2B admin aggregate views |

## 1.3 Tech Stack (Recommended)

| Layer | Technology | Rationale |
|-------|------------|-----------|
| Voice AI | Retell AI | Best-in-class conversational AI for voice |
| Telephony | Twilio | Reliable, scalable, good UK support |
| Messaging | WhatsApp Business API | High open rates, voice notes support |
| Backend | Node.js / Python (FastAPI) | Team preference |
| Database | PostgreSQL | Relational data, good for analytics |
| Cache | Redis | Session state, rate limiting |
| Queue | Bull (Redis) / SQS | Scheduled jobs, async processing |
| Hosting | AWS / GCP / Vercel | Team preference |
| Payments | Stripe | Subscriptions, usage tracking |
| Calendar | Google Calendar API, Microsoft Graph | Schedule awareness |

---

# 2. Architecture

## 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              CLIENTS                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  Phone (Voice)  │  WhatsApp  │  Web Dashboard  │  Admin Dashboard       │
└────────┬────────┴──────┬─────┴────────┬────────┴──────────┬─────────────┘
         │               │              │                   │
         ▼               ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           API GATEWAY                                    │
│                    (Authentication, Rate Limiting)                       │
└─────────────────────────────────────────────────────────────────────────┘
         │               │              │                   │
         ▼               ▼              ▼                   ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          CORE SERVICES                                   │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│    Voice     │   Messaging  │     User     │   Scheduler  │   Donation  │
│   Service    │   Service    │   Service    │   Service    │   Service   │
└──────┬───────┴──────┬───────┴──────┬───────┴──────┬───────┴──────┬──────┘
       │              │              │              │              │
       ▼              ▼              ▼              ▼              ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          DATA LAYER                                      │
├─────────────────────────────┬───────────────────────────────────────────┤
│         PostgreSQL          │              Redis                         │
│    (Users, Logs, Stats)     │    (Sessions, Cache, Queues)              │
└─────────────────────────────┴───────────────────────────────────────────┘
         │               │              │                   
         ▼               ▼              ▼                   
┌─────────────────────────────────────────────────────────────────────────┐
│                      EXTERNAL INTEGRATIONS                               │
├──────────────┬──────────────┬──────────────┬──────────────┬─────────────┤
│  Retell AI   │    Twilio    │   WhatsApp   │   Calendar   │   Stripe    │
│              │              │   Business   │    APIs      │             │
└──────────────┴──────────────┴──────────────┴──────────────┴─────────────┘
```

## 2.2 Service Responsibilities

| Service | Responsibilities |
|---------|------------------|
| **Voice Service** | Retell integration, call initiation, webhook handling, transcript processing |
| **Messaging Service** | WhatsApp sending/receiving, template management, delivery tracking |
| **User Service** | User CRUD, authentication, preferences, subscription management |
| **Scheduler Service** | Call scheduling, reminder queuing, job management |
| **Donation Service** | Impact Wallet, donation logging, charity integration, receipts |
| **Analytics Service** | Stats aggregation, transformation tracking, dashboard data |

---

# 3. Core Services

## 3.1 Voice Service

### Responsibilities
- Initiate outbound calls via Retell AI
- Handle Retell webhooks (call started, ended, transcript)
- Manage conversation context
- Process call outcomes and update user state

### Key Endpoints

```
POST /voice/calls/initiate
  - Initiates an outbound call to user
  - Body: { user_id, call_type, context }

POST /voice/webhooks/retell
  - Receives Retell webhook events
  - Events: call_started, call_ended, transcript_update

GET /voice/calls/:call_id
  - Get call details and transcript

POST /voice/calls/:call_id/outcome
  - Record call outcome (completed, missed, voicemail)
```

### Call Types

```typescript
enum CallType {
  MORNING_PLANNING = 'morning_planning',
  EVENING_REVIEW = 'evening_review',
  WEEKLY_PLANNING = 'weekly_planning',
  MONTHLY_CHECK = 'monthly_check',
  QUARTERLY_REVIEW = 'quarterly_review',
  RESCUE = 'rescue',
  FOLLOW_UP = 'follow_up',
  ONBOARDING = 'onboarding'
}
```

## 3.2 Messaging Service

### Responsibilities
- Send WhatsApp messages (text, templates, voice notes)
- Handle incoming WhatsApp messages
- Manage message templates
- Track delivery status

### Key Endpoints

```
POST /messaging/whatsapp/send
  - Send WhatsApp message
  - Body: { user_id, message_type, content, template_id? }

POST /messaging/webhooks/whatsapp
  - Receives WhatsApp webhook events
  - Events: message_received, delivery_status

GET /messaging/conversations/:user_id
  - Get conversation history
```

### Message Types

```typescript
enum MessageType {
  TEXT = 'text',
  TEMPLATE = 'template',
  VOICE_NOTE = 'voice_note',
  QUICK_REPLY = 'quick_reply'
}

enum TemplateType {
  WORKOUT_REMINDER = 'workout_reminder',
  COMPLETION_CONFIRMATION = 'completion_confirmation',
  STREAK_UPDATE = 'streak_update',
  WEEKLY_SUMMARY = 'weekly_summary',
  MISSED_CALL_FOLLOW_UP = 'missed_call_follow_up'
}
```

## 3.3 Scheduler Service

### Responsibilities
- Schedule calls based on user preferences
- Manage call windows and timezone handling
- Handle rescheduling and cancellations
- Queue reminder messages

### Key Endpoints

```
POST /scheduler/calls/schedule
  - Schedule a call
  - Body: { user_id, call_type, scheduled_time, window_start, window_end }

DELETE /scheduler/calls/:schedule_id
  - Cancel scheduled call

GET /scheduler/calls/upcoming
  - Get upcoming calls (for monitoring)

POST /scheduler/calls/:schedule_id/reschedule
  - Reschedule a call
```

### Scheduling Logic

```typescript
interface CallSchedule {
  user_id: string;
  call_type: CallType;
  scheduled_time: DateTime;
  window_start: DateTime;
  window_end: DateTime;
  timezone: string;
  retry_count: number;
  max_retries: number;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
}
```

## 3.4 Donation Service

### Responsibilities
- Manage Impact Wallets
- Log donations per completion
- Calculate streak bonuses
- Generate impact receipts
- Integrate with charity APIs (future)

### Key Endpoints

```
POST /donations/log
  - Log a donation from completion
  - Body: { user_id, workout_id, amount, charity_id }

GET /donations/wallet/:user_id
  - Get user's Impact Wallet status

GET /donations/receipts/:user_id
  - Get donation receipts (monthly)

GET /donations/impact/:user_id
  - Get lifetime impact stats
```

### Donation Rules

```typescript
interface DonationRules {
  per_completion: number;      // £1.00 - £2.00 based on tier
  daily_cap: number;           // £3.00 - £5.00 based on tier
  monthly_cap: number;         // £20 - £50 based on tier
  streak_bonus_7: number;      // £3
  streak_bonus_30: number;     // £10
  streak_bonus_90: number;     // £25
}
```

---

# 4. Database Schema

## 4.1 Core Tables

### users

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Basic info
  email VARCHAR(255) UNIQUE,
  phone VARCHAR(20) NOT NULL UNIQUE,
  first_name VARCHAR(100) NOT NULL,
  last_name VARCHAR(100),
  timezone VARCHAR(50) DEFAULT 'Europe/London',
  
  -- Subscription
  subscription_type VARCHAR(20) NOT NULL, -- 'b2b_sponsor' | 'b2c_pro' | 'b2c_elite' | 'b2c_concierge'
  subscription_status VARCHAR(20) DEFAULT 'active',
  stripe_customer_id VARCHAR(100),
  stripe_subscription_id VARCHAR(100),
  
  -- B2B specific
  company_id UUID REFERENCES companies(id),
  
  -- Track & goals
  track VARCHAR(20) NOT NULL, -- 'fitness' | 'focus' | 'sleep' | 'balance'
  weekly_goal INTEGER DEFAULT 3,
  
  -- Preferences
  morning_window_start TIME,
  morning_window_end TIME,
  evening_window_start TIME,
  evening_window_end TIME,
  preferred_days VARCHAR(50)[], -- ['monday', 'wednesday', 'friday']
  communication_preference VARCHAR(20) DEFAULT 'calls', -- 'calls' | 'async' | 'mixed'
  
  -- Personal context (for Ivy)
  minimum_action TEXT,
  gift_frame TEXT,
  why_started TEXT,
  obstacles TEXT[],
  
  -- Charity
  charity_id UUID REFERENCES charities(id),
  
  -- Status
  status VARCHAR(20) DEFAULT 'active', -- 'active' | 'paused' | 'traveling' | 'sick'
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  onboarded_at TIMESTAMP
);
```

### companies (B2B)

```sql
CREATE TABLE companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  domain VARCHAR(255),
  
  -- Subscription
  stripe_customer_id VARCHAR(100),
  plan_type VARCHAR(20), -- 'standard' | 'premium' | 'enterprise'
  seats_purchased INTEGER,
  seats_used INTEGER DEFAULT 0,
  
  -- Impact Wallet
  monthly_wallet_per_employee DECIMAL(10,2),
  
  -- Season
  current_season INTEGER DEFAULT 1,
  season_start_date DATE,
  season_end_date DATE,
  
  -- Admin
  admin_email VARCHAR(255),
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### charities

```sql
CREATE TABLE charities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(50), -- 'mental_health' | 'hunger' | 'water' | 'children' | 'health'
  logo_url VARCHAR(500),
  
  -- Impact framing
  impact_statement TEXT, -- "£1 funds one call to the helpline"
  impact_unit VARCHAR(100), -- "helpline calls"
  impact_per_pound DECIMAL(10,2), -- 2.0 (£1 = 2 calls)
  
  active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### workouts (commitments)

```sql
CREATE TABLE workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  
  -- Plan
  planned_activity TEXT,
  planned_time TIMESTAMP,
  planned_duration_minutes INTEGER,
  
  -- Outcome
  status VARCHAR(20) DEFAULT 'planned', -- 'planned' | 'completed' | 'partial' | 'skipped' | 'rest_day'
  completed_at TIMESTAMP,
  actual_duration_minutes INTEGER,
  completion_notes TEXT,
  
  -- Source
  logged_via VARCHAR(20), -- 'morning_call' | 'evening_call' | 'whatsapp' | 'rescue_call'
  
  -- Donation
  donation_id UUID REFERENCES donations(id),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### calls

```sql
CREATE TABLE calls (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  
  -- Call details
  call_type VARCHAR(30) NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'outbound' | 'inbound'
  scheduled_time TIMESTAMP,
  started_at TIMESTAMP,
  ended_at TIMESTAMP,
  duration_seconds INTEGER,
  
  -- Status
  status VARCHAR(20) DEFAULT 'scheduled', -- 'scheduled' | 'in_progress' | 'completed' | 'missed' | 'failed'
  outcome VARCHAR(30), -- 'workout_planned' | 'workout_logged' | 'rescue_success' | 'rescue_failed' | 'voicemail'
  
  -- Retell
  retell_call_id VARCHAR(100),
  
  -- Transcript
  transcript TEXT,
  transcript_summary TEXT,
  
  -- Context sent to Ivy
  context_snapshot JSONB,
  
  -- Retry tracking
  retry_count INTEGER DEFAULT 0,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### donations

```sql
CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  charity_id UUID REFERENCES charities(id) NOT NULL,
  workout_id UUID REFERENCES workouts(id),
  
  -- Amount
  amount DECIMAL(10,2) NOT NULL,
  currency VARCHAR(3) DEFAULT 'GBP',
  
  -- Type
  donation_type VARCHAR(20), -- 'completion' | 'streak_bonus_7' | 'streak_bonus_30' | 'streak_bonus_90'
  
  -- B2B
  company_id UUID REFERENCES companies(id), -- If company-funded
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

### impact_wallets

```sql
CREATE TABLE impact_wallets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  
  -- Limits (based on subscription tier)
  monthly_limit DECIMAL(10,2) NOT NULL,
  per_completion DECIMAL(10,2) NOT NULL,
  daily_cap DECIMAL(10,2) NOT NULL,
  
  -- Current period
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  amount_used DECIMAL(10,2) DEFAULT 0,
  
  -- Lifetime
  lifetime_donated DECIMAL(10,2) DEFAULT 0,
  
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### streaks

```sql
CREATE TABLE streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) UNIQUE NOT NULL,
  
  current_streak INTEGER DEFAULT 0,
  longest_streak INTEGER DEFAULT 0,
  
  last_completion_date DATE,
  streak_start_date DATE,
  
  -- Bonus tracking
  last_7_day_bonus DATE,
  last_30_day_bonus DATE,
  last_90_day_bonus DATE,
  
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### transformation_scores

```sql
CREATE TABLE transformation_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  
  -- Scores (1-10)
  energy_score INTEGER,
  mood_score INTEGER,
  health_confidence INTEGER,
  
  -- Context
  recorded_via VARCHAR(20), -- 'weekly_call' | 'monthly_check' | 'whatsapp'
  notes TEXT,
  
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

### life_markers

```sql
CREATE TABLE life_markers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  
  marker_text TEXT NOT NULL,
  category VARCHAR(50), -- 'physical' | 'energy' | 'capability' | 'confidence'
  
  recorded_at TIMESTAMP DEFAULT NOW()
);
```

### messages

```sql
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES users(id) NOT NULL,
  
  direction VARCHAR(10) NOT NULL, -- 'inbound' | 'outbound'
  channel VARCHAR(20) NOT NULL, -- 'whatsapp' | 'sms'
  
  message_type VARCHAR(20), -- 'text' | 'template' | 'voice_note'
  template_id VARCHAR(100),
  
  content TEXT,
  media_url VARCHAR(500),
  
  -- Status
  status VARCHAR(20), -- 'sent' | 'delivered' | 'read' | 'failed'
  
  -- External IDs
  whatsapp_message_id VARCHAR(100),
  
  sent_at TIMESTAMP,
  delivered_at TIMESTAMP,
  read_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

## 4.2 Indexes

```sql
-- Users
CREATE INDEX idx_users_phone ON users(phone);
CREATE INDEX idx_users_company ON users(company_id);
CREATE INDEX idx_users_status ON users(status);

-- Workouts
CREATE INDEX idx_workouts_user ON workouts(user_id);
CREATE INDEX idx_workouts_planned_time ON workouts(planned_time);
CREATE INDEX idx_workouts_status ON workouts(status);

-- Calls
CREATE INDEX idx_calls_user ON calls(user_id);
CREATE INDEX idx_calls_scheduled ON calls(scheduled_time);
CREATE INDEX idx_calls_status ON calls(status);

-- Donations
CREATE INDEX idx_donations_user ON donations(user_id);
CREATE INDEX idx_donations_charity ON donations(charity_id);
CREATE INDEX idx_donations_created ON donations(created_at);

-- Transformation
CREATE INDEX idx_transformation_user ON transformation_scores(user_id);
CREATE INDEX idx_transformation_date ON transformation_scores(recorded_at);
```

---

# 5. API Specifications

## 5.1 Authentication

### B2C Users
- Magic link via email/SMS
- JWT tokens with refresh
- Token in Authorization header

### B2B Admins
- Email/password or SSO (future)
- Separate admin JWT

### Webhooks
- Signature verification (Retell, Twilio, WhatsApp, Stripe)

## 5.2 Core Endpoints

### Users

```
POST   /api/users                    # Create user (onboarding)
GET    /api/users/:id                # Get user
PATCH  /api/users/:id                # Update user
GET    /api/users/:id/stats          # Get user stats & streaks
GET    /api/users/:id/transformation # Get transformation data
POST   /api/users/:id/pause          # Pause accountability
POST   /api/users/:id/resume         # Resume accountability
```

### Workouts

```
POST   /api/workouts                 # Create/plan workout
GET    /api/workouts/:id             # Get workout
PATCH  /api/workouts/:id             # Update workout (log completion)
GET    /api/users/:id/workouts       # Get user's workouts
GET    /api/users/:id/workouts/today # Get today's workout(s)
```

### Calls

```
POST   /api/calls/initiate           # Initiate call now
GET    /api/calls/:id                # Get call details
GET    /api/users/:id/calls          # Get user's call history
POST   /api/calls/webhooks/retell    # Retell webhook
```

### Messages

```
POST   /api/messages/send            # Send message
GET    /api/users/:id/messages       # Get conversation
POST   /api/messages/webhooks/whatsapp # WhatsApp webhook
```

### Donations

```
GET    /api/users/:id/donations      # Get donation history
GET    /api/users/:id/wallet         # Get wallet status
GET    /api/users/:id/impact         # Get impact summary
```

### B2B Admin

```
GET    /api/admin/companies/:id/dashboard  # Company dashboard data
GET    /api/admin/companies/:id/employees  # List employees
POST   /api/admin/companies/:id/invite     # Invite employee
GET    /api/admin/companies/:id/reports    # Generate reports
```

## 5.3 Webhook Endpoints

```
POST   /webhooks/retell              # Retell call events
POST   /webhooks/twilio              # Twilio call status
POST   /webhooks/whatsapp            # WhatsApp messages
POST   /webhooks/stripe              # Stripe subscription events
POST   /webhooks/calendar            # Calendar change notifications
```

---

# 6. Retell AI Integration

## 6.1 Overview

Retell AI handles the conversational AI for voice calls. We send them:
- Phone number to call
- System prompt (the Ivy prompt)
- Dynamic variables (user context)

They handle:
- Speech-to-text
- LLM conversation
- Text-to-speech
- Call management

## 6.2 Creating an Agent

```javascript
// Create Retell agent (do once, or per-update)
const agent = await retell.createAgent({
  agent_name: "Ivy B2B",
  voice_id: "eleven_labs_voice_id", // Choose appropriate voice
  llm_websocket_url: "wss://your-server.com/retell-llm", // If custom LLM
  
  // Or use Retell's hosted LLM
  response_engine: {
    type: "retell-llm",
    llm_id: "your_llm_id"
  },
  
  // Agent settings
  language: "en-GB",
  interruption_sensitivity: 0.8,
  ambient_sound: null,
  responsiveness: 0.9,
  
  // Webhook
  webhook_url: "https://your-server.com/webhooks/retell"
});
```

## 6.3 Creating a Call

```javascript
// Initiate outbound call
const call = await retell.createCall({
  agent_id: "your_agent_id",
  
  // Phone numbers
  from_number: "+44xxxxxxxxxx", // Your Twilio number
  to_number: user.phone,
  
  // Dynamic variables for the prompt
  retell_llm_dynamic_variables: {
    user_name: user.first_name,
    company_name: user.company?.name || "",
    track: user.track,
    weekly_goal: user.weekly_goal,
    charity_name: user.charity.name,
    donation_amount: user.wallet.per_completion,
    minimum_action: user.minimum_action,
    gift_frame: user.gift_frame,
    current_streak: user.streak.current_streak,
    workouts_this_week: await getWorkoutsThisWeek(user.id),
    total_donated: user.wallet.lifetime_donated,
    call_type: callType,
    todays_plan: todaysPlan || "",
    // ... all other variables from prompt
  },
  
  // Metadata
  metadata: {
    user_id: user.id,
    call_type: callType,
    scheduled_call_id: scheduledCallId
  }
});
```

## 6.4 Handling Webhooks

```javascript
app.post('/webhooks/retell', async (req, res) => {
  const event = req.body;
  
  switch (event.event) {
    case 'call_started':
      await handleCallStarted(event);
      break;
      
    case 'call_ended':
      await handleCallEnded(event);
      break;
      
    case 'call_analyzed':
      // Transcript and analysis ready
      await handleCallAnalyzed(event);
      break;
  }
  
  res.sendStatus(200);
});

async function handleCallEnded(event) {
  const { call_id, metadata, transcript, call_analysis } = event;
  
  // Update call record
  await db.calls.update({
    where: { retell_call_id: call_id },
    data: {
      status: 'completed',
      ended_at: new Date(),
      duration_seconds: event.duration_seconds,
      transcript: transcript,
      transcript_summary: call_analysis?.summary
    }
  });
  
  // Process outcome based on call type and transcript
  await processCallOutcome(metadata.user_id, metadata.call_type, call_analysis);
}
```

## 6.5 System Prompt Structure

The system prompt (see Retell Prompt docs) includes:
- Ivy's identity and personality
- User context variables (injected dynamically)
- All call flows and scripts
- Nudge stack reference
- Safety boundaries

**Key**: The prompt uses `{{variable}}` syntax that Retell replaces with `retell_llm_dynamic_variables`.

---

# 7. Twilio Integration

## 7.1 Overview

Twilio provides:
- UK phone numbers for Ivy
- Call routing infrastructure
- SMS fallback

Retell integrates with Twilio directly, but we need Twilio for:
- Number provisioning
- SMS sending
- Call status webhooks (backup)

## 7.2 Setup

```javascript
// Buy a UK number
const number = await twilioClient.incomingPhoneNumbers.create({
  phoneNumber: '+44xxxxxxxxxx', // Or search for available
  voiceUrl: 'https://your-retell-webhook-url',
  smsUrl: 'https://your-server.com/webhooks/twilio/sms'
});

// Configure for Retell
// Retell provides the webhook URL to set for voice
```

## 7.3 SMS Fallback

```javascript
// Send SMS (for missed call follow-up)
await twilioClient.messages.create({
  body: "Missed you just now. What's your workout plan today? Reply when you can.",
  from: '+44xxxxxxxxxx',
  to: user.phone
});
```

---

# 8. WhatsApp Integration

## 8.1 Overview

WhatsApp Business API for:
- Nudges and reminders
- Async check-ins
- Quick replies for logging
- Voice note support (future)

## 8.2 Setup

1. Apply for WhatsApp Business API access
2. Set up via Meta Business Manager
3. Verify business
4. Create message templates (require approval)

## 8.3 Sending Messages

```javascript
// Using official WhatsApp Cloud API
const response = await fetch(
  `https://graph.facebook.com/v17.0/${PHONE_NUMBER_ID}/messages`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${ACCESS_TOKEN}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      to: user.phone,
      type: 'template',
      template: {
        name: 'workout_reminder',
        language: { code: 'en_GB' },
        components: [
          {
            type: 'body',
            parameters: [
              { type: 'text', text: user.first_name },
              { type: 'text', text: '12:30pm' },
              { type: 'text', text: 'Peloton' }
            ]
          }
        ]
      }
    })
  }
);
```

## 8.4 Message Templates

```
# workout_reminder
"Hey {{1}}, your workout is coming up at {{2}}. {{3}} — still the plan?"

# completion_check
"Did the workout happen? Reply 'done' or 'skip'."

# streak_update
"{{1}} in a row! £{{2}} to {{3}}. Keep going."

# weekly_summary
"This week: {{1}}/{{2}} workouts ✓. £{{3}} donated. Energy score: {{4}}."

# missed_call_follow_up
"Missed you just now. What's your plan for today? Reply when you can."
```

## 8.5 Handling Incoming Messages

```javascript
app.post('/webhooks/whatsapp', async (req, res) => {
  const { entry } = req.body;
  
  for (const e of entry) {
    for (const change of e.changes) {
      if (change.value.messages) {
        for (const message of change.value.messages) {
          await handleIncomingWhatsApp(message);
        }
      }
    }
  }
  
  res.sendStatus(200);
});

async function handleIncomingWhatsApp(message) {
  const { from, type, text } = message;
  
  const user = await db.users.findByPhone(from);
  if (!user) return;
  
  // Log message
  await db.messages.create({
    user_id: user.id,
    direction: 'inbound',
    channel: 'whatsapp',
    content: text?.body,
    whatsapp_message_id: message.id
  });
  
  // Process based on content
  const content = text?.body?.toLowerCase();
  
  if (content === 'done') {
    await logWorkoutCompletion(user.id);
    await sendWhatsApp(user.id, "Logged! £1 to [charity]. Nice work.");
  } else if (content === 'skip' || content === 'rest') {
    await logRestDay(user.id);
    await sendWhatsApp(user.id, "Rest day logged. Tomorrow's a new day.");
  } else {
    // Could trigger rescue flow or just acknowledge
    await sendWhatsApp(user.id, "Got it. I'll check in later.");
  }
}
```

---

# 9. Calendar Integration

## 9.1 Overview

Calendar integration (Elite/Concierge) allows Ivy to:
- See user's schedule
- Schedule workouts around meetings
- Auto-reschedule when conflicts arise
- Block workout time on calendar

## 9.2 Google Calendar

```javascript
// OAuth2 setup
const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  REDIRECT_URI
);

// Get auth URL
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: ['https://www.googleapis.com/auth/calendar']
});

// After user authorizes, exchange code for tokens
const { tokens } = await oauth2Client.getToken(code);
// Store tokens securely

// Get today's events
const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
const events = await calendar.events.list({
  calendarId: 'primary',
  timeMin: startOfDay.toISOString(),
  timeMax: endOfDay.toISOString(),
  singleEvents: true,
  orderBy: 'startTime'
});

// Create workout block
await calendar.events.insert({
  calendarId: 'primary',
  resource: {
    summary: '🏋️ Workout (via Ivy)',
    start: { dateTime: workoutTime.toISOString() },
    end: { dateTime: workoutEndTime.toISOString() },
    description: 'Blocked by Ivy for your workout'
  }
});
```

## 9.3 Microsoft Graph (Outlook)

```javascript
// Similar OAuth flow with Microsoft identity platform
// Use @microsoft/microsoft-graph-client

const client = Client.init({
  authProvider: (done) => {
    done(null, accessToken);
  }
});

// Get events
const events = await client
  .api('/me/calendar/events')
  .filter(`start/dateTime ge '${startOfDay.toISOString()}'`)
  .get();

// Create event
await client.api('/me/calendar/events').post({
  subject: '🏋️ Workout (via Ivy)',
  start: { dateTime: workoutTime.toISOString(), timeZone: 'Europe/London' },
  end: { dateTime: workoutEndTime.toISOString(), timeZone: 'Europe/London' }
});
```

## 9.4 Calendar Context for Calls

```javascript
async function getCalendarContext(userId) {
  const user = await db.users.findById(userId);
  if (!user.calendarConnected) return null;
  
  const events = await getEventsForDay(userId, new Date());
  
  // Find gaps
  const gaps = findGapsInSchedule(events, user.morningWindow, user.eveningWindow);
  
  // Format for Ivy
  return {
    has_conflicts: events.length > 0,
    busy_periods: events.map(e => `${e.start} to ${e.end}: ${e.summary}`),
    available_gaps: gaps,
    suggested_workout_time: gaps[0]?.start || null
  };
}
```

---

# 10. Stripe Integration

## 10.1 Overview

Stripe handles:
- B2C subscriptions (Pro/Elite/Concierge)
- B2B invoicing
- Impact Wallet tracking (usage-based component)

## 10.2 Products & Prices

```javascript
// Create products (one-time setup)
const proProduct = await stripe.products.create({
  name: 'Ivy Pro',
  description: '2 calls/week, WhatsApp nudges, £20 Impact Wallet'
});

const proPrice = await stripe.prices.create({
  product: proProduct.id,
  unit_amount: 9900, // £99
  currency: 'gbp',
  recurring: { interval: 'month' }
});

// Similar for Elite (£199) and Concierge (£399)
```

## 10.3 Creating Subscriptions

```javascript
// Create customer
const customer = await stripe.customers.create({
  email: user.email,
  phone: user.phone,
  metadata: { user_id: user.id }
});

// Create subscription
const subscription = await stripe.subscriptions.create({
  customer: customer.id,
  items: [{ price: priceId }],
  payment_behavior: 'default_incomplete',
  expand: ['latest_invoice.payment_intent']
});

// Return client secret for payment
return subscription.latest_invoice.payment_intent.client_secret;
```

## 10.4 Handling Webhooks

```javascript
app.post('/webhooks/stripe', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const event = stripe.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  
  switch (event.type) {
    case 'customer.subscription.created':
      await activateSubscription(event.data.object);
      break;
      
    case 'customer.subscription.updated':
      await updateSubscription(event.data.object);
      break;
      
    case 'customer.subscription.deleted':
      await cancelSubscription(event.data.object);
      break;
      
    case 'invoice.paid':
      await resetMonthlyWallet(event.data.object);
      break;
  }
  
  res.json({ received: true });
});
```

---

# 11. Call Flow State Machine

## 11.1 Call States

```
┌──────────┐
│ SCHEDULED│
└────┬─────┘
     │ Time reached
     ▼
┌──────────┐     No answer      ┌──────────┐
│INITIATING│──────────────────▶│  MISSED  │
└────┬─────┘                    └────┬─────┘
     │ Connected                     │
     ▼                               │ Retry?
┌──────────┐                         │
│IN_PROGRESS│                        ▼
└────┬─────┘                   ┌──────────┐
     │ Call ends               │ RETRY    │──┐
     ▼                         └──────────┘  │
┌──────────┐                         ▲       │
│COMPLETED │                         └───────┘
└──────────┘                         Max retries
                                           │
                                           ▼
                                    ┌──────────┐
                                    │ FAILED   │
                                    └──────────┘
```

## 11.2 State Transitions

```typescript
enum CallState {
  SCHEDULED = 'scheduled',
  INITIATING = 'initiating',
  IN_PROGRESS = 'in_progress',
  COMPLETED = 'completed',
  MISSED = 'missed',
  RETRY = 'retry',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

interface CallStateMachine {
  schedule(userId: string, callType: CallType, time: Date): Promise<Call>;
  initiate(callId: string): Promise<void>;
  handleConnected(callId: string): Promise<void>;
  handleEnded(callId: string, transcript: string): Promise<void>;
  handleNoAnswer(callId: string): Promise<void>;
  retry(callId: string): Promise<void>;
  cancel(callId: string): Promise<void>;
}
```

## 11.3 Retry Logic

```typescript
const RETRY_CONFIG = {
  max_retries: 2,
  retry_delays: [30 * 60 * 1000, 60 * 60 * 1000], // 30 min, 1 hour
  
  // Missed call recovery (Elite/Concierge)
  send_whatsapp_after_miss: true,
  whatsapp_delay: 5 * 60 * 1000 // 5 minutes
};

async function handleMissedCall(call: Call) {
  const user = await db.users.findById(call.user_id);
  
  // Send WhatsApp
  if (user.subscription_tier !== 'b2c_pro') {
    await sendWhatsApp(user.id, 'missed_call_follow_up');
  }
  
  // Schedule retry if under limit
  if (call.retry_count < RETRY_CONFIG.max_retries) {
    const retryDelay = RETRY_CONFIG.retry_delays[call.retry_count];
    await scheduleRetry(call.id, retryDelay);
  } else {
    await markCallFailed(call.id);
  }
}
```

---

# 12. Scheduled Jobs

## 12.1 Job Types

| Job | Frequency | Description |
|-----|-----------|-------------|
| `schedule_daily_calls` | Daily 00:00 | Schedule all calls for the day |
| `process_call_queue` | Every minute | Initiate calls whose time has come |
| `send_reminders` | Every 15 min | Send pre-workout WhatsApp reminders |
| `check_missed_calls` | Every 5 min | Handle calls that weren't answered |
| `reset_daily_caps` | Daily 00:00 | Reset daily donation caps |
| `reset_monthly_wallets` | Monthly | Reset monthly Impact Wallets |
| `generate_weekly_summaries` | Sunday | Generate and send weekly summaries |
| `generate_monthly_receipts` | Monthly | Generate donation receipts |
| `streak_check` | Daily | Update streaks, trigger bonuses |

## 12.2 Implementation

```typescript
// Using Bull for job queues
import Bull from 'bull';

const callQueue = new Bull('calls', REDIS_URL);
const messageQueue = new Bull('messages', REDIS_URL);

// Schedule daily calls job
callQueue.process('schedule_daily_calls', async (job) => {
  const users = await db.users.findActive();
  
  for (const user of users) {
    const callsToSchedule = getCallsForUser(user, new Date());
    
    for (const call of callsToSchedule) {
      await db.calls.create({
        user_id: user.id,
        call_type: call.type,
        scheduled_time: call.time,
        status: 'scheduled'
      });
    }
  }
});

// Process call queue
callQueue.process('process_call_queue', async (job) => {
  const now = new Date();
  const dueCalls = await db.calls.findMany({
    where: {
      status: 'scheduled',
      scheduled_time: { lte: now }
    }
  });
  
  for (const call of dueCalls) {
    await initiateCall(call);
  }
});

// Add recurring jobs
callQueue.add('schedule_daily_calls', {}, {
  repeat: { cron: '0 0 * * *' } // Daily at midnight
});

callQueue.add('process_call_queue', {}, {
  repeat: { every: 60000 } // Every minute
});
```

---

# 13. Security & Privacy

## 13.1 Data Protection

| Data Type | Protection |
|-----------|------------|
| Phone numbers | Encrypted at rest |
| Call transcripts | Encrypted at rest, auto-delete after 90 days |
| Health data (energy, mood) | User-controlled, exportable, deletable |
| Payment data | Handled by Stripe (PCI compliant) |

## 13.2 GDPR Compliance

- **Right to access**: Users can export all their data
- **Right to deletion**: Users can delete account and all data
- **Right to portability**: Data export in standard format
- **Consent**: Clear opt-in for calls, messages, data processing

## 13.3 B2B Privacy

**Critical**: Employers cannot see individual employee data.

```typescript
// B2B Dashboard data - aggregate only
interface CompanyDashboard {
  participation_rate: number;      // % of employees active
  average_consistency: number;     // Aggregate goal completion
  total_donations: number;         // Sum of all donations
  track_distribution: Record<string, number>; // % per track
  
  // Aggregate transformation (anonymous)
  avg_energy_change: number;
  avg_mood_change: number;
  
  // NO individual data
}
```

## 13.4 API Security

- All endpoints require authentication
- Rate limiting on all endpoints
- Webhook signature verification
- Input validation and sanitization
- SQL injection prevention (parameterized queries)

---

# 14. Monitoring & Logging

## 14.1 Key Metrics

| Metric | Description | Alert Threshold |
|--------|-------------|-----------------|
| Call pickup rate | % of calls answered | < 50% |
| Call completion rate | % of calls that complete normally | < 90% |
| Retell API errors | Failed API calls | > 5/hour |
| WhatsApp delivery rate | % of messages delivered | < 95% |
| Average call duration | Typical call length | > 5 min or < 15 sec |
| Scheduler lag | Delay between scheduled and actual | > 5 min |

## 14.2 Logging

```typescript
// Structured logging
logger.info('call_initiated', {
  call_id: call.id,
  user_id: user.id,
  call_type: callType,
  scheduled_time: scheduledTime,
  actual_time: new Date()
});

logger.info('call_completed', {
  call_id: call.id,
  duration_seconds: duration,
  outcome: outcome,
  transcript_length: transcript.length
});

logger.error('call_failed', {
  call_id: call.id,
  error: error.message,
  retry_count: call.retry_count
});
```

## 14.3 Dashboards

- **Operations**: Call volume, success rates, queue depth
- **Product**: Completion rates, streak distribution, transformation trends
- **Business**: Active users, MRR, churn rate

---

# 15. Development Guidelines

## 15.1 Code Structure

```
/src
  /services
    /voice          # Retell integration
    /messaging      # WhatsApp integration
    /users          # User management
    /scheduler      # Call scheduling
    /donations      # Impact Wallet
    /analytics      # Stats and transformation
  /api
    /routes         # API endpoints
    /middleware     # Auth, validation
    /webhooks       # External webhooks
  /jobs             # Scheduled jobs
  /lib
    /retell         # Retell client
    /twilio         # Twilio client
    /whatsapp       # WhatsApp client
    /stripe         # Stripe client
  /db
    /models         # Database models
    /migrations     # Schema migrations
  /config           # Configuration
  /utils            # Helpers
```

## 15.2 Environment Variables

```env
# Database
DATABASE_URL=postgresql://...

# Redis
REDIS_URL=redis://...

# Retell
RETELL_API_KEY=...
RETELL_AGENT_ID=...

# Twilio
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...

# WhatsApp
WHATSAPP_PHONE_NUMBER_ID=...
WHATSAPP_ACCESS_TOKEN=...
WHATSAPP_VERIFY_TOKEN=...

# Stripe
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

# Google Calendar
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...

# App
APP_URL=https://...
JWT_SECRET=...
```

## 15.3 Testing

```typescript
// Unit tests for core logic
describe('StreakService', () => {
  it('should increment streak on completion', async () => {
    const user = await createTestUser();
    await logCompletion(user.id);
    const streak = await getStreak(user.id);
    expect(streak.current_streak).toBe(1);
  });
  
  it('should reset streak after missed day', async () => {
    // ...
  });
});

// Integration tests for API
describe('POST /api/workouts', () => {
  it('should create workout and schedule evening call', async () => {
    // ...
  });
});

// E2E tests for call flows
describe('Morning Planning Call', () => {
  it('should initiate call and handle response', async () => {
    // Mock Retell, verify call created
  });
});
```

---

# 16. MVP Scope

## 16.1 MVP Features (Week 1-4)

### Must Have

- [ ] User signup and onboarding
- [ ] Basic call scheduling (morning + evening)
- [ ] Retell integration (outbound calls)
- [ ] Core call flows (planning, review, basic rescue)
- [ ] Workout logging
- [ ] Streak tracking
- [ ] Basic donation tracking
- [ ] WhatsApp notifications (reminders, confirmations)
- [ ] Simple user dashboard (stats, streaks)

### Should Have

- [ ] Weekly planning call
- [ ] WhatsApp quick replies for logging
- [ ] B2B company setup (basic)
- [ ] Admin dashboard (basic aggregate stats)

### Nice to Have (Post-MVP)

- [ ] Calendar integration
- [ ] Monthly transformation checks
- [ ] Ivy Circle
- [ ] Human review (Concierge)
- [ ] Full transformation tracking
- [ ] Impact receipts

## 16.2 MVP Technical Priorities

1. **Retell integration working** — Can make and receive calls
2. **Call scheduling reliable** — Right time, right user, handles failures
3. **State management solid** — User context, streaks, completions
4. **WhatsApp working** — Send messages, receive replies
5. **Basic dashboard** — Users can see their progress

## 16.3 MVP Milestones

| Week | Milestone |
|------|-----------|
| 1 | Retell POC working, basic user model |
| 2 | Call scheduling, morning/evening flows |
| 3 | WhatsApp integration, workout logging, streaks |
| 4 | Dashboard, donation tracking, pilot-ready |

---

# Appendix A: Retell Prompt Variables

Full list of variables used in the Retell prompts:

```
{{user_name}}
{{company_name}}
{{track}}
{{weekly_goal}}
{{charity_name}}
{{donation_amount}}
{{minimum_action}}
{{gift_frame}}
{{why_started}}
{{obstacles}}
{{current_streak}}
{{longest_streak}}
{{workouts_this_week}}
{{workouts_this_month}}
{{total_workouts}}
{{total_donated}}
{{weeks_in_program}}
{{start_energy}}
{{current_energy}}
{{start_mood}}
{{current_mood}}
{{start_confidence}}
{{current_confidence}}
{{recent_life_markers}}
{{call_type}}
{{todays_plan}}
{{workout_time}}
{{day_of_week}}
{{calendar_conflicts}}
{{is_first_call}}
{{is_first_week_of_month}}
{{user_status}}
{{subscription_tier}}
{{calls_per_week}}
{{previous_streak}}
{{days_since_last_interaction}}
```

---

# Appendix B: API Response Examples

## Get User Stats

```json
GET /api/users/:id/stats

{
  "user_id": "uuid",
  "current_streak": 12,
  "longest_streak": 23,
  "workouts_this_week": 2,
  "workouts_this_month": 8,
  "total_workouts": 45,
  "weekly_goal": 3,
  "goal_completion_rate": 0.73,
  "impact": {
    "total_donated": 89.50,
    "charity": "Mind",
    "impact_equivalent": "179 helpline calls"
  },
  "transformation": {
    "energy": { "start": 4, "current": 7, "change": "+75%" },
    "mood": { "start": 5, "current": 7, "change": "+40%" },
    "confidence": { "start": 3, "current": 7, "change": "+133%" }
  }
}
```

## B2B Dashboard

```json
GET /api/admin/companies/:id/dashboard

{
  "company_id": "uuid",
  "season": 2,
  "week": 5,
  "participation": {
    "enrolled": 150,
    "active": 126,
    "rate": 0.84
  },
  "consistency": {
    "average_goal_completion": 0.71,
    "employees_above_80": 65
  },
  "impact": {
    "total_donated": 4287.50,
    "by_charity": {
      "Mind": 1842.00,
      "WaterAid": 1203.50,
      "Food Bank": 892.00
    }
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
  }
}
```

---

**End of Technical Specification**
