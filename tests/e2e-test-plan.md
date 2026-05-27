# Ivy E2E Test Plan

## Before You Start

| Requirement | Where to get it |
|---|---|
| API running locally or at `ivykeeps-api.fly.dev` | `npm run dev` or Fly.io |
| Frontend running at `localhost:3000` or Vercel URL | `cd frontend && npm run dev` |
| A real phone number that can receive calls | Your own |
| Stripe test mode active | Dashboard → Developers → Test mode |
| Stripe test card | `4242 4242 4242 4242`, any expiry/CVC |
| Telegram account | To test bot alerts |
| Two email addresses | To test coach invite and buddy flows |

---

## Journey 1 — New B2C User: Sign Up → Onboard → First Call

**What this tests:** The entire new user golden path from cold landing to first AI call.

### Steps

1. Open the frontend homepage (`/`). Confirm hero, pricing, and CTA are visible.
2. Click the primary CTA. Confirm you land on `/signup`.
3. Enter a real email address you can access. Submit.
4. Check your inbox for the magic link email. Confirm it arrives within 60 seconds.
5. Click the magic link. Confirm you're redirected into `/onboard/welcome`.
6. Work through the onboarding steps in order:
   - **Welcome** — read and continue
   - **Track** — pick any track (e.g. Fitness)
   - **Goal** — type a goal
   - **Preferences** — set a morning call time 5 minutes from now and an evening call time
   - **Timezone** — confirm your timezone is correct (defaults to Europe/London)
   - **Charity** — select at least one charity
   - Continue through remaining steps until you reach the final step
7. On completion, confirm you're redirected to `/dashboard`.
8. On the dashboard, confirm:
   - Your name appears
   - An upcoming call is shown for the time you set
   - Streak shows 0
9. Wait until the call time. Confirm your phone rings.
10. Answer the call. Speak naturally. Confirm the AI responds and the conversation flows.
11. After the call ends, refresh `/calls`. Confirm the call appears with status `COMPLETED` and a transcript.
12. Check the dashboard streak — confirm it incremented to 1.

### Pass criteria
- Magic link arrives < 60s
- Onboarding completes without error
- Call fires within 2 minutes of scheduled time
- Transcript visible after call ends
- Streak increments

---

## Journey 2 — Returning User Login

**What this tests:** Passwordless login for an existing user.

### Steps

1. Go to `/login`.
2. Enter the email from Journey 1.
3. Submit. Confirm "check your inbox" message appears.
4. Click the magic link. Confirm you land directly on `/dashboard` (not onboarding).
5. Confirm your previous streak, call history, and settings are intact.

### Pass criteria
- No re-onboarding triggered
- Data persists correctly from previous session

---

## Journey 3 — Subscription Purchase (Stripe)

**What this tests:** Stripe checkout for a paid tier.

### Steps

