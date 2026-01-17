# Ivy — Team Introduction
## What We're Building and Why It Matters

---

# Welcome to Ivy

You're joining a project to build something genuinely different in the fitness/wellness space. This document will get you up to speed quickly.

**Read time**: 10 minutes

---

# The One-Liner

**Ivy is an AI accountability partner that calls you to make sure you do what you said you'd do — and donates to charity every time you follow through.**

---

# The Problem We're Solving

## The Fitness App Graveyard

- Average fitness app has **4% retention** after 30 days
- 96% of people download an app, use it for a week, and abandon it
- This happens because apps are "pull-based" — you have to open them
- When motivation dips, you just... don't open the app
- The habit dies silently

## Why Existing Solutions Fail

| Solution | Why It Fails |
|----------|--------------|
| **Notifications** | Easy to swipe away, feel like spam |
| **Gamification** | Points and badges have no real value |
| **Social features** | Awkward, unstructured, friends flake |
| **Human coaches** | Expensive (£200+/month), judgment anxiety |
| **Accountability buddies** | People avoid them when they miss |

## The Core Insight

**People with social anxiety feel LESS anxious talking to AI than humans.**

Traditional accountability works through fear of judgment. Effective, but anxiety-inducing. When people slip up, they avoid the accountability itself.

AI removes the judgment. You get the accountability without the social cost.

---

# What Ivy Does

## The Core Loop

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   MORNING                    DAY                  EVENING   │
│                                                             │
│   ┌─────────┐          ┌─────────────┐        ┌─────────┐  │
│   │ Ivy     │          │ User works  │        │ Ivy     │  │
│   │ calls   │────────▶ │ out (or     │───────▶│ calls   │  │
│   │ to plan │          │ calls for   │        │ to      │  │
│   └─────────┘          │ rescue)     │        │ review  │  │
│        │               └─────────────┘        └─────────┘  │
│        │                                           │       │
│        │         ┌─────────────────────┐           │       │
│        └────────▶│  Completion =       │◀──────────┘       │
│                  │  Charity Donation   │                   │
│                  └─────────────────────┘                   │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## Key Interactions

1. **Morning Call**: "What's your workout plan today?"
2. **Evening Call**: "Did you do it?"
3. **Rescue Call** (user-initiated): "I'm about to skip..." → Ivy helps negotiate a minimum
4. **Weekly Planning**: Sunday call to plan the week ahead
5. **Monthly Check-in**: Track transformation, not just consistency

## The Giveback

Every completed commitment triggers a real donation to charity:
- User chooses their charity during onboarding
- £1-2 donated per completion (from Impact Wallet)
- Monthly receipts showing total impact
- Creates meaning, not just discipline

---

# The Two Products We're Building

## 1. B2B Sponsor Mode

**Companies pay for employee accountability.**

- Company funds "Impact Wallet" for employees
- Employees get Ivy calls, company gets aggregate dashboard
- 8-week "seasons" with clear start/end
- Pricing: ~£25/employee/month

**Why companies buy this:**
- Existing wellbeing programs have 20% engagement
- Ivy is proactive (calls you) not passive (app you ignore)
- Charity angle = CSR/PR value
- Measurable outcomes

## 2. B2C Premium

**Individuals pay for high-touch accountability.**

| Tier | Price | Key Features |
|------|-------|--------------|
| **Pro** | £99/mo | 2 calls/week, WhatsApp nudges, £20 Impact Wallet |
| **Elite** | £199/mo | 4 calls/week, calendar sync, Ivy Circle community, £30 wallet |
| **Concierge** | £399/mo | Daily calls, human review weekly, escalation rules, £50 wallet |

**Why individuals pay this:**
- Apps don't work for them
- They need external accountability
- They value transformation tracking
- Charity giving creates meaning

---

# What Makes Ivy Different

## 1. Voice-First

Not an app to open. Not notifications to swipe. Actual phone calls that create a commitment loop.

## 2. Judgment-Free

AI removes the social anxiety. You can admit you skipped without embarrassment. The accountability still works — without the shame spiral.

## 3. The Rescue Feature

Most apps ignore the moment when you're about to skip. Ivy leans in:
- User texts "I don't want to go to the gym"
- Ivy validates the feeling
- Negotiates a minimum ("Can you do a 15-minute walk?")
- Gets verbal commitment
- That minimum counts — streak alive, donation made

## 4. Transformation Tracking

We don't just track "did you work out?" We track:
- Energy scores (weekly)
- Mood scores (weekly)
- Life markers ("I took the stairs without thinking")
- Health confidence

Then we reflect it back: "When you started, your energy was 4. Now it's 7. That's not the workouts — that's you becoming different."

## 5. Meaningful Stakes

Every completion donates to charity. This creates:
- Prosocial motivation (helping others)
- Identity reinforcement ("I'm someone who follows through")
- Real consequences (not fake points)

