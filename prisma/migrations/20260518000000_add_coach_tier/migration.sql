-- Add COACH to SubscriptionTier enum
ALTER TYPE "SubscriptionTier" ADD VALUE 'COACH';

-- Add coach relationship fields to users
ALTER TABLE "users" ADD COLUMN "coachId" TEXT;
ALTER TABLE "users" ADD COLUMN "coachNotes" TEXT;

ALTER TABLE "users" ADD CONSTRAINT "users_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "users_coachId_idx" ON "users"("coachId");

-- CreateTable: coach_profiles
CREATE TABLE "coach_profiles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "programmeName" TEXT NOT NULL,
    "coachingStyle" TEXT,
    "programmeNotes" TEXT,
    "whitelabelEnabled" BOOLEAN NOT NULL DEFAULT false,
    "brandName" TEXT,
    "brandLogoUrl" TEXT,
    "alertOnMissedCalls" INTEGER NOT NULL DEFAULT 3,
    "weeklyDigestEnabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "coach_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "coach_profiles_userId_key" ON "coach_profiles"("userId");

ALTER TABLE "coach_profiles" ADD CONSTRAINT "coach_profiles_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
