-- AlterEnum
ALTER TYPE "MessageStatus" ADD VALUE 'PENDING';

-- CreateTable
CREATE TABLE "ops_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "severity" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "detail" TEXT,
    "userId" TEXT,
    "entityType" TEXT,
    "entityId" TEXT,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "ops_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_heartbeats" (
    "jobName" TEXT NOT NULL,
    "lastStartedAt" TIMESTAMP(3) NOT NULL,
    "lastFinishedAt" TIMESTAMP(3),
    "lastStatus" TEXT NOT NULL DEFAULT 'RUNNING',
    "lastError" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_heartbeats_pkey" PRIMARY KEY ("jobName")
);

-- CreateIndex
CREATE INDEX "ops_events_createdAt_idx" ON "ops_events"("createdAt");

-- CreateIndex
CREATE INDEX "ops_events_severity_createdAt_idx" ON "ops_events"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "ops_events_source_title_createdAt_idx" ON "ops_events"("source", "title", "createdAt");

