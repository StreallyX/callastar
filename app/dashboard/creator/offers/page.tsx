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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Clock, DollarSign, Loader2, Plus, Trash2, ArrowLeft, Edit } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { CurrencyDisplay } from '@/components/ui/currency-display';

export default function OffersPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [offers, setOffers] = useState<any[]>([]);
  const [filteredOffers, setFilteredOffers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingOffer, setCreatingOffer] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [creatorCurrency, setCreatorCurrency] = useState<string>('EUR');
  const [newOffer, setNewOffer] = useState({
    title: '',
    description: '',
    price: '',
    dateTime: '',
    duration: '30',
  });

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
      if (userData?.user?.creator?.currency) {
        setCreatorCurrency(userData.user.creator.currency);
      }

      // Get offers
      const offersResponse = await fetch(`/api/call-offers?creatorId=${userData?.user?.creator?.id}`);
      if (offersResponse.ok) {
        const offersData = await offersResponse.json();
        setOffers(offersData?.callOffers ?? []);
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

  // Group offers by date
  const offersByDate = filteredOffers.reduce((acc, offer) => {
    const date = new Date(offer.dateTime).toLocaleDateString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(offer);
    return acc;
  }, {} as Record<string, any[]>);

  const statusCounts = {
    ALL: offers.length,
    AVAILABLE: offers.filter((o) => o.status === 'AVAILABLE').length,
    BOOKED: offers.filter((o) => o.status === 'BOOKED').length,
    COMPLETED: offers.filter((o) => o.status === 'COMPLETED').length,
    CANCELLED: offers.filter((o) => o.status === 'CANCELLED').length,
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
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-3xl font-bold mb-2">Mes Offres</h1>
              <p className="text-gray-600">Gérez vos offres d'appels disponibles</p>
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

        {/* Status Filter */}
        <Card className="mb-6">
          <CardContent className="pt-6">
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
                className={statusFilter === 'AVAILABLE' ? 'bg-green-500' : ''}
              >
                Disponibles ({statusCounts.AVAILABLE})
              </Button>
              <Button
                variant={statusFilter === 'BOOKED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('BOOKED')}
                size="sm"
                className={statusFilter === 'BOOKED' ? 'bg-yellow-500' : ''}
              >
                Réservées ({statusCounts.BOOKED})
              </Button>
              <Button
                variant={statusFilter === 'COMPLETED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('COMPLETED')}
                size="sm"
                className={statusFilter === 'COMPLETED' ? 'bg-blue-500' : ''}
              >
                Terminées ({statusCounts.COMPLETED})
              </Button>
              <Button
                variant={statusFilter === 'CANCELLED' ? 'default' : 'outline'}
                onClick={() => setStatusFilter('CANCELLED')}
                size="sm"
                className={statusFilter === 'CANCELLED' ? 'bg-red-500' : ''}
              >
                Annulées ({statusCounts.CANCELLED})
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Offers List */}
        {filteredOffers.length > 0 ? (
          <div className="space-y-8">
            {Object.entries(offersByDate).map(([date, dateOffers]) => (
              <div key={date}>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  {date}
                </h2>
                <div className="grid md:grid-cols-2 gap-4">
                  {(dateOffers as any[]).map((offer: any) => {
                    const offerDate = new Date(offer?.dateTime);
                    const statusColors = {
                      AVAILABLE: 'bg-green-500',
                      BOOKED: 'bg-yellow-500',
                      COMPLETED: 'bg-blue-500',
                      CANCELLED: 'bg-red-500',
                    };
                    const statusLabels = {
                      AVAILABLE: 'Disponible',
                      BOOKED: 'Réservée',
                      COMPLETED: 'Terminée',
                      CANCELLED: 'Annulée',
                    };
                    return (
                      <Card key={offer?.id}>
                        <CardHeader>
                          <div className="flex justify-between items-start">
                            <div className="flex-1">
                              <CardTitle className="text-lg">{offer?.title}</CardTitle>
                              <CardDescription className="mt-1">{offer?.description}</CardDescription>
                            </div>
                            <Badge
                              className={statusColors[offer?.status as keyof typeof statusColors]}
                            >
                              {statusLabels[offer?.status as keyof typeof statusLabels]}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-2">
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Clock className="w-4 h-4" />
                            {offerDate.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })} - {offer?.duration}min
                          </div>
                          <div className="flex items-center gap-2 text-sm font-semibold text-purple-600">
                            <DollarSign className="w-4 h-4" />
                            <CurrencyDisplay 
                              amount={Number(offer?.price ?? 0)} 
                              currency={offer?.currency || creatorCurrency} 
                            />
                          </div>
                          {offer?.status === 'AVAILABLE' && (
                            <div className="flex gap-2 mt-4">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteOffer(offer?.id)}
                                className="flex-1"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Supprimer
                              </Button>
                            </div>
                          )}
                          {offer?.status === 'BOOKED' && (
                            <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                              <p className="text-yellow-800">Réservée par {offer?.booking?.user?.name}</p>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
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
      </div>
    </div>
  );
}

const statusLabels = {
  AVAILABLE: 'Disponible',
  BOOKED: 'Réservée',
  COMPLETED: 'Terminée',
  CANCELLED: 'Annulée',
};
