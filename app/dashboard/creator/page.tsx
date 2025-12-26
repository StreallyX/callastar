'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, DollarSign, Loader2, Plus, Video, TrendingUp, Trash2, MessageSquare, Star, Check, X, CreditCard, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';

export default function CreatorDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [callRequests, setCallRequests] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [stripeOnboarding, setStripeOnboarding] = useState({
    onboarded: false,
    loading: true,
  });
  const [newOffer, setNewOffer] = useState({
    title: '',
    description: '',
    price: '',
    dateTime: '',
    duration: '30',
  });
  const [payoutData, setPayoutData] = useState<any>(null);

  useEffect(() => {
    fetchData();
    
    // ✅ FIX: Check if returning from Stripe onboarding
    const params = new URLSearchParams(window.location.search);
    const onboardingParam = params.get('onboarding');
    
    if (onboardingParam === 'success' || onboardingParam === 'refresh') {
      // User returned from Stripe onboarding - trigger re-verification
      console.log('[Onboarding Return] Re-verifying account status...');
      
      // Show toast notification
      if (onboardingParam === 'success') {
        toast.info('Vérification de votre compte Stripe en cours...');
      }
      
      // Wait a moment for Stripe's systems to update, then re-verify
      setTimeout(async () => {
        try {
          const response = await fetch('/api/stripe/connect-onboard');
          if (response.ok) {
            const data = await response.json();
            setStripeOnboarding({
              onboarded: data?.onboarded ?? false,
              loading: false,
            });
            
            if (data?.onboarded) {
              toast.success('✅ Votre compte Stripe est maintenant configuré !');
            } else if (data?.issues && data.issues.length > 0) {
              toast.warning(`Configuration incomplète: ${data.issues[0]}`);
            } else {
              toast.info('Configuration en cours de vérification...');
            }
          }
        } catch (error) {
          console.error('[Onboarding Return] Error re-verifying:', error);
        }
        
        // Clean up URL
        window.history.replaceState({}, '', window.location.pathname);
      }, 2000); // Wait 2 seconds for Stripe to process
    }
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
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      
      if (userData?.user?.role !== 'CREATOR') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);
      setAuthChecked(true);

      // Get offers
      const offersResponse = await fetch(`/api/call-offers?creatorId=${userData?.user?.creator?.id}`);
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        setOffers(offersData?.callOffers ?? []);
      }

      // Get bookings
      const bookingsResponse = await fetch('/api/bookings/creator');
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        const allBookings = bookingsData?.bookings ?? [];
        // Show both CONFIRMED and PENDING bookings (PENDING may have paid but webhook not processed)
        setBookings(allBookings.filter((b: any) => 
          b?.status === 'CONFIRMED' || b?.status === 'PENDING'
        ));
        
        // Extract payments from bookings
        const bookingPayments = allBookings
          .filter((b: any) => b?.payment)
          .map((b: any) => b.payment);
        setPayments(bookingPayments);
      }

      // Get call requests
      const requestsResponse = await fetch('/api/call-requests?type=received');
      if (requestsResponse.ok) {
        const requestsData = await requestsResponse.json();
        setCallRequests(requestsData?.callRequests ?? []);
      }

      // Get reviews
      if (userData?.user?.creator?.id) {
        const reviewsResponse = await fetch(`/api/reviews/creator/${userData.user.creator.id}`);
        if (reviewsResponse.ok) {
          const reviewsData = await reviewsResponse.json();
          setReviews(reviewsData?.reviews ?? []);
          setAverageRating(reviewsData?.averageRating ?? 0);
        }
      }

      // Check Stripe Connect onboarding status
      const onboardingResponse = await fetch('/api/stripe/connect-onboard');
      if (onboardingResponse.ok) {
        const onboardingData = await onboardingResponse.json();
        setStripeOnboarding({
          onboarded: onboardingData?.onboarded ?? false,
          loading: false,
        });
      } else {
        setStripeOnboarding({ onboarded: false, loading: false });
      }

      // Get payout data
      const payoutResponse = await fetch('/api/payouts/creator');
      if (payoutResponse.ok) {
        const payoutResponseData = await payoutResponse.json();
        setPayoutData(payoutResponseData);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/call-requests/${requestId}/accept`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Échec de l\'acceptation');
      }

      toast.success('Demande acceptée et offre créée!');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const response = await fetch(`/api/call-requests/${requestId}/reject`, {
        method: 'PUT',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Échec du rejet');
      }

      toast.success('Demande rejetée');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreateOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingOffer(true);

    try {
      const response = await fetch('/api/call-offers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...newOffer,
          price: parseFloat(newOffer.price),
          duration: parseInt(newOffer.duration),
        }),
      });

      if (response.ok) {
        toast.success('Offre créée avec succès!');
        setCreateDialogOpen(false);
        setNewOffer({
          title: '',
          description: '',
          price: '',
          dateTime: '',
          duration: '30',
        });
        fetchData();
      } else {
        const error = await response.json();
        throw new Error(error?.error ?? 'Erreur lors de la création');
      }
    } catch (error: any) {
      toast.error(error?.message ?? 'Une erreur est survenue');
    } finally {
      setCreatingOffer(false);
    }
  };

  const handleDeleteOffer = async (offerId: string) => {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette offre ?')) return;

    try {
      const response = await fetch(`/api/call-offers/${offerId}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        toast.success('Offre supprimée avec succès');
        fetchData();
      } else {
        throw new Error('Erreur lors de la suppression');
      }
    } catch (error) {
      toast.error('Impossible de supprimer l\'offre');
    }
  };

  const handleStartStripeOnboarding = async () => {
    const toastId = toast('Redirection vers Stripe...', { duration: Infinity });
    
    try {
      const response = await fetch('/api/stripe/connect-onboard', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        toast.dismiss(toastId);
        toast.success('Redirection en cours...');
        // Redirect to Stripe onboarding
        window.location.href = data.url;
      } else {
        const error = await response.json();
        toast.dismiss(toastId);
        toast.error(error?.error ?? 'Erreur lors de la création du lien d\'onboarding');
        console.error('Stripe onboarding error:', error);
      }
    } catch (error: any) {
      toast.dismiss(toastId);
      toast.error('Une erreur est survenue: ' + (error?.message || 'Erreur inconnue'));
      console.error('Stripe onboarding error:', error);
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

  const totalRevenue = payments.reduce((sum, p) => sum + Number(p?.creatorAmount ?? 0), 0);

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Dashboard Créateur</h1>
          <p className="text-gray-600">Bienvenue, {user?.name}</p>
        </div>

        {/* Stripe Connect Onboarding Alert */}
        {!stripeOnboarding.loading && !stripeOnboarding.onboarded && (
          <Card className="mb-8 border-yellow-200 bg-yellow-50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-yellow-800">
                <DollarSign className="w-5 h-5" />
                Configuration des paiements requise
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-yellow-700 mb-4">
                Pour recevoir vos paiements automatiquement via Stripe Connect, vous devez compléter votre configuration.
                Cela ne prend que quelques minutes.
              </p>
              <Button 
                onClick={handleStartStripeOnboarding}
                className="bg-yellow-600 hover:bg-yellow-700 text-white"
              >
                Configurer Stripe Connect
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Payment Setup Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Configuration des paiements
            </CardTitle>
            <CardDescription>
              Gérez votre compte Stripe et vos paiements
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {stripeOnboarding.loading ? (
                  <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                ) : stripeOnboarding.onboarded ? (
                  <Badge className="bg-green-500 text-white">
                    Paiements activés
                  </Badge>
                ) : (
                  <Badge className="bg-red-500 text-white">
                    Configuration incomplète
                  </Badge>
                )}
                <span className="text-sm text-gray-600">
                  {stripeOnboarding.onboarded 
                    ? 'Votre compte est configuré et prêt à recevoir des paiements'
                    : 'Complétez votre configuration pour recevoir des paiements'
                  }
                </span>
              </div>
              <Link href="/dashboard/creator/payment-setup">
                <Button variant="outline" size="sm">
                  {stripeOnboarding.onboarded ? 'Voir les détails' : 'Configurer'}
                  <ArrowRight className="w-4 h-4 ml-2" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <div className="grid md:grid-cols-3 gap-6 mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Offres actives</CardTitle>
              <Calendar className="w-5 h-5 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{offers.filter(o => o?.status === 'AVAILABLE').length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Appels à venir</CardTitle>
              <Video className="w-5 h-5 text-pink-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{bookings.length}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">Revenus totaux</CardTitle>
              <TrendingUp className="w-5 h-5 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{totalRevenue.toFixed(2)} €</div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="offers" className="space-y-6">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="offers">Offres</TabsTrigger>
            <TabsTrigger value="requests">Demandes</TabsTrigger>
            <TabsTrigger value="calls">Appels</TabsTrigger>
            <TabsTrigger value="reviews">Avis</TabsTrigger>
            <TabsTrigger value="revenue">Revenus</TabsTrigger>
          </TabsList>

          {/* Offers Tab */}
          <TabsContent value="offers" className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold">Mes offres d'appels</h2>
              <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                    <Plus className="w-4 h-4 mr-2" />
                    Créer une offre
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-2xl">
                  <form onSubmit={handleCreateOffer}>
                    <DialogHeader>
                      <DialogTitle>Nouvelle offre d'appel</DialogTitle>
                      <DialogDescription>
                        Créez une nouvelle offre d'appel pour vos fans
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-4">
                      <div>
                        <Label htmlFor="title">Titre</Label>
                        <Input
                          id="title"
                          value={newOffer.title}
                          onChange={(e) => setNewOffer({ ...newOffer, title: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={newOffer.description}
                          onChange={(e) => setNewOffer({ ...newOffer, description: e.target.value })}
                          rows={3}
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label htmlFor="price">Prix (€)</Label>
                          <Input
                            id="price"
                            type="number"
                            step="0.01"
                            value={newOffer.price}
                            onChange={(e) => setNewOffer({ ...newOffer, price: e.target.value })}
                            required
                          />
                        </div>
                        <div>
                          <Label htmlFor="duration">Durée (minutes)</Label>
                          <Input
                            id="duration"
                            type="number"
                            value={newOffer.duration}
                            onChange={(e) => setNewOffer({ ...newOffer, duration: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                      <div>
                        <Label htmlFor="dateTime">Date et heure</Label>
                        <Input
                          id="dateTime"
                          type="datetime-local"
                          value={newOffer.dateTime}
                          onChange={(e) => setNewOffer({ ...newOffer, dateTime: e.target.value })}
                          required
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button type="submit" disabled={creatingOffer}>
                        {creatingOffer ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Création...
                          </>
                        ) : (
                          'Créer'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            </div>

            {offers.length > 0 ? (
              <div className="grid md:grid-cols-2 gap-4">
                {offers.map((offer: any) => {
                  const offerDate = new Date(offer?.dateTime ?? new Date());
                  return (
                    <Card key={offer?.id}>
                      <CardHeader>
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">{offer?.title}</CardTitle>
                            <CardDescription className="mt-1">{offer?.description}</CardDescription>
                          </div>
                          <Badge
                            variant={offer?.status === 'AVAILABLE' ? 'default' : 'secondary'}
                            className={offer?.status === 'AVAILABLE' ? 'bg-green-500' : ''}
                          >
                            {offer?.status}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Calendar className="w-4 h-4" />
                          {offerDate.toLocaleDateString('fr-FR')}
                        </div>
                        <div className="flex items-center gap-2 text-sm text-gray-600">
                          <Clock className="w-4 h-4" />
                          {offerDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {offer?.duration}min
                        </div>
                        <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
                          <DollarSign className="w-4 h-4" />
                          {Number(offer?.price ?? 0).toFixed(2)} €
                        </div>
                        {offer?.status === 'AVAILABLE' && (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleDeleteOffer(offer?.id)}
                            className="mt-2 w-full"
                          >
                            <Trash2 className="w-4 h-4 mr-2" />
                            Supprimer
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune offre créée</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Calls Tab */}
          <TabsContent value="calls">
            <h2 className="text-xl font-semibold mb-4">Appels à venir</h2>
            {bookings.length > 0 ? (
              <div className="space-y-4">
                {bookings.map((booking: any) => {
                  const callDate = new Date(booking?.callOffer?.dateTime ?? new Date());
                  return (
                    <Card key={booking?.id}>
                      <CardContent className="py-4">
                        <div className="flex justify-between items-center">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold">{booking?.callOffer?.title}</h3>
                              <Badge 
                                className={booking?.status === 'CONFIRMED' ? 'bg-green-500' : 'bg-yellow-500'}
                              >
                                {booking?.status === 'CONFIRMED' ? 'Confirmé' : 'En attente'}
                              </Badge>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                              Avec: {booking?.user?.name}
                            </p>
                            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                              <span>{callDate.toLocaleDateString('fr-FR')}</span>
                              <span>{callDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}</span>
                            </div>
                          </div>
                          <Button
                            onClick={() => router.push(`/call/${booking?.id}`)}
                            className="bg-gradient-to-r from-purple-600 to-pink-600"
                          >
                            <Video className="w-4 h-4 mr-2" />
                            Rejoindre
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun appel à venir</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Call Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <h2 className="text-xl font-semibold">Demandes d'appels reçues</h2>
            {callRequests.length > 0 ? (
              <div className="grid gap-4">
                {callRequests.map((request: any) => {
                  const statusColors = {
                    PENDING: 'bg-yellow-100 text-yellow-800',
                    ACCEPTED: 'bg-green-100 text-green-800',
                    REJECTED: 'bg-red-100 text-red-800',
                  };
                  return (
                    <Card key={request.id}>
                      <CardContent className="pt-6">
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <p className="font-semibold text-lg">{request?.user?.name ?? 'Utilisateur'}</p>
                              <Badge className={statusColors[request.status as keyof typeof statusColors]}>
                                {request.status === 'PENDING' ? 'En attente' : request.status === 'ACCEPTED' ? 'Acceptée' : 'Rejetée'}
                              </Badge>
                            </div>
                            <div className="space-y-1 text-sm text-gray-600">
                              <div className="flex items-center gap-2">
                                <Clock className="w-4 h-4" />
                                <span>{request.duration} minutes</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4" />
                                <span>{Number(request.proposedPrice).toFixed(2)} €</span>
                              </div>
                              {request.message && (
                                <div className="flex items-start gap-2 mt-2">
                                  <MessageSquare className="w-4 h-4 mt-0.5" />
                                  <p className="text-sm">{request.message}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                        {request.status === 'PENDING' && (
                          <div className="flex gap-2 mt-4">
                            <Button
                              onClick={() => handleAcceptRequest(request.id)}
                              className="flex-1 bg-green-600 hover:bg-green-700"
                            >
                              <Check className="w-4 h-4 mr-2" />
                              Accepter
                            </Button>
                            <Button
                              onClick={() => handleRejectRequest(request.id)}
                              variant="destructive"
                              className="flex-1"
                            >
                              <X className="w-4 h-4 mr-2" />
                              Rejeter
                            </Button>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <MessageSquare className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucune demande d'appel reçue</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews" className="space-y-4">
            <div className="mb-6">
              <h2 className="text-xl font-semibold mb-2">Mes avis</h2>
              {reviews.length > 0 && (
                <div className="flex items-center gap-3">
                  <div className="flex items-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star
                        key={star}
                        className={`w-6 h-6 ${
                          star <= Math.round(averageRating)
                            ? 'fill-yellow-400 text-yellow-400'
                            : 'text-gray-300'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="font-bold text-2xl">{averageRating.toFixed(1)}</span>
                  <span className="text-gray-500">({reviews.length} avis)</span>
                </div>
              )}
            </div>

            {reviews.length > 0 ? (
              <div className="grid gap-4">
                {reviews.map((review: any) => (
                  <Card key={review.id}>
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
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Star className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">Aucun avis pour le moment</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Revenue Tab */}
          <TabsContent value="revenue" className="space-y-6">
            {/* Payout Summary Cards */}
            <div className="grid md:grid-cols-3 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Total transféré</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-green-600">
                    {payoutData?.summary?.totalEarnings?.toFixed(2) || '0.00'} EUR
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Déjà sur votre compte Stripe</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">En attente</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-yellow-600">
                    {payoutData?.summary?.pendingEarnings?.toFixed(2) || '0.00'} EUR
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Période de sécurité (7 jours)</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-gray-600">Disponible</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">
                    {payoutData?.summary?.readyForPayout?.toFixed(2) || '0.00'} EUR
                  </div>
                  <p className="text-xs text-gray-500 mt-1">Prêt pour transfert</p>
                </CardContent>
              </Card>
            </div>

            {/* Link to Payouts Page */}
            <Card className="border-purple-200 bg-purple-50">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-semibold text-lg mb-1">Gérer vos paiements</h3>
                    <p className="text-sm text-gray-600">
                      Consultez votre solde disponible et gérez vos virements vers votre compte bancaire.
                    </p>
                  </div>
                  <Link href="/dashboard/creator/payouts">
                    <Button variant="outline" className="border-purple-600 text-purple-600 hover:bg-purple-50">
                      <ArrowRight className="w-4 h-4 mr-2" />
                      Voir les payouts
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Payment History */}
            <Card>
              <CardHeader>
                <CardTitle>Historique des paiements</CardTitle>
                <CardDescription>Tous vos paiements et leur statut</CardDescription>
              </CardHeader>
              <CardContent>
                {!payoutData?.payments || payoutData.payments.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">Aucun paiement pour le moment</p>
                ) : (
                  <div className="space-y-4">
                    {payoutData.payments.map((payment: any) => (
                      <div key={payment.id} className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50">
                        <div className="flex-1">
                          <div className="font-medium">{payment.booking?.callOffer?.title}</div>
                          <div className="text-sm text-gray-500">
                            {payment.booking?.user?.name} • {new Date(payment.booking?.callOffer?.dateTime).toLocaleDateString('fr-FR')}
                          </div>
                          <div className="text-xs text-gray-400 mt-1">
                            {payment.payoutReleaseDate && payment.payoutStatus === 'HELD' && (
                              <>Disponible le {new Date(payment.payoutReleaseDate).toLocaleDateString('fr-FR')}</>
                            )}
                            {payment.payoutDate && payment.payoutStatus === 'PAID' && (
                              <>Transféré le {new Date(payment.payoutDate).toLocaleDateString('fr-FR')}</>
                            )}
                          </div>
                        </div>
                        <div className="text-right ml-4">
                          <div className="font-semibold text-lg">{Number(payment.creatorAmount).toFixed(2)} EUR</div>
                          <Badge variant={
                            payment.payoutStatus === 'PAID' ? 'default' :
                            payment.payoutStatus === 'READY' ? 'default' :
                            payment.payoutStatus === 'HELD' ? 'secondary' :
                            'outline'
                          } className={
                            payment.payoutStatus === 'PAID' ? 'bg-green-500' :
                            payment.payoutStatus === 'READY' ? 'bg-purple-500' :
                            payment.payoutStatus === 'HELD' ? 'bg-yellow-500' :
                            ''
                          }>
                            {payment.payoutStatus === 'PAID' && '✓ Transféré'}
                            {payment.payoutStatus === 'READY' && '✓ Disponible'}
                            {payment.payoutStatus === 'HELD' && '⏳ En attente'}
                            {payment.payoutStatus === 'PROCESSING' && '⏳ En cours'}
                            {payment.payoutStatus === 'PENDING' && '⏳ En attente'}
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Info Card */}
            <Card className="bg-blue-50 border-blue-200">
              <CardHeader>
                <CardTitle className="text-blue-800 text-base">📋 Comment fonctionnent les paiements ?</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-blue-700 space-y-2">
                <p><strong>1. Période de sécurité (7 jours) :</strong> Après chaque réservation payée, le montant est sécurisé sur la plateforme pendant 7 jours pour protéger contre les litiges et annulations.</p>
                <p><strong>2. Disponibilité :</strong> Après 7 jours, le montant devient disponible et apparaît dans la section "Disponible".</p>
                <p><strong>3. Demande de paiement :</strong> Vous pouvez demander le transfert vers votre compte Stripe en cliquant sur "Demander le paiement".</p>
                <p><strong>4. Transfert :</strong> Le montant est transféré automatiquement vers votre compte Stripe Connect, puis vers votre compte bancaire selon vos paramètres Stripe.</p>
                <p className="pt-2 border-t border-blue-300 mt-2"><strong>Configuration bancaire :</strong> Pour configurer ou modifier votre compte bancaire, connectez-vous à votre <a href="https://dashboard.stripe.com" target="_blank" rel="noopener noreferrer" className="underline font-semibold">tableau de bord Stripe</a>.</p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
