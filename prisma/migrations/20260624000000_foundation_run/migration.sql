-- Foundation Run: a new user's first stake cycle is a flat low starter stake
-- over a shorter-than-weekly window. daysInCycle drives per-day slice math so
-- slices sum to the held amount even when the cycle is <7 days.
ALTER TABLE "stake_cycles" ADD COLUMN "isFoundation" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "stake_cycles" ADD COLUMN "daysInCycle" INTEGER NOT NULL DEFAULT 7;
