const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkData() {
  try {
    const payoutCount = await prisma.payout.count();
    const payoutAuditCount = await prisma.payoutAuditLog.count();
    const paymentCount = await prisma.payment.count();
    
    console.log('=== Existing Data ===');
    console.log(`Payouts: ${payoutCount}`);
    console.log(`PayoutAuditLogs: ${payoutAuditCount}`);
    console.log(`Payments: ${paymentCount}`);
    
    if (payoutCount > 0) {
      const payouts = await prisma.payout.findMany({
        select: {
          id: true,
          status: true,
          stripePayoutId: true,
        },
        take: 5,
      });
      console.log('\n=== Sample Payouts ===');
      console.log(JSON.stringify(payouts, null, 2));
    }
    
    if (paymentCount > 0) {
      const payments = await prisma.payment.findMany({
        select: {
          id: true,
          payoutStatus: true,
        },
        take: 5,
      });
      console.log('\n=== Sample Payments ===');
      console.log(JSON.stringify(payments, null, 2));
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkData();
