import Stripe from 'stripe';
import { stripe } from './stripe';

/**
 * Stripe Connect Express – Account Status
 * Source de vérité = Stripe
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
    identityDue: string[];
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
 * Get detailed Stripe Connect Express account status
 */
export async function getStripeAccountStatus(
  stripeAccountId: string
): Promise<StripeAccountStatus> {
  const account = await stripe.accounts.retrieve(stripeAccountId);

  const currentlyDue = account.requirements?.currently_due ?? [];
  const eventuallyDue = account.requirements?.eventually_due ?? [];
  const pastDue = account.requirements?.past_due ?? [];
  const disabledReason = account.requirements?.disabled_reason ?? null;

  // 🔍 Détection spécifique des exigences d'identité
  const identityDue = [...currentlyDue, ...eventuallyDue].filter((req) =>
    req.includes('verification') ||
    req.includes('identity') ||
    req.includes('document')
  );

  // Capabilities (info uniquement)
  const cardPaymentsCapability = account.capabilities?.card_payments ?? 'inactive';
  const transfersCapability = account.capabilities?.transfers ?? 'inactive';

  // Comptes bancaires
  const hasExternalAccount =
    !!account.external_accounts?.data &&
    account.external_accounts.data.length > 0;

  // Flags Stripe
  const detailsSubmitted = !!account.details_submitted;
  const chargesEnabled = !!account.charges_enabled;
  const payoutsEnabled = !!account.payouts_enabled;

  // Problèmes réels (user-actionable)
  const issues: string[] = [];

  if (!detailsSubmitted) {
    issues.push('Informations de compte Stripe non soumises');
  }

  if (currentlyDue.length > 0) {
    issues.push(`Exigences en attente : ${currentlyDue.join(', ')}`);
  }

  if (pastDue.length > 0) {
    issues.push(`Exigences en retard : ${pastDue.join(', ')}`);
  }

  if (identityDue.length > 0) {
    issues.push(
      `Vérification d'identité requise : ${identityDue.join(', ')}`
    );
  }

  if (disabledReason) {
    issues.push(`Compte Stripe désactivé : ${disabledReason}`);
  }

  // 🧠 Logique métier correcte pour Express
  const canReceivePayments =
    detailsSubmitted &&
    currentlyDue.length === 0 &&
    pastDue.length === 0 &&
    identityDue.length === 0 &&
    !disabledReason;

  const canReceivePayouts =
    canReceivePayments &&
    hasExternalAccount;

  const isFullyOnboarded = canReceivePayments && canReceivePayouts;

  return {
    isFullyOnboarded,
    canReceivePayments,
    canReceivePayouts,
    issues,
    requirements: {
      currentlyDue,
      eventuallyDue,
      pastDue,
      identityDue,
    },
    capabilities: {
      cardPayments: cardPaymentsCapability,
      transfers: transfersCapability,
    },
    detailsSubmitted,
    chargesEnabled,
    payoutsEnabled,
    hasExternalAccount,
    disabledReason,
  };
}

/**
 * Message lisible pour le créateur
 */
export function getStatusMessage(status: StripeAccountStatus): string {
  if (status.isFullyOnboarded) {
    return 'Compte Stripe entièrement configuré et opérationnel';
  }

  if (status.issues.length > 0) {
    return status.issues[0];
  }

  return 'Configuration Stripe en cours';
}

/**
 * Action recommandée pour le créateur
 */
export function getRecommendedAction(
  status: StripeAccountStatus
): string | null {
  if (status.isFullyOnboarded) {
    return null;
  }

  if (!status.detailsSubmitted) {
    return 'Complétez votre configuration Stripe Connect';
  }

  if (status.requirements.identityDue.length > 0) {
    return 'Stripe demande un document d’identité pour vérifier votre compte';
  }

  if (status.requirements.pastDue.length > 0) {
    return 'Complétez les exigences Stripe en retard';
  }

  if (status.requirements.currentlyDue.length > 0) {
    return 'Complétez les informations manquantes sur Stripe';
  }

  if (!status.hasExternalAccount) {
    return 'Ajoutez un compte bancaire sur Stripe pour recevoir les virements';
  }

  if (status.disabledReason) {
    return 'Votre compte Stripe est temporairement désactivé';
  }

  return 'Vérifiez votre compte Stripe pour plus de détails';
}
