'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, Loader2, Star, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/currency-display';

export default function HistoryPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!userResponse.ok) {
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      setUser(userData?.user);

      const bookingsResponse = await fetch('/api/bookings');
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        setBookings(bookingsData?.bookings ?? []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBooking) return;

    setSubmittingReview(true);

    try {
      const response = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: selectedBooking.id,
          creatorId: selectedBooking.callOffer?.creator?.id,
          rating: reviewData.rating,
          comment: reviewData.comment,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Échec de l\'envoi de l\'avis');
      }

      toast.success('Avis envoyé avec succès!');
      setReviewDialogOpen(false);
      setReviewData({ rating: 5, comment: '' });
      setSelectedBooking(null);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  const pastBookings = bookings.filter((b: any) => {
    const callDate = new Date(b?.callOffer?.dateTime ?? new Date());
    return b?.status === 'COMPLETED' || callDate.getTime() <= Date.now();
  });

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'CONFIRMED':
        return <Badge className="bg-green-500">Confirmé</Badge>;
      case 'PENDING':
        return <Badge className="bg-yellow-500">En attente</Badge>;
      case 'COMPLETED':
        return <Badge variant="outline">Terminé</Badge>;
      case 'CANCELLED':
        return <Badge variant="destructive">Annulé</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const canLeaveReview = (booking: any) => {
    return booking?.status === 'COMPLETED' && !booking?.review;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6">
          <Link href="/dashboard/user">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Historique des Appels</h1>
          <p className="text-gray-600">Tous vos appels passés</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Appels passés</CardTitle>
            <CardDescription>Vous avez {pastBookings.length} appel(s) dans l'historique</CardDescription>
          </CardHeader>
          <CardContent>
            {pastBookings.length > 0 ? (
              <div className="space-y-4">
                {pastBookings.map((booking: any) => {
                  const callDate = new Date(booking?.callOffer?.dateTime ?? new Date());
                  const formattedDate = callDate.toLocaleDateString('fr-FR', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  });

                  return (
                    <Card key={booking?.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between">
                          <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-3">
                              <h3 className="font-semibold text-lg">{booking?.callOffer?.title}</h3>
                              {getStatusBadge(booking?.status)}
                            </div>
                            <p className="text-sm text-gray-600">avec {booking?.callOffer?.creator?.user?.name}</p>
                            <p className="text-sm text-gray-500">{formattedDate}</p>
                            <div className="text-sm text-gray-500">
                              <CurrencyDisplay 
                                amount={Number(booking?.totalPrice)} 
                                currency={booking?.callOffer?.currency || 'EUR'} 
                              />
                            </div>
                            {booking?.review && (
                              <div className="flex items-center gap-2 mt-2">
                                <CheckCircle className="w-4 h-4 text-green-600" />
                                <span className="text-sm text-green-600">Avis laissé</span>
                              </div>
                            )}
                          </div>
                          {canLeaveReview(booking) && (
                            <Button
                              onClick={() => {
                                setSelectedBooking(booking);
                                setReviewDialogOpen(true);
                              }}
                              variant="outline"
                            >
                              <Star className="w-4 h-4 mr-2" />
                              Laisser un avis
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <div className="py-12 text-center">
                <CheckCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Aucun appel terminé</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <form onSubmit={handleSubmitReview}>
            <DialogHeader>
              <DialogTitle>Laisser un avis</DialogTitle>
              <DialogDescription>
                Partagez votre expérience avec {selectedBooking?.callOffer?.creator?.user?.name}
              </DialogDescription>
            </DialogHeader>

            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Note</Label>
                <div className="flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setReviewData({ ...reviewData, rating: star })}
                      className="transition-transform hover:scale-110"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= reviewData.rating
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="comment">Commentaire (optionnel)</Label>
                <Textarea
                  id="comment"
                  placeholder="Partagez votre expérience..."
                  className="min-h-[100px]"
                  value={reviewData.comment}
                  onChange={(e) => setReviewData({ ...reviewData, comment: e.target.value })}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setReviewDialogOpen(false);
                  setReviewData({ rating: 5, comment: '' });
                }}
                disabled={submittingReview}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={submittingReview}
                className="bg-gradient-to-r from-purple-600 to-pink-600"
              >
                {submittingReview ? 'Envoi...' : 'Envoyer l\'avis'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
