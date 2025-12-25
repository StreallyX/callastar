-- 1️⃣ Add new columns as NULLABLE first
ALTER TABLE "Payout"
ADD COLUMN "actualAmount" DECIMAL(10,2),
ADD COLUMN "completedAt" TIMESTAMP(3),
ADD COLUMN "failedAt" TIMESTAMP(3),
ADD COLUMN "failureReason" TEXT,
ADD COLUMN "notes" TEXT,
ADD COLUMN "processedAt" TIMESTAMP(3),
ADD COLUMN "processedBy" TEXT,
ADD COLUMN "requestedAmount" DECIMAL(10,2),
ADD COLUMN "requestedAt" TIMESTAMP(3) DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "stripeAccountId" TEXT,
ADD COLUMN "updatedAt" TIMESTAMP(3);

-- 2️⃣ Backfill existing rows using old `amount`
UPDATE "Payout"
SET
  "requestedAmount" = "amount",
  "actualAmount" = "amount",
  "updatedAt" = NOW()
WHERE "requestedAmount" IS NULL;

-- 3️⃣ Enforce NOT NULL constraints
ALTER TABLE "Payout"
ALTER COLUMN "requestedAmount" SET NOT NULL,
ALTER COLUMN "updatedAt" SET NOT NULL,
ALTER COLUMN "requestedAt" SET NOT NULL;

-- 4️⃣ Now it is SAFE to drop old column
ALTER TABLE "Payout"
DROP COLUMN "amount";

-- 5️⃣ Index
CREATE INDEX "Payout_requestedAt_idx" ON "Payout"("requestedAt");
