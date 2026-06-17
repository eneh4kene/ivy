-- Phase 5 — Tier Collapse Migration
-- docs/product-pricing-rework.md §5b + §9 decision 4
--
-- PURPOSE: Collapse all B2C paid tiers to the single PRO ("Ivy") tier.
-- Under the rework (Phase 5) there is ONE paid B2C subscription tier — PRO —
-- displayed as "Ivy". The ELITE and CONCIERGE enum values remain in the schema
-- temporarily to avoid a breaking enum migration, but all users are moved to PRO.
--
-- SAFETY NOTES:
--   1. DO NOT apply to production without founder sign-off (§10 / §9 decision 4 ⚑).
--      Founder must confirm grandfather vs. new-price treatment for any live subscribers.
--   2. This is a BACKWARD-COMPATIBLE migration: ELITE and CONCIERGE enum values are
--      NOT dropped here (dropping a PG enum value requires all rows to be cleared first,
--      and it is a DDL operation that cannot be rolled back trivially). Remove the enum
--      values in a separate future migration once the column is confirmed clean.
--   3. At ~0 live subscribers pre-launch this migration is effectively instantaneous and
--      risk-free, but the founder confirmation step is mandatory process regardless.
--
-- WHAT THIS DOES:
--   - Moves all ELITE and CONCIERGE users to PRO.
--   - Does NOT touch FREE, PRO, B2B, or COACH users.
--   - Does NOT change Stripe subscriptions — that is handled at the Stripe level
--     (new checkouts use the PRO price; legacy price IDs are routed to PRO in
--     getTierFromPriceId). Existing Stripe subscriptions for ELITE/CONCIERGE
--     subscribers should be migrated separately via the Stripe dashboard or API.

UPDATE users
SET "subscriptionTier" = 'PRO'
WHERE "subscriptionTier" IN ('ELITE', 'CONCIERGE');
