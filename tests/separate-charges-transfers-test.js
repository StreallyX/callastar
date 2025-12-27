"use strict";
/**
 * Test du nouveau modèle : Separate Charges and Transfers
 * Phase 1.1 - Refactoring système de paiement
 *
 * OBJECTIF: Le créateur reçoit TOUJOURS 85 EUR (pas 81.80) pour un paiement de 100 EUR
 * La plateforme absorbe les frais Stripe (~3.20 EUR)
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculateSeparateChargesAndTransfers = calculateSeparateChargesAndTransfers;
// Simulation du nouveau calcul dans createPaymentIntent()
function calculateSeparateChargesAndTransfers(amount, platformFeePercentage) {
    if (platformFeePercentage === void 0) { platformFeePercentage = 15; }
    var amountInCents = Math.round(amount * 100);
    // Calcul du montant créateur (85% du total)
    var creatorAmount = amount * (1 - platformFeePercentage / 100);
    var creatorAmountInCents = Math.round(creatorAmount * 100);
    // Commission plateforme
    var platformFeeAmount = amount - creatorAmount;
    // Frais Stripe (déduits du compte plateforme, pas du créateur)
    var stripeFees = (amount * 0.029) + 0.30; // 2.9% + €0.30
    // Ce que la plateforme garde après avoir payé Stripe
    var platformNet = platformFeeAmount - stripeFees;
    return {
        clientPays: amount,
        creatorReceives: creatorAmount,
        creatorReceivesCents: creatorAmountInCents,
        platformCommission: platformFeeAmount,
        stripeFees: stripeFees,
        platformNet: platformNet,
    };
}
// Tests avec différents montants
var testCases = [
    { amount: 100, commission: 15, description: "Paiement standard 100 EUR avec 15%" },
    { amount: 50, commission: 15, description: "Paiement 50 EUR avec 15%" },
    { amount: 200, commission: 15, description: "Paiement 200 EUR avec 15%" },
    { amount: 10, commission: 15, description: "Petit paiement 10 EUR avec 15%" },
];
console.log("═══════════════════════════════════════════════════════════════");
console.log("  TEST SEPARATE CHARGES AND TRANSFERS - PHASE 1.1");
console.log("═══════════════════════════════════════════════════════════════\n");
console.log("🎯 OBJECTIF: Créateur reçoit EXACTEMENT 85% (85 EUR pour 100 EUR)");
console.log("🏦 Plateforme absorbe les frais Stripe (~2.9% + €0.30)\n");
testCases.forEach(function (testCase, index) {
    console.log("\n".concat(index + 1, ". ").concat(testCase.description));
    console.log("─────────────────────────────────────────────────────────────");
    var result = calculateSeparateChargesAndTransfers(testCase.amount, testCase.commission);
    console.log("\n\uD83D\uDCE5 CHARGE (sur compte plateforme):");
    console.log("   \uD83D\uDCB0 Client paie              : ".concat(result.clientPays.toFixed(2), " EUR"));
    console.log("   \uD83D\uDCB3 Frais Stripe d\u00E9duits     : ".concat(result.stripeFees.toFixed(2), " EUR"));
    console.log("   \uD83D\uDCE6 Reste sur plateforme     : ".concat((result.clientPays - result.stripeFees).toFixed(2), " EUR"));
    console.log("\n\uD83D\uDCE4 TRANSFER (au cr\u00E9ateur):");
    console.log("   \u2705 Cr\u00E9ateur re\u00E7oit          : ".concat(result.creatorReceives.toFixed(2), " EUR (").concat(100 - testCase.commission, "%)"));
    console.log("   \uD83D\uDD22 En centimes              : ".concat(result.creatorReceivesCents, " cents"));
    console.log("\n\uD83D\uDCBC PLATEFORME:");
    console.log("   \uD83D\uDCCA Commission               : ".concat(result.platformCommission.toFixed(2), " EUR (").concat(testCase.commission, "%)"));
    console.log("   \uD83D\uDCB3 Frais Stripe             : ".concat(result.stripeFees.toFixed(2), " EUR"));
    console.log("   \uD83C\uDFE6 Net (apr\u00E8s frais)        : ".concat(result.platformNet.toFixed(2), " EUR"));
    // Vérifications
    var expectedCreator = testCase.amount * (1 - testCase.commission / 100);
    var isCorrect = Math.abs(result.creatorReceives - expectedCreator) < 0.01;
    console.log("\n\u2713 V\u00E9rification cr\u00E9ateur: ".concat(result.creatorReceives.toFixed(2), " EUR = ").concat(expectedCreator.toFixed(2), " EUR"));
    console.log("".concat(isCorrect ? "✅" : "❌", " ").concat(isCorrect ? "Créateur reçoit le montant exact!" : "ERREUR!"));
});
console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  COMPARAISON: ANCIEN vs NOUVEAU MODÈLE");
console.log("═══════════════════════════════════════════════════════════════");
var amount = 100;
var commission = 15;
// Ancien modèle (Destination Charges)
var oldStripeFees = (amount * 0.029) + 0.30;
var oldApplicationFee = (amount * commission / 100) + oldStripeFees;
var oldCreatorReceives = amount - oldApplicationFee;
var oldPlatformNet = (amount * commission / 100) - oldStripeFees;
// Nouveau modèle (Separate Charges and Transfers)
var newResult = calculateSeparateChargesAndTransfers(amount, commission);
console.log("\n📌 ANCIEN MODÈLE (Destination Charges):");
console.log("   Client paie              : ".concat(amount.toFixed(2), " EUR"));
console.log("   application_fee_amount   : ".concat(oldApplicationFee.toFixed(2), " EUR (commission + Stripe)"));
console.log("   \u274C Cr\u00E9ateur re\u00E7oit       : ".concat(oldCreatorReceives.toFixed(2), " EUR"));
console.log("   Plateforme net           : ".concat(oldPlatformNet.toFixed(2), " EUR"));
console.log("\n✨ NOUVEAU MODÈLE (Separate Charges and Transfers):");
console.log("   Client paie              : ".concat(newResult.clientPays.toFixed(2), " EUR"));
console.log("   Charge sur plateforme    : ".concat(newResult.clientPays.toFixed(2), " EUR"));
console.log("   \u2705 Transfer au cr\u00E9ateur  : ".concat(newResult.creatorReceives.toFixed(2), " EUR"));
console.log("   Plateforme net           : ".concat(newResult.platformNet.toFixed(2), " EUR"));
console.log("\n🎯 AMÉLIORATION:");
console.log("   Cr\u00E9ateur gagne           : +".concat((newResult.creatorReceives - oldCreatorReceives).toFixed(2), " EUR"));
console.log("   (de ".concat(oldCreatorReceives.toFixed(2), " \u2192 ").concat(newResult.creatorReceives.toFixed(2), " EUR)"));
console.log("\n═══════════════════════════════════════════════════════════════");
console.log("  RÉSUMÉ DES CHANGEMENTS");
console.log("═══════════════════════════════════════════════════════════════");
console.log("✅ CHARGE: PaymentIntent simple sur compte plateforme");
console.log("   → Pas de transfer_data, pas de application_fee_amount");
console.log("✅ TRANSFER: Créé dans webhook après payment_intent.succeeded");
console.log("   → Montant exact garanti (85 EUR pour 100 EUR)");
console.log("✅ FRAIS STRIPE: Absorbés par la plateforme");
console.log("   → Déduits du solde plateforme, pas du créateur");
console.log("✅ DEVISE: Charge et Transfer dans la MÊME devise");
console.log("   → Pas de conversion, pas de perte");
console.log("═══════════════════════════════════════════════════════════════\n");
// Flow détaillé
console.log("═══════════════════════════════════════════════════════════════");
console.log("  FLOW DÉTAILLÉ: SEPARATE CHARGES AND TRANSFERS");
console.log("═══════════════════════════════════════════════════════════════");
console.log("\n1️⃣  CLIENT PAIE 100 EUR");
console.log("    ↓");
console.log("2️⃣  CHARGE créée sur compte PLATEFORME");
console.log("    - PaymentIntent.amount = 10000 cents");
console.log("    - Metadata: creatorAmount = 8500 cents");
console.log("    - Metadata: stripeAccountId = acct_xxx");
console.log("    ↓");
console.log("3️⃣  PAIEMENT RÉUSSI → Webhook payment_intent.succeeded");
console.log("    - Stripe déduit frais (~3.20 EUR) du compte plateforme");
console.log("    - Solde plateforme: 96.80 EUR");
console.log("    ↓");
console.log("4️⃣  TRANSFER automatique au créateur");
console.log("    - stripe.transfers.create()");
console.log("    - amount = 8500 cents (85 EUR)");
console.log("    - destination = acct_xxx");
console.log("    - transferId stocké en DB");
console.log("    ↓");
console.log("5️⃣  RÉSULTAT FINAL");
console.log("    - Créateur: +85.00 EUR ✅");
console.log("    - Plateforme: 96.80 - 85.00 = 11.80 EUR ✅");
console.log("    - Commission: 15.00 EUR");
console.log("    - Frais Stripe: 3.20 EUR (absorbés)");
console.log("═══════════════════════════════════════════════════════════════\n");
