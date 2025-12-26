import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { calculateNextPayoutDate } from '@/lib/payout-eligibility';
import {
  getStripeAccountStatus,
  getStatusMessage,
  getRecommendedAction,
} from '@/lib/stripe-account-validator';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    // Get creator
    const creator = await prisma.creator.findUnique({
      where: { userId: jwtUser.userId },
    });

    if (!creator) {
      return NextResponse.json(
        { error: 'Créateur introuvable' },
        { status: 404 }
      );
    }

    let accountId = creator.stripeAccountId;

    // Create Stripe Connect account if it doesn't exist
    if (!accountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        capabilities: {
          transfers: { requested: true },
        },
      });

      accountId = account.id;

      // Save Stripe Connect account ID
      await prisma.creator.update({
        where: { id: creator.id },
        data: { stripeAccountId: accountId },
      });

      // Create default PayoutSchedule for new Stripe account
      const existingSchedule = await prisma.payoutScheduleNew.findUnique({
        where: { creatorId: creator.id },
      });

      if (!existingSchedule) {
        await prisma.payoutScheduleNew.create({
          data: {
            creatorId: creator.id,
            mode: 'AUTOMATIC',
            frequency: 'WEEKLY',
            isActive: true,
            nextPayoutDate: null, // Will be set after first payout
          },
        });
        console.log(`✅ Created default payout schedule for creator ${creator.id}`);
      }
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${process.env.NEXTAUTH_URL}/dashboard/creator?onboarding=refresh`,
      return_url: `${process.env.NEXTAUTH_URL}/dashboard/creator?onboarding=success`,
      type: 'account_onboarding',
    });

    return NextResponse.json({ url: accountLink.url });
  } catch (error: any) {
    console.error('Stripe Connect onboarding error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du lien d\'onboarding' },
      { status: 500 }
    );
  }
}

// Check onboarding status
export async function GET(request: NextRequest) {
  try {
    const jwtUser = await getUserFromRequest(request);
    if (!jwtUser || jwtUser.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Non autorisé' },
        { status: 401 }
      );
    }

    const creator = await prisma.creator.findUnique({
      where: { userId: jwtUser.userId },
    });

    if (!creator || !creator.stripeAccountId) {
      return NextResponse.json({
        onboarded: false,
        detailsSubmitted: false,
        chargesEnabled: false,
        payoutsEnabled: false,
        canReceivePayments: false,
        canReceivePayouts: false,
        statusMessage: 'Aucun compte Stripe configuré',
        recommendedAction: 'Complétez votre configuration Stripe Connect',
        issues: ['Aucun compte Stripe créé'],
        requirements: {
          currentlyDue: [],
          eventuallyDue: [],
          pastDue: [],
        },
      });
    }

    // Get comprehensive account status
    const accountStatus = await getStripeAccountStatus(creator.stripeAccountId);
    const statusMessage = getStatusMessage(accountStatus);
    const recommendedAction = getRecommendedAction(accountStatus);

    // Update database if onboarding status changed
    if (accountStatus.isFullyOnboarded !== creator.isStripeOnboarded) {
      await prisma.creator.update({
        where: { id: creator.id },
        data: { isStripeOnboarded: accountStatus.isFullyOnboarded },
      });

      // Ensure PayoutSchedule exists when onboarding is complete
      if (accountStatus.isFullyOnboarded) {
        const existingSchedule = await prisma.payoutScheduleNew.findUnique({
          where: { creatorId: creator.id },
        });

        if (!existingSchedule) {
          await prisma.payoutScheduleNew.create({
            data: {
              creatorId: creator.id,
              mode: 'MANUAL', // Changed to MANUAL as per requirements
              frequency: 'WEEKLY',
              isActive: true,
              nextPayoutDate: null,
            },
          });
          console.log(
            `✅ Created default payout schedule for creator ${creator.id} on onboarding complete`
          );
        }
      }
    }

    return NextResponse.json({
      onboarded: accountStatus.isFullyOnboarded,
      detailsSubmitted: accountStatus.detailsSubmitted,
      chargesEnabled: accountStatus.chargesEnabled,
      payoutsEnabled: accountStatus.payoutsEnabled,
      canReceivePayments: accountStatus.canReceivePayments,
      canReceivePayouts: accountStatus.canReceivePayouts,
      statusMessage,
      recommendedAction,
      issues: accountStatus.issues,
      requirements: accountStatus.requirements,
      capabilities: accountStatus.capabilities,
      hasExternalAccount: accountStatus.hasExternalAccount,
    });
  } catch (error) {
    console.error('Error checking Stripe onboarding status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification du statut' },
      { status: 500 }
    );
  }
}
