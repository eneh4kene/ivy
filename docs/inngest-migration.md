# Inngest migration — Phase 1 (cron backbone)

**Status:** code complete, not yet deployed. This is the founder runbook for the cutover.

## What this does

Moves the 11 node-cron jobs out of the always-on `worker` machine and onto
Inngest Cloud's scheduler. Inngest invokes our functions over HTTP against the
**API** process (already publicly reachable on Fly), so the schedule no longer
needs a 24/7 machine polling Neon every 5 minutes.

- **Kills the every-5-min Neon poll** (the arming loop) — the main idle-compute
  drain. With it gone, Neon can idle / scale to zero between real requests.
- **Lets you retire the separate `worker` machine for cron.** (Bull processors —
  call/message — are *not* migrated yet; that's Phase 2. See below.)

Behaviour is unchanged: same service calls, same UTC schedule. Each job is
wrapped in `step.run`, so a failed step is retried by Inngest without re-running
the steps that already succeeded.

> ⚠️ This does **not** revive June's prod on its own — Neon's June compute is
> already spent until the ~July 1 reset. This stops the bleeding and sets July
> up clean.

## The cutover switch

`INNGEST_ENABLED` is an **exclusive** switch:

- `INNGEST_ENABLED=false` (default) → `worker.ts` runs the node-cron jobs as
  today. Inngest endpoint is mounted but its functions are dormant (Inngest
  Cloud only invokes them once you sync the app there).
- `INNGEST_ENABLED=true` → `worker.ts` **stands down its cron** (logs and skips
  `registerCronJobs()`); Inngest Cloud owns the schedule. Bull processors in the
  worker stay active either way (Phase 2).

Exactly one scheduler runs at a time. No double-firing.

## Code map

- `src/inngest/client.ts` — Inngest client (`id: ivy`, dev mode off in prod).
- `src/inngest/functions.ts` — the 11 cron jobs as Inngest functions.
- `src/app.ts` — `serve(...)` mounted at `/api/inngest`, **before** the `/api`
  rate limiter so Inngest's bursty calls aren't throttled.
- `src/config/env.ts` / `src/config/index.ts` — `INNGEST_*` env vars + config.
- `src/worker.ts` — legacy cron gated behind `config.inngest.enabled`.

## Founder steps (the parts I can't do)

1. **Create an Inngest Cloud account** → create an app (any name; our app id is
   `ivy`). In the dashboard, grab the **Event Key** and **Signing Key**.

2. **Set Fly secrets** on `ivykeeps-api`:
   ```
   fly secrets set \
     INNGEST_EVENT_KEY=<event key> \
     INNGEST_SIGNING_KEY=<signing key> \
     --app ivykeeps-api
   ```
   (Leave `INNGEST_ENABLED` unset / false for now.)

3. **Deploy the API** (this PR's code) to Fly. The endpoint goes live at
   `https://ivykeeps-api.fly.dev/api/inngest` but stays dormant until synced.

4. **Sync the app in Inngest Cloud** → add the URL above as the app's serve
   endpoint. Inngest introspects it and registers all 11 functions. Verify they
   appear in the dashboard.

5. **Flip the switch — exclusive cutover:**
   ```
   fly secrets set INNGEST_ENABLED=true --app ivykeeps-api
   ```
   Also set it on the `worker` machine's config so its node-cron stands down.
   Redeploy/restart both. You'll get the Telegram "Inngest mode" startup ping.

6. **Watch one cycle.** Confirm in the Inngest dashboard that `arming-loop` fires
   every 5 min and the daily jobs fire at their UTC times. Check Telegram for the
   cost alert at 09:00 UTC.

7. **Retire the worker's cron role.** Once Inngest is proven, the `worker`
   machine only needs to run the Bull processors. (Don't delete it yet — Phase 2
   still relies on it for call/message queues.)

## Rollback

Set `INNGEST_ENABLED=false` and restart the worker → node-cron resumes
immediately. Inngest functions go dormant (or pause the app in the dashboard).

## Phase 2 (deferred)

Migrate the Bull processors (`call.processor`, `message.processor`) to Inngest
events to drop Upstash/Redis entirely, after which the `worker` machine can be
deleted outright. Not in this change.
