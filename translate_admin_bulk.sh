#!/bin/bash

# Bulk translation integration script for Admin Dashboard files
# This script applies translation patterns to all remaining admin dashboard files

cd /home/ubuntu/github_repos/callastar

# List of files to process (excluding already completed ones)
FILES=(
  "app/[locale]/dashboard/admin/payouts/page.tsx"
  "app/[locale]/dashboard/admin/payouts/dashboard/page.tsx"
  "app/[locale]/dashboard/admin/logs/page.tsx"
  "app/[locale]/dashboard/admin/system-logs/page.tsx"
  "app/[locale]/dashboard/admin/notifications/page.tsx"
  "app/[locale]/dashboard/admin/testing/page.tsx"
  "app/[locale]/dashboard/admin/refunds/page.tsx"
  "app/[locale]/dashboard/admin/refunds-disputes/page.tsx"
  "app/[locale]/dashboard/admin/creators/[id]/stripe/page.tsx"
)

echo "Starting bulk translation integration..."

for file in "${FILES[@]}"; do
  if [ ! -f "$file" ]; then
    echo "Skipping non-existent file: $file"
    continue
  fi
  
  echo "Processing: $file"
  
  # Create backup
  cp "$file" "$file.backup"
  
  # Common replacements for all files
  
  # Replace common hardcoded French text with translation keys
  sed -i "s/Chargement\.\.\./t('loading')/g" "$file"
  sed -i "s/'Chargement...'/t('loading')/g" "$file"
  sed -i "s/\"Chargement...\"/t('loading')/g" "$file"
  
  sed -i "s/Actualiser/t('refresh')/g" "$file"
  sed -i "s/Retour au tableau de bord/t('backToDashboard')/g" "$file"
  sed -i "s/Retour/t('back')/g" "$file"
  
  sed -i "s/Erreur lors du chargement/t('errors.loadingError')/g" "$file"
  sed -i "s/Une erreur est survenue/t('errors.genericError')/g" "$file"
  
  sed -i "s/'Statut'/'t(\"filters.status\")'/g" "$file"
  sed -i "s/\"Statut\"/t(\"filters.status\")/g" "$file"
  
  # Fix DateDisplay components to include locale
  sed -i 's/<DateDisplay date={\([^}]*\)} format="\([^"]*\)" \/>/<DateDisplay date={\1} format="\2" locale={locale} \/>/g' "$file"
  sed -i 's/<DateDisplay date={\([^}]*\)} format={\([^}]*\)} \/>/<DateDisplay date={\1} format={\2} locale={locale} \/>/g' "$file"
  
  echo "  ✓ Completed: $file"
done

echo ""
echo "============================================"
echo "Bulk translation integration complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo "1. Review changes in each file"
echo "2. Replace remaining hardcoded text manually if needed"
echo "3. Test the application"
echo ""
