# Beta launch runbook — production app, Stripe in TEST mode

**Goal:** Give a coach + his clients the *real* production app. Everything is live
(onboarding, calls, voice notes, arming, forfeits, coach↔client link) EXCEPT Stripe,
which runs in **test mode** so the 4242 card simulates the full money loop with no real
charges. After ~4 weeks, review → for converts, flip Stripe to live + real cards.

Frontend has **no client-side Stripe** (checkout is a server redirect), so Stripe env
changes are **backend (Fly) only**. Vercel needs nothing Stripe-related.

---

## Pre-launch checklist (do tonight)

### 1. Deploy the new stake code (REQUIRED — prod is running the pre-fix code)
Commit `2bb8dfe` wires the off-session hold + workout↔cycle linking + default-on
optionality. Without it the commitment device does nothing.
- **Frontend:** `git push origin master` → Vercel auto-builds (project: interviewsai/ivy, root `frontend`).
- **Backend:** from repo root: `fly deploy -a ivykeeps-api`

### 2. Point Fly at TEST Stripe (after deploy, or together)
Test-mode price IDs already created in the sandbox:
```
fly secrets set -a ivykeeps-api \
  STRIPE_SECRET_KEY=sk_test_XXXX \
  STRIPE_WEBHOOK_SECRET=whsec_XXXX \
  STRIPE_PRICE_IVY_GBP=price_1TlFxGFupLFcPbOvy8cmFQ3P \
  STRIPE_PRICE_IVY_USD=price_1TlFxGFupLFcPbOvoBRc8xIa \
  STRIPE_PRICE_COACH_GBP=price_1TlFxHFupLFcPbOvoD6tHGyb
```
(Setting secrets restarts the app.)

### 3. Create the TEST webhook endpoint (Stripe dashboard, test mode)
Developers → Webhooks → Add endpoint:
- URL: `https://<prod-api-host>/webhooks/stripe`  (Fly app `ivykeeps-api`)
- Events: `customer.subscription.*`, `invoice.payment_succeeded`,
  `invoice.payment_failed`, `payment_intent.succeeded`, `payment_intent.canceled`,
  `payment_intent.payment_failed`, `payment_intent.requires_action`
- Copy the **signing secret** (`whsec_…`) into `STRIPE_WEBHOOK_SECRET` above.
Without this, subscriptions won't upgrade clients to PRO (and the stake gate won't fire).

### 4. House-default charity — ALREADY DONE in prod (verified 22 Jun)
Express setup defaults everyone to MIDDLE, which routes forfeits to a
`Charity.isHouseDefault = true` active charity. Prod has 13 active charities and
**Against Malaria Foundation** is already flagged house-default, so MIDDLE settle works.
(NB: the repo `prisma/seed.ts` does NOT set this flag — it was set directly in prod.
Don't re-run seed expecting it.)

### 5. Scheduler — Inngest Cloud (verified INNGEST_ENABLED=true in prod)
Inngest Cloud owns the schedule (the functions in src/inngest/functions.ts), not
node-cron. Same cron expressions: stake **open** Monday, settle Sunday.
- Next *auto* open is **Mon 29 Jun** — week-1 holds won't auto-place. To start holds on
  day 1, manually open per enrolled user (scheduler-independent — calls the service directly):
  ```
  STRIPE_SECRET_KEY=sk_test_XXXX DATABASE_URL=<prod> \
    npx ts-node src/scripts/stake-smoke.ts open <userId>
  ```
  (script refuses any non-`sk_test_` key, so it's safe in this setup)

---

## Beta user flow (what they actually do)
1. Onboard on the real app → subscribe with test card **4242 4242 4242 4242** (any
   future expiry / any CVC) → webhook upgrades them to PRO + saves the card.
2. Default-on gate sends them into **/stake-setup** → one-tap activate (£14/wk default,
   MIDDLE) or £7 minimum.
3. Each week the backend places a real **test-mode** off-session hold; daily arming via
   voice note keeps each day's slice safe; misses are captured to the house charity at
   Sunday settle. No real money moves.
4. Coach signs up on the COACH plan (test card), links to clients — coach does NOT stake.

## SCA note
If a beta user's saved card needs 3DS off-session, the hold can't complete unattended →
that week's cycle is marked FAILED and they get an in-app re-auth nudge. The 4242 card
never triggers this, so hand out 4242 specifically.

## Conversion (end of beta)
Swap Fly Stripe secrets back to **live** (`sk_live_…`, live `whsec_…`, live price IDs
`price_1Tj6tA…` etc.), create a live webhook endpoint, and have converts re-enter a real
card. No code change.
