"use client";

import { useState, useEffect } from "react";
import { Bell, Check, Trash2, Filter, X } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { fr } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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

const NOTIFICATION_TYPES = [
  { value: "", label: "Tous les types" },
  { value: "PAYMENT_RECEIVED", label: "Paiement reçu" },
  { value: "PAYOUT_REQUEST", label: "Demande de payout" },
  { value: "PAYOUT_APPROVED", label: "Payout approuvé" },
  { value: "PAYOUT_FAILED", label: "Payout échoué" },
  { value: "REFUND_CREATED", label: "Remboursement créé" },
  { value: "DISPUTE_CREATED", label: "Litige créé" },
  { value: "DEBT_DEDUCTED", label: "Dette déduite" },
  { value: "TRANSFER_FAILED", label: "Transfer échoué" },
  { value: "DEBT_THRESHOLD_EXCEEDED", label: "Seuil de dette dépassé" },
  { value: "SYSTEM", label: "Système" },
];

export default function CreatorNotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [filterRead, setFilterRead] = useState<string>("all"); // all, read, unread
  const [filterType, setFilterType] = useState<string>("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const itemsPerPage = 20;

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
        setNotifications(data.notifications || []);
        setUnreadCount(data.unreadCount || 0);
      }
    } catch (error) {
      console.error("Error fetching notifications:", error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [filterRead, filterType]);

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

  // Get notification badge color
  const getNotificationBadge = (type: string) => {
    switch (type) {
      case "PAYMENT_RECEIVED":
        return <Badge className="bg-green-100 text-green-800">Paiement</Badge>;
      case "PAYOUT_REQUEST":
        return <Badge className="bg-blue-100 text-blue-800">Payout</Badge>;
      case "PAYOUT_APPROVED":
        return <Badge className="bg-green-100 text-green-800">Approuvé</Badge>;
      case "PAYOUT_FAILED":
        return <Badge className="bg-red-100 text-red-800">Échoué</Badge>;
      case "REFUND_CREATED":
        return <Badge className="bg-yellow-100 text-yellow-800">Remboursement</Badge>;
      case "DISPUTE_CREATED":
        return <Badge className="bg-red-100 text-red-800">Litige</Badge>;
      case "DEBT_DEDUCTED":
        return <Badge className="bg-orange-100 text-orange-800">Dette</Badge>;
      case "TRANSFER_FAILED":
        return <Badge className="bg-red-100 text-red-800">Transfer échoué</Badge>;
      default:
        return <Badge>{type}</Badge>;
    }
  };

  // Pagination
  const totalPages = Math.ceil(notifications.length / itemsPerPage);
  const paginatedNotifications = notifications.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Notifications</h1>
        <p className="text-gray-600 mt-2">
          Gérez vos notifications système et financières
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{notifications.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Non lues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{unreadCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium text-gray-600">
              Lues
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-gray-600">
              {notifications.length - unreadCount}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Actions */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <Button
              onClick={() => setShowFilters(!showFilters)}
              variant="outline"
              className="gap-2"
            >
              <Filter className="h-4 w-4" />
              Filtres
            </Button>
            
            {unreadCount > 0 && (
              <Button onClick={markAllAsRead} variant="outline" className="gap-2">
                <Check className="h-4 w-4" />
                Tout marquer comme lu
              </Button>
            )}
          </div>

          {/* Filter Options */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-gray-50 rounded-lg">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Statut
                </label>
                <select
                  value={filterRead}
                  onChange={(e) => {
                    setFilterRead(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                >
                  <option value="all">Toutes</option>
                  <option value="unread">Non lues</option>
                  <option value="read">Lues</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Type
                </label>
                <select
                  value={filterType}
                  onChange={(e) => {
                    setFilterType(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
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
              Chargement...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Bell className="h-16 w-16 mx-auto mb-4 text-gray-300" />
              <p className="text-lg">Aucune notification</p>
            </div>
          ) : (
            <>
              <div className="divide-y divide-gray-200">
                {paginatedNotifications.map((notification) => (
                  <div
                    key={notification.id}
                    className={`p-6 hover:bg-gray-50 transition-colors ${
                      !notification.read ? "bg-blue-50" : ""
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Status Indicator */}
                      <div
                        className={`flex-shrink-0 w-3 h-3 mt-1.5 rounded-full ${
                          !notification.read ? "bg-blue-600" : "bg-gray-300"
                        }`}
                      />

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="flex items-center gap-2">
                            {getNotificationBadge(notification.type)}
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
                            className="text-sm text-blue-600 hover:text-blue-800"
                          >
                            Voir les détails →
                          </a>
                        )}

                        {/* Metadata */}
                        {notification.metadata && (
                          <div className="mt-2 text-xs text-gray-500 bg-gray-100 p-2 rounded">
                            <pre className="overflow-auto">
                              {JSON.stringify(notification.metadata, null, 2)}
                            </pre>
                          </div>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-2">
                        {!notification.read && (
                          <Button
                            onClick={() => markAsRead(notification.id)}
                            variant="ghost"
                            size="sm"
                            className="text-green-600 hover:text-green-800"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          onClick={() => deleteNotification(notification.id)}
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-800"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
                  <div className="text-sm text-gray-600">
                    Page {currentPage} sur {totalPages}
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
  );
}
