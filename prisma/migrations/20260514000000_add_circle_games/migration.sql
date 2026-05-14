-- CreateTable: circle_games
CREATE TABLE "circle_games" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "circleId" TEXT NOT NULL,
    "sprintId" TEXT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "templateType" TEXT NOT NULL DEFAULT 'custom',
    "rules" JSONB NOT NULL DEFAULT '{}',
    "ivyInstruction" TEXT NOT NULL,
    "state" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'active',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "circle_games_pkey" PRIMARY KEY ("id")
);

-- CreateTable: circle_game_events
CREATE TABLE "circle_game_events" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "gameId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,

    CONSTRAINT "circle_game_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "circle_games_circleId_status_idx" ON "circle_games"("circleId", "status");
CREATE INDEX "circle_games_sprintId_idx" ON "circle_games"("sprintId");
CREATE INDEX "circle_game_events_gameId_createdAt_idx" ON "circle_game_events"("gameId", "createdAt");
CREATE INDEX "circle_game_events_userId_idx" ON "circle_game_events"("userId");

-- AddForeignKey
ALTER TABLE "circle_games" ADD CONSTRAINT "circle_games_circleId_fkey" FOREIGN KEY ("circleId") REFERENCES "ivy_circles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "circle_games" ADD CONSTRAINT "circle_games_sprintId_fkey" FOREIGN KEY ("sprintId") REFERENCES "sprints"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "circle_game_events" ADD CONSTRAINT "circle_game_events_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "circle_games"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "circle_game_events" ADD CONSTRAINT "circle_game_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
