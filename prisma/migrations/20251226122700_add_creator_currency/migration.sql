-- AlterTable Creator: Add currency field
-- Phase 1: Detection and storage of creator currency
-- This field stores the default_currency from Stripe Connect account (EUR, CHF, USD, GBP, etc.)

ALTER TABLE "Creator" ADD COLUMN "currency" TEXT NOT NULL DEFAULT 'EUR';

-- Create index for faster queries on currency
CREATE INDEX "Creator_currency_idx" ON "Creator"("currency");

-- No data migration needed: existing creators default to EUR
-- Currency will be automatically updated when they check their onboarding status
