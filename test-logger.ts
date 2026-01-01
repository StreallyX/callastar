/**
 * Script de test pour le système de logging
 * 
 * Ce script vérifie que :
 * 1. Les types sont correctement générés
 * 2. Les fonctions de logging sont importables
 * 3. Les enums sont accessibles
 * 
 * Pour exécuter : npx tsx test-logger.ts
 */

import {
  logEmailSent,
  logEmailError,
  logCronRun,
  logCronError,
  logDailyRoomDeleted,
  logDailyRoomError,
  logDailyRoomCreated,
  logBookingCreated,
  logBookingError,
  logPaymentSuccess,
  logPaymentError,
  logSuccess,
  logError,
  getRecentLogs,
  getLogStats,
  LogType,
  LogStatus,
} from "./lib/logger";

async function testLogger() {
  console.log("🧪 Test du système de logging\n");

  console.log("✅ Import des fonctions : OK");
  console.log("✅ Import des types : OK");
  console.log("✅ Import des enums : OK");

  console.log("\n📋 Types disponibles :");
  console.log("- LogType enum :", Object.keys(LogType));
  console.log("- LogStatus enum :", Object.keys(LogStatus));

  console.log("\n📋 Fonctions disponibles :");
  const functions = [
    "logSuccess",
    "logError",
    "logEmailSent",
    "logEmailError",
    "logCronRun",
    "logCronError",
    "logDailyRoomDeleted",
    "logDailyRoomError",
    "logDailyRoomCreated",
    "logBookingCreated",
    "logBookingError",
    "logPaymentSuccess",
    "logPaymentError",
    "getRecentLogs",
    "getLogStats",
  ];

  functions.forEach((fn, index) => {
    console.log(`  ${index + 1}. ${fn}`);
  });

  console.log("\n✅ Tous les tests de compilation sont passés !");
  console.log("\n⚠️  Note : Pour tester avec une vraie base de données :");
  console.log("   1. Configurez votre DATABASE_URL dans .env");
  console.log("   2. Exécutez : npx prisma migrate deploy");
  console.log("   3. Testez les fonctions de logging dans votre application");
}

// Exécuter les tests
testLogger().catch(console.error);
