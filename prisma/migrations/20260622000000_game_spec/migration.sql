-- Declarative GameSpec for Circle games (src/services/games/gamespec.ts).
-- Additive + nullable: existing games (spec IS NULL) keep using the legacy
-- templateType/rules processor; games with a spec run on the generic interpreter.
ALTER TABLE "circle_games" ADD COLUMN "spec" JSONB;
