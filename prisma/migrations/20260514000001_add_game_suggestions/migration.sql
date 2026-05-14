-- Add role field to users
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'user';

-- CreateTable: game_suggestions
CREATE TABLE "game_suggestions" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "templateType" TEXT NOT NULL DEFAULT 'custom',
    "ivyInstruction" TEXT NOT NULL,
    "tracks" TEXT NOT NULL DEFAULT '[]',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "usageCount" INTEGER NOT NULL DEFAULT 0,
    "createdByEmail" TEXT,

    CONSTRAINT "game_suggestions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "game_suggestions_published_idx" ON "game_suggestions"("published");
