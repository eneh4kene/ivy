-- Add unique constraint to everyOrgSlug so seed upserts work correctly
-- and to prevent duplicate charity imports from Every.org
CREATE UNIQUE INDEX "charities_everyOrgSlug_key" ON "charities"("everyOrgSlug")
  WHERE "everyOrgSlug" IS NOT NULL;
