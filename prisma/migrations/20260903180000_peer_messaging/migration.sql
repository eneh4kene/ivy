-- Pair-to-pair messaging, with the moderation primitives that must ship with it.
-- Before this, every message in the system was Ivy <-> user: there was no
-- member-to-member write path at all, and so no block, report or mute either.

CREATE TABLE "peer_messages" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fromUserId" TEXT NOT NULL,
    "toUserId" TEXT NOT NULL,
    "gameId" TEXT,
    "content" TEXT NOT NULL,
    "deliveredMessageId" TEXT,

    CONSTRAINT "peer_messages_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member_blocks" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "blockerId" TEXT NOT NULL,
    "blockedId" TEXT NOT NULL,

    CONSTRAINT "member_blocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "member_reports" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reporterId" TEXT NOT NULL,
    "reportedId" TEXT NOT NULL,
    "peerMessageId" TEXT,
    "reason" TEXT NOT NULL,
    "reviewedAt" TIMESTAMP(3),

    CONSTRAINT "member_reports_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "peer_messages_toUserId_createdAt_idx" ON "peer_messages"("toUserId", "createdAt");
CREATE INDEX "peer_messages_fromUserId_createdAt_idx" ON "peer_messages"("fromUserId", "createdAt");
CREATE UNIQUE INDEX "member_blocks_blockerId_blockedId_key" ON "member_blocks"("blockerId", "blockedId");
CREATE INDEX "member_blocks_blockedId_idx" ON "member_blocks"("blockedId");
CREATE INDEX "member_reports_reportedId_createdAt_idx" ON "member_reports"("reportedId", "createdAt");

ALTER TABLE "peer_messages" ADD CONSTRAINT "peer_messages_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "peer_messages" ADD CONSTRAINT "peer_messages_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_blocks" ADD CONSTRAINT "member_blocks_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_blocks" ADD CONSTRAINT "member_blocks_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_reports" ADD CONSTRAINT "member_reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "member_reports" ADD CONSTRAINT "member_reports_reportedId_fkey" FOREIGN KEY ("reportedId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
