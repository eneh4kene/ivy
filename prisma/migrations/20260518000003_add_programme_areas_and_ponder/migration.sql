-- Add programmeAreas to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "programmeAreas" JSONB;

-- Add ponder fields to coach_profiles
ALTER TABLE "coach_profiles" ADD COLUMN IF NOT EXISTS "ponderCallEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "coach_profiles" ADD COLUMN IF NOT EXISTS "ponderCallDay" INTEGER;
ALTER TABLE "coach_profiles" ADD COLUMN IF NOT EXISTS "ponderCallTime" TEXT;

-- Add COACH_PONDER to CallType enum
ALTER TYPE "CallType" ADD VALUE IF NOT EXISTS 'COACH_PONDER';
