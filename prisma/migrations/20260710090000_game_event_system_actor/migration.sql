-- System-fired game events (timer ticks, deadline passes) have no human actor.
ALTER TABLE "circle_game_events" ALTER COLUMN "userId" DROP NOT NULL;
