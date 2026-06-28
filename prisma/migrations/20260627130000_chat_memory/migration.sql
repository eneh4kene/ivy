-- Chat-derived long-term memory: let CallMemory hold memories that came from the
-- in-app chat (no originating call), and track which chat messages have been
-- distilled so the daily extraction job is idempotent.

-- CallMemory.callId becomes nullable; chat memories carry callId = NULL.
ALTER TABLE "call_memories" ALTER COLUMN "callId" DROP NOT NULL;

-- Provenance: 'call' (default, existing rows) or 'chat'.
ALTER TABLE "call_memories" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'call';

-- Marks an IN_APP message as already distilled into long-term memory.
ALTER TABLE "messages" ADD COLUMN "memoryExtractedAt" TIMESTAMP(3);
