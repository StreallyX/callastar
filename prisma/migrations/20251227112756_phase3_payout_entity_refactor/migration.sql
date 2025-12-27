-- AlterEnum: Simplify PayoutStatus enum to match new workflow
-- Step 1: Create new enum with desired values
CREATE TYPE "PayoutStatus_new" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'CANCELED');

-- Step 2: Alter columns to use new enum (safe since no data exists)
ALTER TABLE "Payment" ALTER COLUMN "payoutStatus" DROP DEFAULT;
ALTER TABLE "Payment" ALTER COLUMN "payoutStatus" TYPE "PayoutStatus_new" USING "payoutStatus"::text::"PayoutStatus_new";
ALTER TABLE "Payment" ALTER COLUMN "payoutStatus" SET DEFAULT 'REQUESTED';

ALTER TABLE "Payout" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "Payout" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING "status"::text::"PayoutStatus_new";
ALTER TABLE "Payout" ALTER COLUMN "status" SET DEFAULT 'REQUESTED';

ALTER TABLE "PayoutAuditLog" ALTER COLUMN "status" TYPE "PayoutStatus_new" USING "status"::text::"PayoutStatus_new";

-- Step 3: Drop old enum and rename new one
DROP TYPE "PayoutStatus";
ALTER TYPE "PayoutStatus_new" RENAME TO "PayoutStatus";

-- AlterTable: Modify Payout table structure
ALTER TABLE "Payout" DROP COLUMN "retriedCount",
DROP COLUMN "amountPaid",
DROP COLUMN "conversionRate",
DROP COLUMN "conversionDate",
ADD COLUMN "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "paidAt" TIMESTAMP(3),
ADD COLUMN "failedAt" TIMESTAMP(3),
ADD COLUMN "rejectedAt" TIMESTAMP(3),
ADD COLUMN "metadata" JSONB,
ALTER COLUMN "currency" SET NOT NULL,
ALTER COLUMN "currency" SET DEFAULT 'EUR';

-- CreateIndex: Add unique constraint on stripePayoutId
CREATE UNIQUE INDEX "Payout_stripePayoutId_key" ON "Payout"("stripePayoutId");

-- AlterTable: Add payoutId to PayoutAuditLog
ALTER TABLE "PayoutAuditLog" ADD COLUMN "payoutId" TEXT;

-- CreateIndex: Add index on payoutId
CREATE INDEX "PayoutAuditLog_payoutId_idx" ON "PayoutAuditLog"("payoutId");

-- AddForeignKey: Link PayoutAuditLog to Payout
ALTER TABLE "PayoutAuditLog" ADD CONSTRAINT "PayoutAuditLog_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey: Link Payout to User (approvedBy)
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
