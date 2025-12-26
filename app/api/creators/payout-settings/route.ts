import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { PayoutSchedule } from '@prisma/client';
import { stripe } from '@/lib/stripe';

/**
 * GET /api/creators/payout-settings
 * Fetch creator's payout settings from both database and Stripe
 * ✅ FIX: Added reconciliation logic to detect mismatches
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated as creator
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
      select: {
        id: true,
        stripeAccountId: true,
        payoutSchedule: true,
        payoutMinimum: true,
        isPayoutBlocked: true,
        payoutBlockReason: true,
        currency: true, // ✅ Include creator's currency
      }
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // ✅ FIX: Fetch settings from Stripe if account exists
    let stripeSettings: any = null;
    let syncStatus: 'synced' | 'out_of_sync' | 'no_stripe_account' = 'no_stripe_account';

    if (creator.stripeAccountId) {
      try {
        const account = await stripe.accounts.retrieve(creator.stripeAccountId);
        
        // Map Stripe payout schedule to our enum
        const stripeSchedule = account.settings?.payouts?.schedule?.interval;
        const mappedSchedule = stripeSchedule === 'daily' ? 'DAILY' 
                             : stripeSchedule === 'weekly' ? 'WEEKLY' 
                             : stripeSchedule === 'monthly' ? 'MONTHLY'
                             : 'MANUAL';

        stripeSettings = {
          schedule: mappedSchedule,
          // Note: Stripe doesn't have a "minimum payout amount" setting in the same way
          // This is typically managed by the platform
        };

        // Check if settings are in sync
        syncStatus = stripeSettings.schedule === creator.payoutSchedule ? 'synced' : 'out_of_sync';
      } catch (error) {
        console.error('Error fetching Stripe settings:', error);
        // Continue without Stripe settings - will return only database values
      }
    }

    return NextResponse.json({
      payoutSchedule: creator.payoutSchedule,
      payoutMinimum: Number(creator.payoutMinimum),
      isPayoutBlocked: creator.isPayoutBlocked,
      payoutBlockReason: creator.payoutBlockReason,
      currency: creator.currency, // ✅ Include creator's currency
      // ✅ FIX: Include sync information
      syncStatus,
      stripeSettings,
      hasStripeAccount: !!creator.stripeAccountId,
    });
  } catch (error) {
    console.error('Error fetching payout settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paramètres de paiement' },
      { status: 500 }
    );
  }
}

/**
 * PUT /api/creators/payout-settings
 * Update creator's payout settings
 * ✅ FIX: Now synchronizes with Stripe account settings
 */
export async function PUT(request: NextRequest) {
  try {
    // Verify user is authenticated as creator
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator
    const creator = await db.creator.findUnique({
      where: { userId: jwtUser.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { payoutSchedule, payoutMinimum } = body;

    // Validation
    const errors: string[] = [];

    // Validate payout schedule
    if (payoutSchedule && !['DAILY', 'WEEKLY', 'MANUAL'].includes(payoutSchedule)) {
      errors.push('Le planning de paiement doit être DAILY, WEEKLY ou MANUAL');
    }

    // Validate payout minimum
    if (payoutMinimum !== undefined) {
      const minimum = Number(payoutMinimum);
      if (isNaN(minimum) || minimum < 10) {
        errors.push('Le montant minimum de paiement doit être au moins 10€');
      }
      if (minimum > 10000) {
        errors.push('Le montant minimum de paiement ne peut pas dépasser 10 000€');
      }
    }

    if (errors.length > 0) {
      return NextResponse.json(
        { error: 'Validation échouée', details: errors },
        { status: 400 }
      );
    }

    // ✅ FIX: Update Stripe account settings FIRST before updating database
    // This ensures atomicity - if Stripe update fails, database is not updated
    if (creator.stripeAccountId && payoutSchedule) {
      try {
        // Map our schedule enum to Stripe's interval format
        const stripeInterval = payoutSchedule === 'DAILY' ? 'daily'
                            : payoutSchedule === 'WEEKLY' ? 'weekly'
                            : 'manual';

        console.log(`[Payout Settings] Updating Stripe account ${creator.stripeAccountId} payout schedule to ${stripeInterval}`);

        await stripe.accounts.update(creator.stripeAccountId, {
          settings: {
            payouts: {
              schedule: {
                interval: stripeInterval as 'daily' | 'weekly' | 'manual',
              },
            },
          },
        });

        console.log(`[Payout Settings] ✅ Stripe account updated successfully`);
      } catch (stripeError: any) {
        console.error('[Payout Settings] ❌ Error updating Stripe account:', stripeError);
        
        // Return error to prevent database update
        return NextResponse.json(
          { 
            error: 'Erreur lors de la synchronisation avec Stripe',
            details: stripeError.message || 'Impossible de mettre à jour les paramètres Stripe'
          },
          { status: 500 }
        );
      }
    }

    // ✅ FIX: Only update database AFTER successful Stripe update
    const updateData: any = {};
    if (payoutSchedule) {
      updateData.payoutSchedule = payoutSchedule as PayoutSchedule;
    }
    if (payoutMinimum !== undefined) {
      updateData.payoutMinimum = Number(payoutMinimum);
    }

    const updatedCreator = await db.creator.update({
      where: { id: creator.id },
      data: updateData,
      select: {
        id: true,
        stripeAccountId: true,
        payoutSchedule: true,
        payoutMinimum: true,
        isPayoutBlocked: true,
        payoutBlockReason: true,
      }
    });

    console.log(`[Payout Settings] ✅ Database updated successfully for creator ${creator.id}`);

    return NextResponse.json({
      message: 'Paramètres de paiement mis à jour avec succès',
      payoutSchedule: updatedCreator.payoutSchedule,
      payoutMinimum: Number(updatedCreator.payoutMinimum),
      isPayoutBlocked: updatedCreator.isPayoutBlocked,
      payoutBlockReason: updatedCreator.payoutBlockReason,
      syncStatus: 'synced',
    });
  } catch (error) {
    console.error('Error updating payout settings:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour des paramètres de paiement' },
      { status: 500 }
    );
  }
}
