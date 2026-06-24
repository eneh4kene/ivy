# Foundation Run + Day-Zero Onboarding — Implementation Plan

> Status: **BUILT 24 Jun 2026** (backend + frontend typecheck/build clean; migration applied to prod; not yet deployed). Author: design pass 24 Jun 2026.
> Solves two coupled problems for a brand-new paid user:
> 1. **The Monday wait** — today a new user pays, onboards, and then sits idle until the next Monday cron opens their first stake cycle. Dead air on the highest-intent day of their life with the product.
> 2. **The odd-hour first day** — a user who signs up at 6/8/10pm should not be handed the morning "what are you doing today" voice note + an evening review. Day Zero needs its own shape.
>
> **What changed between spec and build (read this first):**
> - **No 9-day "absorb-next-cycle" run.** Stripe auth-holds expire at ~7 days, so no cycle may exceed 7 days. The rule became: *a user's first cycle is always the Foundation Run, ≤7 days, flat £7/$10.* A weekend signup with <2 forfeitable days does **not** get an extended £7 run — it **defers to the Monday opener**, which opens its first cycle as a flat-£7 full Mon–Sun week. (Supersedes §1.2's original absorb wording.)
> - **`daysInCycle` was added alongside `isFoundation`** so slice math is cycle-aware (`stakeAmount / daysInCycle`), not hard-coded to 7.
> - **Day Zero ships as a single scheduled, tz-aware evening `ONBOARDING` call**, not the richer async-VN-with-"talk now/pick a time"-buttons UI sketched in §2.3. That async-door UI is deferred (see §2.3 note).

---

## Part 0 — The two facts this plan is built on

- **The stake engine is already rolling.** `stake.service.openStakeCycle(userId)` sets `periodStart = now` and `periodEnd = now + cycleDays*24h`, places a Stripe manual-capture hold for `stakeWeeklyAmount`, and writes a cycle row at status `AUTHORIZED`. Settlement (`arming.service.settleExpiredStakeCycles`) keys off `periodEnd <= now` — it does **not** care what day of week it is. So "Monday" is *only* the `stakecycle-open` cron (`5 0 * * 1`). Nothing technical forces the wait.
- **The capture gap is real.** `openStakeCycle` is currently called only by the cron opener, the worker, the Inngest function, and the smoke script — **never** by a live setup-completion flow. So finishing stake-setup today places no hold and opens no cycle. This plan is also the fix for [[project-stake-capture-gap]].

Net: the Foundation Run is a *modest* change — open a cycle at setup completion with a flat amount and a short end date, run the settle sweep daily, and keep the Monday cron as the steady-state renewer.

---

## Part 1 — The Foundation Run (flat starter stake)

### 1.1 Concept

When a user completes stake-setup, immediately open a **Foundation Run**: a real, live, money-on-the-line stake cycle that starts *now* and ends at the upcoming Sunday 23:59 in the user's timezone. It uses a **flat starter stake** (not the user's full chosen weekly amount, not prorated by day) so the first commitment is low-friction and low-stakes-anxiety. From the following Monday onward, the normal full-amount rolling weekly cycle takes over via the existing cron.

Why flat (not prorated):
- A new user has not yet experienced a single "I kept it" win. Charging the full weekly amount on a partial first week is both scary and unfair.
- A flat, small, fixed number (proposal: **£7**) is easy to say in copy ("Your first run is just £7 on the line — a real stake, training wheels on") and removes the "why is my first charge a weird £4.71" confusion of proration.
- It makes Day Zero about *proving the loop works*, not about the money.

### 1.2 No teeth on signup day, the window, and the weekend-defer rule

**Signup day has no teeth.** Day Zero is onboarding — completing setup *is* the day's win. The flat hold is *placed* at first payment (validates the card, earmarks the money), but the first **forfeitable** day is **Day 1 (tomorrow, user TZ)**, never the signup day. So `periodStart` for slice-accounting = start of the next calendar day in the user's TZ. This is the "it shouldn't stake the same day, might be too early" fix.

