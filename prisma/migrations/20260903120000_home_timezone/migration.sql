-- Where a member normally is, remembered only while they are away from it.
--
-- `timezone` is where they are NOW and drives every call time. Travel used to
-- be a one-way door: "landed in Denver" moved them, and "I'm back home" had
-- nothing to resolve to, so they stayed on Denver time indefinitely.
--
-- Set when a member is first moved away; cleared when they return. NULL is the
-- normal state and means "they are home".
ALTER TABLE "users" ADD COLUMN "home_timezone" TEXT;
