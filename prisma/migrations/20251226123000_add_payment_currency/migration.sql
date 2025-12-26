-- AlterTable Payment: Add currency field
-- Phase 2: PaymentIntent in creator's currency
-- This field stores the currency used for the PaymentIntent (same as creator's currency)

ALTER TABLE "Payment" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

-- Create index for faster queries on currency
CREATE INDEX "Payment_currency_idx" ON "Payment"("currency");

-- Update existing payments with EUR as default
-- Future payments will automatically use the creator's currency
