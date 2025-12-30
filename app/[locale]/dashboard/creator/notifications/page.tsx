"use client";

import { useState, useEffect } from "react";
import { useRouter } from '@/navigation';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { Navbar } from "@/components/navbar";
import { 
  Bell, 
  Check, 
  Trash2, 
  Filter, 
  ArrowLeft, 
  DollarSign, 
  CreditCard, 
  AlertCircle, 
  CheckCircle, 
  XCircle, 
  TrendingUp,
  AlertTriangle,
  Loader2
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Link } from '@/navigation';

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  link?: string;
  read: boolean;
  createdAt: string;
  metadata?: any;
}

const NOTIFICATION_CATEGORIES = {
  PAYMENTS: {
    label: "Paiements",
    types: ["PAYMENT_RECEIVED"],
    icon: DollarSign,
    color: "text-green-600",
    bgColor: "bg-green-50",
  },
  PAYOUTS: {
    label: "Payouts",
    types: ["PAYOUT_REQUEST", "PAYOUT_APPROVED", "PAYOUT_FAILED", "TRANSFER_FAILED"],
    icon: CreditCard,
    color: "text-blue-600",
    bgColor: "bg-blue-50",
  },
  BOOKINGS: {
    label: "Rendez-vous",
    types: ["BOOKING_CREATED", "BOOKING_CONFIRMED", "CALL_REQUEST_ACCEPTED", "CALL_REQUEST_REJECTED"],
    icon: CheckCircle,
    color: "text-purple-600",
    bgColor: "bg-purple-50",
  },
  DISPUTES: {
    label: "Litiges & Remboursements",
    types: ["REFUND_CREATED", "DISPUTE_CREATED", "DEBT_DEDUCTED", "DEBT_THRESHOLD_EXCEEDED"],
    icon: AlertTriangle,
    color: "text-orange-600",
    bgColor: "bg-orange-50",
  },
  SYSTEM: {
    label: "Système",
    types: ["SYSTEM"],
    icon: Bell,
    color: "text-gray-600",
    bgColor: "bg-gray-50",
  },
};

const NOTIFICATION_TYPES = [
  { value: "", label: "Tous les types" },
  { value: "PAYMENT_RECEIVED", label: "Paiement reçu", category: "PAYMENTS" },
  { value: "PAYOUT_REQUEST", label: "Demande de payout", category: "PAYOUTS" },
  { value: "PAYOUT_APPROVED", label: "Payout approuvé", category: "PAYOUTS" },
  { value: "PAYOUT_FAILED", label: "Payout échoué", category: "PAYOUTS" },
  { value: "BOOKING_CREATED", label: "Nouveau rendez-vous", category: "BOOKINGS" },
  { value: "BOOKING_CONFIRMED", label: "Rendez-vous confirmé", category: "BOOKINGS" },
  { value: "CALL_REQUEST_ACCEPTED", label: "Demande acceptée", category: "BOOKINGS" },
  { value: "CALL_REQUEST_REJECTED", label: "Demande refusée", category: "BOOKINGS" },
  { value: "REFUND_CREATED", label: "Remboursement créé", category: "DISPUTES" },
  { value: "DISPUTE_CREATED", label: "Litige créé", category: "DISPUTES" },
  { value: "DEBT_DEDUCTED", label: "Dette déduite", category: "DISPUTES" },
  { value: "TRANSFER_FAILED", label: "Transfer échoué", category: "PAYOUTS" },
  { value: "DEBT_THRESHOLD_EXCEEDED", label: "Seuil de dette dépassé", category: "DISPUTES" },
  { value: "SYSTEM", label: "Système", category: "SYSTEM" },
];

