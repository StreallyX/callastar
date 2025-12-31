-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('EMAIL_SENT', 'EMAIL_ERROR', 'CRON_RUN', 'CRON_ERROR', 'DAILY_ROOM_DELETED', 'DAILY_ROOM_ERROR', 'BOOKING_CREATED', 'BOOKING_ERROR', 'PAYMENT_SUCCESS', 'PAYMENT_ERROR', 'PAYMENT_REFUND', 'PAYOUT_SUCCESS', 'PAYOUT_ERROR', 'STRIPE_WEBHOOK', 'STRIPE_WEBHOOK_ERROR', 'DAILY_ROOM_CREATED', 'NOTIFICATION_SENT', 'NOTIFICATION_ERROR', 'SYSTEM_ERROR', 'API_ERROR');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('SUCCESS', 'ERROR');

-- AlterTable
ALTER TABLE "Log" DROP COLUMN IF EXISTS "level",
DROP COLUMN IF EXISTS "actor",
DROP COLUMN IF EXISTS "actorId",
DROP COLUMN IF EXISTS "metadata",
ADD COLUMN "type" "LogType" NOT NULL DEFAULT 'SYSTEM_ERROR',
ADD COLUMN "status" "LogStatus" NOT NULL DEFAULT 'ERROR',
ADD COLUMN "context" JSONB,
ADD COLUMN "error" TEXT;

-- Update existing type column if it exists and is string
-- This handles migration from old schema where type was a String
ALTER TABLE "Log" ALTER COLUMN "type" DROP DEFAULT;

-- DropIndex
DROP INDEX IF EXISTS "Log_level_idx";
DROP INDEX IF EXISTS "Log_actor_idx";
DROP INDEX IF EXISTS "Log_actorId_idx";
DROP INDEX IF EXISTS "Log_level_createdAt_idx";

-- CreateIndex
CREATE INDEX "Log_type_idx" ON "Log"("type");

-- CreateIndex
CREATE INDEX "Log_status_idx" ON "Log"("status");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE INDEX "Log_type_status_idx" ON "Log"("type", "status");

-- CreateIndex
CREATE INDEX "Log_type_createdAt_idx" ON "Log"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Log_status_createdAt_idx" ON "Log"("status", "createdAt");
