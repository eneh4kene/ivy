-- Coach-scoped circles: auto-formed at 5+ active clients, coach observes via
-- the console pulse and is never a member.
ALTER TABLE "ivy_circles" ADD COLUMN "coachId" TEXT;
ALTER TABLE "ivy_circles" ADD CONSTRAINT "ivy_circles_coachId_fkey"
  FOREIGN KEY ("coachId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "ivy_circles_coachId_idx" ON "ivy_circles"("coachId");
