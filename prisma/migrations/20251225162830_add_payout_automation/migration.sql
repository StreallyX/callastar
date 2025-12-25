-- CreateEnum
CREATE TYPE "PayoutSchedule" AS ENUM ('DAILY', 'WEEKLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayoutAction" AS ENUM ('TRIGGERED', 'BLOCKED', 'UNBLOCKED', 'COMPLETED', 'FAILED');

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "payoutSchedule" "PayoutSchedule" NOT NULL DEFAULT 'WEEKLY',
ADD COLUMN     "payoutMinimum" DECIMAL(10,2) NOT NULL DEFAULT 10,
ADD COLUMN     "isPayoutBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payoutBlockReason" TEXT;

-- CreateTable
CREATE TABLE "PayoutAuditLog" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "action" "PayoutAction" NOT NULL,
    "amount" DECIMAL(10,2),
    "status" "PayoutStatus",
    "stripePayoutId" TEXT,
    "adminId" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Creator_isPayoutBlocked_idx" ON "Creator"("isPayoutBlocked");

-- CreateIndex
CREATE INDEX "PayoutAuditLog_creatorId_idx" ON "PayoutAuditLog"("creatorId");

-- CreateIndex
CREATE INDEX "PayoutAuditLog_action_idx" ON "PayoutAuditLog"("action");

-- CreateIndex
CREATE INDEX "PayoutAuditLog_createdAt_idx" ON "PayoutAuditLog"("createdAt");

-- AddForeignKey
ALTER TABLE "PayoutAuditLog" ADD CONSTRAINT "PayoutAuditLog_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
