# Ivy E2E — real consumer journey against live prod

These tests drive the **live site against the live backend with no API mocking**.
The goal is to catch the bugs that mocked-render checks miss: 500s on submit, dead
buttons, broken nav, wrong empty states. Every page is watched by `fixtures/guards.ts`,
which fails on any uncaught error, unexpected console error, or ≥400 `/api` response.

## How auth + external services are handled

- **Auth**: no email needed. `bootstrap.sh` creates a disposable `enatec.grp+e2e-<ts>@gmail.com`
  user, pre-sets its phone in the DB, mints a real magic-link token straight from
  the `magic_links` table, and prints the verify URL. Playwright navigates to it on
  the real site, so the genuine verify + routing path runs.
- **SMS OTP (Twilio)**: skipped legitimately. Onboarding's channel step takes a
  verified-phone fast-path when the typed number equals the account's phone — which
  we pre-set in `bootstrap.sh`. No SMS is sent.
- **Email (SMTP)**: bypassed (token read from DB).
- **Stripe**: the test never drives Stripe Checkout. The new-user subject is a FREE
  trial account (exactly what a brand-new user sees); the stake-activate→Stripe
  redirect is out of browser scope.
- **Anthropic**: the one accepted real call — sending a single chat message in `/ivy`
  hits real Anthropic server-side (fractions of a penny) and validates "alive Ivy".

## Run it

```bash
cd frontend
npx playwright install chromium          # first time only

eval "$(bash e2e/bootstrap.sh)"          # exports E2E_VERIFY_URL, E2E_USER_ID, ...
npm run test:e2e                         # mobile + desktop projects
npx playwright show-report               # HTML report + traces

bash e2e/teardown.sh "$E2E_USER_ID" "$E2E_USER_EMAIL"   # hard-delete the test user
# or sweep leftovers:
bash e2e/teardown.sh --all
```

Override the target with `E2E_BASE_URL` (e.g. a Vercel preview or localhost).

## Files

- `playwright.config.ts` — prod baseURL, mobile (iPhone 13) + desktop projects, traces on.
- `fixtures/guards.ts` — pageerror / console-error / ≥400-response collectors + telemetry abort.
- `fixtures/auth.ts` — reads `E2E_VERIFY_URL`, runs the real verify, waits for an authed session.
- `consumer-journey.spec.ts` — signup → verify → onboard → stake gate → in-app tour → Ivy chat round-trip.
- `pwa.spec.ts` — manifest, service worker, offline fallback.
- `bootstrap.sh` / `teardown.sh` — provision / hard-delete the disposable prod user.

## Requirements

`curl`, `psql`, and `DATABASE_URL` in the repo-root `.env` (used only to mint the
magic-link token and pre-set the phone — never written to a tracked file).
