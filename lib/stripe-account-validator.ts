import Stripe from 'stripe';
import { stripe } from './stripe';

/**
 * Comprehensive Stripe Connect account validation
 * Checks all necessary requirements for a creator to receive payments
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

  // Collect issues
  const issues: string[] = [];

  if (!detailsSubmitted) {
    issues.push('Informations de compte non soumises');
  }

  if (!chargesEnabled) {
    issues.push('Paiements désactivés');
    if (disabledReason) {
      issues.push(`Raison: ${disabledReason}`);
    }
  }

  if (!payoutsEnabled) {
    issues.push('Transferts désactivés');
  }

  if (cardPaymentsCapability !== 'active') {
    issues.push(`Capacité de paiement par carte: ${cardPaymentsCapability}`);
  }

  if (transfersCapability !== 'active') {
    issues.push(`Capacité de transfert: ${transfersCapability}`);
  }

  if (currentlyDue.length > 0) {
    issues.push(`Exigences en attente: ${currentlyDue.join(', ')}`);
  }

  if (pastDue.length > 0) {
    issues.push(`Exigences en retard: ${pastDue.join(', ')}`);
  }

  if (!hasExternalAccount) {
    issues.push('Aucun compte bancaire configuré');
  }

  // Determine if fully onboarded and can receive payments/payouts
  const canReceivePayments: boolean =
    !!detailsSubmitted &&
    !!chargesEnabled &&
    cardPaymentsCapability === 'active' &&
    currentlyDue.length === 0 &&
    pastDue.length === 0;

  const canReceivePayouts: boolean =
    !!payoutsEnabled &&
    transfersCapability === 'active' &&
    hasExternalAccount &&
    currentlyDue.length === 0 &&
    pastDue.length === 0;

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

  if (status.requirements.currentlyDue.length > 0) {
    return 'Complétez les exigences manquantes sur Stripe';
  }

  if (status.requirements.pastDue.length > 0) {
    return 'Complétez les exigences en retard de toute urgence';
  }

  if (!status.hasExternalAccount) {
    return 'Configurez votre compte bancaire sur Stripe';
  }

  if (!status.chargesEnabled) {
    return 'Attendez la validation de votre compte par Stripe';
  }

  if (!status.payoutsEnabled) {
    return 'Attendez l\'activation des transferts par Stripe';
  }

  return 'Vérifiez votre compte Stripe pour plus de détails';
}
