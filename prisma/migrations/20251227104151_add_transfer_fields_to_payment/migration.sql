-- AlterTable
-- Add transferId and transferStatus fields to Payment model
-- These fields track Stripe Transfers for Separate Charges and Transfers pattern

ALTER TABLE "Payment" ADD COLUMN "transferId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "transferStatus" TEXT;

-- CreateIndex
-- Add index on transferId for faster queries
CREATE INDEX "Payment_transferId_idx" ON "Payment"("transferId");
