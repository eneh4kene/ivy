-- Reconcile drift between schema.prisma and the live database.
--
-- Found after discovering that `prisma migrate deploy` had never run on Fly
-- (fly.toml's [processes] block overrode the Dockerfile CMD). All 28 migrations
-- were applied by some other route, and the ledger is clean — but the SCHEMA
-- had drifted, which a clean ledger does not prove.
--
-- The dangerous half: two UNIQUE constraints the schema declares and the
-- database did not enforce. The code believed both existed.
--
--   stake_cycles.stripePaymentIntentId  — the manual-capture PaymentIntent.
--     Without the constraint a retried or concurrent Stripe webhook can open
--     two cycles against one payment intent, and Prisma's upsert on this field
--     stops being atomic. This is the money path.
--
--   workouts.voiceNoteId — the 1:1 arming link. Without it one voice note can
--     arm two workouts, which is a day counted twice.
--
-- Verified before writing: zero duplicate values in either column, so these
-- cannot fail on the way in. Both tables are effectively empty, which makes
-- this the cheapest moment this fix will ever be available.
CREATE UNIQUE INDEX IF NOT EXISTS "stake_cycles_stripePaymentIntentId_key"
  ON "stake_cycles"("stripePaymentIntentId");

CREATE UNIQUE INDEX IF NOT EXISTS "workouts_voiceNoteId_key"
  ON "workouts"("voiceNoteId");

-- The other half: two indexes the database had and the schema did not declare.
-- A drift check wanted to DROP them, which would have been a silent performance
-- regression — users are queried by coachId constantly (client rosters, the
-- scheduler), and Postgres does not index foreign keys automatically. They are
-- declared in schema.prisma now instead, and created here so a database built
-- from migrations alone matches production rather than quietly lacking them.
CREATE INDEX IF NOT EXISTS "users_coachId_idx" ON "users"("coachId");

CREATE INDEX IF NOT EXISTS "circle_sprint_goals_collectiveCharityGoalId_idx"
  ON "circle_sprint_goals"("collectiveCharityGoalId");
