-- Add Telegram support: chat ID on users, TELEGRAM channel enum value
ALTER TYPE "MessageChannel" ADD VALUE 'TELEGRAM';
ALTER TABLE "users" ADD COLUMN "telegramChatId" TEXT;
CREATE UNIQUE INDEX "users_telegramChatId_key" ON "users"("telegramChatId");