---

# The Nudge Stack

Ivy uses 10 psychological mechanisms to create motivation without shame:

| Nudge | What It Does |
|-------|--------------|
| **Witness Effect** | "I'll ask you tonight" — creates open loop |
| **Verbal Commitment** | "Say it out loud" — self-binding |
| **Identity Reinforcement** | "You're someone who shows up" |
| **Social Proof** | "70% of people who feel like this still do something" |
| **Consequence Framing** | "Your streak is 12 days. Skip = zero." |
| **Gift Frame** | "You said you're doing this for your daughter" |
| **Minimum Negotiation** | "What's the smallest thing you can do?" |
| **Impact Stakes** | "That's £1 to Mind" |
| **Anticipation** | "You're close to something. Keep going." |
| **Progress Reflection** | "Your energy was 4, now it's 7" |

These are deployed situationally throughout conversations — especially during rescue moments.

---

# What We're NOT Building

**Ivy is accountability, not coaching.**

| Ivy Does | Ivy Does NOT |
|----------|--------------|
| Check if you did your workout | Tell you what workout to do |
| Help you stay consistent | Design exercise programs |
| Track transformation | Check your form |
| Donate to charity | Provide medical advice |
| Support your mental wellbeing | Replace therapy |

**Our target user**: Someone who knows what to do but doesn't do it consistently.

**Not our target user**: Total beginners who need programming, people with injuries needing rehab, athletes needing specialized training.

---

# Technical Overview

## Core Stack

| Component | Technology |
|-----------|------------|
| Voice AI | Retell AI |
| Telephony | Twilio |
| Messaging | WhatsApp Business API |
| Backend | [TBD by team] |
| Database | [TBD by team] |
| Calendar | Google Calendar API, Microsoft Graph |
| Payments | Stripe |

## Key Integrations

1. **Retell AI** — Handles voice conversations, speech-to-text, text-to-speech
2. **Twilio** — Phone number provisioning, call routing
3. **WhatsApp Business API** — Async messaging, nudges
4. **Calendar APIs** — Schedule awareness (Elite/Concierge)
5. **Stripe** — Subscription management, Impact Wallet tracking

## Data We Track

- User profile & preferences
- Scheduled commitments
- Completion logs
- Call transcripts (for context)
- Energy/mood scores
- Life markers
- Donation totals
- Streaks

---

# Go-to-Market Strategy

## Phase 1: Validate (Now → 8 weeks)

- Build MVP with core flows
- Pilot with 50-100 users (mix of B2B and B2C)
- Prove: pickup rates, completion rates, willingness to pay

## Phase 2: B2B Focus (Months 3-6)

- Land 3-5 company pilots
- Refine Sponsor Mode
- Build case studies

## Phase 3: Scale (Months 6-12)

- Expand B2B sales
- Launch B2C Premium publicly
- Add Ivy Circle community layer

---

# Your Role

Depending on your function, here's what you'll be working on:

## Engineering

- Voice AI integration (Retell)
- Call scheduling & routing
- User state management
- Impact Wallet & donation tracking
- Dashboard (B2B admin, user stats)
- Calendar integration

## Product/Design

- Onboarding flows
- Dashboard UX
- Transformation summary designs
- Impact receipts

## Operations

- Pilot user management
- Charity partnerships
- Customer support

---

# Key Documents

| Document | What It Contains |
|----------|------------------|
| **B2B Sponsor Mode Spec** | Full product spec, user journeys, pricing |
| **B2C Premium Spec** | Full product spec, tier features, user journeys |
| **Technical Spec** | Architecture, APIs, database schema |
| **Retell Prompt (B2B)** | Production AI prompt for Sponsor Mode |
| **Retell Prompt (B2C)** | Production AI prompt for Premium |

All documents are attached to this onboarding package.

---

# Questions You Might Have

**Why voice calls instead of just text?**
Calls create a commitment loop that's harder to ignore than texts. You have to engage. And voice conveys warmth/emotion that text can't.

**Why charity donations instead of rewards?**
Rewards for yourself can feel transactional. Charity creates prosocial motivation — you're not just helping yourself, you're helping others. It also creates identity reinforcement ("I'm someone who follows through for others").

**Why not build a mobile app?**
We might eventually. But voice-first is the differentiator. The app would be supplementary — for viewing stats, not for core accountability.

**What about people who hate phone calls?**
They can choose async mode (WhatsApp voice notes). The AI-calling-you model reduces phone anxiety vs. human calls, but we offer alternatives.

**Is this therapy?**
No. We're very clear about boundaries. Ivy is accountability, not mental health support. If someone is in crisis, we provide resources and encourage professional help.

---

# Let's Build

You have everything you need to get started. Read the relevant specs for your role, and let's build something that actually helps people follow through.

Welcome to Ivy.

---
