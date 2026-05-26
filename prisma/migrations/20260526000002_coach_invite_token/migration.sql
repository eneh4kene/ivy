-- Shareable coach invite token: coaches share a link, no email address required
ALTER TABLE "coach_profiles" ADD COLUMN "inviteToken" TEXT;
CREATE UNIQUE INDEX "coach_profiles_inviteToken_key" ON "coach_profiles"("inviteToken");
