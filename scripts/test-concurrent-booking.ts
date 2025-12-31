/**
 * ✅ Test de concurrence pour vérifier la protection anti multi-booking
 * 
 * Ce script simule plusieurs utilisateurs essayant de réserver le même créneau
 * simultanément pour vérifier que l'implémentation atomique fonctionne correctement.
 * 
 * Résultat attendu :
 * - Une seule réservation réussit (HTTP 201)
 * - Toutes les autres échouent avec HTTP 409 (Conflict)
 */

import axios, { AxiosError } from 'axios';

// Configuration
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';
const CONCURRENT_REQUESTS = 5; // Nombre de requêtes simultanées

// Types
interface TestResult {
  requestId: number;
  success: boolean;
  statusCode: number;
  message: string;
  responseTime: number;
  errorType?: string;
}

interface TestSession {
  userId: string;
  authToken: string;
}

/**
 * Simule une requête de booking
 */
async function attemptBooking(
  callOfferId: string,
  session: TestSession,
  requestId: number
): Promise<TestResult> {
  const startTime = Date.now();

  try {
    const response = await axios.post(
      `${BASE_URL}/api/bookings`,
      { callOfferId },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.authToken}`,
        },
      }
    );

    const responseTime = Date.now() - startTime;

    return {
      requestId,
      success: true,
      statusCode: response.status,
      message: response.data.booking ? 'Booking created successfully' : 'Unknown response',
      responseTime,
    };
  } catch (error) {
    const responseTime = Date.now() - startTime;

    if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError<any>;
      const statusCode = axiosError.response?.status || 0;
      const errorMessage = axiosError.response?.data?.error || 'Unknown error';

      return {
        requestId,
        success: false,
        statusCode,
        message: errorMessage,
        responseTime,
        errorType: statusCode === 409 ? 'CONFLICT_EXPECTED' : 'OTHER_ERROR',
      };
    }

    return {
      requestId,
      success: false,
      statusCode: 0,
      message: (error as Error).message || 'Unknown error',
      responseTime,
      errorType: 'NETWORK_ERROR',
    };
  }
}

/**
 * Exécute le test de concurrence
 */
async function runConcurrencyTest(
  callOfferId: string,
  sessions: TestSession[]
) {
  console.log('\n' + '='.repeat(70));
  console.log('🔬 TEST DE CONCURRENCE - ANTI MULTI-BOOKING');
  console.log('='.repeat(70));
  console.log(`\n📋 Configuration:`);
  console.log(`   - Call Offer ID: ${callOfferId}`);
  console.log(`   - Nombre de requêtes simultanées: ${CONCURRENT_REQUESTS}`);
  console.log(`   - Base URL: ${BASE_URL}`);
  console.log(`\n🚀 Lancement des requêtes simultanées...\n`);

  const startTime = Date.now();

  // Lancer toutes les requêtes en parallèle
  const promises = Array.from({ length: CONCURRENT_REQUESTS }, (_, i) =>
    attemptBooking(callOfferId, sessions[i % sessions.length], i + 1)
  );

  const results = await Promise.all(promises);
  const totalTime = Date.now() - startTime;

  // Analyse des résultats
  const successCount = results.filter((r) => r.success).length;
  const conflictCount = results.filter((r) => r.statusCode === 409).length;
  const otherErrorCount = results.filter(
    (r) => !r.success && r.statusCode !== 409
  ).length;

  // Affichage des résultats détaillés
  console.log('📊 RÉSULTATS DÉTAILLÉS:\n');
  results.forEach((result) => {
    const icon = result.success
      ? '✅'
      : result.statusCode === 409
      ? '⚠️'
      : '❌';
    const status = result.success
      ? 'SUCCESS'
      : result.statusCode === 409
      ? 'CONFLICT (Expected)'
      : 'ERROR';

    console.log(
      `   ${icon} Request #${result.requestId}: [${result.statusCode}] ${status} - ${result.message} (${result.responseTime}ms)`
    );
  });

  // Résumé
  console.log('\n' + '-'.repeat(70));
  console.log('📈 RÉSUMÉ:');
  console.log('-'.repeat(70));
  console.log(`   ✅ Bookings réussis: ${successCount}`);
  console.log(`   ⚠️  Conflits (409): ${conflictCount}`);
  console.log(`   ❌ Autres erreurs: ${otherErrorCount}`);
  console.log(`   ⏱️  Temps total: ${totalTime}ms`);
  console.log(
    `   ⏱️  Temps moyen: ${Math.round(
      results.reduce((sum, r) => sum + r.responseTime, 0) / results.length
    )}ms`
  );

  // Validation du test
  console.log('\n' + '='.repeat(70));
  console.log('🎯 VALIDATION:');
  console.log('='.repeat(70));

  const testPassed =
    successCount === 1 && conflictCount === CONCURRENT_REQUESTS - 1;

  if (testPassed) {
    console.log('\n✅ TEST RÉUSSI !');
    console.log(
      '   → Une seule réservation a été créée (comme attendu)'
    );
    console.log(
      `   → ${conflictCount} requêtes ont été rejetées avec HTTP 409 (comme attendu)`
    );
    console.log(
      '   → Le système est PROTÉGÉ contre le multi-booking ✨'
    );
  } else {
    console.log('\n❌ TEST ÉCHOUÉ !');
    console.log(`   → ${successCount} réservations créées (attendu: 1)`);
    console.log(
      `   → ${conflictCount} conflits détectés (attendu: ${
        CONCURRENT_REQUESTS - 1
      })`
    );
    console.log('   → Le système N\'EST PAS protégé contre le multi-booking ⚠️');
  }

  console.log('='.repeat(70) + '\n');

  return testPassed;
}

/**
 * Fonction principale
 */
async function main() {
  // Vérifier les variables d'environnement
  if (!process.env.TEST_CALL_OFFER_ID) {
    console.error('❌ Erreur: Variable TEST_CALL_OFFER_ID non définie');
    console.error('\nUsage:');
    console.error('  TEST_CALL_OFFER_ID=<offer-id> TEST_AUTH_TOKEN=<token> npm run test:concurrency');
    process.exit(1);
  }

  if (!process.env.TEST_AUTH_TOKEN) {
    console.error('❌ Erreur: Variable TEST_AUTH_TOKEN non définie');
    console.error('\nUsage:');
    console.error('  TEST_CALL_OFFER_ID=<offer-id> TEST_AUTH_TOKEN=<token> npm run test:concurrency');
    process.exit(1);
  }

  const callOfferId = process.env.TEST_CALL_OFFER_ID;
  const authToken = process.env.TEST_AUTH_TOKEN;

  // Créer des sessions de test (même utilisateur pour simplifier)
  const sessions: TestSession[] = Array.from(
    { length: CONCURRENT_REQUESTS },
    (_, i) => ({
      userId: `test-user-${i + 1}`,
      authToken,
    })
  );

  try {
    const testPassed = await runConcurrencyTest(callOfferId, sessions);
    process.exit(testPassed ? 0 : 1);
  } catch (error) {
    console.error('\n❌ Erreur lors de l\'exécution du test:', error);
    process.exit(1);
  }
}

// Exécuter le test
main();
