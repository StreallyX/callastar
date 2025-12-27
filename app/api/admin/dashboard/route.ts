import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/db';
import { verifyToken } from '@/lib/auth';

// GET /api/admin/dashboard - Get admin dashboard metrics
export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin role
    const token = request.cookies.get('auth-token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    }

    const decoded = await verifyToken(token);
    if (!decoded || decoded.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    // Get total revenues - GROUPED BY CURRENCY
    const successfulPayments = await prisma.payment.findMany({
      where: {
        status: 'SUCCEEDED',
      },
      select: {
        amount: true,
        platformFee: true,
        currency: true,
      },
    });

    // Group by currency
    const revenueByCurrency = successfulPayments.reduce((acc, p) => {
      const currency = p.currency || 'EUR';
      acc[currency] = {
        totalRevenue: (acc[currency]?.totalRevenue || 0) + Number(p.amount),
        totalCommissions: (acc[currency]?.totalCommissions || 0) + Number(p.platformFee || 0),
      };
      return acc;
    }, {} as Record<string, { totalRevenue: number; totalCommissions: number }>);

    // Get total bookings count
    const totalBookings = await prisma.booking.count();
    const confirmedBookings = await prisma.booking.count({
      where: { status: 'CONFIRMED' },
    });
    const completedBookings = await prisma.booking.count({
      where: { status: 'COMPLETED' },
    });

    // Get total users and creators
    const totalUsers = await prisma.user.count();
    const totalCreators = await prisma.creator.count();
    const activeCreators = await prisma.creator.count({
      where: {
        isStripeOnboarded: true,
      },
    });

    // Get revenue by day for the last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const revenueByDay = await prisma.payment.groupBy({
      by: ['createdAt'],
      where: {
        status: 'SUCCEEDED',
        createdAt: {
          gte: thirtyDaysAgo,
        },
      },
      _sum: {
        amount: true,
        platformFee: true,
      },
    });

    // Format revenue data by date
    const revenueData = revenueByDay.map((item: any) => ({
      date: item.createdAt.toISOString().split('T')[0],
      revenue: Number(item._sum.amount || 0),
      commission: Number(item._sum.platformFee || 0),
    }));

    // Get recent bookings
    const recentBookings = await prisma.booking.findMany({
      take: 10,
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        user: {
          select: {
            name: true,
            email: true,
          },
        },
        callOffer: {
          include: {
            creator: {
              include: {
                user: {
                  select: {
                    name: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // Format amounts by currency
    const formattedRevenueByCurrency = Object.entries(revenueByCurrency).reduce((acc, [currency, data]) => {
      acc[currency] = {
        totalRevenue: Number(data.totalRevenue.toFixed(2)),
        totalCommissions: Number(data.totalCommissions.toFixed(2)),
      };
      return acc;
    }, {} as Record<string, { totalRevenue: number; totalCommissions: number }>);

    return NextResponse.json({
      metrics: {
        revenueByCurrency: formattedRevenueByCurrency,
        totalBookings,
        confirmedBookings,
        completedBookings,
        totalUsers,
        totalCreators,
        activeCreators,
      },
      revenueData,
      recentBookings,
    });
  } catch (error) {
    console.error('Error fetching admin dashboard:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du dashboard' },
      { status: 500 }
    );
  }
}
