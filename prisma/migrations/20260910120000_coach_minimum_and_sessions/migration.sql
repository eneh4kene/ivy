-- The floor a COACH sets for a client, and the days they actually see them.
--
-- minimumMode already existed but only the member could set it, and a floor you
-- set for yourself is negotiable with yourself at 9pm. coachMinimum is separate
-- rather than a takeover so neither party clobbers the other's value.
--
-- coachSessionDays is a PATTERN, not an appointment: no recurrence, no
-- cancellations, no timezone handling. Ivy must speak about it as the rhythm
-- she believes in, never as a fact about a specific session.
ALTER TABLE "users" ADD COLUMN "coachMinimum" TEXT;
ALTER TABLE "users" ADD COLUMN "coachSessionDays" TEXT;
