'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, DollarSign, Loader2, CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useToast } from '@/hooks/use-toast';
import { CurrencyDisplay } from '@/components/ui/currency-display';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ bookingId, onSuccess }: { bookingId: string; onSuccess: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!stripe || !elements) return;

    setLoading(true);

    try {
      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          return_url: `${window.location.origin}/dashboard/user`,
        },
        redirect: 'if_required',
      });

      if (error) {
        toast({
          variant: 'destructive',
          title: 'Erreur de paiement',
          description: error.message,
        });
      } else {
        toast({
          title: 'Paiement réussi !',
          description: 'Votre réservation est confirmée',
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Une erreur est survenue lors du paiement',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <PaymentElement />
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        disabled={!stripe || loading}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Traitement...
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            Payer et réserver
          </>
        )}
      </Button>
    </form>
  );
}

export default function BookOfferPage({ params }: { params: { offerId: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [offer, setOffer] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const offerId = params.offerId;
  const initBookingRef = useRef(false);

  useEffect(() => {
    if (offerId && !initBookingRef.current) {
      initBookingRef.current = true;
      initBooking();
    }
  }, [offerId]);

  const initBooking = async () => {
    if (!offerId) return;

    try {
      // Get current user
      const userResponse = await fetch('/api/auth/me');
      if (userResponse.ok) {
        const userData = await userResponse.json();
        setUser(userData?.user);
      }

      // Get offer details
      const offerResponse = await fetch(`/api/call-offers/${offerId}`);
      if (!offerResponse.ok) {
        throw new Error('Offre introuvable');
      }
      const offerData = await offerResponse.json();
      setOffer(offerData?.callOffer);

      // Check if offer is already booked
      if (offerData?.callOffer?.booking) {
        setExistingBooking(offerData.callOffer.booking);
        setLoading(false);
        return;
      }

      // Create booking
      const bookingResponse = await fetch('/api/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callOfferId: offerId }),
        credentials: 'include',
      });

      if (!bookingResponse.ok) {
        const error = await bookingResponse.json();
        throw new Error(error?.error ?? 'Erreur lors de la réservation');
      }

      const bookingData = await bookingResponse.json();
      setBooking(bookingData?.booking);

      // Create payment intent
      const intentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookingId: bookingData?.booking?.id }),
      });

      if (!intentResponse.ok) {
        throw new Error('Erreur lors de la création du paiement');
      }

      const intentData = await intentResponse.json();
      setClientSecret(intentData?.clientSecret);
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: error?.message ?? 'Une erreur est survenue',
      });
      setTimeout(() => router.push('/creators'), 2000);
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    setTimeout(() => {
      router.push('/dashboard/user');
    }, 1500);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  // If offer is already booked, show booking details
  if (offer && existingBooking) {
    const isUserBooking = user && existingBooking.userId === user.id;
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
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">
                {isUserBooking ? '✅ Votre réservation' : '❌ Offre indisponible'}
              </CardTitle>
              <CardDescription className="text-center">
                {isUserBooking
                  ? 'Cette réservation vous appartient'
                  : 'Cette offre a déjà été réservée par un autre utilisateur'}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-pink-50 p-6 rounded-lg">
                <h3 className="font-semibold text-lg mb-4">{offer?.title}</h3>
                <p className="text-sm text-gray-600 mb-4">{offer?.description}</p>

                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{formattedDate}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Clock className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">{formattedTime} ({offer?.duration} minutes)</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <DollarSign className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">
                      <CurrencyDisplay 
                        amount={Number(offer?.price ?? 0)} 
                        currency={offer?.creator?.currency || 'EUR'} 
                      />
                    </span>
                  </div>
                </div>
              </div>

              {isUserBooking ? (
                <div className="space-y-4">
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                    <p className="text-sm text-green-800">
                      <strong>Statut:</strong>{' '}
                      {existingBooking.status === 'CONFIRMED' ? 'Confirmé ✓' : 
                       existingBooking.status === 'PENDING' ? 'En attente de paiement' :
                       existingBooking.status}
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => router.push('/dashboard/user')}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      Voir mes réservations
                    </Button>
                    {existingBooking.status === 'CONFIRMED' && (
                      <Button
                        onClick={() => router.push(`/call/${existingBooking.id}`)}
                        variant="outline"
                        className="flex-1"
                      >
                        Rejoindre l'appel
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                    <p className="text-sm text-yellow-800">
                      Cette offre n'est plus disponible. Explorez d'autres opportunités !
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => router.push(`/creators/${offer?.creator?.id}`)}
                      variant="outline"
                      className="flex-1"
                    >
                      Voir le profil du créateur
                    </Button>
                    <Button
                      onClick={() => router.push('/creators')}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      Explorer d'autres créateurs
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (!offer || !booking || !clientSecret) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12 text-center">
          <h1 className="text-2xl font-bold mb-4">Erreur de réservation</h1>
          <Button onClick={() => router.push('/creators')} variant="outline">
            Retour aux créateurs
          </Button>
        </div>
      </div>
    );
  }

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
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8 text-center">Réservation et paiement</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Offer Details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails de l'appel</CardTitle>
              <CardDescription>Vérifiez les informations avant de payer</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">{offer?.title}</h3>
                <p className="text-sm text-gray-600">{offer?.description}</p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{formattedDate}</span>
                </div>

                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-gray-400" />
                  <span>{formattedTime} ({offer?.duration} minutes)</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>Total</span>
                  <div className="flex items-center gap-1 text-purple-600">
                    <DollarSign className="w-5 h-5" />
                    <CurrencyDisplay 
                      amount={Number(offer?.price ?? 0)} 
                      currency={offer?.creator?.currency || 'EUR'} 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-xs text-gray-500">
                  Créateur: {offer?.creator?.user?.name ?? 'Unknown'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>Paiement</CardTitle>
              <CardDescription>Entrez vos informations de paiement</CardDescription>
            </CardHeader>
            <CardContent>
              <Elements
                stripe={stripePromise}
                options={{
                  clientSecret,
                  appearance: {
                    theme: 'stripe',
                    variables: {
                      colorPrimary: '#9333ea',
                    },
                  },
                }}
              >
                <CheckoutForm bookingId={booking?.id} onSuccess={handlePaymentSuccess} />
              </Elements>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
