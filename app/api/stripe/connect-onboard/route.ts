import { NextRequest, NextResponse } from 'next/server';
import { getUserFromRequest } from '@/lib/auth';
import prisma from '@/lib/db';
import { stripe } from '@/lib/stripe';
import { calculateNextPayoutDate } from '@/lib/payout-eligibility';

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
      });
    }

    // Get account details from Stripe
    const account = await stripe.accounts.retrieve(creator.stripeAccountId);

    const onboarded = account.details_submitted && account.charges_enabled;

    // Update database if onboarding is complete
    if (onboarded && !creator.isStripeOnboarded) {
      await prisma.creator.update({
        where: { id: creator.id },
        data: { isStripeOnboarded: true },
      });

      // Ensure PayoutSchedule exists when onboarding is complete
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
            nextPayoutDate: null,
          },
        });
        console.log(`✅ Created default payout schedule for creator ${creator.id} on onboarding complete`);
      }
    }

    return NextResponse.json({
      onboarded,
      detailsSubmitted: account.details_submitted,
      chargesEnabled: account.charges_enabled,
    });
  } catch (error) {
    console.error('Error checking Stripe onboarding status:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la vérification du statut' },
      { status: 500 }
    );
  }
}