**Hard constraint: no cycle may exceed ~7 days.** Stripe manual-capture auth-holds expire at roughly 7 days, and `reauthoriseStakeCycle` uses `confirm:false` (not a true off-session re-hold), so it's an unreliable fallback. Therefore the design rule is: **a user's first cycle is *always* the Foundation Run** — flat amount, `isFoundation:true`, ≤7 days — and full price kicks in from the *second* cycle.

`computeFoundationWindow(tz, now)` is the source of truth (`stake.service.ts`). Let `day1` = start of tomorrow, user TZ. Let `nextResetBoundary` = the coming Sunday 23:59:59 user-TZ (just before the Monday opener runs). Let `forfeitableDays` = whole days from `day1` to `nextResetBoundary`.

- **Normal case** — `forfeitableDays >= STAKE_CONFIG.minFoundationDays` (`= 2`):
  `computeFoundationWindow` returns `{ periodStart: day1, periodEnd: nextResetBoundary, daysInCycle: forfeitableDays }`. `openFoundationCycle` places the flat hold and writes the cycle. Daily slice = `flat / forfeitableDays`. The Monday opener then starts the first **full-price** week.
- **Weekend-defer case** — `forfeitableDays < minFoundationDays` (signed up Sat night / Sunday):
  `computeFoundationWindow` returns **null**. `handlePaymentSucceeded` logs "deferred to Monday opener" and opens **no cycle now** — so the user has no teeth over the remainder of the weekend. On Monday 00:05 the opener sees `priorCycles === 0` and calls `openFoundationCycle(user.id)` with **no window**, which defaults to a flat-£7 **full Mon–Sun week** (`daysInCycle = 7`). Full price starts the Monday *after* that. (This replaces the original "extend the £7 to absorb the next cycle" idea, which would have produced a >7-day hold.)

Both cases: flat amount regardless of length. Length only changes `periodEnd` and `daysInCycle` (and thus the per-day slice). Example A (signs up Wed): teeth Thu–Sun, flat £7, then Mon = first full week. Example B (signs up Sat): no run this weekend → Monday opens the flat-£7 full Mon–Sun week, then full price the following Monday.

### 1.3 Where it's wired (as built)

`stake.service.ts` was refactored so `openStakeCycle` and `openFoundationCycle` share one private core, `placeHoldAndCreateCycle(userId, params)`, which carries every guard (overlapping-cycle, customer create/retrieve, `resolveDefaultPaymentMethod`, manual-capture PI with `metadata.purpose`, `recordFailedHoldAndNotify` on failure) and persists `isFoundation` + `daysInCycle`.

- `openStakeCycle` → full `stakeWeeklyAmount`, `daysInCycle: STAKE_CONFIG.cycleDays`, `isFoundation:false`.
- `openFoundationCycle(userId, window?)` → flat `STAKE_CONFIG.foundationFlatAmount[currency]`, `isFoundation:true`; `window` defaults to a full 7-day run from now when omitted (the Monday-defer path).
- Slice math is cycle-aware everywhere: `linkWorkoutToCycle`, `settle`, and `getStakeState` all divide by `cycle.daysInCycle`, not a global 7, so slices sum to the held amount even on short runs.
- Schema: `StakeCycle` gained `isFoundation Boolean @default(false)` **and** `daysInCycle Int @default(7)`. Migration `20260624000000_foundation_run` — **applied to prod 24 Jun 2026 via `prisma migrate deploy`** (checksum recorded, so the deploy-time Fly-SSH run will skip it). Remember the Fly `[processes]` gotcha generally: migrations never auto-apply on deploy.

**Call site (as built):** `payment.service.handlePaymentSucceeded`, inside the `isFirstRealPayment` branch, after donation dispatch. Gated on `user.isOnboarded && user.stakeWeeklyAmount != null && tier not FREE/COACH`. It dynamically imports `openFoundationCycle` + `computeFoundationWindow`, computes the window from `user.timezone`; if the window is null it logs the Monday-defer and returns; otherwise it opens the run. Fire-and-forget with try/catch so a failed hold surfaces a nudge (via `recordFailedHoldAndNotify`) rather than a silent gap. This is also the fix for [[project-stake-capture-gap]] — the hold is now placed at first payment.

