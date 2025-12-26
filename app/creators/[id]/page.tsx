import Image from 'next/image';
import { Navbar } from '@/components/navbar';
import { Star, Calendar, Clock, DollarSign, MessageSquare } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CallRequestDialog } from '@/components/call-request-dialog';
import Link from 'next/link';
import { db } from '@/lib/db';
import { CurrencyDisplay } from '@/components/ui/currency-display';

async function getCreator(id: string) {
  try {
    const creator = await db.creator.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        callOffers: {
          where: {
            dateTime: {
              gte: new Date(),
            },
          },
          orderBy: {
            dateTime: 'asc',
          },
          take: 10,
        },
      },
    });
    
    if (!creator) return null;
    
    return {
      ...creator,
      user: creator.user,
      callOffers: creator.callOffers,
    };
  } catch (error) {
    console.error('Error fetching creator:', error);
    return null;
  }
}

async function getCreatorReviews(id: string) {
  try {
    const reviews = await db.review.findMany({
      where: {
        booking: {
          callOffer: {
            creatorId: id,
          },
        },
      },
      include: {
        user: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 10,
    });
    
    const totalReviews = reviews.length;
    const averageRating = totalReviews > 0
      ? reviews.reduce((sum, review) => sum + review.rating, 0) / totalReviews
      : 0;
    
    return { reviews, averageRating, totalReviews };
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return { reviews: [], averageRating: 0, totalReviews: 0 };
  }
}

export default async function CreatorProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const creator = await getCreator(id);
  const reviewsData = await getCreatorReviews(id);

  if (!creator) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Créateur introuvable</h1>
          <Link href="/creators">
            <Button variant="outline">Retour aux créateurs</Button>
          </Link>
        </div>
      </div>
    );
  }

  const availableOffers = creator?.callOffers ?? [];
  const { reviews, averageRating, totalReviews } = reviewsData;

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-12">
        {/* Creator Header */}
        <div className="bg-white rounded-xl shadow-sm border p-8 mb-8">
          <div className="flex flex-col md:flex-row gap-8 items-start">
            <div className="relative w-32 h-32 rounded-full overflow-hidden bg-gradient-to-br from-purple-200 to-pink-200 flex-shrink-0">
              {creator?.profileImage ? (
                <Image
                  src={creator.profileImage}
                  alt={creator?.user?.name ?? 'Creator'}
                  fill
                  className="object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Star className="w-16 h-16 text-purple-600" />
                </div>
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-start justify-between gap-4 mb-2">
                <h1 className="text-3xl font-bold">{creator?.user?.name ?? 'Unknown'}</h1>
                <CallRequestDialog creatorId={id} creatorName={creator?.user?.name ?? 'ce créateur'} />
              </div>
              
              {/* Rating Display */}
              {totalReviews > 0 && (
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center">
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
                  </div>
                  <span className="font-semibold text-lg">{averageRating.toFixed(1)}</span>
                  <span className="text-gray-500">({totalReviews} avis)</span>
                </div>
              )}

              <p className="text-gray-600 mb-4 whitespace-pre-wrap">
                {creator?.bio ?? 'Pas de bio disponible'}
              </p>
              <Badge className="bg-gradient-to-r from-purple-600 to-pink-600">
                {availableOffers.length} offre{availableOffers.length !== 1 ? 's' : ''} disponible{availableOffers.length !== 1 ? 's' : ''}
              </Badge>
            </div>
          </div>
        </div>

        {/* Available Call Offers */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Appels disponibles</h2>

          {availableOffers.length > 0 ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {availableOffers.map((offer: any) => {
                const offerDate = new Date(offer?.dateTime ?? new Date());
                const formattedDate = offerDate.toLocaleDateString('fr-FR', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                });
                const formattedTime = offerDate.toLocaleTimeString('fr-FR', {
                  hour: '2-digit',
                  minute: '2-digit',
                });

                return (
                  <Card key={offer?.id} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <h3 className="text-xl font-semibold">{offer?.title ?? 'Untitled'}</h3>
                    </CardHeader>

                    <CardContent className="space-y-3">
                      <p className="text-gray-600 text-sm">{offer?.description ?? ''}</p>

                      <div className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          <span>{formattedDate}</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          <span>{formattedTime} - {offer?.duration ?? 0} minutes</span>
                        </div>

                        <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
                          <DollarSign className="w-4 h-4" />
                          <CurrencyDisplay 
                            amount={Number(offer?.price ?? 0)} 
                            currency={creator?.currency || 'EUR'} 
                          />
                        </div>
                      </div>
                    </CardContent>

                    <CardFooter>
                      <Link href={`/book/${offer?.id}`} className="w-full">
                        <Button className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700">
                          Réserver
                        </Button>
                      </Link>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-12 bg-white rounded-xl shadow-sm border">
              <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 mb-4">Aucun appel disponible pour le moment</p>
              <p className="text-sm text-gray-400">Utilisez le bouton "Proposer un appel" pour envoyer une demande personnalisée</p>
            </div>
          )}
        </div>

        {/* Reviews Section */}
        {totalReviews > 0 && (
          <div>
            <h2 className="text-2xl font-bold mb-6">Avis des utilisateurs</h2>
            <div className="grid gap-4">
              {reviews.slice(0, 6).map((review: any) => (
                <Card key={review.id} className="bg-white">
                  <CardContent className="pt-6">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold">{review?.user?.name ?? 'Anonyme'}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(review.createdAt).toLocaleDateString('fr-FR', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                          })}
                        </p>
                      </div>
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`w-4 h-4 ${
                              star <= review.rating
                                ? 'fill-yellow-400 text-yellow-400'
                                : 'text-gray-300'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {review.comment && (
                      <p className="text-gray-600 text-sm">{review.comment}</p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
