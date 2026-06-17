# Ivy — Product & Pricing Rework (v2.0)

**Status:** Spec for implementation · Supersedes the marked sections of `docs/pricing-strategy.md` (v1.1)
**Date:** June 2026
**Audience:** The implementing agent (and human reviewers)

---

## 0. How to use this document

This doc has two parts:

- **Part A — Spec (the *what* and *why*).** Read this first and in full. It is the source of truth for product intent. Do not "improve" the mechanics; they are the result of deliberate design decisions documented here.
- **Part B — Build plan (the *how*, in what order, touching which files).** Execute it phase by phase. **Stop at the review checkpoint at the end of each phase** rather than running the whole thing end to end.

**Three rules for the implementing agent:**

1. **When a detail is genuinely ambiguous, flag it in the "Open decisions" section and stop — do not invent product behaviour.** Small architectural calls (naming, file layout) are yours to make; product-mechanic calls are not.
2. **The principle hierarchy in §7 overrides convenience.** If an implementation shortcut would violate a guardrail (e.g. routing stake money through Ivy's P&L), don't take it — surface it.
3. **All money figures in this doc are illustrative placeholders pending the founder's confirmed COGS.** Wire them through a single config module (`src/config/pricing.ts`), never hard-code them inline.

---

# PART A — SPEC

## 1. What is changing, and why

Ivy v1.1 is built on a **positive-reinforcement Impact Wallet**: a fixed slice of every subscription (£30/£45/£60) is pre-allocated as charity budget, and money is donated **only when the user follows through**. Missing a day fires nothing.

This rework changes two things at the core:

### 1a. The charity mechanic becomes a loss-framed commitment device (a "stake"), not a reward

**Problem with v1.1:** the wallet is funded from money the user has already paid and mentally written off. Following through donates it; failing donates nothing. There is **no felt cost to failing** — and behavioural-economics evidence (StickK, Beeminder, Kahneman loss aversion) is clear that the *prospect of losing something you hold* motivates far more than the prospect of a reward you never possessed. v1.1's mechanic is warm but motivationally weak, and it relies on the user caring about a donation that costs them nothing extra to forfeit.

**The rework:** the user puts **their own money at stake** each cycle, separate from the subscription. The money is *earmarked up front* (so it feels possessed and at-risk). Following through **returns it**; failing **forfeits it** to a destination they don't want (see §3). The departure of the money is *contingent on failing* — that is what creates teeth.

### 1b. The subscription is decoupled from the charity money — which unlocks margin and a lower price

Because the stake is now the user's *own* separate money, **the subscription no longer has to carry the wallet allocation.** In v1.1, ~£30 of the £70 PRO price was pass-through charity money, leaving only ~£40 to cover COGS + margin — which is why margins felt thin. Stripping the wallet out of the subscription hands back roughly the old wallet amount per tier, to be used as **lower price, more margin, or a split** (see §5).

### 1c. The morning live call becomes an async voice note ("VN")

**Problem:** two live voice calls/day is the dominant COGS line. It is also the main reason the price has to be high.

**The rework:** replace the **morning live planning call** with a **compulsory morning voice note** the user records in-app ("what I'm taking on today"), said *out loud*. The **evening review stays a live call by default** (channel is a user preference — see §1d). This:

- **Roughly halves live-call COGS** — a recorded VN is async, transcribed cheaply (Whisper/Haiku), with no telephony minutes or real-time model.
- **Strengthens the commitment mechanic** — verbal/spoken commitment is a known amplifier, and the VN becomes context the evening call plays back ("This morning you said you'd ship the deck — did you?").
- **Budgets friction correctly** — low-friction async note in the rushed morning; the real call in the reflective evening.

### 1d. Channel is a user preference, not a price axis

**Ivy is voice-first, but the delivery channel is the user's choice — and the channel never changes the price.** There is one plan (§5b); voice and text cost the same. Some users won't want phone calls at all; serve them on the same plan rather than building a separate cheaper tier. A call-averse user flips a preference and gets the **same system** — same stake, same daily loop, same chase, same charity mechanic — delivered by **text** (the existing `CommStyle` enum: `CALLS | TEXTS | ADAPTIVE` already models this). The evening review becomes a text chat; Ivy's nudges are texts.

- **Voice is the default and the marketed experience** (it's the moat — presence a notification can't match), but **you charge for the accountability system, not the channel.** A text user pays the same as a voice user *on the same tier*.
- **The morning VN is the one exception — it stays a spoken voice note for *everyone*, including text-preference users.** Saying the commitment *out loud* is the commitment mechanic itself, not a delivery channel. Text users type nothing to arm; they still record and speak the VN. No-VN = unarmed = miss, same as everyone.
- **No cheap text-only tier, no voice add-on, no lower voice price.** Lowering the price for text would signal voice is lesser; an add-on would betray the core. Channel-as-preference sidesteps both. (Bonus: text users are *cheaper to serve* (~£3-5 vs ~£12-15/mo) at the same price → higher margin, and since channel choice doesn't change price, nobody downgrades channel to save money.)

### 1e. Channel & client roadmap

**Decision: Ivy's own app is the single front door — built as a PWA (extending the existing Next.js frontend), now.** Not Telegram, not WhatsApp, not (yet) native. Voice **calls stay external** on **Retell + Twilio** (phone) — the app never handles telephony.

**Why own-app-now, not Telegram:**
- **You're building the web app anyway.** Circles' rich UI (baton games, leaderboards, the social feed), the **coach marketplace**, and **coach-client interfaces** *cannot* live in a chat app — they require your own UI regardless. Once that's true, renting Telegram for *only* the daily loop buys little and costs **fragmentation** (Telegram + web + phone = three surfaces). Consolidate the daily loop into the app you're already building.
- **It's tractable, not a moonshot** — precisely *because calls stay external* (the one genuinely hard part, real-time voice, is offloaded). The app needs: **browser audio recording** for the VN (MediaRecorder → upload → existing Whisper transcription), a **chat view** (evening review + nudges), and **Circle / marketplace / dashboard** screens on a backend that already exists. Weeks on existing foundations (Next.js frontend, auth, backend, VAPID push, coach dashboard all already built), not months.
- **Ownership + brand + coherence:** a £40/mo product in one branded place you control beats a bot in someone else's chat app, and avoids Telegram's low UK/US penetration ("install Telegram to use Ivy" friction) and its API/TOS dependency.

**Why PWA, not native (yet):** native (iOS/Android) adds app-store accounts, review cycles, and ongoing maintenance — the genuinely premature, expensive part. A PWA gets ~90% of the benefit (installable, push-capable, audio recording) at a fraction of the cost. Go native **post-PMF** if push reliability or polish demands it.

**The one real engineering risk — push reliability (open decision):** the loop depends on the morning "drop your VN" prompt *landing.* Web push is reliable on Android but **historically flaky on iOS** (works since 16.4, but only after "add to home screen," and Apple can throttle it). **Mitigation:** a thin **SMS fallback for the single daily morning nudge only** (cheap — one message/day, not a whole conversation) while everything else lives in the PWA. Decide based on how much you trust iOS web push in your market.

**Explicitly rejected:**
- **WhatsApp** — per-conversation fees + Meta business-verification (KYB) gauntlet (founder decision).
- **Telegram as the primary client** — fragments the experience and can't host Circles/marketplace; not worth it once the app exists. *(The already-built Telegram VN ingestion + Whisper transcription can serve as a **stopgap for the earliest beta** while the PWA front door is built — but it is not the destination.)*

**Slimming the journey:** Stripe checkout + stake/charity setup are web today; folding the daily loop into the same PWA is what removes the fragmentation the founder flagged.

**Premium feel — an execution question, not a platform limit.** Chat is web's *strongest* surface; a well-built PWA reaches ~90–95% of native feel (smooth virtualised scroll, optimistic sends, crisp typography). The known gap clusters on **iOS Safari**: (1) **keyboard/input choreography** — the input bar staying above the keyboard, viewport resize, scroll position — is the hardest thing to nail and the core interaction, so **budget real effort here** (use the `visualViewport` API); (2) **no haptics** on iPhone (Android fine); (3) overscroll/gesture polish. Android feels essentially native. A lazily-built PWA feels cheap — premium feel requires deliberate investment (design system, motion, the iOS keyboard layer). If users prove iPhone-heavy and the feel doesn't carry the price, that is the trigger to go **React Native** (reuse most logic; gain native keyboard + haptics + push).

**Delivery (decided):** the PWA is a **separate, dedicated frontend workstream — NOT the backend implementation agent's job.** It's significant, design-critical work and the bar is "absolutely banging," not merely functional. Staff it with a **design-focused frontend agent** (e.g. the `frontend-design` capability), and it can start **in parallel** on the design system + chat/VN shell against mocked data contracts while the backend phases proceed.

---

## 2. The Stake — core mechanic

| Property | Decision |
|---|---|
| **Whose money** | The user's own, **separate from the subscription**. Never recognised as Ivy revenue. |
| **How it's held** | **Stripe auth-and-capture (manual capture).** Authorize the full cycle stake up front (earmarked, visible to the user as "£X on the line"); capture only what's forfeited. Avoids holding balances / money-transmitter exposure. *Note: card auth holds expire ~7 days → a **weekly** cycle fits; re-auth logic needed for longer cycles.* |
| **Amount** | **User-set**, with a **mandatory minimum**. Self-set stakes commit harder; the minimum is the seriousness filter (see §5d). |
| **Cadence** | Weekly cycle (fits the auth window). Daily slices within the week. |
| **On success (day followed through)** | The day's slice is **released back to the user** (not captured). On a successful day, the **corporate/CSR pool** (§6) donates to the user's chosen charity. Ivy funds no match itself. |
| **On failure (day missed or unarmed)** | The day's slice is **captured and forfeited** to the failure destination (§3), **and** no corporate donation fires for that day. |
| **Arming requirement** | A day only counts as "armed" if the morning VN was recorded before the deadline. **Unarmed = miss = forfeit** (this is what makes the VN truly compulsory). |
| **Grace valve** | **One grace skip per cycle** (configurable). Prevents teeth from punishing illness/emergencies and the resulting churn. |

**The motivational spread the user feels each day:** *show up → keep my money + my charity gets funded (and amplified)* vs *flake → lose my money to somewhere I don't want + nothing good happens.* Ivy funds none of this — the teeth are the user's own stake; the warmth is corporate money.

---

## 3. Failure destinations — where forfeited stake goes

The user picks their intensity at setup. **Self-selection of intensity is itself good design** (a chosen tooth bites harder).

| Intensity | Forfeit destination | The sting | Default? |
|---|---|---|---|
| **Middle** | A vetted **"house" charity the user did *not* choose** (or a pool of them) | Loss of agency + loss of the payoff — *you wasted your shot*; a stranger's cause benefited from your slip | **Yes (default)** |
| **Savage** | A cause the user **actively dislikes**, chosen at signup ("anti-charity") | *You funded something you hate* — maximum teeth | Opt-in |
| ~~Weak~~ | ~~The user's *own* chosen charity~~ | *(none — failing still feels good; moral-licensing leak)* | **Never offer** |

**Honest caveat to encode in product copy decisions:** the Middle tier has genuinely *softer* teeth than Savage, because "it still did some good" lets charitable users off the hook. Middle is the brand-safe default; Savage is for users who know they need a sharper edge.

**A constant tooth across all tiers:** on any failure, the **corporate match never fires**, so the total good done is always less when you fail — independent of where the forfeited stake lands.

**Do not build (yet):** redistributing forfeited stakes *to other users* (e.g. "your miss is split among Circle members who succeeded"). It has real teeth but drifts toward gambling/prize-pool regulation — park it until legal review. Note it as a future option.

---

## 4. The morning voice note — user journey & escalation

A user-set morning **arming window** (they choose their own deadline). The journey:

1. **Prompt** (start of window): "Morning! Drop your voice note — what's the one thing you're taking on today?"
2. **One reminder** (~60–90 min later, if no VN), **framed as loss, not nagging**: "You haven't armed today — your £X is on the line until you do."
3. **Final notice** (approaching deadline): "Last chance — drop your VN by [their time] or today won't count and your stake goes to [destination]."
4. **Deadline**: unarmed day = miss = forfeit. **No call. The stake consequence is the enforcement.**

**Critical design constraint — the escalation must NOT bottom out in a live call.** A live "Ivy calls to chase you" escalation rebuilds the exact COGS this rework removes, and it would fire most on the *least engaged* users (the worst cohort to spend on). Therefore:

- **Default escalation floor = the stake consequence** (free).
- **Free social layer = the accountability buddy nudge.** Ping the user's pre-consented, reciprocal buddy ("[name] hasn't checked in — give them a poke?"). The `AccountabilityBuddy` model already exists. Social accountability is both free to Ivy and more effective than an AI call.
- **Ivy-calls-you-to-chase = a PREMIUM, opt-in feature only.** Never default. Only fires for users who've chosen and funded it.

**VN content & handling:**
- **One-shot, not a conversation** (morning = *declare*, evening = *review*). No back-and-forth in the morning (cost + friction).
- **Light structure:** "your one main thing + anything else" so the evening call has concrete commitments to check.
- The evening call prompt **must ingest the morning VN transcript** for the callback loop.
- **Track two miss types separately:** *didn't arm* (no VN) vs *armed but didn't follow through* (failed evening review). They diagnose different problems (engagement vs follow-through).
- **Compulsory for all channels (§1d):** even text-preference users record a *spoken* morning VN — arming is always voice, because saying it out loud is the mechanic. Only the evening review and nudges follow the user's channel preference.

---

## 4a. Circles & games — the social engine (already built; now central)

Circles is the most differentiated, hardest-to-copy part of Ivy, and it is **already implemented** (`circle.service.ts`, `circle-game.service.ts`, `circle-catchup.service.ts`; models `IvyCircle`, `CircleGame`, `CircleGameEvent`, `GameSuggestion`, `CircleSprintSession`, `CircleCatchup`). In the one-tier model it is **promoted from a tier-perk to a free, central retention/virality engine.**

**What's built:**
- **Cohorts** (`IvyCircle`) — 6–8 per circle, grouped by track, with season themes, sprint pledges (`CircleSprintGoal`), periodic sessions (`CircleSprintSession`), and 48-hour catch-ups (`CircleCatchup`) so absent members don't fall out.
- **A live game engine** (`GAME_TEMPLATES`) with four templates: **relay/baton** (hold the baton; complete your workout to pass it; miss your window → baton drops + the group loses a life; push notifications fire), **points_race**, **collective** (the group chases a shared target), **custom**.
- **AI-native games:** `ivyInstruction` is **plain-English game rules that Ivy reads and runs conversationally**, while the backend deterministically enforces state (windows, lives, points, win conditions). Any game a circle can describe in words, Ivy runs — hard to copy, and a virality/content engine via the curated `GameSuggestion` library.

**Why it's central, not a perk:**
- The baton manufactures *daily social obligation* (the group is waiting on you) — stronger and more fun than 1:1 accountability, and it's peer pressure as a *feature*, not nagging.
- Social belonging + games are the antidote to Ivy's **#1 risk: novelty-driven churn.** Circles may be the retention mechanism, not a nice-to-have.
- Its value **compounds with adoption** (more users → better cohorts → more game liquidity → more stickiness), so free + maximum adoption is correct; gating it starves the liquidity it needs. This is *why* one tier (§5b) and "Circles is central" are the same decision.

## 4b. Stake × Circles fusion (committed design)

The commitment device (the stake) and the social game fuse into something neither does alone. **Committed to the design now**, but **sequenced after both cores exist** — you cannot wire two systems together before both are built (see build plan).

Three mechanics, all guardrail-safe:
1. **Witnessed stakes** *(the core — cheap and powerful):* members opt to share stake status with their circle. Showing up is celebrated; a forfeit is *seen.* **Witnessed loss aversion (shame/pride) is far stronger than private loss** — and it's pure visibility on the existing stake, no new money plumbing.
2. **Collective charity goal:** a circle can point members' *own* success-donations at a shared cause for a sprint; hitting a `collective` target becomes a group impact moment ("your circle funded 100 meals"). Coordination/presentation on existing donations — no new money.
3. **Baton-stake** *(opt-in game escalation):* holding the baton temporarily raises *your own* stake-at-risk for your window (you accepted the baton, you accepted more of your own skin). Pass → released as normal; **drop → a larger slice of your own stake forfeits to your own destination, and the group loses a life.** Teeth + social, all with the user's own money to their own destination.

**Hard guardrail (carries §7):** forfeited stakes are **never** redistributed to other members as winnings — that is the gambling/regulatory line. Games affect *visibility, coordination, and your own stake size* — **never transfer of money between users.** (The redistribute-to-winners idea stays parked for legal review.)

**Why commit now:** private loss aversion is good; *witnessed* loss aversion is stronger, and games with real personal money-skin beat games with abstract points. Mechanics 1 + 3 make the stake and the social game amplify each other — hitting novelty-churn with social + money + fun at once.

---

## 5. Pricing rework

### 5a. The decoupling (the headline)

The old per-tier wallet (`IMPACT_WALLET_MONTHLY`: £30/£45/£60) is **removed from the subscription**. That reclaims ~the wallet amount per tier. Combined with the ~50% live-call COGS reduction from the VN change, the subscription can drop *and* carry healthy margin.

### 5b. One tier + free opt-in features

**One paid subscription — "Ivy" — that includes the *entire* Ivy-delivered system, plus a 14-day trial. No tiers, no permanent free tier.** Nothing Ivy makes is gated behind an upgrade; the user opts into the features they want and **none cost extra.** (No "free + stake" tier either: the arming ladder costs messaging and Stripe auth/capture runs ~£1-3/mo on pass-through money, so £0 is pure runway burn — and the stake is already the commitment gate, so "free" just serves committed users at a loss. A trial does the cheap-entry job.)

`FREE` = trial/lapsed state. Reuse `PRO` as the single paid tier (display name **"Ivy"**); retire `STARTER`/`ELITE`/`CONCIERGE` (see migration, Phase 5). Figures illustrative pending confirmed COGS.

| Enum | Name | What's included (all opt-in, no extra cost) | Indicative price |
|---|---|---|---|
| `FREE` | Trial / lapsed | **14-day full trial** (real VN + evening review + stake), no card. Convert or lapse — not a permanent product. | £0 for 14 days |
| `PRO` | **Ivy** | The whole system: morning **VN** arming + **evening review** + **stake** + **arming-chase** + **Circles & games** (§4a) + **on-demand / rescue calls**. Channel is a preference (§1d). | **~£40–45** |

### 5b-i. Why one tier — and how "free features" don't blow up COGS

- **Philosophy:** *one price for all of Ivy; you are never charged more at the moment you need more help.* Every Ivy-delivered feature is included and opt-in.
- The **only** added costs a user ever sees are their own **stake** (their money) and a **human coach** (paid to the coach, §5f). Ivy-delivered features are free.
- **Cost control replaces tier-gating** (this is the real risk of "free" features):
  - **Arming-chase** — opt-in (self-selects to the motivated) **and capped** (e.g. N live chase calls/user/month) so a chronic flaker can't run up unlimited live calls.
  - **Circles** — **peer/community-facilitated** + games run conversationally by Ivy → near-zero cash cost even at full adoption.
- **The tradeoff (accept it deliberately):** one price = no tier-based price discrimination; you can't capture more from power users. Pre-PMF that's the right bet — simplicity + **maximum adoption of Circles** (your retention/virality engine, §4a). It's reversible: add a premium tier later if data shows a segment that would pay for more. Adding a tier later is far easier than un-confusing a multi-tier launch.

### 5c. Stake, coach, and channel sit alongside the one product

- **Stake** — a user-set dial, their own money (§2). Decoupled from price.
- **Coach** — opt-in human add-on, coach-priced, Ivy 0% rake (§5f). Principle: *Ivy-delivered features are free; humans are paid to the humans.*
- **Channel** — voice/text **preference at the same price** (§1d); the morning VN stays spoken for everyone.

### 5f. Certified-coach add-on (all tiers)

A user can add a **certified coach from Ivy's coach pool at any point.** It is the one thing that costs extra — and even that is not Ivy's revenue (coach bills the client directly). Decisions baked in:
- **The coach sets their own hourly rate and bills the client directly. Ivy takes 0% for now.** Ivy's revenue stays clean: client subscriptions + the flat coach platform fee (£79/$99). No payment-splitting, payouts, or marketplace-billing infra to build; coaches keep 100% of their rate, which maximises coach supply.
- **Lightweight vetting + rating** (vouched, reviewable, removable) — *not* formal certification pre-scale. The moment coaches are surfaced inside the product, their quality reflects on Ivy's brand even with no rake.
- **Two coach pathways coexist:** (a) coach-led — a coach recruits their own clients, who pay normal Ivy rates (the existing flow, e.g. the PT beta); (b) marketplace/discovery — a self-serve user finds a coach from within the app (new). Both fine.
- **Rails-later note (deliberate trade):** off-platform billing means Ivy has no visibility into coaching revenue and no rake unless it later retrofits booking/payment rails. Acceptable for launch; revisit when marketplace demand is proven. Do **not** build marketplace billing before there's a marketplace.

### 5d. Seriousness is enforced by the stake, not the price

A low subscription does **not** attract unserious users here, because a **meaningful minimum stake** is the filter — anyone willing to risk their own money self-selects as serious regardless of the sub price. This is why Ivy can be priced for a wide funnel without becoming a tire-kicker magnet. **Do not raise the subscription to filter seriousness; set the minimum stake.**

### 5e. What to do with the freed margin

**Do NOT spend it on match-funding or paying moderators/coaches from base margin.** That re-creates the broken Coach-tier pattern (giving away money you can't afford — see `docs/pricing-strategy.md` §9 warning). The freed margin's job pre-PMF is **CAC and runway**. Generosity is funded by **other people's money only**: the user's stake (teeth) and the corporate/CSR pool (warmth). Coach costs are the coach's own (paid to the human, §5f), never absorbed into the base price; Circle facilitation is peer/community-based to stay near-zero.

---

## 6. Corporate / CSR funding layer (later phase — do not block launch on it)

The "warmth" (charity donation on success) is funded by **corporate sponsors**, not Ivy's margin and not the user's stake (which returns on success). Why a corporate routes CSR money through Ivy rather than donating directly:

1. **Attribution & reporting** — "we funded 12,000 completed healthy-habit days and £40k to employee-chosen charities" beats a lump donation as CSR collateral.
2. **Brand presence** on a genuine moment of human achievement ("powered by [Corp]").
3. **Employee-wellness fusion (strongest):** a corporate buys Ivy *seats* (B2B revenue) **and** sponsors the charity pool for its workforce. Healthier employees + CSR impact + brand, in one purchase.

**Guardrails / cautions (encode as sequencing, not features to rush):**
- **Chicken-and-egg:** the stake engine must work **standalone with zero sponsor** — success simply means "you kept your money," and the corporate donation is a *bonus that appears once a sponsor exists.* Build it to degrade gracefully.
- **Different, slow sale** (6–12 mo enterprise cycle) — sequence *after* the consumer loop is proven.
- **Heavier regulatory weight** — conduiting third-party charitable funds at scale needs legal review before taking a penny.

---

## 7. Non-negotiable principles (the guardrail hierarchy)

1. **Forfeited money never touches Ivy's P&L.** It goes to charity / house-charity / anti-charity — never to Ivy. (A product that profits from user failure reads as a scam.)
2. **The stake is never Ivy revenue.** It is pass-through (user → charity). Accounting and regulatory: Ivy is a conduit, not the recipient.
3. **The subscription must cover its own COGS + margin, standalone.** No cross-subsidy from stakes or corporate money.
4. **Generosity is funded by other people's money** (stakes + corporate), never Ivy's margin.
5. **No weak failure destination** (forfeit → own charity) — it has no teeth.
6. **Teeth bite slacking, not being human** — the grace valve is mandatory.

---

# PART B — BUILD PLAN

> Execute phase by phase. Stop at each **✋ checkpoint** for review. Verify exact existing field names against `prisma/schema.prisma` before writing migrations — model/field references below are accurate as of this writing but confirm.

**Current repo state (verified June 2026 — read before estimating effort):**
- **Stake / auth-capture: does NOT exist.** `payment.service.ts` only creates `mode: 'subscription'` checkout sessions — no PaymentIntent, no manual capture. **Phase 2 is genuinely greenfield.**
- **Whisper transcription already exists** (`transcription.service.ts:transcribeTelegramVoice`, via `webhook.controller.ts`). Per §1e the destination is **browser audio capture in the PWA** (MediaRecorder → upload → reuse the Whisper transcription), *not* Telegram. The existing Telegram VN path can serve as a **stopgap for the earliest beta** only. Generalise the transcription helper to accept an uploaded blob, not just a Telegram `file_id`.
- **Prompt composer: ALREADY BUILT.** `prompt.service.ts` already has the `FLOWS` / `resolveFlowKey` / `buildSystemPrompt` per-call-type composer described in `docs/prompt-composer.md` (whose "NOT YET IMPLEMENTED" header is now **stale** — ignore it). It already wires an evening→morning callback via `ctx.morning_context` (`memoryBlock`, ~line 508). Phase 4 is mostly *feeding the VN transcript into that existing slot*, not new prompt architecture.
- **Cron/scheduling lives in `src/worker.ts`** (not `index.ts`). `callService.scheduleDailyCalls` is the hook. Donation dispatch (`every-org.service.dispatchPendingDonations`) already runs monthly — stake forfeits/success donations can reuse it.

## Phase 0 — Config & guardrails (foundation)

**Goal:** central, tier-driven config; no behaviour change yet.

- `src/config/pricing.ts`:
  - **Deprecate** `IMPACT_WALLET_MONTHLY` (wallet is no longer bundled). Leave a comment pointing here.
  - Reprice `TIER_PRICES` to the new structure (§5b) — **placeholders, flagged for founder confirmation.**
  - Add `STAKE_CONFIG`: `{ minWeeklyStake, defaultWeeklyStake, currency-aware }`, `GRACE_SKIPS_PER_CYCLE`, `FORFEIT_MODE_DEFAULT = 'MIDDLE'`.
- Add new Stripe price env vars for the repriced tiers (`src/config/env.ts` zod schema). Keep old vars until migration done.

**✋ Checkpoint:** founder confirms prices/minimum stake before anything bills against them.

## Phase 1 — Data model

**Goal:** schema for stakes, voice notes, forfeit destinations. One migration.

In `prisma/schema.prisma`:

- **`User`** — add stake config fields (or a `StakeConfig` 1:1 model): `stakeWeeklyAmount Decimal?`, `forfeitMode` (`MIDDLE`|`SAVAGE`), `dislikedCharityId String?` (savage destination), `armingWindowStart/End String?`. Success-charity already exists (`preferredCharityId` / `UserCharity`). *(Note: an earlier `stakeMinAutoArm` field was dropped — there is no auto-arm; arming is always the spoken VN.)*
- **New enum `ForfeitMode`** = `MIDDLE | SAVAGE`.
- **New model `StakeCycle`**: `userId`, `periodStart`, `periodEnd`, `stakeAmount`, `stripePaymentIntentId` (the auth), `capturedAmount Decimal @default(0)`, `status` (`AUTHORIZED|SETTLED|VOIDED|FAILED`), `daysArmed Int`, `daysCompleted Int`, `daysForfeited Int`, `graceUsed Int @default(0)`.
- **Reuse `Workout` as the per-day unit** (it already has `status` PLANNED/COMPLETED/PARTIAL/SKIPPED/MISSED and `planningCallId`/`reviewCallId`). Add: `armedAt DateTime?`, `voiceNoteId String?`, `stakeCycleId String?`, `stakeSliceAmount Decimal?`, `sliceOutcome` (`RELEASED|FORFEITED|PENDING`).
- **New model `VoiceNote`**: `userId`, `workoutId`, `audioUrl`/`telegramFileId`, `transcript String? @db.Text`, `recordedAt`, `durationSec`. Transcription + ingestion already exist via Telegram (`transcription.service.ts` + `webhook.controller.ts`) — this model just persists the result and links it to the day.
- **`Charity`** — add `isHouseDefault Boolean @default(false)` (Middle-tier destination pool).
- **`DonationType`** — add `STAKE_SUCCESS` (corporate-funded, success) and `STAKE_FORFEIT` (user stake, failure). Add `source` field (`USER_STAKE | CORPORATE | SPONSOR`) to `Donation`.
- **`CallType`** — add `ARMING_CHASE` ("Ivy chases you if you go quiet"). It is an **opt-in feature for all users, with a monthly cap** (§5b-i cost control) — *not* tier-gated. Live `MORNING_PLANNING` becomes an **opt-in preference** (default for everyone is the async VN).
- **`ImpactWallet`** — repurpose for *lifetime donated / corporate pool tracking only* (no longer subscription allocation), or deprecate `monthlyLimit`/`dailyCap` if unused. Confirm usages before changing.

**✋ Checkpoint:** review schema diff + migration plan before `migrate dev`.

## Phase 2 — Stake lifecycle (Stripe auth/capture)

**Goal:** the money engine. Highest-risk phase — **recommend tight review / Opus pairing here.**

- `src/services/payment.service.ts` (or new `stake.service.ts`):
  - `openStakeCycle(userId)` → create PaymentIntent with `capture_method: 'manual'` for the weekly stake; persist `StakeCycle`.
  - `settleStakeCycle(cycleId)` → at period end: capture `Σ forfeited slices` only; **void/release the rest** (released = never captured). Then dispatch forfeits to the correct destination and (if a sponsor exists) trigger `STAKE_SUCCESS` corporate donations for completed days.
  - Handle `payment_intent.*` webhooks; handle auth expiry / re-auth.
- **Guardrail tests (required):** forfeits never credit an Ivy-owned account; released slices are never captured; Middle vs Savage routes to the correct charity; grace skip suppresses one forfeit/cycle.

**✋ Checkpoint:** money-flow review against §7 guardrails before connecting to live scheduling.

## Phase 3 — Morning VN + arming + escalation

**Goal:** the daily arming loop.

- **Scheduler** (`src/worker.ts` crons; `callService.scheduleDailyCalls` is the hook): replace the scheduled live morning call with the VN arming job **for everyone** (a live morning call survives only as an opt-in preference): prompt → one reminder → final notice → deadline → mark unarmed `Workout` as MISSED + flag slice `FORFEITED`. Keep evening call. Add `StakeCycle` open (cycle start) and `settle` (cycle end) jobs.
- **VN capture (PWA, per §1e):** in-app **browser audio recording** (MediaRecorder) → upload → reuse the Whisper transcription helper → persist `VoiceNote`, set `Workout.armedAt`. *(Telegram VN ingestion is a stopgap for the earliest beta only.)*
- **Nudge delivery (push reliability, §1e open decision):** PWA web push for the prompt/reminder ladder, with a thin **SMS fallback for the single morning nudge** if iOS web push proves unreliable. Voice calls stay on Retell+Twilio.
- **Messaging** (`communication.service.ts` / `messaging.service.ts` / `push.service.ts`): the prompt/reminder/final-notice ladder, loss-framed copy.
- **Buddy nudge** (`buddy.service.ts` + `AccountabilityBuddy`): free social escalation, pre-consented only.
- **`ARMING_CHASE` call:** an **opt-in feature for all users**, **capped** per user/month (§5b-i). The default escalation floor for everyone remains the stake consequence + buddy nudge; the chase is the extra layer a user *chooses* to enable, not a paid tier.
- **Channel preference (§1d):** drive evening review + nudges off the existing `CommStyle` enum (`CALLS | TEXTS | ADAPTIVE`) — text users get text evening reviews. **But the morning VN is always a spoken voice note regardless of `CommStyle`** (arming = voice for everyone). Same price, same loop.

**✋ Checkpoint:** confirm the chase call respects the per-user monthly cap (COGS guardrail — opt-in + capped is what replaces tier-gating now that there's one tier).

## Phase 4 — Evening call uses the VN (mostly wiring, not new architecture)

- `src/services/prompt.service.ts` **already composes per call type and already supports an evening→morning callback** via `ctx.morning_context` (`memoryBlock`, ~line 508). The work is to **feed the day's `VoiceNote.transcript` into `ctx.morning_context`** for `EVENING_REVIEW` — not to build new prompt structure. (`docs/prompt-composer.md`'s "not implemented" header is stale; the composer exists.)
- Resolve day outcome (completed/partial/missed) → set `Workout.sliceOutcome` → feeds Phase 2 settlement.

## Phase 4b — Stake × Circles fusion (after Phase 2 stake engine + the existing Circles system)

**Goal:** wire the commitment device into the social game (§4b). Depends on the stake engine (Phase 2) being live; Circles is already built. **Money-touching → review against §7 guardrails.**

- **Witnessed stakes:** add an opt-in "share stake status with my circle" flag (on `IvyCircleMember` or user prefs); surface arm/success/forfeit events into the circle feed and Ivy's circle narration. *No money mechanic — visibility only.*
- **Collective charity goal:** let a circle nominate a shared cause for a sprint; when a `collective` game target is hit, badge the members' existing `STAKE_SUCCESS` donations as a group impact moment. *Presentation/coordination on existing donations.*
- **Baton-stake:** link `CircleGame` (relay) state to the day's stake slice — holding the baton raises *that user's own* stake-at-risk for the window; a drop forfeits a larger slice **to their own destination** (and the group loses a life, as today).
- **Guardrail test (required):** forfeited stakes are **never** credited to another user. Games change visibility, coordination, and a user's *own* stake size only — never inter-user money transfer.

**✋ Checkpoint:** money-flow review — confirm no stake ever moves between users (gambling/regulatory line, §7).

## Phase 5 — Pricing/subscription surfaces & migration

- `SubscriptionTier` enum: `FREE` → trial/lapsed; **reuse `PRO` as the single paid tier** (display "Ivy"); **retire `STARTER`/`ELITE`/`CONCIERGE`**. Migration: **all paid subscribers (`PRO`/`ELITE`/`CONCIERGE`) collapse to the single `PRO` tier** — much simpler than the earlier two-tier flip (founder confirms grandfather vs new price).
- **14-day trial flow:** new signups enter `FREE`/trial with full access (incl. stake setup); on day 14, convert (card) or lapse. No permanent free product.
- **Opt-in feature toggles:** arming-chase (capped), Circles, on-demand — all included, user switches on what they want; none change price.
- **Coach add-on surfaces:** coach discovery/booking; coach sets rate, bills client directly (Ivy 0% rake — §5f); lightweight vetting/rating. No marketplace-billing infra at launch.
- `payment.service.ts` tier↔price map: one paid price (per currency).
- Frontend: single pricing page (one plan + the coach add-on + opt-in feature toggles), onboarding (stake setup: amount ≥ min, forfeit mode, success charity, optional disliked charity, arming window), checkout.
- Retire bundled-wallet copy/logic across backend + frontend.
- **⚠️ The consumer PWA is a separate, dedicated frontend workstream — NOT this backend plan's job (§1e).** It covers the **VN recorder (MediaRecorder), evening-review chat UI, web-push nudges (+ optional SMS morning-nudge fallback), and the Circle/game + coach-marketplace + coach-client screens** — owned by a design-focused frontend agent, to the "absolutely banging" bar, runnable in parallel against mocked contracts. The backend phases here only need to expose the APIs/data those screens consume. (Telegram VN = earliest-beta stopgap only.)

**✋ Checkpoint:** founder reviews migration/grandfathering for existing users.

## Phase 6 — Corporate/CSR layer (later — do not block launch)

Build only after the standalone stake loop is proven. `Company` model already has `impactWalletPerUser`; extend to fund `STAKE_SUCCESS` donations. **Legal review before conduiting third-party charitable funds.**

---

## 8. What this supersedes in `docs/pricing-strategy.md` (v1.1)

- **§2 Impact Wallet** ("money only moves on follow-through", "wallet funding built into subscription price") → replaced by the **stake** (§2–§3 here). Subscription no longer funds the wallet.
- **§5–§6 COGS & B2C pricing** (2 calls/day, `Price = Wallet + COGS×2`, £70/£99/£149 with £30/£45/£60 wallets) → replaced by **VN + 1 evening call** COGS and the **decoupled** tier structure (§5 here).
- **Core mechanics** "daily morning call (live)" → morning **VN for everyone** (live morning call survives only as an opt-in preference); evening stays live. **Five tiers (Ivy/Plus/Concierge + coach) → ONE tier ("Ivy") + free opt-in features (arming-chase, Circles, on-demand) + a coach add-on** (§5b). Circles is promoted from a Concierge/Plus perk to a free, central social engine (§4a).

Sections still valid: Seasons/Sprints structure, Season Close, Impact Stories (now corporate/stake-funded), positioning, B2B sponsor concept (now the corporate warmth funder).

---

## 9. Decisions (defaults set so the build isn't blocked — ⚑ = still needs founder)

Build against these. The ⚑ items still need the founder's real-world input but **do not block starting** (prices are wired through config as placeholders; the rest are content/business confirmations).

1. **Pricing — PLACEHOLDER ⚑:** one plan **"Ivy" £42/mo · $52/mo**, 14-day trial. Wired through `pricing.ts`; founder confirms once real COGS is known. Build proceeds on the placeholder.
2. **Minimum stake: £7/week (£1/day) · $10**; default suggested **£14/week (£2/day) · $20**; user-settable higher.
3. **Cycle length: weekly** (fits the Stripe ~7-day auth window).
4. **Migration: grandfather** — existing subscribers keep their current price until they cancel/renew; new signups on the new model. ⚑ founder confirms (likely trivial — ~0 live subscribers pre-launch; all old tiers collapse to single `PRO`/"Ivy", Phase 5).
4b. **Arming-chase cap: 8 chase calls / user / month** (~2/week — catches real slips, bounds COGS).
5. **Forfeit → Middle (default): a single house charity** (not split), flagged via `Charity.isHouseDefault`. ⚑ founder picks the specific 1–3 vetted orgs.
6. **Forfeit → Savage (opt-in): free-choice from the existing charity catalogue** (user nominates a real charity they'd hate to fund). No separate curated "anti-charity" list — cleaner operationally and reputationally.
7. **Trial requires a stake: yes** — it's the mechanic being trialed.
8. **Coach rake: 0% at launch** (§5f). ⚑ revisit *only* once there's genuine marketplace liquidity; no booking/payment rails built until then.
9. **Circles: peer/community-facilitated** (Ivy Graduates) → near-zero cash cost, which is what makes free-for-all viable (§4a).
10. **iOS push: build the thin SMS morning-nudge fallback from the start** (§1e) — the morning prompt landing is existential to the loop; cheap insurance beats betting on iOS web-push.

---

## 10. Recommended review checkpoints (cost-aware)

**Two workstreams, two agents (§1e):** the **backend implementation agent** owns the phases in this doc; a **separate, design-focused frontend agent** owns the consumer PWA. They run in parallel against agreed API/data contracts.

- **Founder sign-off:** Phase 0 (prices/min stake) and Phase 5 (migration).
- **Higher-capability model / careful human review:** Phase 1 (schema), Phase 2 (money flow vs §7 guardrails), and **Phase 4b** (stake×Circles fusion — confirm no inter-user money movement). The irreversible, money-touching, regulatory-adjacent parts.
- **Safe for the backend agent to run with minimal oversight:** Phases 3–4 messaging/prompt/scheduler wiring, once the data model and money engine are locked.
- **PWA workstream:** owned by the frontend agent to the "absolutely banging" bar; its main technical risk is the **iOS keyboard/feel layer** (§1e), so review that surface specifically rather than the whole UI.

---

## 11. PT / Coach beta channel

A PT with paying clients (UK + US) is the launch beta — and, importantly, **a viable steady-state channel, not just a test.** The current coach tier is economically sound (verified: `payment.service.ts:createCoachCheckoutSession` = flat £79/$99 for unlimited clients; clients self-fund their own subscription via `coach.service.ts` invite → normal pricing flow). So clients cover their own COGS and the coach's flat fee is margin — scaling via PTs does **not** hit a unit-economics wall.

### Packaging (reuse what's built)
- **PT signs up as `COACH`** (£79/$99 flat) → existing dashboard, weekly digests, programme areas, ponder calls. No new build.
- **Clients go through normal pricing** on the single **Ivy** plan (post-rework: VN + evening review + stake, all features included). Self-funding. The PT *is* their coach (coach-led pathway, §5f).
- **Reconciliation:** coach clients currently get morning-call-only — move them to VN + evening call like everyone else as part of the rework.

### Beta rules
- **Keep the stake real; comp/discount only the *subscription*.** The stake is the mechanic under test — never comp it. (WtP can't be cleanly tested through a warm channel anyway; defer it to cold acquisition.)
- **Cohort:** 10–30 clients, both regions (validates dual-currency/dual-Twilio; **mind US TCPA consent** — already built).
- **Instrument three numbers:** daily arming rate, follow-through rate, D30 retention. Plus weekly PT debrief + a few client interviews.
- **Set success criteria up front** (e.g. ">X% arming daily by week 4, >Y% active at D30") so the beta decides something.

### The PT pitch (why he/colleagues push it)
"Your clients follow through *between* sessions, you see who's slipping on a dashboard before the next session, and your retention goes up." Between-session adherence is the thing PTs lose clients over — Ivy as a retention tool *for his business*. Give him a concrete benefit too (free coach access, his charity benefiting, or revenue share).

### Guardrails
- **Read this beta as "product works when vouched for," NOT "B2C acquisition cracked."** Warm-channel retention is partly his rapport, not Ivy. Cold acquisition/retention is a separate, later test.
- **Comping is a deliberate, time-boxed beta cost.** At steady state clients must pay their own subscription — comping clients at scale re-creates the old coach loss (the flat coach fee can't cover N clients' COGS if those clients aren't paying their own way).
