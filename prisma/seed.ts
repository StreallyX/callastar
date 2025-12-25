import { PrismaClient, Prisma, PayoutMode } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Starting database seeding...');

  // Seed default platform settings
  console.log('Creating default platform settings...');
  
  // Check if settings already exist
  const existingSettings = await prisma.platformSettings.findFirst();
  
  if (existingSettings) {
    console.log('Platform settings already exist, skipping...');
  } else {
    const platformSettings = await prisma.platformSettings.create({
      data: {
        platformFeePercentage: new Prisma.Decimal(15.0), // 15%
        platformFeeFixed: null, // No fixed fee by default
        minimumPayoutAmount: new Prisma.Decimal(10.0), // 10 EUR minimum
        holdingPeriodDays: 7, // 7 days holding period
        payoutMode: PayoutMode.AUTOMATIC,
        payoutFrequencyOptions: ['DAILY', 'WEEKLY', 'MONTHLY'],
        currency: 'EUR',
      },
    });
    console.log('✅ Platform settings created:', platformSettings);
  }

  // Optional: Create a test admin user (only in development)
  if (process.env.NODE_ENV === 'development') {
    console.log('Development mode: Checking for admin user...');
    
    const adminEmail = 'admin@callastar.com';
    const existingAdmin = await prisma.user.findUnique({
      where: { email: adminEmail },
    });

    if (existingAdmin) {
      console.log('Admin user already exists, skipping...');
    } else {
      // Note: In production, you should use proper password hashing (bcrypt)
      const adminUser = await prisma.user.create({
        data: {
          email: adminEmail,
          password: '$2a$10$YourHashedPasswordHere', // Replace with actual hashed password
          name: 'Admin User',
          role: 'ADMIN',
        },
      });
      console.log('✅ Admin user created:', adminUser.email);
    }
  }

  console.log('Database seeding completed successfully! 🌱');
}

main()
  .catch((e) => {
    console.error('Error during seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
