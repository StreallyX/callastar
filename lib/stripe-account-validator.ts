import Stripe from 'stripe';
import { stripe } from './stripe';

/**
 * Comprehensive Stripe Connect account validation
 * 
 * IMPORTANT: For Stripe Connect Express accounts, operational status is determined by:
 * 1. details_submitted === true (user completed onboarding)
 * 2. requirements.currently_due.length === 0 (no pending requirements)
 *
 * DO NOT use charges_enabled or payouts_enabled for validation:
 * - These can be false in test mode
 * - These can be false during Stripe processing delays
 * - These represent immediate technical state, not account readiness
 *
 * Stripe Dashboard may show "all capabilities enabled" (authorization)
 * while charges_enabled is still false (immediate state)
 */

export interface StripeAccountStatus {
  isFullyOnboarded: boolean;
  canReceivePayments: boolean;
  canReceivePayouts: boolean;
  issues: string[];
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
  };
  capabilities: {
    cardPayments: string;
    transfers: string;
  };
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  hasExternalAccount: boolean;
  disabledReason: string | null;
}

/**
 * Get detailed status of a Stripe Connect account
 * @param stripeAccountId - The Stripe Connect account ID
 * @returns Detailed account status with all checks
 */
export async function getStripeAccountStatus(
  stripeAccountId: string
): Promise<StripeAccountStatus> {
  const account = await stripe.accounts.retrieve(stripeAccountId);

  const currentlyDue = account.requirements?.currently_due || [];
  const eventuallyDue = account.requirements?.eventually_due || [];
  const pastDue = account.requirements?.past_due || [];
  const disabledReason = account.requirements?.disabled_reason || null;

  // Check capabilities
  const cardPaymentsCapability = account.capabilities?.card_payments || 'inactive';
  const transfersCapability = account.capabilities?.transfers || 'inactive';

  // Check if external accounts (bank accounts) are configured
  const hasExternalAccount: boolean =
    !!(account.external_accounts?.data && account.external_accounts.data.length > 0);

  // Basic flags
  const detailsSubmitted = account.details_submitted || false;
  const chargesEnabled = account.charges_enabled || false;
  const payoutsEnabled = account.payouts_enabled || false;

  // Collect issues - ONLY for actual user-actionable problems
  const issues: string[] = [];

  // For Express accounts, operational status is based on:
  // 1. details_submitted === true
  // 2. requirements.currently_due.length === 0
  const isOperational = detailsSubmitted && currentlyDue.length === 0 && pastDue.length === 0;

  if (!detailsSubmitted) {
    issues.push('Informations de compte non soumises');
  }

  // Show actual missing requirements, not technical state flags
  if (currentlyDue.length > 0) {
    issues.push(`Exigences en attente: ${currentlyDue.join(', ')}`);
  }

  if (pastDue.length > 0) {
    issues.push(`Exigences en retard: ${pastDue.join(', ')}`);
  }

  // Disabled reason is a real problem
  if (disabledReason) {
    issues.push(`Compte désactivé: ${disabledReason}`);
  }

  // DO NOT check charges_enabled or payouts_enabled as issues
  // These can be false in test mode or during processing delays
  // They are NOT user errors for Express accounts

  // DO NOT check capabilities as issues
  // For Express accounts, capabilities being pending/inactive is normal during setup
  // They will automatically become active once requirements are met
  // Only disabled_reason indicates a real problem (already handled above)

  // External account is only required if payouts are being set up
  // Not including this as an "issue" since it's handled by requirements

  // Determine if fully onboarded and can receive payments/payouts
  // For Express accounts: details_submitted + no pending requirements = operational
  const canReceivePayments: boolean =
    !!detailsSubmitted &&
    currentlyDue.length === 0 &&
    pastDue.length === 0 &&
    !disabledReason;

  const canReceivePayouts: boolean =
    !!detailsSubmitted &&
    currentlyDue.length === 0 &&
    pastDue.length === 0 &&
    !disabledReason &&
    hasExternalAccount;

  const isFullyOnboarded: boolean = canReceivePayments && canReceivePayouts;

  return {
    isFullyOnboarded,
    canReceivePayments,
    canReceivePayouts,
    issues,
    requirements: {
      currentlyDue,
      eventuallyDue,
      pastDue,
    },
    capabilities: {
      cardPayments: cardPaymentsCapability,
      transfers: transfersCapability,
    },
    detailsSubmitted: !!detailsSubmitted,
    chargesEnabled: !!chargesEnabled,
    payoutsEnabled: !!payoutsEnabled,
    hasExternalAccount,
    disabledReason,
  };
}

/**
 * Get human-readable status message
 * @param status - Account status object
 * @returns User-friendly status message
 */
export function getStatusMessage(status: StripeAccountStatus): string {
  if (status.isFullyOnboarded) {
    return 'Compte complètement configuré et prêt à recevoir des paiements';
  }

  if (status.issues.length > 0) {
    return status.issues[0]; // Return the first/most important issue
  }

  return 'Configuration en cours';
}

/**
 * Get recommended action for the creator
 * @param status - Account status object
 * @returns User-friendly action message
 */
export function getRecommendedAction(status: StripeAccountStatus): string | null {
  if (status.isFullyOnboarded) {
    return null;
  }

  if (!status.detailsSubmitted) {
    return 'Complétez votre configuration Stripe Connect';
  }

  if (status.requirements.pastDue.length > 0) {
    return 'Complétez les exigences en retard de toute urgence';
  }

  if (status.requirements.currentlyDue.length > 0) {
    return 'Complétez les exigences manquantes sur Stripe';
  }

  if (!status.hasExternalAccount) {
    return 'Configurez votre compte bancaire sur Stripe';
  }

  if (status.disabledReason) {
    return 'Votre compte nécessite une attention - consultez Stripe';
  }

  // DO NOT recommend actions based on charges_enabled or payouts_enabled
  // These are technical states that resolve automatically after requirements are met
  // Showing "wait for activation" is misleading when nothing is actually wrong

  // If we reach here with details submitted and no requirements, the account is operational
  // Even if charges_enabled/payouts_enabled are temporarily false
  if (status.detailsSubmitted && 
      status.requirements.currentlyDue.length === 0 && 
      status.requirements.pastDue.length === 0) {
    return null; // No action needed - account is operational
  }

  return 'Vérifiez votre compte Stripe pour plus de détails';
}
