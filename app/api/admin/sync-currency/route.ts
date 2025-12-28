import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { stripe } from '@/lib/stripe';

/**
 * Interface pour le résultat de synchronisation
 */
interface SyncResult {
  creatorId: string;
  creatorName: string;
  creatorEmail: string;
  stripeAccountId: string | null;
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
    console.error(`[sync-currency] Erreur Stripe pour ${stripeAccountId}:`, error.message);
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
      creatorEmail: 'N/A',
      stripeAccountId: null,
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
      creatorEmail: creator.user.email,
      stripeAccountId: null,
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
      creatorEmail: creator.user.email,
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

    console.log(`[sync-currency] ✅ ${creator.user.name} (${creator.id}) : ${oldCurrency} → ${stripeCurrency}`);
  } else {
    console.log(`[sync-currency] ⏭️  ${creator.user.name} (${creator.id}) : ${oldCurrency} (déjà correct)`);
  }

  return {
    creatorId: creator.id,
    creatorName: creator.user.name,
    creatorEmail: creator.user.email,
    stripeAccountId: creator.stripeAccountId,
    oldCurrency,
    newCurrency: stripeCurrency,
    updated: needsUpdate,
  };
}

/**
 * POST /api/admin/sync-currency
 * Resynchronise la devise d'un ou plusieurs créateurs avec Stripe
 * 
 * Body:
 * - creatorId (optionnel) : ID du créateur spécifique à resynchroniser
 * - Si omis, resynchronise tous les créateurs
 */
export async function POST(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est admin
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { creatorId } = body;

    console.log(`[sync-currency] 🚀 Démarrage de la synchronisation ${creatorId ? `pour ${creatorId}` : 'pour tous les créateurs'}`);

    let results: SyncResult[] = [];

    if (creatorId) {
      // Resynchroniser un créateur spécifique
      const result = await syncCreatorCurrency(creatorId);
      results = [result];
    } else {
      // Resynchroniser tous les créateurs
      const creators = await prisma.creator.findMany({
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      });

      console.log(`[sync-currency] 📊 ${creators.length} créateurs trouvés, dont ${creators.filter(c => c.stripeAccountId).length} avec compte Stripe`);

      for (const creator of creators) {
        const result = await syncCreatorCurrency(creator.id);
        results.push(result);

        // Pause pour éviter le rate limiting
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    // Calculer les statistiques
    const updated = results.filter(r => r.updated);
    const skipped = results.filter(r => !r.updated && !r.error);
    const errors = results.filter(r => r.error);

    console.log(`[sync-currency] ✅ Synchronisation terminée : ${updated.length} mis à jour, ${skipped.length} déjà correct, ${errors.length} erreurs`);

    return NextResponse.json({
      success: true,
      summary: {
        total: results.length,
        updated: updated.length,
        skipped: skipped.length,
        errors: errors.length,
      },
      results: results.map(r => ({
        creatorId: r.creatorId,
        creatorName: r.creatorName,
        creatorEmail: r.creatorEmail,
        stripeAccountId: r.stripeAccountId,
        oldCurrency: r.oldCurrency,
        newCurrency: r.newCurrency,
        updated: r.updated,
        error: r.error,
      })),
    });

  } catch (error: any) {
    console.error('[sync-currency] ❌ Erreur fatale:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de la synchronisation des devises',
        details: error.message 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/admin/sync-currency
 * Vérifie les incohérences de devises sans les corriger (dry-run)
 */
export async function GET(request: NextRequest) {
  try {
    // Vérifier que l'utilisateur est admin
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 401 }
      );
    }

    console.log('[sync-currency] 🔍 Vérification des incohérences de devises (dry-run)');

    // Récupérer tous les créateurs avec compte Stripe
    const creators = await prisma.creator.findMany({
      where: {
        stripeAccountId: {
          not: null
        }
      },
      include: {
        user: {
          select: { name: true, email: true }
        }
      }
    });

    console.log(`[sync-currency] 📊 ${creators.length} créateurs avec compte Stripe`);

    const inconsistencies: Array<{
      creatorId: string;
      creatorName: string;
      creatorEmail: string;
      stripeAccountId: string;
      dbCurrency: string;
      stripeCurrency: string;
    }> = [];

    for (const creator of creators) {
      if (!creator.stripeAccountId) continue;

      const stripeCurrency = await getStripeCurrency(creator.stripeAccountId);
      
      if (stripeCurrency && stripeCurrency !== creator.currency) {
        inconsistencies.push({
          creatorId: creator.id,
          creatorName: creator.user.name,
          creatorEmail: creator.user.email,
          stripeAccountId: creator.stripeAccountId,
          dbCurrency: creator.currency,
          stripeCurrency,
        });
      }

      // Pause pour éviter le rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    console.log(`[sync-currency] 🔍 ${inconsistencies.length} incohérences détectées sur ${creators.length} créateurs`);

    return NextResponse.json({
      success: true,
      totalCreators: creators.length,
      inconsistenciesFound: inconsistencies.length,
      inconsistencies,
    });

  } catch (error: any) {
    console.error('[sync-currency] ❌ Erreur:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de la vérification des incohérences',
        details: error.message 
      },
      { status: 500 }
    );
  }
}
