import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

try {
  // Update all PENDING bookings that have payment intents to CONFIRMED
  const result = await prisma.booking.updateMany({
    where: {
      status: 'PENDING',
      stripePaymentIntentId: { not: null }
    },
    data: {
      status: 'CONFIRMED'
    }
  });
  
  console.log(`\n✅ Updated ${result.count} bookings from PENDING to CONFIRMED\n`);
  
  // Show updated bookings
  const bookings = await prisma.booking.findMany({
    where: {
      status: 'CONFIRMED'
    },
    include: {
      user: { select: { name: true } },
      callOffer: { 
        select: { 
          title: true,
          creator: {
            select: {
              user: { select: { name: true } }
            }
          }
        } 
      },
    },
  });
  
  console.log('=== CONFIRMED BOOKINGS ===\n');
  bookings.forEach((b, i) => {
    console.log(`${i+1}. ${b.user.name} → ${b.callOffer.creator.user.name}`);
    console.log(`   Call: ${b.callOffer.title}`);
    console.log(`   Status: ${b.status}\n`);
  });
  
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await prisma.$disconnect();
}
