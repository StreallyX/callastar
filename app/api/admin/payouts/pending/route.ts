import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import { db } from '@/lib/db';
import { stripe } from '@/lib/stripe';

/**
 * GET /api/admin/payouts/pending
 * Fetch all creators with pending payouts (Admin only)
 */
export async function GET(request: NextRequest) {
  try {
    // Verify user is authenticated as admin
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Non autorisé - Accès administrateur requis' },
        { status: 401 }
      );
    }

    // Get all creators with Stripe accounts that are not blocked
    const creators = await db.creator.findMany({
      where: {
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

    // Check each creator's eligibility and balance
    const pendingPayouts = [];
    
    for (const creator of creators) {
      try {
        // Skip if no Stripe account ID
        if (!creator.stripeAccountId) continue;

        // Fetch Stripe account details
        const account = await stripe.accounts.retrieve(creator.stripeAccountId);
        
        // Check if KYC complete and bank validated
        if (!account.charges_enabled || !account.payouts_enabled) {
          continue;
        }

        // Fetch balance
        const balance = await stripe.balance.retrieve({
          stripeAccount: creator.stripeAccountId,
        });

        // Check if balance meets minimum
        const availableBalance = balance.available.find(b => b.currency === 'eur');
        const minimumAmount = Number(creator.payoutMinimum);
        
        if (!availableBalance) continue;
        
        const availableAmountEur = availableBalance.amount / 100;
        
        if (availableAmountEur < minimumAmount) continue;

        // Determine if payout is due based on schedule
        let isDue = false;
        let nextPayoutDate = null;
        
        // Get last payout audit log for this creator
        const lastPayout = await db.payoutAuditLog.findFirst({
          where: {
            creatorId: creator.id,
            action: 'TRIGGERED'
          },
          orderBy: {
            createdAt: 'desc'
          }
        });

        const now = new Date();
        const lastPayoutDate = lastPayout ? lastPayout.createdAt : null;

        if (creator.payoutSchedule === 'DAILY') {
          // Daily: payout every day if balance >= minimum
          if (!lastPayoutDate) {
            isDue = true;
          } else {
            const daysSinceLast = Math.floor((now.getTime() - lastPayoutDate.getTime()) / (1000 * 60 * 60 * 24));
            isDue = daysSinceLast >= 1;
            if (!isDue) {
              nextPayoutDate = new Date(lastPayoutDate.getTime() + (1000 * 60 * 60 * 24));
            }
          }
        } else if (creator.payoutSchedule === 'WEEKLY') {
          // Weekly: payout every 7 days if balance >= minimum
          if (!lastPayoutDate) {
            isDue = true;
          } else {
            const daysSinceLast = Math.floor((now.getTime() - lastPayoutDate.getTime()) / (1000 * 60 * 60 * 24));
            isDue = daysSinceLast >= 7;
            if (!isDue) {
              nextPayoutDate = new Date(lastPayoutDate.getTime() + (7 * 1000 * 60 * 60 * 24));
            }
          }
        } else if (creator.payoutSchedule === 'MANUAL') {
          // Manual: never auto-trigger
          isDue = false;
        }

        pendingPayouts.push({
          creator: {
            id: creator.id,
            name: creator.user.name,
            email: creator.user.email,
            payoutSchedule: creator.payoutSchedule,
            payoutMinimum: Number(creator.payoutMinimum),
          },
          balance: {
            available: availableAmountEur,
            currency: 'eur'
          },
          account: {
            charges_enabled: account.charges_enabled,
            payouts_enabled: account.payouts_enabled,
          },
          payout: {
            isDue,
            lastPayoutDate,
            nextPayoutDate,
          }
        });
      } catch (error) {
        console.error(`Error processing creator ${creator.id}:`, error);
        // Continue with next creator
        continue;
      }
    }

    // Sort by due status and amount
    pendingPayouts.sort((a, b) => {
      if (a.payout.isDue !== b.payout.isDue) {
        return a.payout.isDue ? -1 : 1;
      }
      return b.balance.available - a.balance.available;
    });

    return NextResponse.json({
      pendingPayouts,
      summary: {
        total: pendingPayouts.length,
        due: pendingPayouts.filter(p => p.payout.isDue).length,
        notDue: pendingPayouts.filter(p => !p.payout.isDue).length,
        totalAmount: pendingPayouts.reduce((sum, p) => sum + p.balance.available, 0),
      }
    });
  } catch (error) {
    console.error('Error fetching pending payouts:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paiements en attente' },
      { status: 500 }
    );
  }
}
