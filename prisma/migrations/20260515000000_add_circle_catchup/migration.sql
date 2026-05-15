CREATE TABLE "circle_catchups" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "sprintNumber" INTEGER NOT NULL,
    "collectivePledge" TEXT NOT NULL,
    "highlights" TEXT,
    "coveredAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "circle_catchups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "circle_catchups_userId_sessionId_key" ON "circle_catchups"("userId", "sessionId");
CREATE INDEX "circle_catchups_userId_coveredAt_idx" ON "circle_catchups"("userId", "coveredAt");

ALTER TABLE "circle_catchups" ADD CONSTRAINT "circle_catchups_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "circle_catchups" ADD CONSTRAINT "circle_catchups_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "circle_sprint_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
