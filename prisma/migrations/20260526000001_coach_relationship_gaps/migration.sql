-- Coach relationship gaps: consent, tier memory, timestamps, self-leave

-- Pending invite: coach inviting an existing user waits for their acceptance
ALTER TABLE "users" ADD COLUMN "pendingCoachId" TEXT;

-- Store the tier the user had before the coach linked them
-- NULL means they were a stub created by the coach (no prior subscription)
ALTER TABLE "users" ADD COLUMN "preCoachTier" TEXT;

-- When the user accepted the coach link
ALTER TABLE "users" ADD COLUMN "coachLinkedAt" TIMESTAMP(3);

-- Self-referential FK for pendingCoachId
ALTER TABLE "users" ADD CONSTRAINT "users_pendingCoachId_fkey"
  FOREIGN KEY ("pendingCoachId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