export default function CreatorNotificationsPage() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('dashboard.creator.notifications');
  const [user, setUser] = useState<any>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRead, setFilterRead] = useState<string>("all"); // all, read, unread
  const [filterType, setFilterType] = useState<string>("");
  const [filterCategory, setFilterCategory] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 20;

  // Check authentication
  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
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
      fetchNotifications();
    } catch (error) {
      console.error('Error checking auth:', error);
      router.push('/auth/login');
    }
  };

  // Fetch notifications
  const fetchNotifications = async () => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams();
      
      if (filterRead === "read") params.append("read", "true");
      if (filterRead === "unread") params.append("read", "false");
      if (filterType) params.append("type", filterType);
      params.append("limit", "100"); // Get more for client-side pagination

      const response = await fetch(`/api/notifications?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        let notifs = data.notifications || [];
        
        // Filter by category if selected
        if (filterCategory) {
          const categoryTypes = NOTIFICATION_CATEGORIES[filterCategory as keyof typeof NOTIFICATION_CATEGORIES]?.types || [];
          notifs = notifs.filter((n: Notification) => categoryTypes.includes(n.type));
        }
        
        setNotifications(notifs);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
    }
  }, [filterRead, filterType, filterCategory]);

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    try {
      const response = await fetch(`/api/notifications/${notificationId}/read`, {
        method: "PATCH",
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error("Error marking notification as read:", error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    try {
      const response = await fetch("/api/notifications/mark-all-read", {
        method: "PATCH",
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error("Error marking all notifications as read:", error);
    }
  };

  // Delete notification
  const deleteNotification = async (notificationId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cette notification ?")) {
      return;
    }

    try {
      const response = await fetch(`/api/notifications/${notificationId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        fetchNotifications();
      }
    } catch (error) {
      console.error("Error deleting notification:", error);
    }
  };

  // Get notification badge and icon
  const getNotificationStyle = (type: string) => {
    // Find category for this type
    let category: any = null;
    for (const [key, cat] of Object.entries(NOTIFICATION_CATEGORIES)) {
      if (cat.types.includes(type)) {
        category = cat;
        break;
      }
    }

    if (!category) {
      category = NOTIFICATION_CATEGORIES.SYSTEM;
    }

    const Icon = category.icon;

    let badgeColor = "bg-gray-100 text-gray-800";
    switch (type) {
      case "PAYMENT_RECEIVED":
        badgeColor = "bg-green-100 text-green-800 border-green-300";
        break;
      case "PAYOUT_REQUEST":
        badgeColor = "bg-blue-100 text-blue-800 border-blue-300";
        break;
      case "PAYOUT_APPROVED":
        badgeColor = "bg-green-100 text-green-800 border-green-300";
        break;
      case "PAYOUT_FAILED":
      case "TRANSFER_FAILED":
        badgeColor = "bg-red-100 text-red-800 border-red-300";
        break;
      case "REFUND_CREATED":
      case "DEBT_DEDUCTED":
        badgeColor = "bg-yellow-100 text-yellow-800 border-yellow-300";
        break;
      case "DISPUTE_CREATED":
      case "DEBT_THRESHOLD_EXCEEDED":
        badgeColor = "bg-red-100 text-red-800 border-red-300";
        break;
      case "BOOKING_CREATED":
      case "BOOKING_CONFIRMED":
      case "CALL_REQUEST_ACCEPTED":
        badgeColor = "bg-purple-100 text-purple-800 border-purple-300";
        break;
      case "CALL_REQUEST_REJECTED":
        badgeColor = "bg-gray-100 text-gray-800 border-gray-300";
        break;
    }

    return { Icon, badgeColor, category };
  };

  // Get category counts
  const getCategoryCounts = () => {
    const counts: Record<string, number> = {};
    Object.keys(NOTIFICATION_CATEGORIES).forEach((cat) => {
      const categoryTypes = NOTIFICATION_CATEGORIES[cat as keyof typeof NOTIFICATION_CATEGORIES].types;
      counts[cat] = notifications.filter((n) => categoryTypes.includes(n.type)).length;
    });
    return counts;
  };

  // Pagination
  const totalPages = Math.ceil(notifications.length / itemsPerPage);
  const paginatedNotifications = notifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-7xl px-4 py-12 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin text-purple-600" />
        </div>
      </div>
    );
  }

  const categoryCounts = getCategoryCounts();

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
          <div>
            <h1 className="text-3xl font-bold mb-2">Notifications</h1>
            <p className="text-gray-600">Gérez vos notifications système et financières</p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Total
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{notifications.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Non lues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600">{unreadCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-gray-600">
                Lues
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-gray-600">
                {notifications.length - unreadCount}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Category Filter Buttons */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-wrap gap-2 mb-4">
              <Button
                variant={filterCategory === "" ? "default" : "outline"}
                onClick={() => {
                  setFilterCategory("");
                  setCurrentPage(1);
                }}
                size="sm"
              >
                Toutes ({notifications.length})
              </Button>
              {Object.entries(NOTIFICATION_CATEGORIES).map(([key, cat]) => {
                const Icon = cat.icon;
                return (
                  <Button
                    key={key}
                    variant={filterCategory === key ? "default" : "outline"}
                    onClick={() => {
                      setFilterCategory(key);
                      setCurrentPage(1);
                    }}
                    size="sm"
                    className="gap-2"
                  >
                    <Icon className="w-4 h-4" />
                    {cat.label} ({categoryCounts[key] || 0})
                  </Button>
                );
              })}
            </div>

            <div className="flex items-center justify-between">
              <Button
                onClick={() => setShowFilters(!showFilters)}
                variant="outline"
                size="sm"
                className="gap-2"
              >
                <Filter className="h-4 w-4" />
                Filtres avancés
              </Button>
              
              {unreadCount > 0 && (
                <Button onClick={markAllAsRead} variant="outline" size="sm" className="gap-2">
                  <Check className="h-4 w-4" />
                  Tout marquer comme lu
                </Button>
              )}
            </div>

            {/* Advanced Filter Options */}
            {showFilters && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg mt-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Statut de lecture
                  </label>
                  <select
                    value={filterRead}
                    onChange={(e) => {
                      setFilterRead(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">Toutes</option>
                    <option value="unread">Non lues</option>
                    <option value="read">Lues</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Type spécifique
                  </label>
                  <select
                    value={filterType}
                    onChange={(e) => {
                      setFilterType(e.target.value);
                      setCurrentPage(1);
                    }}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    {NOTIFICATION_TYPES.map((type) => (
                      <option key={type.value} value={type.value}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notifications List */}
        <Card>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-12 text-center text-gray-500">
                <Loader2 className="w-8 h-8 animate-spin text-purple-600 mx-auto mb-4" />
                <p>Chargement...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
                <p className="text-lg">Aucune notification</p>
                <p className="text-sm mt-2">Vous n'avez aucune notification pour le moment</p>
              </div>
            ) : (
              <>
                <div className="divide-y divide-gray-200">
                  {paginatedNotifications.map((notification) => {
                    const { Icon, badgeColor, category } = getNotificationStyle(notification.type);
                    return (
                      <div
                        key={notification.id}
                        className={`p-6 hover:bg-gray-50 transition-colors ${
                          !notification.read ? "bg-blue-50/50 border-l-4 border-l-blue-500" : ""
                        }`}
                      >
                        <div className="flex items-start gap-4">
                          {/* Icon */}
                          <div className={`flex-shrink-0 w-10 h-10 rounded-full ${category.bgColor} flex items-center justify-center`}>
                            <Icon className={`w-5 h-5 ${category.color}`} />
                          </div>

                          {/* Content */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-4 mb-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge className={badgeColor}>
                                  {NOTIFICATION_TYPES.find((t) => t.value === notification.type)?.label || notification.type}
                                </Badge>
                                <h3 className="text-lg font-semibold text-gray-900">
                                  {notification.title}
                                </h3>
                              </div>
                              <span className="text-sm text-gray-500 whitespace-nowrap">
                                {formatDistanceToNow(
                                  new Date(notification.createdAt),
                                  { addSuffix: true, locale: fr }
                                )}
                              </span>
                            </div>
                            <p className="text-gray-600 mb-2">{notification.message}</p>
                            
                            {notification.link && (
                              <a
                                href={notification.link}
                                className="inline-block text-sm text-purple-600 hover:text-purple-800 hover:underline"
                              >
                                Voir les détails →
                              </a>
                            )}
                          </div>

                          {/* Actions */}
                          <div className="flex items-center gap-2">
                            {!notification.read && (
                              <Button
                                onClick={() => markAsRead(notification.id)}
                                variant="ghost"
                                size="sm"
                                className="text-green-600 hover:text-green-800 hover:bg-green-50"
                                title="Marquer comme lu"
                              >
                                <Check className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              onClick={() => deleteNotification(notification.id)}
                              variant="ghost"
                              size="sm"
                              className="text-red-600 hover:text-red-800 hover:bg-red-50"
                              title="Supprimer"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                    <div className="text-sm text-gray-600">
                      Page {currentPage} sur {totalPages} • {notifications.length} notification{notifications.length > 1 ? 's' : ''}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                        disabled={currentPage === 1}
                        variant="outline"
                        size="sm"
                      >
                        Précédent
                      </Button>
                      <Button
                        onClick={() =>
                          setCurrentPage((prev) => Math.min(totalPages, prev + 1))
                        }
                        disabled={currentPage === totalPages}
                        variant="outline"
                        size="sm"
                      >
                        Suivant
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
