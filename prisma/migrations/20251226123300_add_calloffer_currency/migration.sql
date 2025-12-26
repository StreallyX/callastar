-- AlterTable CallOffer: Add currency field
-- Phase 3: Offer prices in creator's currency
-- This field stores the currency of the offer price (same as creator's currency)

ALTER TABLE "CallOffer" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

-- Create index for faster queries on currency
CREATE INDEX "CallOffer_currency_idx" ON "CallOffer"("currency");

-- Update existing offers with creator's currency
UPDATE "CallOffer" co
SET currency = c.currency
FROM "Creator" c
WHERE co."creatorId" = c.id AND c.currency IS NOT NULL;

-- Offers from creators without currency set will remain EUR (default)
