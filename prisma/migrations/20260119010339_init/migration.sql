-- CreateEnum
CREATE TYPE "SubscriptionTier" AS ENUM ('FREE', 'PRO', 'ELITE', 'CONCIERGE', 'B2B');

-- CreateEnum
CREATE TYPE "WorkoutStatus" AS ENUM ('PLANNED', 'COMPLETED', 'PARTIAL', 'SKIPPED', 'MISSED');

-- CreateEnum
CREATE TYPE "CallType" AS ENUM ('MORNING_PLANNING', 'EVENING_REVIEW', 'RESCUE', 'WEEKLY_PLANNING', 'MONTHLY_CHECKIN', 'ONBOARDING');

-- CreateEnum
CREATE TYPE "CallStatus" AS ENUM ('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'NO_ANSWER', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DonationType" AS ENUM ('COMPLETION', 'STREAK_7_DAY', 'STREAK_30_DAY', 'STREAK_90_DAY', 'MANUAL');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('SMS', 'WHATSAPP', 'EMAIL');

-- CreateEnum
CREATE TYPE "MessageDirection" AS ENUM ('INBOUND', 'OUTBOUND');

-- CreateEnum
CREATE TYPE "MessageStatus" AS ENUM ('SENT', 'DELIVERED', 'READ', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Europe/London',
    "profileImage" TEXT,
    "subscriptionTier" "SubscriptionTier" NOT NULL DEFAULT 'FREE',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'active',
    "stripeCustomerId" TEXT,
    "companyId" TEXT,
    "morningCallTime" TEXT,
    "eveningCallTime" TEXT,
    "callFrequency" INTEGER NOT NULL DEFAULT 2,
    "preferredDays" TEXT,
    "track" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "minimumMode" TEXT,
    "giftFrame" TEXT,
    "preferredCharityId" TEXT,
    "googleCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "googleCalendarRefreshToken" TEXT,
    "outlookCalendarConnected" BOOLEAN NOT NULL DEFAULT false,
    "outlookCalendarRefreshToken" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "onboardedAt" TIMESTAMP(3),
    "lastCallAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "companies" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactName" TEXT NOT NULL,
    "stripeCustomerId" TEXT,
    "currentSeason" INTEGER NOT NULL DEFAULT 1,
    "seasonStartDate" TIMESTAMP(3),
    "seasonEndDate" TIMESTAMP(3),
    "seasonDuration" INTEGER NOT NULL DEFAULT 8,
    "platformFeePerUser" DECIMAL(65,30) NOT NULL DEFAULT 15.00,
    "impactWalletPerUser" DECIMAL(65,30) NOT NULL DEFAULT 25.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "companies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "charities" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "impactMetric" TEXT NOT NULL,
    "impactPerPound" TEXT NOT NULL,
    "logoUrl" TEXT,
    "website" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "charities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workouts" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "plannedDate" TIMESTAMP(3) NOT NULL,
    "plannedTime" TEXT,
    "activity" TEXT NOT NULL,
    "duration" INTEGER,
    "status" "WorkoutStatus" NOT NULL DEFAULT 'PLANNED',
    "completedAt" TIMESTAMP(3),
    "skippedReason" TEXT,
    "isMinimum" BOOLEAN NOT NULL DEFAULT false,
    "planningCallId" TEXT,
    "reviewCallId" TEXT,

    CONSTRAINT "workouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "calls" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "callType" "CallType" NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "startedAt" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "status" "CallStatus" NOT NULL DEFAULT 'SCHEDULED',
    "retellCallId" TEXT,
    "transcript" TEXT,
    "recordingUrl" TEXT,
    "outcome" TEXT,
    "sentiment" TEXT,
    "needsFollowUp" BOOLEAN NOT NULL DEFAULT false,
    "contextSnapshot" JSONB,

    CONSTRAINT "calls_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "donations" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "charityId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'GBP',
    "donationType" "DonationType" NOT NULL,
    "workoutId" TEXT,
    "streakDays" INTEGER,

    CONSTRAINT "donations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "impact_wallets" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "monthlyLimit" DECIMAL(10,2) NOT NULL,
    "dailyCap" DECIMAL(10,2) NOT NULL,
    "currentMonthSpent" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "monthStartDate" TIMESTAMP(3) NOT NULL,
    "lifetimeDonated" DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT "impact_wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "streaks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "currentStreak" INTEGER NOT NULL DEFAULT 0,
    "currentStreakStart" TIMESTAMP(3),
    "longestStreak" INTEGER NOT NULL DEFAULT 0,
    "longestStreakStart" TIMESTAMP(3),
    "longestStreakEnd" TIMESTAMP(3),
    "lastWorkoutDate" TIMESTAMP(3),
    "bonus7DayClaimed" BOOLEAN NOT NULL DEFAULT false,
    "bonus30DayClaimed" BOOLEAN NOT NULL DEFAULT false,
    "bonus90DayClaimed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "streaks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transformation_scores" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "energyScore" INTEGER,
    "moodScore" INTEGER,
    "healthConfidence" INTEGER,
    "weekNumber" INTEGER NOT NULL,
    "notes" TEXT,

    CONSTRAINT "transformation_scores_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "life_markers" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "marker" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "significance" TEXT NOT NULL,

    CONSTRAINT "life_markers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" "MessageDirection" NOT NULL,
    "content" TEXT NOT NULL,
    "status" "MessageStatus" NOT NULL DEFAULT 'SENT',
    "twilioSid" TEXT,
    "whatsappId" TEXT,
    "messageType" TEXT,
    "relatedCallId" TEXT,

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ivy_circles" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "size" INTEGER NOT NULL DEFAULT 0,
    "maxSize" INTEGER NOT NULL DEFAULT 12,
    "isActive" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "ivy_circles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ivy_circle_members" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "circleId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',

    CONSTRAINT "ivy_circle_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_stripeCustomerId_key" ON "users"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_companyId_idx" ON "users"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "companies_stripeCustomerId_key" ON "companies"("stripeCustomerId");

-- CreateIndex
CREATE INDEX "companies_name_idx" ON "companies"("name");

-- CreateIndex
CREATE INDEX "charities_category_idx" ON "charities"("category");

-- CreateIndex
CREATE INDEX "workouts_userId_plannedDate_idx" ON "workouts"("userId", "plannedDate");

-- CreateIndex
CREATE INDEX "workouts_status_idx" ON "workouts"("status");

-- CreateIndex
CREATE UNIQUE INDEX "calls_retellCallId_key" ON "calls"("retellCallId");

-- CreateIndex
CREATE INDEX "calls_userId_scheduledAt_idx" ON "calls"("userId", "scheduledAt");

-- CreateIndex
CREATE INDEX "calls_callType_status_idx" ON "calls"("callType", "status");

-- CreateIndex
CREATE INDEX "calls_retellCallId_idx" ON "calls"("retellCallId");

-- CreateIndex
CREATE INDEX "donations_userId_createdAt_idx" ON "donations"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "donations_charityId_idx" ON "donations"("charityId");

-- CreateIndex
CREATE UNIQUE INDEX "impact_wallets_userId_key" ON "impact_wallets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "streaks_userId_key" ON "streaks"("userId");

-- CreateIndex
CREATE INDEX "transformation_scores_userId_createdAt_idx" ON "transformation_scores"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "life_markers_userId_createdAt_idx" ON "life_markers"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "messages_twilioSid_key" ON "messages"("twilioSid");

-- CreateIndex
CREATE UNIQUE INDEX "messages_whatsappId_key" ON "messages"("whatsappId");

-- CreateIndex
CREATE INDEX "messages_userId_createdAt_idx" ON "messages"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "messages_channel_status_idx" ON "messages"("channel", "status");

-- CreateIndex
CREATE INDEX "ivy_circles_companyId_idx" ON "ivy_circles"("companyId");

-- CreateIndex
CREATE INDEX "ivy_circle_members_userId_idx" ON "ivy_circle_members"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ivy_circle_members_circleId_userId_key" ON "ivy_circle_members"("circleId", "userId");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_preferredCharityId_fkey" FOREIGN KEY ("preferredCharityId") REFERENCES "charities"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "calls" ADD CONSTRAINT "calls_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "donations" ADD CONSTRAINT "donations_charityId_fkey" FOREIGN KEY ("charityId") REFERENCES "charities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "impact_wallets" ADD CONSTRAINT "impact_wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "streaks" ADD CONSTRAINT "streaks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transformation_scores" ADD CONSTRAINT "transformation_scores_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "life_markers" ADD CONSTRAINT "life_markers_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivy_circles" ADD CONSTRAINT "ivy_circles_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivy_circle_members" ADD CONSTRAINT "ivy_circle_members_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "ivy_circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ivy_circle_members" ADD CONSTRAINT "ivy_circle_members_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
