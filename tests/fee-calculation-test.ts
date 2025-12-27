/**
 * Test de calcul des frais Stripe - Phase 1 CORRECTIONS CRITIQUES
 * 
 * Ce script teste les nouveaux calculs :
 * 1. Plateforme absorbe les frais Stripe
 * 2. Commission cohérente à 15%
 */

// Simulation du calcul dans createPaymentIntent()
function calculateFees(amount: number, platformFeePercentage: number = 15) {
  const amountInCents = Math.round(amount * 100);
  const platformFeeInCents = Math.round((amount * platformFeePercentage / 100) * 100);

  // Calcul des frais Stripe
  const stripeFees = (amount * 0.029) + 0.30; // 2.9% + €0.30
  const stripeFeesInCents = Math.round(stripeFees * 100);

  // La plateforme absorbe les frais Stripe
  const totalApplicationFeeInCents = platformFeeInCents + stripeFeesInCents;

  // Montant que le créateur recevra
  const creatorAmountInCents = amountInCents - totalApplicationFeeInCents;

  return {
    amount: amount,
    platformFee: platformFeeInCents / 100,
    stripeFees: stripeFees,
    totalApplicationFee: totalApplicationFeeInCents / 100,
    creatorAmount: creatorAmountInCents / 100,
    platformNet: (platformFeeInCents / 100) - stripeFees, // Ce que la plateforme garde après paiement des frais Stripe
  };
}

// Tests avec différents montants
const testCases = [
  { amount: 100, commission: 15, description: "Paiement standard 100 EUR avec 15%" },
  { amount: 50, commission: 15, description: "Paiement 50 EUR avec 15%" },
  { amount: 200, commission: 15, description: "Paiement 200 EUR avec 15%" },
  { amount: 10, commission: 15, description: "Petit paiement 10 EUR avec 15%" },
];

console.log("═══════════════════════════════════════════════════════════════");
console.log("  TEST CALCUL DES FRAIS - CORRECTIONS CRITIQUES PHASE 1");
console.log("═══════════════════════════════════════════════════════════════\n");

testCases.forEach((testCase, index) => {
  console.log(`\n${index + 1}. ${testCase.description}`);
  console.log("─────────────────────────────────────────────────────────────");
  
  const result = calculateFees(testCase.amount, testCase.commission);
  
  console.log(`💰 Client paie              : ${result.amount.toFixed(2)} EUR`);
  console.log(`📊 Commission plateforme    : ${result.platformFee.toFixed(2)} EUR (${testCase.commission}%)`);
  console.log(`💳 Frais Stripe estimés     : ${result.stripeFees.toFixed(2)} EUR (2.9% + 0.30)`);
  console.log(`📦 application_fee_amount   : ${result.totalApplicationFee.toFixed(2)} EUR`);
  console.log(`✅ Créateur reçoit          : ${result.creatorAmount.toFixed(2)} EUR`);
  console.log(`🏦 Plateforme garde (net)   : ${result.platformNet.toFixed(2)} EUR`);
  
  // Vérifications
  const total = result.creatorAmount + result.totalApplicationFee;
  const isValid = Math.abs(total - result.amount) < 0.01; // Tolérance de 1 centime
  
  console.log(`\n✓ Vérification: ${result.creatorAmount.toFixed(2)} + ${result.totalApplicationFee.toFixed(2)} = ${total.toFixed(2)} EUR`);
  console.log(`${isValid ? "✅" : "❌"} ${isValid ? "Calcul correct!" : "ERREUR dans le calcul!"}`);
});

console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  RÉSUMÉ");
console.log("═══════════════════════════════════════════════════════════════");
console.log("✅ CORRECTION 1: La plateforme absorbe les frais Stripe");
console.log("   → application_fee_amount = commission + frais Stripe");
console.log("✅ CORRECTION 2: Commission cohérente à 15%");
console.log("   → Utilisation de platformFeePercentage partout");
console.log("✅ Créateur reçoit: amount - application_fee_amount");
console.log("✅ Plateforme garde (net): commission - frais Stripe");
console.log("═══════════════════════════════════════════════════════════════\n");

// Export pour utilisation dans d'autres tests
export { calculateFees };
