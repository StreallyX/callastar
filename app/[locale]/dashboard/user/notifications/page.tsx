'use client';

import { useEffect, useState } from 'react';
import { useRouter } from '@/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Bell, Loader2, ArrowLeft, CheckCircle2, Circle } from 'lucide-react';
import { toast } from 'sonner';
import { Link } from '@/navigation';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

export default function NotificationsPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);

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

      const notificationsResponse = await fetch('/api/notifications');
      if (notificationsResponse.ok) {
        const data = await notificationsResponse.json();
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour');
      }

      // Update local state
      setNotifications(notifications.map(n => 
        n.id === notificationId ? { ...n, read: true, readAt: new Date().toISOString() } : n
      ));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      const response = await fetch('/api/notifications/mark-all-read', {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error('Erreur lors de la mise à jour');
      }

      // Update local state
      const now = new Date().toISOString();
      setNotifications(notifications.map(n => ({ ...n, read: true, readAt: now })));
      setUnreadCount(0);
      toast.success('Toutes les notifications ont été marquées comme lues');
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
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

  const unreadNotifications = notifications.filter(n => !n.read);
  const readNotifications = notifications.filter(n => n.read);

  const getNotificationTypeColor = (type: string) => {
    switch (type) {
      case 'BOOKING_CONFIRMED':
        return 'bg-green-100 text-green-800';
      case 'BOOKING_CANCELLED':
        return 'bg-red-100 text-red-800';
      case 'CALL_REQUEST':
        return 'bg-blue-100 text-blue-800';
      case 'REVIEW_RECEIVED':
        return 'bg-purple-100 text-purple-800';
      case 'PAYMENT_RECEIVED':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getNotificationTypeLabel = (type: string) => {
    switch (type) {
      case 'BOOKING_CONFIRMED':
        return 'Réservation';
      case 'BOOKING_CANCELLED':
        return 'Annulation';
      case 'CALL_REQUEST':
        return 'Demande';
      case 'REVIEW_RECEIVED':
        return 'Avis';
      case 'PAYMENT_RECEIVED':
        return 'Paiement';
      default:
        return 'Notification';
    }
  };

  const renderNotificationCard = (notification: any) => (
    <Card key={notification.id} className={!notification.read ? 'border-l-4 border-l-purple-600' : ''}>
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="mt-1">
            {notification.read ? (
              <CheckCircle2 className="w-5 h-5 text-gray-400" />
            ) : (
              <Circle className="w-5 h-5 text-purple-600 fill-purple-600" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Badge className={getNotificationTypeColor(notification.type)}>
                    {getNotificationTypeLabel(notification.type)}
                  </Badge>
                  {!notification.read && (
                    <Badge variant="secondary">Nouveau</Badge>
                  )}
                </div>
                <h3 className="font-semibold text-lg">{notification.title}</h3>
                <p className="text-sm text-gray-600">{notification.message}</p>
                <p className="text-xs text-gray-400">
                  {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true, locale: fr })}
                </p>
              </div>
              {!notification.read && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleMarkAsRead(notification.id)}
                >
                  Marquer comme lu
                </Button>
              )}
            </div>
            {notification.link && (
              <Link href={notification.link}>
                <Button variant="outline" size="sm" className="mt-2">
                  Voir détails
                </Button>
              </Link>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );

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

        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2">Notifications</h1>
            <p className="text-gray-600">
              {unreadCount > 0 ? `Vous avez ${unreadCount} notification(s) non lue(s)` : 'Aucune nouvelle notification'}
            </p>
          </div>
          {unreadCount > 0 && (
            <Button onClick={handleMarkAllAsRead} variant="outline">
              <CheckCircle2 className="w-4 h-4 mr-2" />
              Tout marquer comme lu
            </Button>
          )}
        </div>

        {/* Unread Notifications */}
        {unreadNotifications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Nouvelles notifications</CardTitle>
              <CardDescription>{unreadNotifications.length} notification(s) non lue(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {unreadNotifications.map(renderNotificationCard)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Read Notifications */}
        {readNotifications.length > 0 && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Notifications lues</CardTitle>
              <CardDescription>{readNotifications.length} notification(s) lue(s)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {readNotifications.map(renderNotificationCard)}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {notifications.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">Aucune notification</p>
              <p className="text-sm text-gray-400 mt-2">Vous recevrez des notifications ici pour vos appels et demandes</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
