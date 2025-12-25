/*
  Warnings:

  - Added the required column `updatedAt` to the `Payout` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PayoutMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TransactionEventType" AS ENUM ('PAYMENT_CREATED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'REFUND_CREATED', 'REFUND_SUCCEEDED', 'REFUND_FAILED', 'PAYOUT_CREATED', 'PAYOUT_PAID', 'PAYOUT_FAILED', 'TRANSFER_CREATED', 'TRANSFER_SUCCEEDED', 'TRANSFER_FAILED', 'WEBHOOK_RECEIVED', 'DISPUTE_CREATED', 'DISPUTE_UPDATED', 'DISPUTE_CLOSED');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PAYMENT', 'PAYOUT', 'REFUND', 'DISPUTE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('WARNING_NEEDS_RESPONSE', 'WARNING_UNDER_REVIEW', 'WARNING_CLOSED', 'NEEDS_RESPONSE', 'UNDER_REVIEW', 'CHARGE_REFUNDED', 'WON', 'LOST');

-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "payoutBlocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payoutBlockedReason" TEXT;

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "disputeStatus" TEXT,
ADD COLUMN     "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "failureReason" TEXT,
ADD COLUMN     "retriedCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "platformFeePercentage" DECIMAL(5,2) NOT NULL,
    "platformFeeFixed" DECIMAL(10,2),
    "minimumPayoutAmount" DECIMAL(10,2) NOT NULL,
    "holdingPeriodDays" INTEGER NOT NULL,
    "payoutMode" "PayoutMode" NOT NULL DEFAULT 'AUTOMATIC',
    "payoutFrequencyOptions" TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLog" (
    "id" TEXT NOT NULL,
    "eventType" "TransactionEventType" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "amount" DECIMAL(10,2),
    "currency" TEXT,
    "status" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT,
    "payoutId" TEXT,
    "refundId" TEXT,

    CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "stripeRefundId" TEXT,
    "initiatedById" TEXT NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL,
    "evidenceDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutScheduleNew" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "mode" "PayoutMode" NOT NULL DEFAULT 'AUTOMATIC',
    "frequency" "PayoutFrequency" NOT NULL DEFAULT 'WEEKLY',
    "nextPayoutDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutScheduleNew_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TransactionLog_eventType_idx" ON "TransactionLog"("eventType");

-- CreateIndex
CREATE INDEX "TransactionLog_entityType_idx" ON "TransactionLog"("entityType");

-- CreateIndex
CREATE INDEX "TransactionLog_entityId_idx" ON "TransactionLog"("entityId");

-- CreateIndex
CREATE INDEX "TransactionLog_createdAt_idx" ON "TransactionLog"("createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_stripeEventId_idx" ON "TransactionLog"("stripeEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_stripeRefundId_idx" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_stripeDisputeId_key" ON "Dispute"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "Dispute_paymentId_idx" ON "Dispute"("paymentId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_stripeDisputeId_idx" ON "Dispute"("stripeDisputeId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutScheduleNew_creatorId_key" ON "PayoutScheduleNew"("creatorId");

-- CreateIndex
CREATE INDEX "PayoutScheduleNew_creatorId_idx" ON "PayoutScheduleNew"("creatorId");

-- CreateIndex
CREATE INDEX "PayoutScheduleNew_nextPayoutDate_idx" ON "PayoutScheduleNew"("nextPayoutDate");

-- CreateIndex
CREATE INDEX "PayoutScheduleNew_isActive_idx" ON "PayoutScheduleNew"("isActive");

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutScheduleNew" ADD CONSTRAINT "PayoutScheduleNew_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
