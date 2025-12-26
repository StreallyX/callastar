import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { PayoutAction, PayoutStatus } from '@prisma/client';

/**
 * GET /api/cron/process-automatic-payouts
 * Process automatic payouts for creators with DAILY or WEEKLY schedules
 * Should be called by a cron job (e.g., Vercel Cron)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify cron authorization (using secret token)
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || 'default-cron-secret-change-in-production';
    
    if (authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    console.log('Starting automatic payout processing...');

    // Get all creators with automatic payout schedules (DAILY or WEEKLY)
    const creators = await db.creator.findMany({
      where: {
        payoutSchedule: {
          in: ['DAILY', 'WEEKLY']
        },
        isPayoutBlocked: false,
        isStripeOnboarded: true,
        stripeAccountId: {
          not: null
        }
      },
      include: {
        user: {
          select: { id: true, email: true, name: true }
        }
      }
    });

    console.log(`Found ${creators.length} creators with automatic payout schedules`);

    const results = {
      processed: [] as any[],
      skipped: [] as any[],
      failed: [] as any[],
    };

    for (const creator of creators) {
      try {
        console.log(`Processing creator ${creator.id}...`);

        // Skip if no Stripe account
        if (!creator.stripeAccountId) {
          results.skipped.push({
            creatorId: creator.id,
            reason: 'No Stripe account',
          });
          continue;
        }

        // ✅ NEW: Use creator's currency instead of hardcoded 'eur'
        const currency = (creator.currency || 'EUR').toLowerCase();

        // Get last payout for this creator
        const lastPayout = await db.payoutAuditLog.findFirst({
          where: {
            creatorId: creator.id,
            action: 'TRIGGERED'
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        // Check if payout is due based on schedule
        const now = new Date();
        const lastPayoutDate = lastPayout ? lastPayout.createdAt : null;
        let isDue = false;

        if (creator.payoutSchedule === 'DAILY') {
          if (!lastPayoutDate) {
            isDue = true;
          } else {
            const hoursSinceLast = (now.getTime() - lastPayoutDate.getTime()) / (1000 * 60 * 60);
            isDue = hoursSinceLast >= 24;
          }
        } else if (creator.payoutSchedule === 'WEEKLY') {
          if (!lastPayoutDate) {
            isDue = true;
          } else {
            const daysSinceLast = (now.getTime() - lastPayoutDate.getTime()) / (1000 * 60 * 60 * 24);
            isDue = daysSinceLast >= 7;
          }
        }

        if (!isDue) {
          results.skipped.push({
            creatorId: creator.id,
            reason: 'Payout not due yet',
            lastPayoutDate,
            schedule: creator.payoutSchedule,
          });
          continue;
        }

        // Fetch Stripe account details
        const account = await stripe.accounts.retrieve(creator.stripeAccountId);

        // Check if KYC complete and bank validated
        if (!account.charges_enabled || !account.payouts_enabled) {
          results.skipped.push({
            creatorId: creator.id,
            reason: 'KYC incomplete or bank not validated',
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
          });
          continue;
        }

        // Fetch balance
        const balance = await stripe.balance.retrieve({
          stripeAccount: creator.stripeAccountId,
        });

        // ✅ MODIFIED: Check balance in creator's currency
        const availableBalance = balance.available.find(b => b.currency === currency);
        const minimumAmount = Number(creator.payoutMinimum);
        
        if (!availableBalance) {
          results.skipped.push({
            creatorId: creator.id,
            reason: `No balance in currency ${currency.toUpperCase()}`,
            availableCurrencies: balance.available.map(b => b.currency.toUpperCase()),
          });
          continue;
        }

        if (availableBalance.amount / 100 < minimumAmount) {
          results.skipped.push({
            creatorId: creator.id,
            reason: 'Balance below minimum',
            available: availableBalance.amount / 100,
            minimum: minimumAmount,
            currency: currency.toUpperCase(),
          });
          continue;
        }

        // Calculate payout amount (entire available balance)
        const payoutAmount = availableBalance.amount;
        const payoutAmountInCurrency = payoutAmount / 100;

        // ✅ MODIFIED: Create payout in creator's currency
        let stripePayout;
        try {
          stripePayout = await stripe.payouts.create(
            {
              amount: payoutAmount,
              currency: currency, // ✅ MODIFIED: Use creator's currency
              metadata: {
                creatorId: creator.id,
                creatorEmail: creator.user.email,
                triggeredBy: 'automatic',
                schedule: creator.payoutSchedule,
                currency: currency.toUpperCase(),
                platform: 'callastar',
              }
            },
            {
              stripeAccount: creator.stripeAccountId,
            }
          );
        } catch (stripeError: any) {
          console.error(`Error creating payout for creator ${creator.id}:`, stripeError);
          
          // Log failed attempt
          await db.payoutAuditLog.create({
            data: {
              creatorId: creator.id,
              action: PayoutAction.FAILED,
              amount: payoutAmountInCurrency, // ✅ MODIFIED
              status: PayoutStatus.FAILED,
              reason: `Échec de création du paiement automatique: ${stripeError.message}`,
              metadata: JSON.stringify({
                stripeErrorType: stripeError.type,
                stripeErrorCode: stripeError.code,
                triggeredBy: 'automatic',
                schedule: creator.payoutSchedule,
                currency: currency.toUpperCase(),
              })
            }
          });

          results.failed.push({
            creatorId: creator.id,
            reason: stripeError.message,
            amount: payoutAmountInCurrency, // ✅ MODIFIED
            currency: currency.toUpperCase(),
          });
          continue;
        }

        // ✅ MODIFIED: Create audit log entry with currency
        await db.payoutAuditLog.create({
          data: {
            creatorId: creator.id,
            action: PayoutAction.TRIGGERED,
            amount: payoutAmountInCurrency, // ✅ MODIFIED
            status: PayoutStatus.PROCESSING,
            stripePayoutId: stripePayout.id,
            reason: `Paiement automatique (${creator.payoutSchedule})`,
            metadata: JSON.stringify({
              stripePayout: {
                id: stripePayout.id,
                status: stripePayout.status,
                arrival_date: stripePayout.arrival_date,
                currency: currency.toUpperCase(),
              },
              triggeredBy: 'automatic',
              schedule: creator.payoutSchedule,
              currency: currency.toUpperCase(),
            })
          }
        });

        results.processed.push({
          creatorId: creator.id,
          creatorName: creator.user.name,
          amount: payoutAmountInCurrency, // ✅ MODIFIED
          currency: currency.toUpperCase(), // ✅ NEW
          stripePayoutId: stripePayout.id,
          schedule: creator.payoutSchedule,
        });

        console.log(`✓ Created payout for creator ${creator.id}: ${payoutAmountInCurrency} ${currency.toUpperCase()}`);
      } catch (error) {
        console.error(`Error processing creator ${creator.id}:`, error);
        results.failed.push({
          creatorId: creator.id,
          reason: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    console.log('Automatic payout processing completed');
    console.log(`Processed: ${results.processed.length}, Skipped: ${results.skipped.length}, Failed: ${results.failed.length}`);

    return NextResponse.json({
      success: true,
      summary: {
        totalCreators: creators.length,
        processed: results.processed.length,
        skipped: results.skipped.length,
        failed: results.failed.length,
        totalAmount: results.processed.reduce((sum, p) => sum + p.amount, 0),
      },
      results,
    });
  } catch (error) {
    console.error('Error in automatic payout processing:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors du traitement des paiements automatiques',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
