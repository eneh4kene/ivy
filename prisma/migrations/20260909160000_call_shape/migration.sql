-- Which shape each call was given, so the variety governor has a memory.
-- Variety is only variety relative to history; without a record the picker
-- would repeat itself by chance and nobody could tell why.
ALTER TABLE "calls" ADD COLUMN "shape" TEXT;
