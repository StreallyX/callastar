'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar, Clock, DollarSign, Loader2, CreditCard } from 'lucide-react';
import { loadStripe } from '@stripe/stripe-js';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { useToast } from '@/hooks/use-toast';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import { useTranslations, useLocale } from 'next-intl';
import { Badge } from '@/components/ui/badge';
import { AlertCircle } from 'lucide-react';

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY || '');

function CheckoutForm({ bookingId, onSuccess, disabled = false }: { bookingId: string; onSuccess: () => void; disabled?: boolean }) {
  const stripe = useStripe();
  const elements = useElements();
  const { toast } = useToast();
  const t = useTranslations('booking');
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
          title: t('paymentError'),
          description: error.message,
        });
      } else {
        toast({
          title: t('paymentSuccess'),
          description: t('bookingConfirmed'),
        });
        onSuccess();
      }
    } catch (error) {
      toast({
        variant: 'destructive',
        title: t('paymentError'),
        description: t('genericError'),
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={`space-y-6 ${disabled ? 'opacity-50 pointer-events-none cursor-not-allowed' : ''}`}>
      <PaymentElement />
      <Button
        type="submit"
        className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
        disabled={!stripe || loading || disabled}
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            {t('processing')}
          </>
        ) : (
          <>
            <CreditCard className="w-4 h-4 mr-2" />
            {t('payAndBook')}
          </>
        )}
      </Button>
    </form>
  );
}

export default function BookOfferPage({ params }: { params: { offerId: string; locale: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const t = useTranslations('booking');
  const locale = useLocale();
  const [offer, setOffer] = useState<any>(null);
  const [booking, setBooking] = useState<any>(null);
  const [existingBooking, setExistingBooking] = useState<any>(null);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const offerId = params.offerId;
  const initBookingRef = useRef(false);

  // ✅ FIX: Add proper dependency array to prevent infinite loops
  // Only run once when component mounts with offerId
  useEffect(() => {
    if (offerId && !initBookingRef.current) {
      initBookingRef.current = true;
      initBooking();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - run only once on mount

  // ✅ REFACTORED: New payment-first flow
  // No booking is created until payment succeeds (prevents slot blocking without payment)
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
        throw new Error(t('offerNotFound'));
      }
      const offerData = await offerResponse.json();
      setOffer(offerData?.callOffer);

      // Check if offer is already booked (by status or by existing booking)
      const isOfferBooked = offerData?.callOffer?.status === 'BOOKED' || 
                            offerData?.callOffer?.booking;
      
      if (isOfferBooked) {
        setExistingBooking(offerData.callOffer.booking);
        setLoading(false);
        return;
      }

      // ✅ NEW FLOW: Create payment intent directly with callOfferId (no booking yet)
      // The booking will be created automatically after payment succeeds (webhook)
      const intentResponse = await fetch('/api/payments/create-intent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ callOfferId: offerId }),
        credentials: 'include',
      });

      if (!intentResponse.ok) {
        const error = await intentResponse.json();
        throw new Error(error?.error ?? t('paymentError'));
      }

      const intentData = await intentResponse.json();
      setClientSecret(intentData?.clientSecret);
      
      // ✅ Set a temporary booking object for UI display (actual booking created after payment)
      setBooking({
        id: 'pending', // Temporary ID for UI
        callOfferId: offerId,
        totalPrice: offerData?.callOffer?.price,
        status: 'PENDING_PAYMENT', // Indicates payment not yet completed
      });
      
      console.log('✅ Payment intent created - booking will be created after payment succeeds');
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: t('paymentError'),
        description: error?.message ?? t('genericError'),
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
    const formattedDate = offerDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const formattedTime = offerDate.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card className="max-w-2xl mx-auto">
            <CardHeader>
              <div className="flex justify-center mb-4">
                <Badge variant="destructive" className="text-lg px-6 py-2 bg-red-600 hover:bg-red-700">
                  {isUserBooking ? t('yourBookingBadge') : t('alreadyBooked')}
                </Badge>
              </div>
              <CardTitle className="text-center">
                {isUserBooking ? t('yourBooking') : t('offerUnavailable')}
              </CardTitle>
              <CardDescription className="text-center">
                {isUserBooking
                  ? t('yourBookingDesc')
                  : t('offerUnavailableDesc')}
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
                    <span className="font-medium">{formattedTime} ({offer?.duration} {t('minutes')})</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
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
                      <strong>{t('status')}:</strong>{' '}
                      {existingBooking.status === 'CONFIRMED' ? t('confirmed') : 
                       existingBooking.status === 'PENDING' ? t('pending') :
                       existingBooking.status}
                    </p>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => router.push('/dashboard/user')}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      {t('viewBookings')}
                    </Button>
                    {existingBooking.status === 'CONFIRMED' && (
                      <Button
                        onClick={() => router.push(`/call/${existingBooking.id}`)}
                        variant="outline"
                        className="flex-1"
                      >
                        {t('joinCall')}
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-red-900 mb-1">
                        {t('offerNotAvailable')}
                      </p>
                      <p className="text-xs text-red-700">
                        {t('offerBookedExplanation')}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex gap-3">
                    <Button
                      onClick={() => router.push(`/creators/${offer?.creator?.id}`)}
                      variant="outline"
                      className="flex-1"
                    >
                      {t('viewCreatorProfile')}
                    </Button>
                    <Button
                      onClick={() => router.push('/creators')}
                      className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600"
                    >
                      {t('exploreCreators')}
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
          <h1 className="text-2xl font-bold mb-4">{t('error')}</h1>
          <Button onClick={() => router.push('/creators')} variant="outline">
            {t('backToCreators')}
          </Button>
        </div>
      </div>
    );
  }

  const offerDate = new Date(offer?.dateTime ?? new Date());
  const formattedDate = offerDate.toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = offerDate.toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-12">
        <h1 className="text-3xl font-bold mb-8 text-center">{t('title')}</h1>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Offer Details */}
          <Card>
            <CardHeader>
              <CardTitle>{t('callDetails')}</CardTitle>
              <CardDescription>{t('verifyInfo')}</CardDescription>
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
                  <span>{formattedTime} ({offer?.duration} {t('minutes')})</span>
                </div>
              </div>

              <div className="pt-4 border-t">
                <div className="flex items-center justify-between text-lg font-semibold">
                  <span>{t('total')}</span>
                  <div className="text-purple-600">
                    <CurrencyDisplay 
                      amount={Number(offer?.price ?? 0)} 
                      currency={offer?.creator?.currency || 'EUR'} 
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <p className="text-xs text-gray-500">
                  {t('creator')}: {offer?.creator?.user?.name ?? 'Unknown'}
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle>{t('payment')}</CardTitle>
              <CardDescription>{t('paymentInfo')}</CardDescription>
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
