-- AlterTable: Add currency tracking fields to Payout model
-- These fields enable tracking of currency conversions when paying out to Stripe accounts in non-EUR currencies

-- Add amountPaid field (amount actually paid in Stripe currency)
ALTER TABLE "Payout" ADD COLUMN "amountPaid" DECIMAL(10,2);

-- Add currency field (Stripe account currency like EUR, CHF, USD, etc.)
ALTER TABLE "Payout" ADD COLUMN "currency" TEXT DEFAULT 'EUR';

-- Add conversionRate field (rate used for currency conversion, if applicable)
ALTER TABLE "Payout" ADD COLUMN "conversionRate" DECIMAL(10,6);

-- Add conversionDate field (timestamp when conversion was calculated)
ALTER TABLE "Payout" ADD COLUMN "conversionDate" TIMESTAMP(3);

-- Create index on currency for efficient filtering
CREATE INDEX "Payout_currency_idx" ON "Payout"("currency");

-- Add comments to amount field for clarity
COMMENT ON COLUMN "Payout"."amount" IS 'Original amount in EUR (database currency, source of truth)';
COMMENT ON COLUMN "Payout"."amountPaid" IS 'Actual amount paid in Stripe currency (if different from EUR)';
COMMENT ON COLUMN "Payout"."currency" IS 'Stripe account currency (EUR, CHF, USD, etc.)';
COMMENT ON COLUMN "Payout"."conversionRate" IS 'Conversion rate used (EUR to target currency)';
COMMENT ON COLUMN "Payout"."conversionDate" IS 'When conversion was calculated';
