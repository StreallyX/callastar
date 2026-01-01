import { Navbar } from '@/components/navbar';
import {
  Star,
  Calendar,
  Clock,
  DollarSign,
  Instagram,
  Twitter,
  Youtube,
  ExternalLink,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallRequestDialog } from '@/components/call-request-dialog';
import { Link } from '@/navigation';
import { db } from '@/lib/db';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { getCreatorCurrency } from '@/lib/stripe';
import { CreatorProfileImage } from '@/components/creator-profile-image';
import { CreatorBannerImage } from '@/components/creator-banner-image';
import { getTranslations } from 'next-intl/server';
import { LocalTime } from '@/components/local-time';

async function getCreator(id: string) {
  return db.creator.findUnique({
    where: { id },
    include: {
      user: { select: { id: true, name: true, email: true } },
      callOffers: {
        where: { dateTime: { gte: new Date() } },
        orderBy: { dateTime: 'asc' },
        take: 10,
      },
    },
  });
}

async function getCreatorReviews(id: string) {
  const reviews = await db.review.findMany({
    where: {
      booking: { callOffer: { creatorId: id } },
    },
    include: { user: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  const totalReviews = reviews.length;
  const averageRating =
    totalReviews > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / totalReviews
      : 0;

  return { reviews, averageRating, totalReviews };
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string; locale: string }>;
}) {
  const { id, locale } = await params;
  const t = await getTranslations({
    locale,
    namespace: 'creators.profile',
  });

  const creator = await getCreator(id);
  if (!creator) return null;

  const { reviews, averageRating, totalReviews } =
    await getCreatorReviews(id);

  const creatorCurrency = await getCreatorCurrency(id);
  const offers = creator.callOffers ?? [];
  const creatorTimezone = creator.timezone || 'UTC';

  const socialLinks =
    creator.socialLinks as Record<string, string> | null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* HEADER */}
        <div className="bg-white rounded-xl shadow-sm border overflow-hidden mb-8">
          <CreatorBannerImage
            bannerImage={creator.bannerImage}
            alt="Banner"
          />

          <div className="p-8">
            <div className="flex flex-col md:flex-row gap-8">
              <CreatorProfileImage
                profileImage={creator.profileImage}
                alt={creator.user?.name ?? 'Creator'}
                hasBanner={!!creator.bannerImage}
              />

              <div className="flex-1">
                <div className="flex justify-between items-start mb-2">
                  <h1 className="text-3xl font-bold">
                    {creator.user?.name}
                  </h1>
                  <CallRequestDialog
                    creatorId={id}
                    creatorName={creator.user?.name ?? ''}
                  />
                </div>

                {totalReviews > 0 && (
                  <div className="flex items-center gap-2 mb-4">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-5 h-5 ${
                          star <= Math.round(averageRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                    <span className="font-semibold">
                      {averageRating.toFixed(1)}
                    </span>
                    <span className="text-gray-500">
                      ({totalReviews} {t('rating')})
                    </span>
                  </div>
                )}

                <p className="text-gray-600 whitespace-pre-wrap mb-4">
                  {creator.bio ?? t('noBio')}
                </p>

                <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                  {offers.length} {t('offersAvailable')}
                </Badge>
              </div>
            </div>
          </div>
        </div>

        {/* OFFERS */}
        <h2 className="text-2xl font-bold mb-6">
          {t('availableOffers')}
        </h2>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map((offer) => {
            const isBooked = offer.status === 'BOOKED';
            const date = new Date(offer.dateTime);

            return (
              <Card key={offer.id}>
                <CardHeader>
                  <h3 className="text-xl font-semibold">
                    {offer.title}
                  </h3>
                </CardHeader>

                <CardContent className="space-y-2 text-sm text-gray-600">
                  <div className="flex gap-2">
                    <Calendar className="w-4 h-4" />
                    {date.toLocaleDateString(locale, {
                      timeZone: creatorTimezone,
                    })}
                  </div>

                  <div className="flex gap-2">
                    <Clock className="w-4 h-4" />
                    {date.toLocaleTimeString(locale, {
                      hour: '2-digit',
                      minute: '2-digit',
                      timeZone: creatorTimezone,
                    })}{' '}
                    ({creatorTimezone})
                  </div>

                  {/* 👇 Heure locale visiteur */}
                  <LocalTime
                    utcDate={offer.dateTime.toISOString()}
                    locale={locale}
                    creatorTimezone={creatorTimezone}
                  />

                  <div className="flex gap-2 font-semibold text-purple-600">
                    <CurrencyDisplay
                      amount={Number(offer.price)}
                      currency={creatorCurrency}
                    />
                  </div>
                </CardContent>

                <CardFooter>
                  {isBooked ? (
                    <Button disabled className="w-full">
                      ⛔ {t('alreadyBooked')}
                    </Button>
                  ) : (
                    <Link href={`/book/${offer.id}`} className="w-full">
                      <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600">
                        {t('reserve')}
                      </Button>
                    </Link>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
