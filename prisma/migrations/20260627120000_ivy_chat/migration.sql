-- Ivy in-app chat. Reuses the existing Message model (src/services/chat.service.ts):
--   • IN_APP channel value so chat messages live alongside SMS/Telegram in one log
--     (direction INBOUND = user, OUTBOUND = Ivy).
--   • metadata JSONB for chat action-card payloads (onboarding handoff buttons,
--     call-summary refs). Additive + nullable — no impact on existing rows.

-- AlterEnum
ALTER TYPE "MessageChannel" ADD VALUE 'IN_APP';

-- AlterTable
ALTER TABLE "messages" ADD COLUMN "metadata" JSONB;
