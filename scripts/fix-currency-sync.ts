/**
 * Script de migration : Synchroniser les devises des créateurs avec Stripe
 * 
 * Ce script récupère la devise réelle de chaque compte Stripe Connect
 * et met à jour le champ creator.currency en base de données.
 * 
 * Usage:
 *   npx ts-node scripts/fix-currency-sync.ts [creatorId]
 * 
 * Arguments:
 *   creatorId (optionnel) - ID du créateur spécifique à corriger
 *                          Si omis, corrige tous les créateurs
 * 
 * Exemples:
 *   npx ts-node scripts/fix-currency-sync.ts                    # Tous les créateurs
 *   npx ts-node scripts/fix-currency-sync.ts cm1abc123xyz      # Un créateur spécifique
 */

import { PrismaClient } from '@prisma/client';
import Stripe from 'stripe';

const prisma = new PrismaClient();

// Initialize Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2025-12-15.clover',
  typescript: true,
});

interface SyncResult {
  creatorId: string;
  creatorName: string;
  stripeAccountId: string;
  oldCurrency: string;
  newCurrency: string;
  updated: boolean;
  error?: string;
}

/**
 * Récupère la devise réelle d'un compte Stripe Connect
 */
async function getStripeCurrency(stripeAccountId: string): Promise<string | null> {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    const currency = (account.default_currency || 'eur').toUpperCase();
    return currency;
  } catch (error: any) {
    console.error(`❌ Erreur Stripe pour le compte ${stripeAccountId}:`, error.message);
    return null;
  }
}

/**
 * Synchronise la devise d'un créateur spécifique
 */
async function syncCreatorCurrency(creatorId: string): Promise<SyncResult> {
  const creator = await prisma.creator.findUnique({
    where: { id: creatorId },
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  });

  if (!creator) {
    return {
      creatorId,
      creatorName: 'Introuvable',
      stripeAccountId: 'N/A',
      oldCurrency: 'N/A',
      newCurrency: 'N/A',
      updated: false,
      error: 'Créateur introuvable'
    };
  }

  if (!creator.stripeAccountId) {
    return {
      creatorId: creator.id,
      creatorName: creator.user.name,
      stripeAccountId: 'N/A',
      oldCurrency: creator.currency,
      newCurrency: creator.currency,
      updated: false,
      error: 'Aucun compte Stripe connecté'
    };
  }

  const stripeCurrency = await getStripeCurrency(creator.stripeAccountId);

  if (!stripeCurrency) {
    return {
      creatorId: creator.id,
      creatorName: creator.user.name,
      stripeAccountId: creator.stripeAccountId,
      oldCurrency: creator.currency,
      newCurrency: creator.currency,
      updated: false,
      error: 'Impossible de récupérer la devise Stripe'
    };
  }

  const oldCurrency = creator.currency;
  const needsUpdate = oldCurrency !== stripeCurrency;

  if (needsUpdate) {
    await prisma.creator.update({
      where: { id: creator.id },
      data: { currency: stripeCurrency }
    });

    console.log(`✅ Créateur ${creator.id} (${creator.user.name}) : ${oldCurrency} → ${stripeCurrency}`);
  } else {
    console.log(`⏭️  Créateur ${creator.id} (${creator.user.name}) : ${oldCurrency} (déjà correct)`);
  }

  return {
    creatorId: creator.id,
    creatorName: creator.user.name,
    stripeAccountId: creator.stripeAccountId,
    oldCurrency,
    newCurrency: stripeCurrency,
    updated: needsUpdate,
  };
}

/**
 * Synchronise tous les créateurs
 */
async function syncAllCreators(): Promise<SyncResult[]> {
  const creators = await prisma.creator.findMany({
    include: {
      user: {
        select: { name: true, email: true }
      }
    }
  });

  console.log(`\n📊 Nombre total de créateurs : ${creators.length}`);
  console.log(`📊 Créateurs avec compte Stripe : ${creators.filter(c => c.stripeAccountId).length}\n`);

  const results: SyncResult[] = [];

  for (const creator of creators) {
    const result = await syncCreatorCurrency(creator.id);
    results.push(result);

    // Pause to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return results;
}

/**
 * Affiche un rapport détaillé des résultats
 */
function printReport(results: SyncResult[]) {
  console.log('\n' + '='.repeat(80));
  console.log('📋 RAPPORT DE SYNCHRONISATION');
  console.log('='.repeat(80));

  const updated = results.filter(r => r.updated);
  const skipped = results.filter(r => !r.updated && !r.error);
  const errors = results.filter(r => r.error);

  console.log(`\n✅ Mis à jour        : ${updated.length}`);
  console.log(`⏭️  Déjà correct      : ${skipped.length}`);
  console.log(`❌ Erreurs          : ${errors.length}`);
  console.log(`📊 Total            : ${results.length}\n`);

  if (updated.length > 0) {
    console.log('\n✅ CRÉATEURS MIS À JOUR :');
    console.log('-'.repeat(80));
    updated.forEach(r => {
      console.log(`  • ${r.creatorName} (${r.creatorId})`);
      console.log(`    Stripe: ${r.stripeAccountId}`);
      console.log(`    Devise: ${r.oldCurrency} → ${r.newCurrency}`);
    });
  }

  if (errors.length > 0) {
    console.log('\n❌ ERREURS :');
    console.log('-'.repeat(80));
    errors.forEach(r => {
      console.log(`  • ${r.creatorName} (${r.creatorId}): ${r.error}`);
    });
  }

  console.log('\n' + '='.repeat(80));
  console.log('✅ Synchronisation terminée !\n');
}

/**
 * Main function
 */
async function main() {
  try {
    console.log('🚀 Démarrage de la synchronisation des devises...\n');

    // Check if Stripe key is configured
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY === 'sk_test_placeholder_for_build') {
      throw new Error('❌ STRIPE_SECRET_KEY non configurée dans les variables d\'environnement');
    }

    const creatorId = process.argv[2];

    let results: SyncResult[];

    if (creatorId) {
      console.log(`🎯 Mode : Créateur spécifique (${creatorId})\n`);
      const result = await syncCreatorCurrency(creatorId);
      results = [result];
    } else {
      console.log('🎯 Mode : Tous les créateurs\n');
      results = await syncAllCreators();
    }

    printReport(results);

  } catch (error: any) {
    console.error('\n❌ Erreur fatale :', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute main function
main();
