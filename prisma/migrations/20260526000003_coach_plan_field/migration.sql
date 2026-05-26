-- Add coachPlan to coach_profiles so seat limits can be enforced per-plan
ALTER TABLE "coach_profiles" ADD COLUMN "coachPlan" TEXT;
