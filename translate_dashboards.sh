#!/bin/bash

# This script will help identify all hardcoded French text in dashboard files
# and organize them for translation

echo "=== DASHBOARD TRANSLATION EXTRACTION ==="
echo ""

# Creator Dashboard files
CREATOR_FILES=(
  "dashboard/creator/payment-setup/page.tsx"
  "dashboard/creator/requests/page.tsx"
  "dashboard/creator/notifications/page.tsx"
  "dashboard/creator/settings/page.tsx"
  "dashboard/creator/payments/page.tsx"
  "dashboard/creator/reviews/page.tsx"
  "dashboard/creator/offers/page.tsx"
  "dashboard/creator/payouts/page.tsx"
  "dashboard/creator/payouts/settings/page.tsx"
  "dashboard/creator/payouts/request/page.tsx"
  "dashboard/creator/fees/page.tsx"
  "dashboard/creator/earnings/page.tsx"
  "dashboard/creator/calls/page.tsx"
)

echo "CREATOR DASHBOARD FILES:"
for file in "${CREATOR_FILES[@]}"; do
  echo "  - app/[locale]/$file"
done

echo ""
echo "Total Creator Files: ${#CREATOR_FILES[@]}"
