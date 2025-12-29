'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, DollarSign, Loader2, Plus, Trash2, ArrowLeft, List, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/currency-display';
import dynamic from 'next/dynamic';

// Import FullCalendar component dynamically
const CalendarView = dynamic(() => import('@/components/calendar-view'), { 
  ssr: false,
  loading: () => <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto" /></div>
});

type ViewMode = 'list' | 'calendar';

export default function OffersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [creatorCurrency, setCreatorCurrency] = useState<string>('EUR');
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [newOffer, setNewOffer] = useState({
    title: '',
    description: '',
    price: '',
    dateTime: '',
    duration: '30',
  });

  // Load view preference from localStorage
  useEffect(() => {
    const savedView = localStorage.getItem('offers-view-mode');
    if (savedView === 'list' || savedView === 'calendar') {
      setViewMode(savedView);
    }
  }, []);

  // Save view preference to localStorage
  const handleViewChange = (mode: ViewMode) => {
    setViewMode(mode);
    localStorage.setItem('offers-view-mode', mode);
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterOffers();
  }, [offers, statusFilter]);

  const fetchData = async () => {
    try {
      const userResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (!userResponse.ok) {
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
      
      const creatorId = userData?.user?.creator?.id;

      // ✅ FIX: Get real Stripe currency from balance API
      if (creatorId) {
        const balanceResponse = await fetch(`/api/stripe/balance/${creatorId}`);
        if (balanceResponse.ok) {
          const balanceData = await balanceResponse.json();
          setCreatorCurrency(balanceData.stripeCurrency || balanceData.currency || 'EUR');
        }
      }

      // Get offers
      const offersResponse = await fetch(`/api/call-offers?creatorId=${creatorId}`);
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        setOffers(offersData?.callOffers ?? []);
      }

      // Get bookings for calendar view
      const bookingsResponse = await fetch(`/api/bookings?creatorId=${userData?.user?.creator?.id}`);
      if (bookingsResponse.ok) {
        const bookingsData = await bookingsResponse.json();
        setBookings(bookingsData?.bookings ?? []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const filterOffers = () => {
    if (statusFilter === 'ALL') {
      setFilteredOffers(offers);
    } else {
      setFilteredOffers(offers.filter((o) => o.status === statusFilter));
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

  // Prepare calendar events
  const getCalendarEvents = () => {
    const events: any[] = [];
    
    // Add all offers as events
    offers.forEach((offer: any) => {
      const statusColors: Record<string, string> = {
        AVAILABLE: '#10b981', // green
        BOOKED: '#f59e0b',    // yellow
        COMPLETED: '#3b82f6', // blue
        CANCELLED: '#ef4444', // red
      };
      
      events.push({
        id: offer.id,
        title: `${offer.title} - ${offer.price} ${offer.currency || creatorCurrency}`,
        start: offer.dateTime,
        end: new Date(new Date(offer.dateTime).getTime() + offer.duration * 60000).toISOString(),
        backgroundColor: statusColors[offer.status] || '#6b7280',
        borderColor: statusColors[offer.status] || '#6b7280',
        extendedProps: {
          type: 'offer',
          status: offer.status,
          description: offer.description,
          price: offer.price,
          duration: offer.duration,
          currency: offer.currency || creatorCurrency,
        },
      });
    });

    // Add confirmed bookings
    bookings.forEach((booking: any) => {
      if (booking.status === 'CONFIRMED' || booking.status === 'PAID') {
        events.push({
          id: `booking-${booking.id}`,
          title: `📞 Appel: ${booking.user?.name || 'Utilisateur'}`,
          start: booking.callOffer?.dateTime,
          end: new Date(new Date(booking.callOffer?.dateTime).getTime() + (booking.callOffer?.duration || 30) * 60000).toISOString(),
          backgroundColor: '#8b5cf6', // purple for confirmed calls
          borderColor: '#7c3aed',
          extendedProps: {
            type: 'booking',
            userName: booking.user?.name,
            status: booking.status,
          },
        });
      }
    });

    return events;
  };

  const handleEventClick = (info: any) => {
    const props = info.event.extendedProps;
    if (props.type === 'offer') {
      alert(`📋 ${info.event.title}\n\n${props.description}\n\nStatut: ${statusLabels[props.status]}\nDurée: ${props.duration} min`);
    } else {
      alert(`📞 Appel confirmé\n\nAvec: ${props.userName}\nStatut: ${props.status}`);
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

  const statusCounts = {
    ALL: offers.length,
    AVAILABLE: offers.filter((o) => o.status === 'AVAILABLE').length,
    BOOKED: offers.filter((o) => o.status === 'BOOKED').length,
    COMPLETED: offers.filter((o) => o.status === 'COMPLETED').length,
    CANCELLED: offers.filter((o) => o.status === 'CANCELLED').length,
  };

  const statusLabels: Record<string, string> = {
    AVAILABLE: 'Disponible',
    BOOKED: 'Réservée',
    COMPLETED: 'Terminée',
    CANCELLED: 'Annulée',
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <Link href="/dashboard/creator">
            <Button variant="ghost" size="sm" className="mb-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Retour au dashboard
            </Button>
          </Link>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">Mes Offres</h1>
              <p className="text-gray-600">Gérez vos offres d'appels et rendez-vous</p>
            </div>
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
                        <Label htmlFor="price">Prix ({creatorCurrency})</Label>
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
        </div>

        {/* View Toggle */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              {/* View Mode Toggle */}
              <div className="flex gap-2">
                <Button
                  variant={viewMode === 'list' ? 'default' : 'outline'}
                  onClick={() => handleViewChange('list')}
                  size="sm"
                  className="gap-2"
                >
                  <List className="w-4 h-4" />
                  Vue Liste
                </Button>
                <Button
                  variant={viewMode === 'calendar' ? 'default' : 'outline'}
                  onClick={() => handleViewChange('calendar')}
                  size="sm"
                  className="gap-2"
                >
                  <CalendarDays className="w-4 h-4" />
                  Vue Calendrier
                </Button>
              </div>

              {/* Status Filters (only for list view) */}
              {viewMode === 'list' && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    variant={statusFilter === 'ALL' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('ALL')}
                    size="sm"
                  >
                    Toutes ({statusCounts.ALL})
                  </Button>
                  <Button
                    variant={statusFilter === 'AVAILABLE' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('AVAILABLE')}
                    size="sm"
                    className={statusFilter === 'AVAILABLE' ? 'bg-green-500 hover:bg-green-600' : ''}
                  >
                    Disponibles ({statusCounts.AVAILABLE})
                  </Button>
                  <Button
                    variant={statusFilter === 'BOOKED' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('BOOKED')}
                    size="sm"
                    className={statusFilter === 'BOOKED' ? 'bg-yellow-500 hover:bg-yellow-600' : ''}
                  >
                    Réservées ({statusCounts.BOOKED})
                  </Button>
                  <Button
                    variant={statusFilter === 'COMPLETED' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('COMPLETED')}
                    size="sm"
                    className={statusFilter === 'COMPLETED' ? 'bg-blue-500 hover:bg-blue-600' : ''}
                  >
                    Terminées ({statusCounts.COMPLETED})
                  </Button>
                  <Button
                    variant={statusFilter === 'CANCELLED' ? 'default' : 'outline'}
                    onClick={() => setStatusFilter('CANCELLED')}
                    size="sm"
                    className={statusFilter === 'CANCELLED' ? 'bg-red-500 hover:bg-red-600' : ''}
                  >
                    Annulées ({statusCounts.CANCELLED})
                  </Button>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* List View */}
        {viewMode === 'list' && (
          <>
            {filteredOffers.length > 0 ? (
              <div className="space-y-4">
                {/* Summary Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-green-600">{statusCounts.AVAILABLE}</div>
                        <p className="text-sm text-gray-600 mt-1">Disponibles</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-yellow-600">{statusCounts.BOOKED}</div>
                        <p className="text-sm text-gray-600 mt-1">Réservées</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600">{statusCounts.COMPLETED}</div>
                        <p className="text-sm text-gray-600 mt-1">Terminées</p>
                      </div>
                    </CardContent>
                  </Card>
                  <Card>
                    <CardContent className="pt-6">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-red-600">{statusCounts.CANCELLED}</div>
                        <p className="text-sm text-gray-600 mt-1">Annulées</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Offers Table */}
                <Card>
                  <CardContent className="pt-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr className="border-b">
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Offre</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Date & Heure</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Durée</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Prix</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Statut</th>
                            <th className="text-left py-3 px-4 font-semibold text-gray-700">Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredOffers.map((offer: any) => {
                            const offerDate = new Date(offer?.dateTime);
                            const statusColors: Record<string, string> = {
                              AVAILABLE: 'bg-green-100 text-green-800 border-green-300',
                              BOOKED: 'bg-yellow-100 text-yellow-800 border-yellow-300',
                              COMPLETED: 'bg-blue-100 text-blue-800 border-blue-300',
                              CANCELLED: 'bg-red-100 text-red-800 border-red-300',
                            };
                            return (
                              <tr key={offer?.id} className="border-b hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-4">
                                  <div>
                                    <div className="font-semibold text-gray-900">{offer?.title}</div>
                                    <div className="text-sm text-gray-600 line-clamp-1">{offer?.description}</div>
                                    {offer?.status === 'BOOKED' && offer?.booking?.user && (
                                      <div className="text-sm text-purple-600 mt-1">
                                        📞 Réservé par {offer.booking.user.name}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4 text-gray-500" />
                                    <div>
                                      <div className="text-sm font-medium">
                                        {offerDate.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
                                      </div>
                                      <div className="text-sm text-gray-600">
                                        {offerDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                                      </div>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-1 text-sm">
                                    <Clock className="w-4 h-4 text-gray-500" />
                                    {offer?.duration} min
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <div className="flex items-center gap-1 font-semibold text-purple-600">
                                    <DollarSign className="w-4 h-4" />
                                    <CurrencyDisplay 
                                      amount={Number(offer?.price ?? 0)} 
                                      currency={offer?.currency || creatorCurrency} 
                                    />
                                  </div>
                                </td>
                                <td className="py-4 px-4">
                                  <Badge className={statusColors[offer?.status as keyof typeof statusColors]}>
                                    {statusLabels[offer?.status as keyof typeof statusLabels]}
                                  </Badge>
                                </td>
                                <td className="py-4 px-4">
                                  {offer?.status === 'AVAILABLE' && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      onClick={() => handleDeleteOffer(offer?.id)}
                                      className="text-red-600 hover:text-red-800 hover:bg-red-50"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </Button>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <p className="text-gray-500">
                    {statusFilter === 'ALL' 
                      ? 'Aucune offre créée' 
                      : `Aucune offre avec le statut "${statusLabels[statusFilter as keyof typeof statusLabels] || statusFilter}"`
                    }
                  </p>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {/* Calendar View */}
        {viewMode === 'calendar' && (
          <Card>
            <CardContent className="pt-6">
              {/* Legend */}
              <div className="mb-4 flex flex-wrap gap-4 text-sm">
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-green-500"></div>
                  <span>Disponible</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-yellow-500"></div>
                  <span>Réservée</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-blue-500"></div>
                  <span>Terminée</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-red-500"></div>
                  <span>Annulée</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded bg-purple-500"></div>
                  <span>📞 Appel confirmé</span>
                </div>
              </div>

              {/* Calendar */}
              <CalendarView 
                events={getCalendarEvents()} 
                onEventClick={handleEventClick}
              />
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