1. Log in as the user from Journey 1 (currently on FREE after onboarding if payment wasn't completed).
2. Navigate to `/pricing`.
3. Click **Get started** on the **Ivy (PRO)** plan in your currency.
4. Confirm you're redirected to Stripe checkout.
5. Enter test card `4242 4242 4242 4242`, any future expiry, any CVC, any postcode.
6. Complete payment.
7. Confirm you're redirected to `/checkout/success`.
8. Navigate to `/settings`. Confirm subscription tier shows **PRO**.
9. Navigate to `/donations`. Confirm the impact wallet shows the PRO monthly budget (£30 GBP / $37 USD).

### Pass criteria
- Stripe checkout loads correctly
- After payment, tier updates to PRO without page refresh needed
- Impact wallet budget matches PRO tier

### Also test: subscription management
1. Go to `/settings` → Subscription section.
2. Click **Manage subscription**.
3. Confirm you're redirected to Stripe customer portal.
4. In the portal, confirm you can see the active subscription and a cancel option.
5. Return to Ivy without cancelling.

---

## Journey 4 — Coach Signs Up and Sets Up

**What this tests:** The coach account creation and profile setup flow.

### Steps

1. Use a second email address. Go to `/signup` and create a new account.
2. Complete onboarding. When asked for a plan, select **Coach** (£79/mo).
3. Complete Stripe checkout with the test card.
4. Confirm you land on `/coach` after checkout.
5. Go to `/coach/settings`. Fill in:
   - Programme name (e.g. "Elite Performance Programme")
   - Coaching style (e.g. "Accountability-first")
6. Save. Confirm changes persist on reload.
7. Go to `/coach`. Confirm client roster shows 0 clients.
8. Click **Get invite link**. Confirm a URL like `https://yourdomain.com/invite/[token]` appears.
9. Copy the invite link.

### Pass criteria
- Coach account created with COACH tier
- Coach profile saves correctly
- Invite link generates and displays

---

## Journey 5 — New Client Joins via Coach Invite Link

**What this tests:** The invite-to-onboard flow for a brand new user coming through a coach's link.

### Steps

1. Open the invite link from Journey 4 in a private/incognito window.
2. Confirm the landing page shows:
   - Coach's programme name
   - A message like "[CoachName] invited you to join [ProgrammeName]"
   - An email input field
3. Enter a third email address you can access.
4. Submit. Confirm a magic link email arrives.
5. Click the magic link. Confirm you're taken into onboarding.
6. Complete onboarding. Select a plan and pay.
7. After onboarding, go to `/settings`. Confirm the coach section shows the coach's name.
8. Switch to the coach account. Go to `/coach`. Confirm the new client appears in the client roster.
9. On the coach dashboard, click the client. Confirm you can see:
   - Their streak
   - Their recent calls
   - A notes field
10. Add a coach note. Save. Confirm it persists.

### Pass criteria
- Invite landing page shows correct coach branding
- New user automatically linked to coach after onboarding
- Client appears in coach roster immediately
- Coach notes save correctly

---

## Journey 6 — Existing User Accepts Coach Invite

**What this tests:** The consent flow when an already-onboarded user receives a coach invite.

### Steps

1. Use the user account from Journey 1 (already onboarded).
2. Open the coach's invite link (from Journey 4) while logged in as that user.
3. Confirm a consent prompt appears — something like "Accept [CoachName] as your coach?"
4. Click **Accept**.
5. Go to `/settings`. Confirm the coach is now linked.
6. Switch to the coach account. Confirm the user now appears in the client roster.

### Also test: leaving a coach
1. As the client, go to `/settings` → Coach section.
2. Click **Leave programme**.
3. Confirm the coach is removed from your profile.
4. Switch to coach. Confirm the client is no longer in the roster.

### Pass criteria
- Consent step shown for existing users (not auto-linked)
- Accepting links correctly
- Leaving removes coach link on both sides

---

## Journey 7 — Accountability Buddy

**What this tests:** Setting a buddy and the weekly digest.

### Steps

1. Log in as the PRO user from Journey 1.
2. Navigate to `/settings` → Buddy section.
3. Enter buddy name, email, and optionally a phone number.
4. Save. Confirm buddy details display.
5. To test the digest without waiting for Sunday 9am UTC:
   - Hit the API directly: `POST /api/buddy` to confirm the record saves
   - The weekly digest fires via cron — you can't easily trigger this manually without a dev endpoint

### Pass criteria
- Buddy saves and displays in settings
- No errors on save

---

## Journey 8 — Rescue Call

**What this tests:** A user-initiated on-demand call.

### Steps

1. Log in as the PRO user.
2. On the dashboard, find the **Rescue call** button (or equivalent CTA).
3. Click it. Confirm a confirmation prompt appears.
4. Confirm. Wait for your phone to ring (should be within 2 minutes).
5. Answer. Confirm the AI knows this is a rescue call and responds appropriately.
6. After the call, confirm it appears in `/calls` with type `RESCUE`.

### Pass criteria
- Rescue call fires within 2 minutes
- Call logged with correct type

---

## Journey 9 — Donations and Impact Wallet

**What this tests:** Charity selection, wallet limits, and donation history.

### Steps

1. Log in as the PRO user.
2. Navigate to `/donations`.
3. Confirm you can see:
   - A list of charities to choose from
   - Impact wallet with monthly budget and remaining balance
4. Select a charity. Save.
5. After a call is completed (from Journey 1 or 7), check `/donations` again.
6. Confirm a donation entry appears for the completed workout/call.
7. Check the wallet balance has decreased by the correct amount.

### Pass criteria
- Charity selection saves correctly
- Donation created after qualifying event
- Wallet balance updates

---

## Journey 10 — Telegram Connect

**What this tests:** Linking a Telegram account to receive nudges and messages.

### Steps

1. Log in as any onboarded user.
2. Go to `/settings` → Integrations section.
3. Find the Telegram connect button. It should show a link to message `@ivykeeps_bot`.
4. Open Telegram and message `@ivykeeps_bot` with `/start`.
5. The bot will reply with a verification code or confirmation.
6. Follow the linking instructions. Confirm the settings page updates to show "Telegram connected".
7. Trigger any event that sends a Telegram message (e.g. a completed call).
8. Confirm you receive the message in Telegram.

### Pass criteria
- Bot responds to /start
- Account links without error
- Messages arrive in Telegram after qualifying events

---

## Journey 11 — Phone Number Verification

**What this tests:** OTP-based phone number update.

### Steps

1. Log in as any user.
2. Go to `/settings` → Phone section.
3. Enter a phone number in E.164 format (e.g. `+447700900000`).
4. Click **Send OTP**.
5. Confirm an SMS arrives with the verification code.
6. Enter the code. Confirm the number saves.

### Pass criteria
- OTP SMS arrives within 30 seconds
- Correct code accepts, wrong code rejects
- Number saves after verification

---

## Journey 12 — Coach Ponder Call

**What this tests:** The biweekly AI synthesis call Ivy makes to the coach about their clients.

### Steps

1. Ensure the coach has at least one active client (from Journey 5).
2. On the coach account, go to `/coach/settings`.
3. Set the ponder call schedule to 2 minutes from now (or use a dev override if available).
4. Wait for the call. Answer. Confirm the AI summarises client progress.
5. After the call, confirm it appears in the coach's call history.

> Note: Ponder calls are triggered by the `*/30 * * * *` cron in the worker. In staging you may need to manually call `POST /api/coach/schedule-ponder` if a dev route exists, or wait for the next 30-minute window.

---

## Journey 13 — Data Export and Account Deletion (GDPR)

**What this tests:** User data rights.

### Steps

**Data export:**
1. Log in as any user.
2. Go to `/settings` → Account section.
3. Click **Export my data**.
4. Confirm a JSON file downloads containing your calls, workouts, donations, and profile.
5. Verify the JSON contains your actual data.

**Account deletion:**
1. Go to `/settings` → Danger Zone.
2. Click **Delete account**.
3. Confirm a warning prompt appears explaining the action is irreversible.
4. Confirm deletion.
5. Attempt to log in again with the same email.
6. Confirm the magic link still sends (email is not stored after deletion) but verification fails or starts a fresh account.

### Pass criteria
- Export file contains real user data
- Account deletion removes data from dashboard immediately
- Deleted user cannot log back into old account

---

## Journey 14 — B2B Admin Invites Employees

**What this tests:** The B2B company admin flow.

### Steps

1. You need a B2B account (requires a company subscription — contact superadmin to set up manually via DB for testing).
2. Log in as the B2B admin.
3. Go to `/admin/employees`.
4. Click **Invite employee**. Enter an email address.
5. Confirm the invitee receives a magic link email.
6. The invitee follows the link and completes onboarding.
7. Return to `/admin/employees`. Confirm the employee appears in the roster.
8. Go to `/admin/calls`. Confirm the admin can see the employee's call transcripts.

---

## Journey 15 — Stripe Webhook (Subscription lifecycle)

**What this tests:** That subscription state updates correctly from Stripe events.

### Steps

1. Use Stripe CLI to replay webhook events locally:
   ```bash
   stripe listen --forward-to localhost:3001/webhooks/stripe
   ```
2. Trigger a `customer.subscription.created` event:
   ```bash
   stripe trigger customer.subscription.created
   ```
3. Confirm the corresponding user's `subscriptionTier` updates in the database.
4. Trigger `customer.subscription.deleted`.
5. Confirm the user's tier reverts to `FREE`.

> In production, cancel a real test subscription via the Stripe portal and verify the user's tier updates within 30 seconds.

---

## Journey 16 — Admin Superadmin Views

**What this tests:** Superadmin dashboards are functional and returning real data.

### Steps

1. Log in as the superadmin account.
2. Navigate to `/admin`. Confirm aggregate stats load (user count, call count, donations).
3. Navigate to `/admin/calls`. Confirm call transcripts are visible and filterable.
4. Navigate to `/admin/costs`. Confirm the cost breakdown shows Retell and Twilio usage.
5. Navigate to `/admin/suggestions`. Create a new game suggestion. Confirm it saves and appears in the list.

---

## Known Gaps / Not Testable Without Extra Setup

| Feature | Blocker |
|---|---|
| Circles (Ivy Circles) | Requires ELITE or higher plan and at least 2 users |
| Calendar sync | Requires Google/Microsoft OAuth credentials configured |
| WhatsApp messages | Requires WhatsApp Business Account connected |
| SMS inbound replies | Requires Twilio number configured for inbound SMS |
| Season Close ceremony | Requires an active season running for 12 weeks |
| Weekly digest emails | Only fires Sunday 9am UTC — must wait or manually trigger |
| B2B company setup | Requires manual DB setup for first B2B company |
| Stripe live payments | Test mode only until go-live |

---

## Regression Checklist (Run After Any Deploy)

- [ ] `/health` returns `200 ok`
- [ ] Magic link email arrives within 60s
- [ ] Dashboard loads without errors after login
- [ ] A scheduled call fires at the correct time
- [ ] Stripe checkout completes and tier updates
- [ ] Transcript appears after a completed call
- [ ] Telegram bot responds to `/start`
- [ ] Worker startup alert arrives in admin Telegram
