-- Async circle sessions: members drop one win + one honest struggle while the
-- session is open; sharing unlocks the room.
CREATE TABLE "circle_session_shares" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sessionId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "win" TEXT NOT NULL,
  "struggle" TEXT NOT NULL,
  CONSTRAINT "circle_session_shares_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "circle_session_shares_sessionId_userId_key" ON "circle_session_shares"("sessionId", "userId");
CREATE INDEX "circle_session_shares_userId_idx" ON "circle_session_shares"("userId");
ALTER TABLE "circle_session_shares" ADD CONSTRAINT "circle_session_shares_sessionId_fkey"
  FOREIGN KEY ("sessionId") REFERENCES "circle_sprint_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "circle_session_shares" ADD CONSTRAINT "circle_session_shares_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
