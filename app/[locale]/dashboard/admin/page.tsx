'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Loader2, DollarSign, Users, Calendar, TrendingUp, Send, CheckCircle, Settings as SettingsIcon, Video, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { MultiCurrencyDisplay } from '@/components/admin';

export default function AdminDashboard() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.admin');
  const tStats = useTranslations('dashboard.admin.stats');
  const tActions = useTranslations('dashboard.admin.quickActions');
  const tUsers = useTranslations('dashboard.admin.users');
  const tPayouts = useTranslations('dashboard.admin.payouts');
  const tTestCalls = useTranslations('dashboard.admin.testCalls');
  const tSettings = useTranslations('dashboard.admin.settings');
  const tTabs = useTranslations('dashboard.admin.tabs');
  const [user, setUser] = useState<any>(null);
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [payouts, setPayouts] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);
  const [payoutDialogOpen, setPayoutDialogOpen] = useState(false);
  const [selectedCreator, setSelectedCreator] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [submittingPayout, setSubmittingPayout] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [platformCommission, setPlatformCommission] = useState('');
  const [updatingSettings, setUpdatingSettings] = useState(false);

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
        router.push('/auth/login');
        return;
      }
      const userData = await userResponse.json();
      
      if (userData?.user?.role !== 'ADMIN') {
        router.push('/dashboard/user');
        return;
      }
      
      setUser(userData?.user);
      setAuthChecked(true);

      // Get dashboard data
      const dashboardResponse = await fetch('/api/admin/dashboard');
      if (dashboardResponse.ok) {
        const data = await dashboardResponse.json();
        setDashboardData(data);
      }

      // Get users
      const usersResponse = await fetch('/api/admin/users');
      if (usersResponse.ok) {
        const data = await usersResponse.json();
        setUsers(data?.users ?? []);
      }

      // Get payouts
      const payoutsResponse = await fetch('/api/admin/payouts');
      if (payoutsResponse.ok) {
        const data = await payoutsResponse.json();
        setPayouts(data?.payouts ?? []);
      }

      // Get settings
      const settingsResponse = await fetch('/api/admin/settings');
      if (settingsResponse.ok) {
        const data = await settingsResponse.json();
        setSettings(data?.settings);
        // ✅ CORRECTION #2: Utilisation de platformFeePercentage au lieu de platformCommissionRate
        setPlatformCommission(String(data?.settings?.platformFeePercentage ?? 15));
      }

      // Get bookings
      const bookingsResponse = await fetch('/api/admin/bookings');
      if (bookingsResponse.ok) {
        const data = await bookingsResponse.json();
        setBookings(data?.bookings ?? []);
      }

    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePayout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCreator || !payoutAmount) {
      toast.error('Veuillez remplir tous les champs');
      return;
    }

    setSubmittingPayout(true);

    try {
      const response = await fetch('/api/admin/payouts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          creatorId: selectedCreator,
          amount: Number(payoutAmount),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Échec de la création du paiement');
      }

      toast.success('Paiement créé avec succès!');
      setPayoutDialogOpen(false);
      setSelectedCreator('');
      setPayoutAmount('');
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSubmittingPayout(false);
    }
  };

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdatingSettings(true);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platformFeePercentage: Number(platformCommission), // ✅ CORRECTION #2: Utiliser platformFeePercentage
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Échec de la mise à jour');
      }

      toast.success('Paramètres mis à jour!');
      setSettingsDialogOpen(false);
      fetchData();
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setUpdatingSettings(false);
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

  const creators = users.filter((u) => u.role === 'CREATOR');
  const revenueByCurrency = dashboardData?.metrics?.revenueByCurrency ?? {};
  const totalBookings = dashboardData?.metrics?.totalBookings ?? 0;
  const totalUsers = dashboardData?.metrics?.totalUsers ?? 0;
  const revenueData = dashboardData?.revenueData ?? [];

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Admin Dashboard</h1>
            <p className="text-gray-600">{t('welcome', { name: user?.name })}</p>
          </div>
          <Dialog open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <SettingsIcon className="w-4 h-4 mr-2" />
                Paramètres
              </Button>
            </DialogTrigger>
            <DialogContent>
              <form onSubmit={handleUpdateSettings}>
                <DialogHeader>
                  <DialogTitle>{tSettings('title')}</DialogTitle>
                  <DialogDescription>
                    {tSettings('description')}
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="commission">{tSettings('commission')}</Label>
                    <Input
                      id="commission"
                      type="number"
                      step="0.1"
                      min="0"
                      max="100"
                      value={platformCommission}
                      onChange={(e) => setPlatformCommission(e.target.value)}
                      required
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setSettingsDialogOpen(false)}>
                    {tSettings('cancel')}
                  </Button>
                  <Button type="submit" disabled={updatingSettings}>
                    {updatingSettings ? tSettings('saving') : tSettings('save')}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics */}
        <div className="grid md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <DollarSign className="w-4 h-4" />
                {tStats('totalRevenue')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                <MultiCurrencyDisplay 
                  amounts={Object.entries(revenueByCurrency).reduce((acc, [currency, data]) => {
                    acc[currency] = (data as any).totalRevenue;
                    return acc;
                  }, {} as Record<string, number>)}
                  emptyMessage="0.00"
                  orientation="vertical"
                />
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                {tStats('commissions')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                <MultiCurrencyDisplay 
                  amounts={Object.entries(revenueByCurrency).reduce((acc, [currency, data]) => {
                    acc[currency] = (data as any).totalCommissions;
                    return acc;
                  }, {} as Record<string, number>)}
                  emptyMessage="0.00"
                  orientation="vertical"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {tStats('bookings')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{totalBookings}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {tUsers('title')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-600">{totalUsers}</div>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>{tActions('title')}</CardTitle>
            <CardDescription>{tActions('description')}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-4 hover:bg-purple-50"
                onClick={() => router.push('/dashboard/admin/settings')}
              >
                <SettingsIcon className="w-6 h-6 mb-2" />
                <span className="font-semibold">Paramètres</span>
                <span className="text-xs text-gray-500 mt-1">{tActions('settings.description')}</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-4 hover:bg-purple-50"
                onClick={() => router.push('/dashboard/admin/payments')}
              >
                <DollarSign className="w-6 h-6 mb-2" />
                <span className="font-semibold">Paiements</span>
                <span className="text-xs text-gray-500 mt-1">{tActions('payments.description')}</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-4 hover:bg-purple-50"
                onClick={() => router.push('/dashboard/admin/payouts')}
              >
                <Send className="w-6 h-6 mb-2" />
                <span className="font-semibold">Paiements créateurs</span>
                <span className="text-xs text-gray-500 mt-1">{tActions('payouts.description')}</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-4 hover:bg-purple-50"
                onClick={() => router.push('/dashboard/admin/payouts/dashboard')}
              >
                <TrendingUp className="w-6 h-6 mb-2" />
                <span className="font-semibold">Tableau de bord</span>
                <span className="text-xs text-gray-500 mt-1">{tActions('dashboard.description')}</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-4 hover:bg-purple-50"
                onClick={() => router.push('/dashboard/admin/refunds')}
              >
                <DollarSign className="w-6 h-6 mb-2" />
                <span className="font-semibold">Remboursements</span>
                <span className="text-xs text-gray-500 mt-1">{tActions('refunds.description')}</span>
              </Button>
              
              <Button
                variant="outline"
                className="h-auto flex flex-col items-start p-4 hover:bg-purple-50"
                onClick={() => router.push('/dashboard/admin/system-logs')}
              >
                <Users className="w-6 h-6 mb-2" />
                <span className="font-semibold">Logs</span>
                <span className="text-xs text-gray-500 mt-1">{tActions('logs.description')}</span>
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Revenue Chart */}
        {revenueData.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle>{t('revenueChart.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={revenueData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="revenue" stroke="#8b5cf6" name="{t('revenueChart.revenue')}" />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tabs */}
        <Tabs defaultValue="users" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="users">{tUsers('title')}</TabsTrigger>
            <TabsTrigger value="payouts">Paiements</TabsTrigger>
            <TabsTrigger value="test-calls">{tTestCalls('title')}</TabsTrigger>
          </TabsList>

          {/* Users Tab */}
          <TabsContent value="users">
            <Card>
              <CardHeader>
                <CardTitle>{tUsers('title')}</CardTitle>
                <CardDescription>{tUsers('description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {users.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tUsers('name')}</TableHead>
                          <TableHead>{tUsers('email')}</TableHead>
                          <TableHead>{tUsers('role')}</TableHead>
                          <TableHead>{tUsers('registered')}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {users.map((u: any) => (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">{u.name}</TableCell>
                            <TableCell>{u.email}</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  u.role === 'ADMIN'
                                    ? 'bg-red-500'
                                    : u.role === 'CREATOR'
                                    ? 'bg-purple-500'
                                    : 'bg-blue-500'
                                }
                              >
                                {u.role}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(u.createdAt).toLocaleDateString(locale)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-500">
                    {tUsers('noUsers')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Payouts Tab */}
          <TabsContent value="payouts">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{tPayouts('title')}</CardTitle>
                    <CardDescription>{tPayouts('description')}</CardDescription>
                  </div>
                  <Dialog open={payoutDialogOpen} onOpenChange={setPayoutDialogOpen}>
                    <DialogTrigger asChild>
                      <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
                        <Send className="w-4 h-4 mr-2" />
                        {tPayouts('new')}
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <form onSubmit={handleCreatePayout}>
                        <DialogHeader>
                          <DialogTitle>{tPayouts('create')}</DialogTitle>
                          <DialogDescription>
                            {tPayouts('createDescription')}
                          </DialogDescription>
                        </DialogHeader>
                        <div className="grid gap-4 py-4">
                          <div className="grid gap-2">
                            <Label htmlFor="creator">{tPayouts('creator')}</Label>
                            <Select value={selectedCreator} onValueChange={setSelectedCreator}>
                              <SelectTrigger>
                                <SelectValue placeholder="{tPayouts('selectCreator')}" />
                              </SelectTrigger>
                              <SelectContent>
                                {creators.map((c: any) => (
                                  <SelectItem key={c.creator?.id} value={c.creator?.id}>
                                    {c.name}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid gap-2">
                            <Label htmlFor="amount">{tPayouts('amount')}</Label>
                            <Input
                              id="amount"
                              type="number"
                              step="0.01"
                              min="0.01"
                              placeholder="100.00"
                              value={payoutAmount}
                              onChange={(e) => setPayoutAmount(e.target.value)}
                              required
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => setPayoutDialogOpen(false)}
                          >
                            {tSettings('cancel')}
                          </Button>
                          <Button type="submit" disabled={submittingPayout}>
                            {submittingPayout ? tPayouts('creating') : tPayouts('createButton')}
                          </Button>
                        </DialogFooter>
                      </form>
                    </DialogContent>
                  </Dialog>
                </div>
              </CardHeader>
              <CardContent>
                {payouts.length > 0 ? (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{tPayouts('creator')}</TableHead>
                          <TableHead>Montant</TableHead>
                          <TableHead>Statut</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payouts.map((p: any) => (
                          <TableRow key={p.id}>
                            <TableCell className="font-medium">
                              {p.creator?.user?.name}
                            </TableCell>
                            <TableCell>{Number(p.amount).toFixed(2)} €</TableCell>
                            <TableCell>
                              <Badge
                                className={
                                  p.status === 'PAID'
                                    ? 'bg-green-500'
                                    : p.status === 'PROCESSING'
                                    ? 'bg-blue-500'
                                    : p.status === 'FAILED'
                                    ? 'bg-red-500'
                                    : 'bg-yellow-500'
                                }
                              >
                                {p.status === 'PAID'
                                  ? tPayouts('status.paid')
                                  : p.status === 'PROCESSING'
                                  ? tPayouts('status.processing')
                                  : p.status === 'FAILED'
                                  ? tPayouts('status.failed')
                                  : tPayouts('status.pending')}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {new Date(p.createdAt).toLocaleDateString(locale)}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="py-12 text-center text-gray-500">
                    {tPayouts('noPayouts')}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Test Calls Tab */}
          <TabsContent value="test-calls">
            <Card>
              <CardHeader>
                <CardTitle>{tTestCalls('title')}</CardTitle>
                <CardDescription>{tTestCalls('description')}</CardDescription>
              </CardHeader>
              <CardContent>
                {bookings.length > 0 ? (
                  <div className="space-y-4">
                    {bookings.filter((b: any) => b.status === 'CONFIRMED' && b.dailyRoomUrl).map((booking: any) => {
                      const callDate = new Date(booking?.callOffer?.dateTime);
                      const now = new Date();
                      const isPast = callDate < now;
                      const canJoin = !isPast || (now.getTime() - callDate.getTime()) < 24 * 60 * 60 * 1000; // Can join if not past or less than 24h ago

                      return (
                        <Card key={booking.id} className={isPast ? 'opacity-60' : ''}>
                          <CardContent className="pt-6">
                            <div className="flex items-start justify-between gap-4">
                              <div className="space-y-2 flex-1">
                                <div className="flex items-center gap-3">
                                  <h3 className="font-semibold text-lg">{booking?.callOffer?.title}</h3>
                                  <Badge variant={booking.status === 'CONFIRMED' ? 'default' : 'secondary'}>
                                    {booking.status}
                                  </Badge>
                                  {isPast && <Badge variant="outline">{tTestCalls('past')}</Badge>}
                                </div>
                                <div className="grid grid-cols-2 gap-4 text-sm">
                                  <div>
                                    <p className="text-gray-500">{tTestCalls('creator')}</p>
                                    <p className="font-medium">{booking?.callOffer?.creator?.user?.name}</p>
                                  </div>
                                  <div>
                                    <p className="text-gray-500">{tTestCalls('participant')}</p>
                                    <p className="font-medium">{booking?.user?.name}</p>
                                  </div>
                                </div>
                                <div className="flex items-center gap-4 text-sm text-gray-600">
                                  <div className="flex items-center gap-1">
                                    <Calendar className="w-4 h-4" />
                                    <span>{callDate.toLocaleDateString('fr-FR', {
                                      weekday: 'short',
                                      day: 'numeric',
                                      month: 'short',
                                      year: 'numeric'
                                    })}</span>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <Clock className="w-4 h-4" />
                                    <span>{callDate.toLocaleTimeString(locale, {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })}</span>
                                  </div>
                                </div>
                                <p className="text-xs text-gray-400">
                                  ID: {booking.id.substring(0, 8)}...
                                </p>
                              </div>
                              {canJoin && (
                                <Button
                                  onClick={() => router.push(`/call/${booking.id}`)}
                                  variant={isPast ? 'outline' : 'default'}
                                  className={!isPast ? 'bg-gradient-to-r from-purple-600 to-pink-600' : ''}
                                >
                                  <Video className="w-4 h-4 mr-2" />
                                  {isPast ? tTestCalls('joinTest') : tTestCalls('join')}
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
                    <Video className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                    <p className="text-gray-500">{tTestCalls('noCalls')}</p>
                    <p className="text-sm text-gray-400 mt-2">
                      {tTestCalls('callsInfo')}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