### 1.4 Settlement + the Monday renewer

- **Switch `stakecycle-settle` from weekly to daily.** Today it's `55 23 * * 0` (Sunday only). A Foundation Run can end on *any* weekday, so settlement must sweep daily. Change to `55 23 * * *` (every night 23:55). This is safe because `settleExpiredStakeCycles` already filters on `periodEnd <= now` — running it nightly just settles whatever has actually expired, weekly cycles included. (Update both `src/inngest/functions.ts` and the node-cron schedule so it's correct under either scheduler.)
- **`stakecycle-open` (`5 0 * * 1`) is the steady-state renewer *and* the weekend-defer opener.** As built (`arming.service.openStakeCyclesForActiveUsers`), it counts each user's prior non-FAILED cycles: `priorCycles === 0 → openFoundationCycle(user.id)` (flat full Mon–Sun week), else `openStakeCycle(user.id)` (full price). The overlapping-cycle guard still refuses to open if an `AUTHORIZED` cycle exists, so:
  - Normal-case Foundation Run (ends Sunday 23:59) → the Sunday nightly sweep at 23:55 settles it, then Monday 00:05 the opener sees `priorCycles >= 1` and starts the first full-price week. Clean handoff.
  - Weekend-defer (no run opened over the weekend) → Monday 00:05 the opener sees `priorCycles === 0` and opens the flat-£7 full Mon–Sun Foundation Run. It settles the following Sunday; the *next* Monday renews at full price. No double-charge, no >7-day hold.

### 1.5 Config

Added to `src/config/pricing.ts` (`STAKE_CONFIG`), as built:
```
foundationFlatAmount: { GBP: 7, USD: 10 } as Record<Currency, number>,  // flat first-run stake, by currency
minFoundationDays: 2,   // < this many forfeitable days to Sunday → defer to the Monday opener
```

### 1.6 Frontend: first-run framing (as built)

The whole setup surface now speaks "flat first run, then weekly", driven by `StakeStatus.isFoundation` + `StakeState.cycle.{isFoundation,daysInCycle}` threaded through the view-models:
- **ConfirmStep / ExpressConfirmStep** — hero + "how it works" copy explains the flat £7 starter with no teeth on day one, then the step-up to the weekly stake; CTAs read "Arm/Activate my stake — £7 first run".
- **DoneScreen** — ends on "**Your first run is live.**" ("A flat £7 starter goes on the line as soon as payment clears … from next week it steps up to £X"), with the existing CTAs into `/daily` and `/circles`.
- **DailyLoop NoStakeState** — "Setting up your first run … goes live right after payment clears" (was "Your cycle starts Monday").
- **StakeBar / HomeScreen cycle bar** — "£X first run" label and `daysCompleted / daysInCycle` (handles short runs), not a hard-coded `/7`.

Note: the spec's idea of routing the CTA *into the Day-Zero call experience* was not built — the Day-Zero call is scheduled server-side (Part 2), so the DoneScreen CTAs keep going to `/daily` / `/circles`.

---

## Part 2 — Day-Zero onboarding call (the odd-hour problem)

### 2.1 The problem, stated precisely

