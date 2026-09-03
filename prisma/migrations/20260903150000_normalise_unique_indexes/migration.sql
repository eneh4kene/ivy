-- Normalise two unique indexes from PARTIAL to plain.
--
-- Correction to the previous migration's reasoning: these constraints were
-- never missing. They exist as
--
--   CREATE UNIQUE INDEX ... ("col") WHERE ("col" IS NOT NULL)
--
-- which enforces exactly what a plain unique index on a nullable column
-- enforces — Postgres never treats two NULLs as equal, so the WHERE clause
-- excludes rows the index would have ignored anyway. Uniqueness on
-- stake_cycles.stripePaymentIntentId and workouts.voiceNoteId has been real
-- all along, and `CREATE UNIQUE INDEX IF NOT EXISTS` correctly skipped them.
--
-- This change is therefore COSMETIC. It is worth making only because a drift
-- check that always prints two false alarms is a drift check nobody reads, and
-- the entire point of fixing the release_command was to be able to trust it.
--
-- Safe to drop and recreate: both tables are empty (0 stake cycles, 0 workouts
-- with a voiceNoteId), so there is no window in which uniqueness goes
-- unenforced over real rows, and no chance of the recreate failing.
DROP INDEX IF EXISTS "stake_cycles_stripePaymentIntentId_key";
CREATE UNIQUE INDEX "stake_cycles_stripePaymentIntentId_key"
  ON "stake_cycles"("stripePaymentIntentId");

DROP INDEX IF EXISTS "workouts_voiceNoteId_key";
CREATE UNIQUE INDEX "workouts_voiceNoteId_key"
  ON "workouts"("voiceNoteId");
