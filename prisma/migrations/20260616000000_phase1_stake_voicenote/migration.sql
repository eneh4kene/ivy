-- Phase 1: Stake mechanic + Voice Notes data model
-- product-pricing-rework.md §2, §3, §4, Phase 1 bullets
-- DO NOT APPLY until reviewed. Run via: npx prisma migrate deploy (after founder review)

-- ============================================
-- 1. New enums
-- ============================================

CREATE TYPE "ForfeitMode" AS ENUM ('MIDDLE', 'SAVAGE');

CREATE TYPE "StakeCycleStatus" AS ENUM ('AUTHORIZED', 'SETTLED', 'VOIDED', 'FAILED');

CREATE TYPE "SliceOutcome" AS ENUM ('RELEASED', 'FORFEITED', 'PENDING');

CREATE TYPE "DonationSource" AS ENUM ('USER_STAKE', 'CORPORATE', 'SPONSOR');

-- ============================================
-- 2. Extend existing enums
-- ============================================

-- DonationType: add stake-era values
ALTER TYPE "DonationType" ADD VALUE IF NOT EXISTS 'STAKE_SUCCESS';
ALTER TYPE "DonationType" ADD VALUE IF NOT EXISTS 'STAKE_FORFEIT';

-- CallType: add SEASON_CLOSE (missing from init; already in schema), ARMING_CHASE
ALTER TYPE "CallType" ADD VALUE IF NOT EXISTS 'SEASON_CLOSE';
ALTER TYPE "CallType" ADD VALUE IF NOT EXISTS 'ARMING_CHASE';

-- ============================================
-- 3. Alter users table — stake config fields
-- ============================================

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "stakeWeeklyAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "forfeitMode"       "ForfeitMode" NOT NULL DEFAULT 'MIDDLE',
  ADD COLUMN IF NOT EXISTS "dislikedCharityId" TEXT,
  ADD COLUMN IF NOT EXISTS "armingWindowStart" TEXT,
  ADD COLUMN IF NOT EXISTS "armingWindowEnd"   TEXT,
  -- Phase 3: arming-chase opt-in (§5b-i, §9 d4b) + morning-call opt-in (VN is the default; live morning call is opt-in only, §1c)
  ADD COLUMN IF NOT EXISTS "armingChaseEnabled"  BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "chaseCallsThisMonth" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "chaseCapMonthStart"  TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "morningCallOptIn"    BOOLEAN NOT NULL DEFAULT false;

-- FK: dislikedCharity → charities
ALTER TABLE "users"
  ADD CONSTRAINT "users_dislikedCharityId_fkey"
  FOREIGN KEY ("dislikedCharityId") REFERENCES "charities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 4. Alter charities table — isHouseDefault flag
-- ============================================

ALTER TABLE "charities"
  ADD COLUMN IF NOT EXISTS "isHouseDefault" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "charities_isHouseDefault_idx" ON "charities"("isHouseDefault");

-- ============================================
-- 5. Create stake_cycles table
-- ============================================

