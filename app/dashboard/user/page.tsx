'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, Video, Loader2, CheckCircle, MessageSquare, Star, Download } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function UserDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [callRequests, setCallRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [reviewData, setReviewData] = useState({ rating: 5, comment: '' });
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Get user data
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!userResponse.ok) {
        // User is not authenticated - clear cookie and redirect
        document.cookie = 'auth-token=; path=/; expires=Thu, 01 Jan 1970 00:00:01 GMT;';
        // Use router.push instead of window.location to work with Next.js
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      setUser(userData?.user);
      setAuthChecked(true);

      // Get bookings
      const bookingsResponse = await fetch('/api/bookings');
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        setBookings(bookingsData?.bookings ?? []);
      }

      // Get call requests
      const requestsResponse = await fetch('/api/call-requests?type=sent');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setCallRequests(requestsData?.callRequests ?? []);
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

  const handleDownloadCalendar = async (bookingId: string) => {
    try {
      const response = await fetch(`/api/bookings/${bookingId}/calendar`);
      if (!response.ok) {
        throw new Error('Impossible de télécharger le fichier calendrier');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `appel-${bookingId}.ics`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success('Fichier calendrier téléchargé !');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  // Don't render anything until authentication is verified
  if (!authChecked || loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  const upcomingBookings = bookings.filter((b: any) => {
    const callDate = new Date(b?.callOffer?.dateTime ?? new Date());
    // Show both CONFIRMED and PENDING bookings (PENDING may have paid but webhook not processed)
    return (b?.status === 'CONFIRMED' || b?.status === 'PENDING') && callDate.getTime() > Date.now();
  });

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

  const canJoinCall = (booking: any) => {
    const callTime = new Date(booking?.callOffer?.dateTime ?? new Date()).getTime();
    const now = Date.now();
    const fifteenMinutesBefore = callTime - 15 * 60 * 1000;
    const twentyFourHoursAfter = callTime + 24 * 60 * 60 * 1000;
    
    return now >= fifteenMinutesBefore && now <= twentyFourHoursAfter;
  };

  const canLeaveReview = (booking: any) => {
    return booking?.status === 'COMPLETED' && !booking?.review;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Mon Dashboard</h1>
          <p className="text-gray-600">Bienvenue, {user?.name}</p>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Appels à venir</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-purple-600">{upcomingBookings.length}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Demandes envoyées</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{callRequests.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Appels terminés</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-600">{pastBookings.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="upcoming" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upcoming">À venir</TabsTrigger>
            <TabsTrigger value="requests">Mes demandes</TabsTrigger>
            <TabsTrigger value="history">Historique</TabsTrigger>
          </TabsList>

          {/* Upcoming Bookings Tab */}
          <TabsContent value="upcoming">
            <Card>
              <CardHeader>
                <CardTitle>Mes appels à venir</CardTitle>
                <CardDescription>Appels confirmés et payés</CardDescription>
              </CardHeader>
              <CardContent>
                {upcomingBookings.length > 0 ? (
                  <div className="space-y-4">
                    {upcomingBookings.map((booking: any) => {
                      const callDate = new Date(booking?.callOffer?.dateTime ?? new Date());
                      const formattedDate = callDate.toLocaleDateString('fr-FR', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      });
                      const formattedTime = callDate.toLocaleTimeString('fr-FR', {
                        hour: '2-digit',
                        minute: '2-digit',
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
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Calendar className="w-4 h-4" />
                                  <span>{formattedDate}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-gray-500">
                                  <Clock className="w-4 h-4" />
                                  <span>{formattedTime} - {booking?.callOffer?.duration} minutes</span>
                                </div>
                              </div>
                              <div className="flex flex-col gap-2">
                                {canJoinCall(booking) && (
                                  <Button
                                    onClick={() => router.push(`/call/${booking?.id}`)}
                                    className="bg-gradient-to-r from-purple-600 to-pink-600"
                                  >
                                    <Video className="w-4 h-4 mr-2" />
                                    Rejoindre
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleDownloadCalendar(booking?.id)}
                                  variant="outline"
                                  size="sm"
                                >
                                  <Download className="w-4 h-4 mr-2" />
                                  Calendrier
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Aucun appel à venir</p>
                    <Link href="/creators">
                      <Button variant="outline" className="mt-4">
                        Parcourir les créateurs
                      </Button>
                    </Link>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Call Requests Tab */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Mes demandes d'appels</CardTitle>
                <CardDescription>Demandes que vous avez envoyées aux créateurs</CardDescription>
              </CardHeader>
              <CardContent>
                {callRequests.length > 0 ? (
                  <div className="space-y-4">
                    {callRequests.map((request: any) => {
                      const statusColors = {
                        PENDING: 'bg-yellow-100 text-yellow-800',
                        ACCEPTED: 'bg-green-100 text-green-800',
                        REJECTED: 'bg-red-100 text-red-800',
                      };
                      return (
                        <Card key={request.id}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-semibold text-lg">Demande à {request?.creator?.user?.name}</h3>
                                  <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                                    {request.status === 'PENDING' ? 'En attente' : request.status === 'ACCEPTED' ? 'Acceptée' : 'Rejetée'}
                                  </Badge>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{request.duration} min</span>
                                  </div>
                                  <span>•</span>
                                  <span>{Number(request.proposedPrice).toFixed(2)} €</span>
                                </div>
                                {request.message && (
                                  <div className="flex items-start gap-2 mt-2">
                                    <MessageSquare className="w-4 h-4 mt-0.5 text-gray-400" />
                                    <p className="text-sm text-gray-600">{request.message}</p>
                                  </div>
                                )}
                                <p className="text-xs text-gray-400">
                                  Envoyé le {new Date(request.createdAt).toLocaleDateString('fr-FR')}
                                </p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                ) : (
                  <div className="py-12 text-center">
                    <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">Aucune demande envoyée</p>
                    <p className="text-sm text-gray-400 mt-2">Visitez un profil de créateur pour proposer un appel</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle>Historique des appels</CardTitle>
                <CardDescription>Appels passés et terminés</CardDescription>
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
          </TabsContent>
        </Tabs>
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
