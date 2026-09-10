-- When a client's floor was last set or confirmed.
--
-- A floor set once and never revisited quietly stops describing the person:
-- "10k steps" chosen while a client is nursing a knee is the wrong number six
-- months later when the knee is fine. This exists so Ivy can ASK whether it
-- still holds on a ponder call — never to expire it automatically, because a
-- floor vanishing on a timer is worse than a slightly stale one.
ALTER TABLE "users" ADD COLUMN "coachMinimumSetAt" TIMESTAMP(3);
