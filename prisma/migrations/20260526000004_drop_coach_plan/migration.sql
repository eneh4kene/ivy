-- Remove coachPlan — seat limits abolished, coach plan is now flat rate unlimited clients
ALTER TABLE "coach_profiles" DROP COLUMN IF EXISTS "coachPlan";
