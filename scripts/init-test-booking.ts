/**
 * Script d'initialisation du booking de test pour le développement
 * 
 * Ce script crée :
 * - Un utilisateur test
 * - Un créateur test
 * - Une offre d'appel test
 * - Un booking test permanent
 * 
 * Usage: npx ts-node scripts/init-test-booking.ts
 */

import { PrismaClient, BookingStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const TEST_USER_EMAIL = 'test-user@callastar.dev';
const TEST_CREATOR_EMAIL = 'test-creator@callastar.dev';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_ROOM_NAME = 'test-dev-call-room';

async function main() {
  console.log('🚀 Initialisation du booking de test...\n');

  // 1. Créer ou récupérer l'utilisateur test
  console.log('1️⃣  Création de l\'utilisateur test...');
  const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
  
  const testUser = await prisma.user.upsert({
    where: { email: TEST_USER_EMAIL },
    update: {},
    create: {
      email: TEST_USER_EMAIL,
      password: hashedPassword,
      name: 'Test User',
      role: 'USER',
      emailVerified: new Date(),
    },
  });
  console.log(`   ✅ Utilisateur test: ${testUser.email} (${testUser.id})`);

  // 2. Créer ou récupérer le créateur test
  console.log('\n2️⃣  Création du créateur test...');
  const testCreatorUser = await prisma.user.upsert({
    where: { email: TEST_CREATOR_EMAIL },
    update: {},
    create: {
      email: TEST_CREATOR_EMAIL,
      password: hashedPassword,
      name: 'Test Creator',
      role: 'CREATOR',
      emailVerified: new Date(),
    },
  });

  const testCreator = await prisma.creator.upsert({
    where: { userId: testCreatorUser.id },
    update: {},
    create: {
      userId: testCreatorUser.id,
      bio: 'Créateur de test pour le développement. Ce profil est utilisé uniquement pour tester les fonctionnalités d\'appel.',
      profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TestCreator',
      isStripeOnboarded: true, // Simuler l'onboarding Stripe
      currency: 'EUR',
    },
  });
  console.log(`   ✅ Créateur test: ${testCreatorUser.email} (${testCreator.id})`);

  // 3. Créer ou récupérer l'offre d'appel test
  console.log('\n3️⃣  Création de l\'offre d\'appel test...');
  
  // Date très éloignée (2099-12-31) pour éviter les contraintes temporelles
  const futureDate = new Date('2099-12-31T12:00:00Z');
  
  // Vérifier si une offre test existe déjà
  const existingOffer = await prisma.callOffer.findFirst({
    where: {
      creatorId: testCreator.id,
      title: '🧪 TEST - Appel de développement',
    },
    include: {
      booking: true,
    },
  });

  let testOffer;
  if (existingOffer) {
    testOffer = existingOffer;
    console.log(`   ⚠️  Offre test existante trouvée: ${testOffer.id}`);
  } else {
    testOffer = await prisma.callOffer.create({
      data: {
        creatorId: testCreator.id,
        title: '🧪 TEST - Appel de développement',
        description: 'Ceci est un appel de test permanent pour le développement. Utilisez-le pour tester les fonctionnalités d\'appel vidéo sans contraintes de temps.',
        price: 0.50, // Prix symbolique pour le test
        currency: 'EUR',
        dateTime: futureDate,
        duration: 30, // 30 minutes
        status: 'BOOKED',
        maxParticipants: 1,
      },
    });
    console.log(`   ✅ Offre d'appel test créée: ${testOffer.id}`);
  }

  // 4. Créer ou mettre à jour le booking test
  console.log('\n4️⃣  Création du booking test...');
  
  // Supprimer l'ancien booking test s'il existe
  if (existingOffer?.booking) {
    await prisma.booking.delete({
      where: { id: existingOffer.booking.id },
    });
    console.log(`   🗑️  Ancien booking supprimé`);
  }

  const testBooking = await prisma.booking.create({
    data: {
      userId: testUser.id,
      callOfferId: testOffer.id,
      status: BookingStatus.CONFIRMED,
      totalPrice: 0.50,
      isTestBooking: true, // 🎯 Flag crucial pour identifier ce booking
      dailyRoomUrl: `https://callastar.daily.co/${TEST_ROOM_NAME}`,
      dailyRoomName: TEST_ROOM_NAME,
    },
  });
  console.log(`   ✅ Booking test créé: ${testBooking.id}`);

  // 5. Résumé
  console.log('\n' + '='.repeat(60));
  console.log('✅ INITIALISATION TERMINÉE');
  console.log('='.repeat(60));
  console.log('\n📋 Informations de connexion:');
  console.log(`\n👤 Utilisateur test:`);
  console.log(`   Email: ${TEST_USER_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);
  console.log(`   Dashboard: http://localhost:3000/dashboard/user/calls`);
  console.log(`\n🎨 Créateur test:`);
  console.log(`   Email: ${TEST_CREATOR_EMAIL}`);
  console.log(`   Password: ${TEST_PASSWORD}`);
  console.log(`   Dashboard: http://localhost:3000/dashboard/creator/bookings`);
  console.log(`\n📞 Booking test:`);
  console.log(`   ID: ${testBooking.id}`);
  console.log(`   URL d'appel: http://localhost:3000/call/${testBooking.id}`);
  console.log(`   Daily Room: ${TEST_ROOM_NAME}`);
  console.log(`   Status: ${testBooking.status}`);
  console.log(`\n⚠️  Note: Vous devez créer manuellement la salle Daily.co "${TEST_ROOM_NAME}"`);
  console.log(`   ou configurer l'API Daily.co pour créer la salle automatiquement.`);
  console.log('\n' + '='.repeat(60));
}

main()
  .catch((error) => {
    console.error('❌ Erreur lors de l\'initialisation:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
