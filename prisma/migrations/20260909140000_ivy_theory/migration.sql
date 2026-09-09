-- A hypothesis Ivy holds about someone, in her own voice.
--
-- Everything else she remembers is a fact about THEM. This is the only thing in
-- the system that is hers: something she worked out, might be wrong about, and
-- returns to. The status lifecycle is the feature — a theory that cannot be
-- revisited or dropped is just another note.

CREATE TABLE "ivy_theories" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT NOT NULL,
    "callId" TEXT,
    "content" TEXT NOT NULL,
    "basis" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "raisedCount" INTEGER NOT NULL DEFAULT 0,
    "lastRaisedAt" TIMESTAMP(3),
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ivy_theories_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ivy_theories_userId_status_createdAt_idx" ON "ivy_theories"("userId", "status", "createdAt");

ALTER TABLE "ivy_theories" ADD CONSTRAINT "ivy_theories_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
