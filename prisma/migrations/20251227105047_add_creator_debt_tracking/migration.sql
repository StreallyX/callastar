-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "creatorDebt" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reconciled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledBy" TEXT,
ADD COLUMN     "reversalId" TEXT;

-- AlterTable
ALTER TABLE "Refund" ADD COLUMN     "creatorDebt" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "reconciled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "reconciledAt" TIMESTAMP(3),
ADD COLUMN     "reconciledBy" TEXT,
ADD COLUMN     "reversalId" TEXT;

-- CreateIndex
CREATE INDEX "Dispute_reconciled_idx" ON "Dispute"("reconciled");

-- CreateIndex
CREATE INDEX "Refund_reconciled_idx" ON "Refund"("reconciled");
