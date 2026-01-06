'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useParams } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { LoadingSpinner, DateDisplay, CurrencyDisplay, StatusBadge } from '@/components/admin';
import {
  Save,
  CreditCard,
  DollarSign,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ShieldAlert,
  Edit,
  Calendar,
} from 'lucide-react';
import { toast } from 'sonner';

interface Creator {
  id: string;
  name: string;
  email: string;
  stripeAccountId: string | null;
  isStripeOnboarded: boolean;
  payoutBlocked: boolean;
  payoutBlockReason: string | null;
}

interface PayoutSchedule {
  id: string;
  creatorId: string;
  mode: 'AUTOMATIC' | 'MANUAL';
  frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY';
  isActive: boolean;
  nextPayoutDate: string | null;
  createdAt: string;
  updatedAt: string;
}

interface Eligibility {
  eligible: boolean;
  reasons: string[];
  availableBalance: number;
  currency: string;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  stripePayoutId: string | null;
  failureReason: string | null;
  createdAt: string;
  updatedAt: string;
}

export default function CreatorStripePage() {
  const router = useRouter();
  const params = useParams();
  const creatorId = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [creator, setCreator] = useState<Creator | null>(null);
  const [payoutSchedule, setPayoutSchedule] = useState<PayoutSchedule | null>(null);
  const [eligibility, setEligibility] = useState<Eligibility | null>(null);
  const [availableBalance, setAvailableBalance] = useState<any>(null);
  const [payoutHistory, setPayoutHistory] = useState<Payout[]>([]);

  // Block/Unblock state
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [blocking, setBlocking] = useState(false);
  const [blockReason, setBlockReason] = useState('');

  // Edit settings state
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState({
    mode: 'AUTOMATIC' as 'AUTOMATIC' | 'MANUAL',
    frequency: 'WEEKLY' as 'DAILY' | 'WEEKLY' | 'MONTHLY',
    isActive: true,
  });

  useEffect(() => {
    if (creatorId) {
      fetchData();
    }
  }, [creatorId]);

  const fetchData = async () => {
    try {
      setRefreshing(true);
      const response = await fetch(`/api/admin/creators/${creatorId}/payout-settings`);
      const data = await response.json();

      if (response.ok && data.success) {
        setCreator(data.creator);
        setPayoutSchedule(data.payoutSchedule);
        setEligibility(data.eligibility);
        setAvailableBalance(data.availableBalance);
        setPayoutHistory(data.payoutHistory || []);

        if (data.payoutSchedule) {
          setEditForm({
            mode: data.payoutSchedule.mode,
            frequency: data.payoutSchedule.frequency,
            isActive: data.payoutSchedule.isActive,
          });
        }
      } else {
        toast.error(data.error || 'Erreur lors du chargement');
        router.push('/dashboard/admin');
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleBlockToggle = async () => {
    if (creator?.payoutBlocked) {
      // Unblock
      setBlocking(true);
      try {
        const response = await fetch(`/api/admin/creators/${creatorId}/block-payout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ blocked: false }),
        });

        const data = await response.json();
        if (response.ok) {
          toast.success('Paiements débloqués');
          fetchData();
        } else {
          toast.error(data.error || 'Erreur');
        }
      } catch (error) {
        toast.error('Erreur lors du déblocage');
      } finally {
        setBlocking(false);
      }
    } else {
      // Open dialog to block
      setBlockDialogOpen(true);
      setBlockReason('');
    }
  };

  const handleBlockSubmit = async () => {
    if (!blockReason.trim()) {
      toast.error('Veuillez entrer une raison');
      return;
    }

    setBlocking(true);
    try {
      const response = await fetch(`/api/admin/creators/${creatorId}/block-payout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ blocked: true, reason: blockReason }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Paiements bloqués');
        setBlockDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors du blocage');
    } finally {
      setBlocking(false);
    }
  };

  const handleEditSettings = () => {
    if (payoutSchedule) {
      setEditForm({
        mode: payoutSchedule.mode,
        frequency: payoutSchedule.frequency,
        isActive: payoutSchedule.isActive,
      });
    }
    setEditDialogOpen(true);
  };

  const handleSaveSettings = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/admin/creators/${creatorId}/payout-settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success('Paramètres mis à jour');
        setEditDialogOpen(false);
        fetchData();
      } else {
        toast.error(data.error || 'Erreur');
      }
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    } finally {
      setSaving(false);
    }
  };

  const handleCheckEligibility = async () => {
    setRefreshing(true);
    try {
      const response = await fetch(`/api/admin/creators/${creatorId}/payout-settings`);
      const data = await response.json();
      if (response.ok && data.success) {
        setEligibility(data.eligibility);
        setAvailableBalance(data.availableBalance);
        toast.success('Éligibilité vérifiée');
      }
    } catch (error) {
      toast.error('Erreur lors de la vérification');
    } finally {
      setRefreshing(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <LoadingSpinner text="Chargement..." />
        </div>
      </div>
    );
  }

  if (!creator) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12">
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertDescription>Créateur introuvable</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const isTestMode = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY?.includes('test');

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-6xl px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
                <CreditCard className="w-8 h-8" />
                Compte Stripe - {creator.name}
              </h1>
              <p className="text-gray-600">{creator.email}</p>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={fetchData}
                disabled={refreshing}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                Actualiser
              </Button>
              <Button variant="outline" onClick={() => router.push('/dashboard/admin')}>
                Retour
              </Button>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-2 gap-6">
          {/* Account Status */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Statut du Compte
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">ID Stripe</span>
                  <span className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                    {creator.stripeAccountId || 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Onboarding</span>
                  {creator.isStripeOnboarded ? (
                    <Badge className="bg-green-500">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Complet
                    </Badge>
                  ) : (
                    <Badge className="bg-yellow-500">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Incomplet
                    </Badge>
                  )}
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Charges activées</span>
                  <Badge className={creator.isStripeOnboarded ? 'bg-green-500' : 'bg-red-500'}>
                    {creator.isStripeOnboarded ? 'Oui' : 'Non'}
                  </Badge>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Paiements activés</span>
                  <Badge className={creator.isStripeOnboarded ? 'bg-green-500' : 'bg-red-500'}>
                    {creator.isStripeOnboarded ? 'Oui' : 'Non'}
                  </Badge>
                </div>
              </div>

              {isTestMode && creator.stripeAccountId && (
                <>
                  <Separator />
                  <Alert className="bg-blue-50 border-blue-200">
                    <ExternalLink className="w-4 h-4" />
                    <AlertDescription>
                      <div className="space-y-2">
                        <p className="font-semibold text-blue-900">Mode Test</p>
                        <p className="text-sm text-blue-700">
                          En mode test/développement, vous pouvez ouvrir le tableau de bord Stripe Express
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-2"
                          onClick={() => {
                            // This would need a server endpoint to generate the login link
                            toast.info('Fonctionnalité à implémenter via l\'API Stripe');
                          }}
                        >
                          <ExternalLink className="w-4 h-4 mr-2" />
                          Ouvrir Dashboard Stripe
                        </Button>
                      </div>
                    </AlertDescription>
                  </Alert>
                </>
              )}
            </CardContent>
          </Card>

          {/* Balance Information */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <DollarSign className="w-5 h-5" />
                  Soldes
                </CardTitle>
                <Button size="sm" variant="ghost" onClick={handleCheckEligibility}>
                  <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {availableBalance ? (
                <>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Solde disponible</span>
                      <span className="text-lg font-bold text-green-600">
                        <CurrencyDisplay
                          amount={availableBalance.available || 0}
                          currency={availableBalance.currency?.toUpperCase() || 'EUR'}
                        />
                      </span>
                    </div>

                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Solde en attente</span>
                      <span className="text-lg font-bold text-yellow-600">
                        <CurrencyDisplay
                          amount={availableBalance.pending || 0}
                          currency={availableBalance.currency?.toUpperCase() || 'EUR'}
                        />
                      </span>
                    </div>

                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <span>Dernière actualisation</span>
                      <span><DateDisplay date={new Date().toISOString()} format="datetime" /></span>
                    </div>
                  </div>
                </>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p>Aucune information de solde disponible</p>
                  <Button size="sm" variant="outline" className="mt-4" onClick={handleCheckEligibility}>
                    Vérifier le solde
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payout Settings */}
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Paramètres de paiement
                </CardTitle>
                {payoutSchedule && (
                  <Button size="sm" variant="ghost" onClick={handleEditSettings}>
                    <Edit className="w-4 h-4" />
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {payoutSchedule ? (
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Mode</span>
                    <Badge variant={payoutSchedule.mode === 'AUTOMATIC' ? 'default' : 'outline'}>
                      {payoutSchedule.mode === 'AUTOMATIC' ? 'Automatique' : 'Manuel'}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Fréquence</span>
                    <Badge variant="outline">
                      {payoutSchedule.frequency === 'DAILY'
                        ? 'Quotidien'
                        : payoutSchedule.frequency === 'WEEKLY'
                        ? 'Hebdomadaire'
                        : 'Mensuel'}
                    </Badge>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm font-medium text-gray-600">Actif</span>
                    <Badge className={payoutSchedule.isActive ? 'bg-green-500' : 'bg-gray-500'}>
                      {payoutSchedule.isActive ? 'Oui' : 'Non'}
                    </Badge>
                  </div>

                  {payoutSchedule.nextPayoutDate && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-600">Prochain paiement</span>
                      <span className="text-sm">
                        <DateDisplay date={payoutSchedule.nextPayoutDate} format="short" />
                      </span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p>Aucun paramètre de paiement configuré</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payout Control */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShieldAlert className="w-5 h-5" />
                Contrôle des paiements
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium text-gray-600">Statut des paiements</span>
                  <Badge className={creator.payoutBlocked ? 'bg-red-500' : 'bg-green-500'}>
                    {creator.payoutBlocked ? 'Bloqué' : 'Actif'}
                  </Badge>
                </div>

                {creator.payoutBlocked && creator.payoutBlockReason && (
                  <Alert className="bg-red-50 border-red-200">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <AlertDescription className="text-red-800">
                      <p className="font-semibold">Raison du blocage:</p>
                      <p className="text-sm mt-1">{creator.payoutBlockReason}</p>
                    </AlertDescription>
                  </Alert>
                )}

                <Button
                  className={`w-full ${
                    creator.payoutBlocked
                      ? 'bg-green-600 hover:bg-green-700'
                      : 'bg-red-600 hover:bg-red-700'
                  }`}
                  onClick={handleBlockToggle}
                  disabled={blocking}
                >
                  {creator.payoutBlocked ? (
                    <>
                      <CheckCircle className="w-4 h-4 mr-2" />
                      Débloquer les paiements
                    </>
                  ) : (
                    <>
                      <XCircle className="w-4 h-4 mr-2" />
                      Bloquer les paiements
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Eligibility Check */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle className="flex items-center gap-2">
                  <CheckCircle className="w-5 h-5" />
                  Éligibilité au paiement
                </CardTitle>
                <Button size="sm" variant="outline" onClick={handleCheckEligibility}>
                  <RefreshCw className={`w-4 h-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
                  Vérifier
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {eligibility ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    {eligibility.eligible ? (
                      <>
                        <CheckCircle className="w-6 h-6 text-green-600" />
                        <div>
                          <p className="font-semibold text-green-900">Éligible au paiement</p>
                          <p className="text-sm text-green-700">
                            Solde disponible:{' '}
                            <CurrencyDisplay
                              amount={eligibility.availableBalance}
                              currency={eligibility.currency}
                            />
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <XCircle className="w-6 h-6 text-red-600" />
                        <div>
                          <p className="font-semibold text-red-900">Non éligible</p>
                          <p className="text-sm text-red-700">Voir les raisons ci-dessous</p>
                        </div>
                      </>
                    )}
                  </div>

                  {!eligibility.eligible && eligibility.reasons.length > 0 && (
                    <Alert className="bg-yellow-50 border-yellow-200">
                      <AlertTriangle className="w-4 h-4 text-yellow-600" />
                      <AlertDescription>
                        <p className="font-semibold text-yellow-900 mb-2">Raisons:</p>
                        <ul className="list-disc list-inside space-y-1 text-sm text-yellow-800">
                          {eligibility.reasons.map((reason, idx) => (
                            <li key={idx}>{reason}</li>
                          ))}
                        </ul>
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p>Cliquez sur "Vérifier" pour contrôler l'éligibilité</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Payout History */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>Historique des paiements (10 derniers)</CardTitle>
            </CardHeader>
            <CardContent>
              {payoutHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b">
                      <tr>
                        <th className="text-left py-2">Date</th>
                        <th className="text-left py-2">Montant</th>
                        <th className="text-left py-2">Statut</th>
                        <th className="text-left py-2">ID Stripe</th>
                        <th className="text-left py-2">Raison échec</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payoutHistory.map((payout) => (
                        <tr key={payout.id} className="border-b hover:bg-gray-50">
                          <td className="py-3">
                            <DateDisplay date={payout.createdAt} format="datetime" />
                          </td>
                          <td className="py-3">
                            <CurrencyDisplay amount={payout.amount} />
                          </td>
                          <td className="py-3">
                            <StatusBadge status={payout.status} type="payout" />
                          </td>
                          <td className="py-3">
                            <span className="text-xs font-mono bg-gray-100 px-2 py-1 rounded">
                              {payout.stripePayoutId?.substring(0, 20) || 'N/A'}
                            </span>
                          </td>
                          <td className="py-3 text-xs text-red-600">
                            {payout.failureReason || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-8 text-center text-gray-500">
                  <p>Aucun historique de paiement</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Block Payout Dialog */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bloquer les paiements</DialogTitle>
            <DialogDescription>
              Veuillez indiquer la raison du blocage des paiements pour {creator.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="blockReason">
                Raison du blocage
                <span className="text-red-500 ml-1">*</span>
              </Label>
              <Textarea
                id="blockReason"
                placeholder="Ex: Activité suspecte, violation des conditions d'utilisation..."
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>
              Annuler
            </Button>
            <Button
              className="bg-red-600 hover:bg-red-700"
              onClick={handleBlockSubmit}
              disabled={blocking || !blockReason.trim()}
            >
              {blocking ? 'Blocage...' : 'Bloquer'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Settings Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les paramètres de paiement</DialogTitle>
            <DialogDescription>
              Configurez les paramètres de paiement pour {creator.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="editMode">Mode de paiement</Label>
              <Select
                value={editForm.mode}
                onValueChange={(value: 'AUTOMATIC' | 'MANUAL') =>
                  setEditForm({ ...editForm, mode: value })
                }
              >
                <SelectTrigger id="editMode">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTOMATIC">Automatique</SelectItem>
                  <SelectItem value="MANUAL">Manuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="editFrequency">Fréquence</Label>
              <Select
                value={editForm.frequency}
                onValueChange={(value: 'DAILY' | 'WEEKLY' | 'MONTHLY') =>
                  setEditForm({ ...editForm, frequency: value })
                }
              >
                <SelectTrigger id="editFrequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="DAILY">Quotidien</SelectItem>
                  <SelectItem value="WEEKLY">Hebdomadaire</SelectItem>
                  <SelectItem value="MONTHLY">Mensuel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label htmlFor="editActive">Actif</Label>
              <Switch
                id="editActive"
                checked={editForm.isActive}
                onCheckedChange={(checked) =>
                  setEditForm({ ...editForm, isActive: checked })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
              Annuler
            </Button>
            <Button onClick={handleSaveSettings} disabled={saving}>
              {saving ? (
                <>
                  <LoadingSpinner size="sm" className="mr-2" />
                  Enregistrement...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Enregistrer
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
