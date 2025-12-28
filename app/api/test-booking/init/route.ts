import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getUserFromRequest } from '@/lib/auth';
import bcrypt from 'bcryptjs';
import { BookingStatus } from '@prisma/client';

const TEST_USER_EMAIL = 'test-user@callastar.dev';
const TEST_CREATOR_EMAIL = 'test-creator@callastar.dev';
const TEST_PASSWORD = 'TestPassword123!';
const TEST_ROOM_NAME = 'test-dev-call-room';

/**
 * POST /api/test-booking/init
 * 
 * Initialise ou réinitialise le booking de test
 * Accessible uniquement en mode développement
 */
export async function POST(request: NextRequest) {
  try {
    // Sécurité: Vérifier que nous sommes en environnement de développement
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Cette route n\'est disponible qu\'en développement' },
        { status: 403 }
      );
    }

    // Optionnel: Vérifier que l'utilisateur est admin
    const user = await getUserFromRequest(request);
    if (user && user.role !== 'ADMIN' && user.role !== 'CREATOR') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    console.log('🚀 Initialisation du booking de test via API...');

    // 1. Créer ou récupérer l'utilisateur test
    const hashedPassword = await bcrypt.hash(TEST_PASSWORD, 10);
    
    const testUser = await db.user.upsert({
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

    // 2. Créer ou récupérer le créateur test
    const testCreatorUser = await db.user.upsert({
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

    const testCreator = await db.creator.upsert({
      where: { userId: testCreatorUser.id },
      update: {},
      create: {
        userId: testCreatorUser.id,
        bio: 'Créateur de test pour le développement. Ce profil est utilisé uniquement pour tester les fonctionnalités d\'appel.',
        profileImage: 'https://api.dicebear.com/7.x/avataaars/svg?seed=TestCreator',
        isStripeOnboarded: true,
        currency: 'EUR',
      },
    });

    // 3. Créer ou récupérer l'offre d'appel test
    const futureDate = new Date('2099-12-31T12:00:00Z');
    
    const existingOffer = await db.callOffer.findFirst({
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
      
      // Supprimer l'ancien booking test s'il existe
      if (existingOffer.booking) {
        await db.booking.delete({
          where: { id: existingOffer.booking.id },
        });
      }
    } else {
      testOffer = await db.callOffer.create({
        data: {
          creatorId: testCreator.id,
          title: '🧪 TEST - Appel de développement',
          description: 'Ceci est un appel de test permanent pour le développement. Utilisez-le pour tester les fonctionnalités d\'appel vidéo sans contraintes de temps.',
          price: 0.50,
          currency: 'EUR',
          dateTime: futureDate,
          duration: 30,
          status: 'BOOKED',
          maxParticipants: 1,
        },
      });
    }

    // 4. Créer le booking test
    const testBooking = await db.booking.create({
      data: {
        userId: testUser.id,
        callOfferId: testOffer.id,
        status: BookingStatus.CONFIRMED,
        totalPrice: 0.50,
        isTestBooking: true,
        dailyRoomUrl: `https://callastar.daily.co/${TEST_ROOM_NAME}`,
        dailyRoomName: TEST_ROOM_NAME,
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Booking de test initialisé avec succès',
      data: {
        testUser: {
          id: testUser.id,
          email: testUser.email,
          password: TEST_PASSWORD,
          dashboardUrl: '/dashboard/user/calls',
        },
        testCreator: {
          id: testCreator.id,
          email: testCreatorUser.email,
          password: TEST_PASSWORD,
          dashboardUrl: '/dashboard/creator/bookings',
        },
        testBooking: {
          id: testBooking.id,
          callUrl: `/call/${testBooking.id}`,
          dailyRoomName: TEST_ROOM_NAME,
          status: testBooking.status,
        },
      },
    });

  } catch (error) {
    console.error('Erreur lors de l\'initialisation du booking de test:', error);
    return NextResponse.json(
      { 
        error: 'Erreur lors de l\'initialisation', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/test-booking/init
 * 
 * Retourne les informations du booking de test existant
 */
export async function GET(request: NextRequest) {
  try {
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json(
        { error: 'Cette route n\'est disponible qu\'en développement' },
        { status: 403 }
      );
    }

    // Trouver le booking de test
    const testBooking = await db.booking.findFirst({
      where: {
        isTestBooking: true,
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        callOffer: {
          include: {
            creator: {
              include: {
                user: {
                  select: {
                    id: true,
                    email: true,
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!testBooking) {
      return NextResponse.json(
        { 
          exists: false,
          message: 'Aucun booking de test trouvé. Utilisez POST /api/test-booking/init pour en créer un.',
        },
        { status: 404 }
      );
    }

    return NextResponse.json({
      exists: true,
      data: {
        booking: {
          id: testBooking.id,
          status: testBooking.status,
          callUrl: `/call/${testBooking.id}`,
          dailyRoomName: testBooking.dailyRoomName,
          dailyRoomUrl: testBooking.dailyRoomUrl,
        },
        user: {
          id: testBooking.user.id,
          email: testBooking.user.email,
          name: testBooking.user.name,
          password: TEST_PASSWORD,
          dashboardUrl: '/dashboard/user/calls',
        },
        creator: {
          id: testBooking.callOffer.creator.user.id,
          email: testBooking.callOffer.creator.user.email,
          name: testBooking.callOffer.creator.user.name,
          password: TEST_PASSWORD,
          dashboardUrl: '/dashboard/creator/bookings',
        },
        offer: {
          id: testBooking.callOffer.id,
          title: testBooking.callOffer.title,
          description: testBooking.callOffer.description,
          price: testBooking.callOffer.price.toString(),
          duration: testBooking.callOffer.duration,
        },
      },
    });

  } catch (error) {
    console.error('Erreur lors de la récupération du booking de test:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération' },
      { status: 500 }
    );
  }
}