The normal daily loop is: **async morning VN** ("what are you taking on today") arms the day → **evening review** call reflects on it. That loop assumes the user woke up inside the product. A user who finishes onboarding at 8pm has no morning to arm and nothing to review. Firing the standard loop at them is nonsense ("what are you doing today?" — it's 8pm).

You are **not** overthinking this. Day Zero is the single highest-intent, highest-churn-risk moment. It deserves its own call.

### 2.2 The design — one Day-Zero call, not the daily loop

On Day Zero we **suppress** `scheduleDailyCalls` and instead schedule exactly one **`ONBOARDING`** call. The machinery already exists:
- `CallType` includes `'ONBOARDING'` (call.service.ts:13).
- `prompt.service.resolveFlowKey` maps `ONBOARDING → 'onboarding'` (line 533).
- The `onboarding` FLOW (prompt.service.ts:385–408) is already a purpose-built 12–15 min first call: welcome → understand them ("real goal behind the goal", "what's got in the way", "who are you doing this for") → confirm track + minimum viable day → plan first session → explain stake + arming → set schedule → close with "you've made your first commitment."

That flow already captures goals / motivation / challenges / "why Ivy." We don't need a new prompt — we need to **schedule it at the right time** and make sure it knows it might be evening.

### 2.3 Timing rules — async-first, never assume they can talk

> **As built (24 Jun 2026):** the shipped Day-Zero is the *minimal* version of this section — **one scheduled, tz-aware `ONBOARDING` call**, never an auto-dial mid-workday. `user.service.markUserAsOnboarded` calls module-level `computeOnboardingCallAt(timezone, eveningCallTime, now)`: it prefers the evening slot **today** if it's ≥10 min ahead; else if local hour < 21 it schedules `now + 10min`; else it rolls to tomorrow's evening slot (default `19:00`). Then `callService.scheduleCall(userId, 'ONBOARDING', at)`. The evening framing is delivered via the `is_evening_first_call` context flag computed in `getUserContext` (see §2.4), and the normal loop resumes the next day. **The richer async-door UI below — immediate welcome VN + "Talk to Ivy now" / "Pick a time" buttons — was NOT built; it's the next iteration.** The rest of §2.3 is that future design.

A new user may be at work, on a train, in a meeting — we must **never auto-dial** them or block Day Zero on a live call. So the **default first contact is always an async welcome voice note**, sent immediately on setup completion, that (a) welcomes them, (b) confirms their first run is live, and (c) does the lightweight intake (goal / why / biggest obstacle) *as questions they can answer in a reply VN whenever they have a minute*. The live `ONBOARDING` call is **offered, not pushed**.

Whether the intake even needs to be a call: **no — it can be fully async.** The reply-VN exchange captures the same goal/motivation/challenge material the `onboarding` FLOW would. The live call is the richer option for users who want it, not a requirement. So Day Zero gives both doors.

Let `now` = setup completion, user TZ. Callable window = 08:00–21:00 user-TZ.

- **Inside the window** (e.g. 2pm): welcome VN goes out immediately + a one-tap **"Talk to Ivy now"** button and a **"Pick a time"** scheduler. Nothing auto-dials. If they tap "now," place the `ONBOARDING` call; if they pick a time, schedule it; if they do neither, the async VN intake stands on its own and the normal loop starts tomorrow.
- **Evening but callable** (≈17:00–21:00, e.g. 8pm): same async welcome VN, but the offered call carries an `is_evening_first_call` flag so if they take it Ivy opens with "I know it's evening and you've just joined" — the "evening call that acknowledges they're a first-timer" you described. Still offered, not forced.
- **After the window** (21:30 / 10pm): welcome VN only tonight ("I'll catch you tomorrow — your first run's already live"). Offer the `ONBOARDING` call for the next morning (their morning time, or 09:00 default) as a *suggested* slot they can confirm or move.

In all three, the async welcome VN is the floor; the call is the ceiling. Day Zero is never blocked on availability.

### 2.4 Context flags into the prompt

As built, computed **inside `getUserContext`** (not passed via `scheduleCall` — `inngest/calls.ts` overwrites scheduled `contextData` with a fresh `getUserContext`, so call-time is the only reliable source):
- `is_evening_first_call: boolean` — `completedCallCount === 0 && callLocalHour >= 17` (local hour via `toLocaleString('en-GB')`).
- `foundation_stake` — `STAKE_CONFIG.foundationFlatAmount[currency]`.
- (`is_first_call` already exists.)

Prompt (`prompt.service.ts` `onboarding` FLOW, as built): `isEvening = ctx.is_evening_first_call === true` drives an evening-aware welcome line; the stake line references the flat `foundation_stake` ("Your first run is just £{foundationStake} on the line… from next week it steps up to the weekly stake you set"); the VN line notes mornings are an async voice note and the only live call is the evening one.

### 2.5 Handoff into the normal loop (Day 1+)

- The Day-Zero `ONBOARDING` touch replaces both the morning VN and the evening review **for Day Zero only**.
- **Steady-state loop (Day 1+) is fixed and must not be changed by this work: async VN in the morning (arming) + a live call only at night (evening review).** The morning is *never* a live call by default — `morningCallOptIn` stays opt-in. Day Zero's async-first onboarding does not alter this; it sits *before* the loop, not inside it.
- Starting the **next calendar day** in the user's TZ, the normal loop resumes: `scheduleDailyCalls` runs (async morning VN arming + evening review call), driven by the existing daily-evening-calls cron (`0 0 * * *`) and the arming service.
- Guard: the daily scheduler must **skip Day Zero** for a just-onboarded user so we don't double up (onboarding call + evening review on the same night). Simplest signal: if the user has an `ONBOARDING` call scheduled/completed for `today` (the dedup `alreadyScheduled` count in `scheduleDailyCalls:123` already covers this — an ONBOARDING call counts as a call today, so it naturally suppresses the daily pair). Verify this dedup actually catches it; if ONBOARDING is excluded anywhere, add it.

---

## Part 3 — Build order / checklist (status)

1. ✅ **Schema**: `StakeCycle.isFoundation` + `daysInCycle`; migration `20260624000000_foundation_run`. **Applied to prod** via `prisma migrate deploy` (not the Fly-SSH path this time; checksum recorded so deploy-time run skips it).
2. ✅ **Config**: `foundationFlatAmount` (per-currency) + `minFoundationDays` in `STAKE_CONFIG`.
3. ✅ **stake.service**: `openFoundationCycle` + `computeFoundationWindow` + shared `placeHoldAndCreateCycle`; cycle-aware slice math throughout, reusing existing guards.
4. ✅ **Webhook**: `handlePaymentSucceeded` opens the Foundation Run for a newly-onboarded paid user (try/catch + nudge on failure). Closes the capture gap.
5. ✅ **Monday opener**: `openStakeCyclesForActiveUsers` — first-timer (`priorCycles === 0`) → `openFoundationCycle`; else `openStakeCycle`.
6. ✅ **call.service / user.service**: Day-Zero schedules one tz-aware evening `ONBOARDING` call (`computeOnboardingCallAt`); `is_evening_first_call` + `foundation_stake` computed in `getUserContext`. (Async-door UI deferred — §2.3.)
7. ✅ **prompt.service**: evening-first-call line + foundation-amount reference in the `onboarding` FLOW.
8. ✅ **cron/inngest**: `stakecycle-settle` `55 23 * * 0` → `55 23 * * *` in both `src/worker.ts` (node-cron) and `src/inngest/functions.ts`.
9. ✅ **frontend**: ConfirmStep / ExpressConfirmStep / DoneScreen / DailyLoop NoStakeState / StakeBar / HomeScreen all carry first-run framing; types threaded through. tsc + `next build` clean.
10. ⏳ **Deploy + verify**: NOT deployed. After deploy, smoke a daytime signup (foundation run opens, hold placed, evening ONBOARDING call scheduled) and a weekend signup (no run until the Monday opener), then confirm the Monday opener renews to full amount without double-charge.

## Resolved (this review)
- **No teeth on signup day** — hold placed at first payment, forfeitable slices start Day 1 (tomorrow). (§1.2)
- **No >7-day hold** — weekend signups with <2 forfeitable days **defer to the Monday opener** (flat-£7 full Mon–Sun week) rather than extending the £7 across two cycles. Supersedes the original absorb-next-cycle idea. (§1.2)
- **Day-Zero call** — single tz-aware evening `ONBOARDING` call, never auto-dialled mid-workday; normal morning-VN/night-call loop resumes Day 1. (§2.3, minimal version)

## Open questions for review
- Flat amount: **£7 / $10** confirmed, or different numbers?
- "Evening" threshold 17:00 and the `computeOnboardingCallAt` slot logic — acceptable defaults?
- `minFoundationDays = 2` (the weekend-defer trigger) — right threshold?
- Ship the async-door Day-Zero UI (welcome VN + "talk now / pick a time") as the next iteration? (§2.3)
