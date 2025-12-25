import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

async function main() {

  const prisma = new PrismaClient();
  console.log('🌱 Seeding database...');

  // Hash password for test users
  const hashedPassword = await bcrypt.hash('johndoe123', 10);

  // Create admin test user
  const adminUser = await prisma.user.upsert({
    where: { email: 'john@doe.com' },
    update: {},
    create: {
      email: 'john@doe.com',
      password: hashedPassword,
      name: 'John Doe',
      role: 'ADMIN',
    },
  });

  console.log('✅ Admin user created:', adminUser.email);

  // Create test creator users
  const creator1User = await prisma.user.upsert({
    where: { email: 'emma.creator@example.com' },
    update: {},
    create: {
      email: 'emma.creator@example.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Emma Martin',
      role: 'CREATOR',
    },
  });

  const creator2User = await prisma.user.upsert({
    where: { email: 'lucas.creator@example.com' },
    update: {},
    create: {
      email: 'lucas.creator@example.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Lucas Bernard',
      role: 'CREATOR',
    },
  });

  const creator3User = await prisma.user.upsert({
    where: { email: 'sophie.creator@example.com' },
    update: {},
    create: {
      email: 'sophie.creator@example.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Sophie Dubois',
      role: 'CREATOR',
    },
  });

  console.log('✅ Creator users created');

  // Create creator profiles
  const creator1 = await prisma.creator.upsert({
    where: { userId: creator1User.id },
    update: {},
    create: {
      userId: creator1User.id,
      bio: 'Influenceuse lifestyle et mode. J\'adore partager mes astuces beauté et discuter avec ma communauté ! 💄✨',
      profileImage: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=400&fit=crop',
      isStripeOnboarded: true,
    },
  });

  const creator2 = await prisma.creator.upsert({
    where: { userId: creator2User.id },
    update: {},
    create: {
      userId: creator2User.id,
      bio: 'Coach sportif et nutrition. Motivé à aider les autres à atteindre leurs objectifs ! 💪🏋️',
      profileImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=400&h=400&fit=crop',
      isStripeOnboarded: true,
    },
  });

  const creator3 = await prisma.creator.upsert({
    where: { userId: creator3User.id },
    update: {},
    create: {
      userId: creator3User.id,
      bio: 'Créatrice de contenu gaming et tech. Passionnée par les nouvelles technologies et l\'e-sport ! 🎮🚀',
      profileImage: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=400&fit=crop',
      isStripeOnboarded: true,
    },
  });

  console.log('✅ Creator profiles created');

  // Create call offers for creators
  const now = new Date();
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const dayAfterTomorrow = new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000);
  const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const fourDaysLater = new Date(now.getTime() + 4 * 24 * 60 * 60 * 1000);
  const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000);

  // Creator 1 offers
  await prisma.callOffer.create({
    data: {
      creatorId: creator1.id,
      title: 'Session Conseils Beauté',
      description: 'Une session privée où je partage mes meilleurs conseils beauté et répondre à toutes vos questions sur le maquillage et les soins de la peau.',
      price: 49.99,
      dateTime: new Date(tomorrow.setHours(14, 0, 0, 0)),
      duration: 30,
      status: 'AVAILABLE',
    },
  });

  await prisma.callOffer.create({
    data: {
      creatorId: creator1.id,
      title: 'Relooking Virtuel',
      description: 'Je vous aide à trouver votre style ! Conseils mode personnalisés et recommandations de tenues.',
      price: 79.99,
      dateTime: new Date(threeDaysLater.setHours(16, 30, 0, 0)),
      duration: 45,
      status: 'AVAILABLE',
    },
  });

  // Creator 2 offers
  await prisma.callOffer.create({
    data: {
      creatorId: creator2.id,
      title: 'Consultation Fitness',
      description: 'Programme d\'entraînement personnalisé et conseils nutrition adaptés à vos objectifs.',
      price: 59.99,
      dateTime: new Date(dayAfterTomorrow.setHours(10, 0, 0, 0)),
      duration: 30,
      status: 'AVAILABLE',
    },
  });

  await prisma.callOffer.create({
    data: {
      creatorId: creator2.id,
      title: 'Coaching Motivation',
      description: 'Session de motivation et définition d\'objectifs pour votre parcours fitness.',
      price: 39.99,
      dateTime: new Date(fourDaysLater.setHours(18, 0, 0, 0)),
      duration: 30,
      status: 'AVAILABLE',
    },
  });

  // Creator 3 offers
  await prisma.callOffer.create({
    data: {
      creatorId: creator3.id,
      title: 'Session Gaming & Conseils',
      description: 'Jouons ensemble et je partage mes astuces de gaming ! Tous niveaux bienvenus.',
      price: 44.99,
      dateTime: new Date(tomorrow.setHours(20, 0, 0, 0)),
      duration: 60,
      status: 'AVAILABLE',
    },
  });

  await prisma.callOffer.create({
    data: {
      creatorId: creator3.id,
      title: 'Conseils Setup Gaming',
      description: 'Je vous aide à optimiser votre setup gaming et choix de matériel.',
      price: 54.99,
      dateTime: new Date(fiveDaysLater.setHours(19, 0, 0, 0)),
      duration: 30,
      status: 'AVAILABLE',
    },
  });

  console.log('✅ Call offers created');

  // Create a test regular user
  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {},
    create: {
      email: 'user@example.com',
      password: await bcrypt.hash('password123', 10),
      name: 'Marie Dupont',
      role: 'USER',
    },
  });

  console.log('✅ Regular user created:', regularUser.email);

  // ======================================
  // PHASE 2: Call Requests, Reviews, Payouts, Admin Settings
  // ======================================

  console.log('\n📋 Creating Phase 2 data...');

  // Create admin settings
  const adminSettings = await prisma.adminSettings.upsert({
    where: { key: 'platformCommissionRate' },
    update: {},
    create: {
      key: 'platformCommissionRate',
      value: '10.0',
    },
  });

  console.log('✅ Admin settings created');

  // Create call requests
  const callRequest1 = await prisma.callRequest.create({
    data: {
      userId: regularUser.id,
      creatorId: creator1.id,
      proposedPrice: 45.0,
      proposedDateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days from now
      message: 'Bonjour Emma ! J\'adore ton contenu lifestyle. J\'aimerais discuter de conseils mode pour un événement spécial. 😊',
      status: 'PENDING',
    },
  });

  const callRequest2 = await prisma.callRequest.create({
    data: {
      userId: regularUser.id,
      creatorId: creator2.id,
      proposedPrice: 60.0,
      proposedDateTime: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), // 10 days from now
      message: 'Salut Lucas ! Je voudrais avoir des conseils personnalisés pour ma routine sportive.',
      status: 'ACCEPTED',
    },
  });

  const callRequest3 = await prisma.callRequest.create({
    data: {
      userId: regularUser.id,
      creatorId: creator3.id,
      proposedPrice: 40.0,
      proposedDateTime: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days from now
      message: 'Hello Sophie ! Passionnée par tes voyages, j\'aimerais des conseils pour mon prochain trip !',
      status: 'PENDING',
    },
  });

  console.log('✅ Call requests created');

  // Create bookings for testing reviews
  const offer1 = await prisma.callOffer.findFirst({ where: { creatorId: creator1.id } });
  const offer2 = await prisma.callOffer.findFirst({ where: { creatorId: creator2.id } });

  const booking1 = await prisma.booking.create({
    data: {
      userId: regularUser.id,
      callOfferId: offer1!.id,
      totalPrice: offer1!.price,
      status: 'COMPLETED',
    },
  });

  const booking2 = await prisma.booking.create({
    data: {
      userId: regularUser.id,
      callOfferId: offer2!.id,
      totalPrice: offer2!.price,
      status: 'COMPLETED',
    },
  });

  console.log('✅ Test bookings created');

  // Create reviews for past bookings
  const review1 = await prisma.review.create({
    data: {
      userId: regularUser.id,
      creatorId: creator1.id,
      bookingId: booking1.id,
      rating: 5,
      comment: 'Expérience incroyable ! Emma est super sympa et donne d\'excellents conseils. Je recommande vivement ! ⭐',
    },
  });

  const review2 = await prisma.review.create({
    data: {
      userId: regularUser.id,
      creatorId: creator2.id,
      bookingId: booking2.id,
      rating: 4,
      comment: 'Très bon échange avec Lucas. Ses conseils sont vraiment pratiques et motivants !',
    },
  });

  console.log('✅ Reviews created');

  // Create payouts for creators
  const payout1 = await prisma.payout.create({
    data: {
      creatorId: creator1.id,
      amount: 135.0, // 3 bookings * 50€ * 0.9 (after 10% commission)
      status: 'PAID',
    },
  });

  const payout2 = await prisma.payout.create({
    data: {
      creatorId: creator2.id,
      amount: 90.0, // 2 bookings * 50€ * 0.9
      status: 'PROCESSING',
    },
  });

  const payout3 = await prisma.payout.create({
    data: {
      creatorId: creator3.id,
      amount: 45.0, // 1 booking * 50€ * 0.9
      status: 'PENDING',
    },
  });

  console.log('✅ Payouts created');

  console.log('\n🎉 Seeding completed successfully!');
  console.log('\n📝 Test accounts:');
  console.log('   Admin: john@doe.com / johndoe123');
  console.log('   Creator 1: emma.creator@example.com / password123');
  console.log('   Creator 2: lucas.creator@example.com / password123');
  console.log('   Creator 3: sophie.creator@example.com / password123');
  console.log('   User: user@example.com / password123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding error:', e);
    process.exit(1);
  })
  .finally(async () => {
    //await prisma.$disconnect();
  });
