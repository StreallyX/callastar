-- AlterEnum
-- Add new statuses to PayoutStatus enum
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'PENDING_APPROVAL';
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "PayoutStatus" ADD VALUE IF NOT EXISTS 'REJECTED';

-- AlterTable
-- Add new columns to Payout table
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "approvedById" TEXT;
ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);
