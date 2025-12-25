import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();
const prisma = new PrismaClient();

try {
  const bookings = await prisma.booking.findMany({
    include: {
      user: { select: { name: true, email: true } },
      callOffer: { 
        select: { 
          title: true, 
          status: true,
          creator: {
            select: {
              user: { select: { name: true } }
            }
          }
        } 
      },
    },
  });
  
  console.log('\n=== BOOKINGS IN DATABASE ===\n');
  bookings.forEach((b, i) => {
    console.log(`Booking ${i+1}:`);
    console.log(`  User: ${b.user.name} (${b.user.email})`);
    console.log(`  Creator: ${b.callOffer.creator.user.name}`);
    console.log(`  Call: ${b.callOffer.title}`);
    console.log(`  Booking Status: ${b.status}`);
    console.log(`  CallOffer Status: ${b.callOffer.status}`);
    console.log(`  Payment Intent: ${b.stripePaymentIntentId || 'None'}`);
    console.log('');
  });
  
  console.log(`Total bookings: ${bookings.length}\n`);
} catch (error) {
  console.error('Error:', error.message);
} finally {
  await prisma.$disconnect();
}
