# Beta Handover Readiness — verified 2 July 2026

The product was verified end-to-end against **live production** (Fly `ivykeeps-api` v65+,
Vercel `www.ivykeeps.life`, prod Neon DB, Stripe in **test mode**). Everything below was
exercised for real — no mocks — by driving the deployed app with a browser and checking
the resulting rows in the prod DB and objects in Stripe.

## ✅ Proven working end-to-end (live prod)

1. **Signup → magic link → onboarding → stake setup → checkout.** A fresh user walked
   the whole funnel: real magic-link verify, consumer onboarding (phone fast-path),
   express stake activation (£14/wk), Stripe hosted checkout with the 4242 test card,
   back to `/checkout/success` → `/home`.
2. **Day-Zero automation fires on its own.** After checkout the user became PRO with a
   saved subscription; circle auto-assignment placed them in a peer circle; Ivy's
   onboarding-handoff message (call now / pick a time / just text) appeared in chat.
3. **The commitment device is real.** The Foundation Run opened automatically:
   £7 hold, 3-day window (Thu signup → Fri–Sun), `requires_capture` PaymentIntent
   visible in Stripe.
4. **Settlement math is right.** With two missed days: one absorbed by grace, one
   forfeited — Stripe shows £2.33 captured and £4.67 released; a `STAKE_FORFEIT`
   donation row targets Against Malaria Foundation; the beta guard correctly skipped
   the real Every.org payout (test mode).
5. **Ivy chat is alive.** Real message → real Anthropic reply round-trip on prod.
   The "Call me now" chat action creates and schedules the call correctly (the dial
   itself is blocked by Twilio — see blockers).
6. **Every consumer surface renders authed** (home, ivy, circles, impact, daily,
   settings) with the bottom nav, plus PWA manifest / service worker / offline page.
7. **Playwright e2e suite: 8/8 green** on live prod, mobile + desktop
   (`cd frontend && npm run test:e2e` — each worker now provisions its own
   disposable user; sweep leftovers with `bash e2e/teardown.sh --all`).
8. **Retell is funded and wired**: agent prompt bound to `{{system_prompt}}`, webhook
   pointed at Fly, BYOC numbers configured, create-call probe returns 201 (the old
   402 credit blocker is gone).

## 🔴 BLOCKER — founder must fix before handing to beta users

**UPDATE 6 Jul 2026:** a NEW Twilio account ("Ivy API", upgraded, $20 balance) replaced the
old one; its credentials are live on Fly and authenticate. The ONLY remaining step is
**KYC verification in Trust Hub** (Console → Trust Hub → create/submit the customer
profile — identity + address; founder-only). Twilio blocks ALL number purchases until
approved. Once approved, Claude buys the number + wires webhooks + geo-permissions +
sets `TWILIO_PHONE_NUMBER` automatically. A **UK (+44) number additionally needs the UK
regulatory bundle** (address proof) — do that before coach handover so calls come from
+44, not +1. Original context below:

**Twilio credentials were invalid (HTTP 401 / error 20003).** Until fixed:
- **No outbound calls connect** (welcome, morning, evening, rescue, callbacks).
- **SMS phone-verification fails**, which blocks onboarding for every real client
  (only the e2e fast-path skips it).

Fix: log into the Twilio console → confirm the account is active → copy the current
Account SID + Auth Token → then:

```bash
fly secrets set TWILIO_AUTH_TOKEN=<token> -a ivykeeps-api   # and SID if it changed
```

Verify from the Fly box (should print `HTTP 200`):

```bash
fly ssh console -a ivykeeps-api -C "node -e \"const s=process.env.TWILIO_ACCOUNT_SID,t=process.env.TWILIO_AUTH_TOKEN;fetch('https://api.twilio.com/2010-04-01/Accounts/'+s+'.json',{headers:{Authorization:'Basic '+Buffer.from(s+':'+t).toString('base64')}}).then(r=>console.log('HTTP',r.status))\""
```

Then do one live proof with your own account: onboard, tap **Call me now** in the Ivy
chat, take the call, and confirm a transcript lands on the call row afterwards.

## 🛠 Fixed during this pass (all deployed)

- **Stripe webhooks never verified on prod** — `constructEvent` received the parsed
  body instead of raw bytes, so *every* Stripe event 400'd: tier upgrades and
  Foundation holds never fired after checkout. This had been broken invisibly the
  whole time; it is the reason no post-checkout automation had ever been observed.
- **Auth rate limiter locked out the whole user base** — no `trust proxy` meant all
  users shared the Fly proxy IP with a 5-per-15-min budget (a coach onboarding
  clients on venue WiFi would have died on signup #2–3). Now per-client-IP, 30/15min.
- **Circle member counter drift** ("14/8 members") — recomputed from live counts.
- **Baton-stake slice math** used `/7` instead of `/daysInCycle` (wrong during every
  new user's Foundation Run).
- Spec-games needing the unwired LLM referee refuse at creation instead of stalling.
- Coach ponder programme-update extraction: no longer silently swallows failures;
  tolerates model code fences.
- 12 stale `prisma as any` casts removed; e2e harness token reuse fixed.

## ⚠️ Known limitations (fine for beta, don't be surprised)

- **Stripe is in test mode** — clients use card `4242 4242 4242 4242`. Conversion to
  live keys is a secrets flip (see docs/beta-launch-runbook.md).
- **Live voice call end-to-end** (audio + transcript) unproven since the Twilio break;
  everything up to the dial is proven. One founder test call closes this.
- Collective-charity-goal donations are deliberately dormant (Phase 6); no UI promises
  them.
- Coach marketplace is browse-only by design (no pricing/ratings shown).
- Checkout-success copy says "set your weekly stake" even though it's already set —
  cosmetic, batched with the UI day.
- Credential rotation (Neon password, Fly token) still outstanding — founder-only.

## 📊 What to watch during the beta (the data that answers "does anyone retain?")

All in prod Neon (`purple-dew-86405613`), or via Fly logs:

- `stake_cycles` — cycles opened vs settled; `daysCompleted` / `daysForfeited` /
  `graceUsed` per user per week. **This is the core loop working or not.**
- `workouts.armedAt` — morning arming rate (the habit signal).
- `calls` — statuses; any `outcome LIKE 'error:%'` is a pipeline failure to chase.
- `messages` (channel `IN_APP`) — chat engagement; users who go quiet in week 2.
- `donations` — forfeit volume (guilt-vs-motivation signal).
- Week-4 question for every user: did they open a cycle in week 4? Would they be
  upset if Ivy disappeared?
