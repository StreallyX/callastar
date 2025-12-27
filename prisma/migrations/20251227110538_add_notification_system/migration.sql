/*
  Warnings:

  - You are about to drop the column `isRead` on the `Notification` table. All the data in the column will be lost.

*/
-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PAYMENT_RECEIVED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_APPROVED';
ALTER TYPE "NotificationType" ADD VALUE 'PAYOUT_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'REFUND_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE_CREATED';
ALTER TYPE "NotificationType" ADD VALUE 'DEBT_DEDUCTED';
ALTER TYPE "NotificationType" ADD VALUE 'TRANSFER_FAILED';
ALTER TYPE "NotificationType" ADD VALUE 'DEBT_THRESHOLD_EXCEEDED';

-- DropIndex
DROP INDEX "Notification_isRead_idx";

-- AlterTable
ALTER TABLE "Notification" DROP COLUMN "isRead",
ADD COLUMN     "metadata" JSONB,
ADD COLUMN     "read" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "readAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");
