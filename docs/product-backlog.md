# Product Backlog — parked decisions & ideas

Decisions made, deliberately parked, with the reasoning attached — so nothing good
gets forgotten and nothing parked gets rebuilt from scratch or re-litigated cold.
Last updated: 3 July 2026.

Rule of thumb for unparking anything here: **the consumer beta must first prove
retention** (users still opening cycles in week 4). Almost everything below gets
better — or gets designed better — with that data in hand.

---

## LOCKED DESIGNS (decided; build when their trigger fires)

### 1. Phase 6 — corporate donation per kept-day  ★ the B2B money layer
**Decision (3 Jul 2026): companies donate £X per employee kept-day. NOT stake top-ups.**
- Why not top-ups: company cash in a refundable personal hold = benefit-in-kind tax
  mess, "whose money forfeited?" accounting, and it dilutes loss aversion (the teeth
  work because it's *your* money).
- Why per-kept-day donations: employee's stake stays 100% theirs; company money only
  moves forward to charity (clean CSR spend, no refunds); completes the success side
  of the emotional loop ("you kept your money AND your company funded nets because
  you showed up").
- The pitch it unlocks: **"Your wellness budget only spends when employees actually
  follow through."** Spend metered by verified behaviour.
- Plumbing already anticipates it: `successCharityId`, `Donation.source` flags,
  `setCollectiveCharityGoal` (dormant, unrouted), prompt guardrails that say
  "Phase 6 not funded — don't claim it."
- **Trigger to build: first real company conversation.**

### 2. Coach marketplace with track matching
Today: browse-only, alphabetical, no `specialties` column, no connect endpoint —
deliberately thin. The invite link is the real acquisition channel (coach = distribution).
- When built: add `specialties`/tracks to CoachProfile, match on user track + style +
  price, add a connect/booking action (the chat coach-escalation nudge then gets a
  real landing).
- **Trigger: more than a handful of coaches AND consumers arriving without one.**

### 3. Retell WebRTC in-app calls (complement, never replacement)
Scheduled evening calls stay real phone rings — Ivy interrupting your evening IS the
ritual; in-app requires the user to show up, which inverts the accountability.
But user-initiated moments ("Call me now" from chat, rescue) suit WebRTC: instant,
no telephony cost, and immune to Twilio outages. Decided 3 Jul when evaluating
"do we need Twilio at all" — answer: yes, keep BYOC Twilio (UK caller-ID trust,
SMS OTP, nudge SMS are all Twilio); WebRTC is an addition.
- **Trigger: post-beta, or the next Twilio outage — whichever first.**

---

## THE ALIVE/VIRAL QUEUE (founder-endorsed direction, sequenced after beta data)

4. **Season garden** — each settled week becomes a permanent plant; your history is a
   growing garden (the collection loop; Forest proved the mechanic, ours has real
   money + charity in it).
5. **Shareable season vine card** — season close mints a generative image: your vine,
   leaves = days kept, "£61 kept · £9 to malaria nets". The viral object; people
   share organisms, not dashboards.
6. **Proactive pattern texts** — 1-2/week, pattern-triggered, never scheduled spam:
   "It's Tuesday — you've missed the last three Tuesdays. What's different today?"
   The memory pipeline already has the data; needs a trigger job + taste.
7. **Witness feature** — user nominates one friend (not a user) who receives the
   weekly vine report by SMS. Deeper accountability + organic distribution to
   non-users. NOTE: the AccountabilityBuddy model (name/email/WhatsApp) already
   exists and Ivy now pitches it on the first call — this item is about making
   the buddy actually RECEIVE things (weekly vine report, slack alerts).

### Hooky nuggets (founder brainstorm, 7 Jul — triaged honestly)
8. **"Embers" — disappearing notes from Ivy** ⭐ the gold one. When Ivy's pattern
   engine notices something real ("you've kept every Tuesday for a month"), she
   sends a view-once note — their name, one line, gone when closed. Rarity +
   ephemerality + being-seen = the strongest hook in the pile, and it's cheap:
   a messageType with view-once UI + a pattern trigger. Build with proactive
   pattern texts (#6) — same trigger engine.
9. **Before/after photos** — proven mechanic in fitness, works for Season Close
   reveals ("day 1 you vs day 84 you"). Consent-sensitive, storage + UI work.
   Build when Season Close ships its share card (#5) — they compound.
10. **"Dream-self" one-time image** — AI-generated future-self visual at
    onboarding, view-once. RISKY: photoreal future-self is uncanny/cheesy and
    can land as body-shaming. The on-brand version: generate their FUTURE VINE
    (a lush season-84 garden with their name, "this is 84 kept days") — same
    aspiration, zero cringe, pure vine language. Park until garden (#4) exists.
11. **Save-my-number vCard** — after the first call, text a contact card so
    "Ivy 🌿" shows on incoming calls instead of a bare number. Tiny build
    (MMS/vCard link), big pickup-rate effect. Do with the next Twilio touch.

### 12a. Client→coach connect requests (the marketplace dead-end)
Ivy's coach-escalation nudge points struggling users at the Coaches section,
but the marketplace is browse-only — the detail page honestly says "ask the
coach for an invite link." Design when built: "Request to join" on a coach
profile → notifies the coach (digest/Telegram) → coach accepts in console →
coachId set (reuse the pendingCoachId acceptance machinery, reversed
initiator). NOT coach-browses-users — that's a privacy landmine; a possible
later variant is an opt-in "open to coaching" pool.
- **Trigger: marketplace matters (>handful of coaches + organic consumers).**

### 12b. Coach client management (leave / remove / transfer)
Today: a user with a coach who clicks another coach's invite gets a hard
"You already have a coach on Ivy" — no leave, no transfer, no coach-side
remove. Fine at beta scale (ask the founder); needs real flows before
multi-coach scale: client "leave coach", coach "remove client", both ends
notified, prompts stop referencing the old coach immediately.
- **Trigger: first real coach-switch request.**

### 12. Coach self-serve entry — ✅ SHIPPED 7 Jul (for-coaches page → signup?as=coach → /coach/join £79 → settings → welcome call)
Marketing "Get started" is consumer-only; coaches today are onboarded by hand
(runbook: coach signs up normally via magic link → founder flips
`subscriptionTier='COACH'` in SQL → coach lands on /coach/settings → completing
setup triggers the partner welcome call automatically). Self-serve = "For
coaches" marketing page + COACH-variant signup + £79 coach checkout
(STRIPE_PRICE_COACH_GBP already exists in Stripe).
- **Trigger: the second coach you can't hand-hold personally.**

---

## SMALL REFINEMENTS (batch into any nearby work)

8. **Late-night retry rule** — missed-call retry is a flat +15min; after ~21:30 it
   should roll to next-morning text instead. Check beta data first: may not matter.
9. **Checkout-success stale copy** — says "set your weekly stake" but it's already
   set by then.
10. **Circle avatar colours** — still yellow/purple, off the vine language.
11. **Stake-setup + onboarding polish, coach dashboard restyle** — last surfaces in
    the design-constitution migration queue.
12. **/donations null-hardening** — page throws on `null.length` if an API ever
    returns null (real API returns arrays; only bites with mocks so far).
13. **Pause-protocol automation** — Ivy currently captures injury/illness dates on
    record for MANUAL founder review + manual cycle void (stake-smoke script).
    If beta shows it's frequent: add a real pause mechanic.

---

## EXPLICITLY NOT DOING (so it stays decided)

- **Native app rebuild** — the "modern feel" problem was design language, not
  platform; solved by the Living Vine system. If store presence/haptics ever matter:
  Capacitor-wrap the existing app (~days), don't rebuild (~months).
- **Company stake top-ups** — see #1.
- **B2B sales motion before consumer retention is proven** — the B2B skeleton
  (Company model, companyId scoping, wellness themes in prompts, legacy wizard)
  stays parked; don't restyle the B2B wizard until a company is actually signing.
- **Retell-managed phone numbers** — US-only; a +1 caller ID would tank UK pickup
  rates, and Retell does no SMS. BYOC Twilio stays.