CREATE TABLE "stake_cycles" (
    "id"                   TEXT NOT NULL,
    "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"            TIMESTAMP(3) NOT NULL,
    "userId"               TEXT NOT NULL,
    "periodStart"          TIMESTAMP(3) NOT NULL,
    "periodEnd"            TIMESTAMP(3) NOT NULL,
    "stakeAmount"          DECIMAL(10,2) NOT NULL,
    "stripePaymentIntentId" TEXT,
    "capturedAmount"       DECIMAL(10,2) NOT NULL DEFAULT 0,
    "status"               "StakeCycleStatus" NOT NULL DEFAULT 'AUTHORIZED',
    "daysArmed"            INTEGER NOT NULL DEFAULT 0,
    "daysCompleted"        INTEGER NOT NULL DEFAULT 0,
    "daysForfeited"        INTEGER NOT NULL DEFAULT 0,
    "graceUsed"            INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "stake_cycles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "stake_cycles_stripePaymentIntentId_key"
  ON "stake_cycles"("stripePaymentIntentId")
  WHERE "stripePaymentIntentId" IS NOT NULL;

CREATE INDEX "stake_cycles_userId_periodStart_idx" ON "stake_cycles"("userId", "periodStart");
CREATE INDEX "stake_cycles_status_idx" ON "stake_cycles"("status");

ALTER TABLE "stake_cycles"
  ADD CONSTRAINT "stake_cycles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ============================================
-- 6. Create voice_notes table
-- ============================================

CREATE TABLE "voice_notes" (
    "id"             TEXT NOT NULL,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId"         TEXT NOT NULL,
    "workoutId"      TEXT,
    "audioUrl"       TEXT,
    "telegramFileId" TEXT,
    "transcript"     TEXT,
    "recordedAt"     TIMESTAMP(3) NOT NULL,
    "durationSec"    INTEGER,

    CONSTRAINT "voice_notes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "voice_notes_userId_recordedAt_idx" ON "voice_notes"("userId", "recordedAt");
CREATE INDEX "voice_notes_workoutId_idx" ON "voice_notes"("workoutId");

ALTER TABLE "voice_notes"
  ADD CONSTRAINT "voice_notes_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "voice_notes"
  ADD CONSTRAINT "voice_notes_workoutId_fkey"
  FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 7. Alter workouts table — stake + arming fields
-- ============================================

ALTER TABLE "workouts"
  ADD COLUMN IF NOT EXISTS "armedAt"          TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "voiceNoteId"      TEXT,
  ADD COLUMN IF NOT EXISTS "stakeCycleId"     TEXT,
  ADD COLUMN IF NOT EXISTS "stakeSliceAmount" DECIMAL(10,2),
  ADD COLUMN IF NOT EXISTS "sliceOutcome"     "SliceOutcome" NOT NULL DEFAULT 'PENDING';

-- voiceNoteId is 1:1 (one canonical VN per workout day)
CREATE UNIQUE INDEX "workouts_voiceNoteId_key"
  ON "workouts"("voiceNoteId")
  WHERE "voiceNoteId" IS NOT NULL;

CREATE INDEX "workouts_stakeCycleId_idx" ON "workouts"("stakeCycleId");

ALTER TABLE "workouts"
  ADD CONSTRAINT "workouts_voiceNoteId_fkey"
  FOREIGN KEY ("voiceNoteId") REFERENCES "voice_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "workouts"
  ADD CONSTRAINT "workouts_stakeCycleId_fkey"
  FOREIGN KEY ("stakeCycleId") REFERENCES "stake_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 8. Alter donations table — source + stakeCycleId
-- ============================================

ALTER TABLE "donations"
  ADD COLUMN IF NOT EXISTS "source"       "DonationSource",
  ADD COLUMN IF NOT EXISTS "stakeCycleId" TEXT;

CREATE INDEX "donations_stakeCycleId_idx" ON "donations"("stakeCycleId");

ALTER TABLE "donations"
  ADD CONSTRAINT "donations_stakeCycleId_fkey"
  FOREIGN KEY ("stakeCycleId") REFERENCES "stake_cycles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ============================================
-- 9. Rename existing users → charities FK for clarity
--    (The original "users_preferredCharityId_fkey" remains; we add the disliked one above.)
--    No rename needed — existing FK name is fine.
-- ============================================

-- ============================================
-- 10. Phase 4b — Stake × Circles fusion
--     product-pricing-rework.md §4b
-- ============================================

-- 10a. Witnessed stakes (§4b mechanic 1): opt-in visibility flag on IvyCircleMember.
--      Pure read/visibility — no money movement.

ALTER TABLE "ivy_circle_members"
  ADD COLUMN IF NOT EXISTS "shareStakeWithCircle" BOOLEAN NOT NULL DEFAULT false;

-- 10b. Collective charity goal (§4b mechanic 2): shared cause + hit timestamp on CircleSprintGoal.
--      Coordination/flagging only — no donation fired here.
--      TODO(phase6): wire STAKE_SUCCESS donations once corporate layer is live.

ALTER TABLE "circle_sprint_goals"
  ADD COLUMN IF NOT EXISTS "collectiveCharityGoalId" TEXT,
  ADD COLUMN IF NOT EXISTS "collectiveGoalHitAt"     TIMESTAMP(3);

ALTER TABLE "circle_sprint_goals"
  ADD CONSTRAINT "circle_sprint_goals_collectiveCharityGoalId_fkey"
  FOREIGN KEY ("collectiveCharityGoalId") REFERENCES "charities"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX IF NOT EXISTS "circle_sprint_goals_collectiveCharityGoalId_idx"
  ON "circle_sprint_goals"("collectiveCharityGoalId");

-- 10c. Baton-stake (§4b mechanic 3): no new table columns needed.
--      The baton_stake_multiplier is stored in CircleGame.rules (JSON, already exists).
--      The elevated stakeSliceAmount is stored in Workout.stakeSliceAmount (already added above §7).
--      On drop: the elevated slice forfeits to THE HOLDER'S OWN destination via settleStakeCycle.
--      GUARDRAIL: forfeited stakes NEVER credited to or transferred to another user.
