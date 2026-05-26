-- Coach relationship gaps: consent, timestamps, self-leave

-- Pending invite: coach inviting an existing user waits for their acceptance
ALTER TABLE "users" ADD COLUMN "pendingCoachId" TEXT;

-- When the user accepted (or was created by) the coach
ALTER TABLE "users" ADD COLUMN "coachLinkedAt" TIMESTAMP(3);

-- Self-referential FK for pendingCoachId
ALTER TABLE "users" ADD CONSTRAINT "users_pendingCoachId_fkey"
  FOREIGN KEY ("pendingCoachId") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
