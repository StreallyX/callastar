'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CheckCircle2, Clock, Calendar, User, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface CallSummary {
  booking: {
    id: string;
    status: string;
    createdAt: string;
  };
  callOffer: {
    title: string;
    scheduledDateTime: string;
    scheduledDuration: number;
  };
  participants: {
    creator: {
      name: string;
      id: string;
    };
    user: {
      name: string;
      id: string;
    };
  };
  callDetails: {
    actualStartTime: string | null;
    actualEndTime: string | null;
    actualDuration: number;
    scheduledDuration: number;
    status: 'completed' | 'interrupted' | 'no-show' | 'unknown';
  };
  logs: Array<{
    event: string;
    timestamp: string;
    actor: string;
  }>;
}

export default function CallSummaryPage({ 
  params 
}: { 
  params: Promise<{ bookingId: string }> | { bookingId: string } 
}) {
  const router = useRouter();
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [summary, setSummary] = useState<CallSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const resolveParams = async () => {
      if (params instanceof Promise) {
        const resolved = await params;
        setBookingId(resolved.bookingId);
      } else {
        setBookingId(params.bookingId);
      }
    };
    resolveParams();
  }, [params]);

  useEffect(() => {
    if (bookingId) {
      fetchSummary();
    }
  }, [bookingId]);

  const fetchSummary = async () => {
    if (!bookingId) return;

    try {
      const response = await fetch(`/api/call-summary/${bookingId}`);
      
      if (!response.ok) {
        throw new Error('Impossible de récupérer le résumé');
      }

      const data = await response.json();
      setSummary(data.summary);
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins} min ${secs} sec`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">Terminé normalement</Badge>;
      case 'interrupted':
        return <Badge className="bg-orange-500">Interrompu</Badge>;
      case 'no-show':
        return <Badge variant="destructive">Absent</Badge>;
      default:
        return <Badge variant="secondary">Inconnu</Badge>;
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

  if (error || !summary) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
        <Navbar />
        <div className="container mx-auto max-w-4xl px-4 py-12">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-6 h-6 text-red-500" />
                Erreur
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">{error || 'Résumé introuvable'}</p>
              <Button onClick={() => router.push('/dashboard/user')} variant="outline">
                Retour au dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-4xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-green-100 rounded-full mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Résumé de l'appel</h1>
          <p className="text-gray-600">{summary.callOffer.title}</p>
        </div>

        {/* Summary Cards */}
        <div className="space-y-6">
          {/* Call Status */}
          <Card>
            <CardHeader>
              <CardTitle>Statut de l'appel</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Statut</span>
                {getStatusBadge(summary.callDetails.status)}
              </div>
            </CardContent>
          </Card>

          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle>Participants</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-semibold">{summary.participants.creator.name}</p>
                  <p className="text-sm text-gray-500">Créateur</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <User className="w-5 h-5 text-gray-400" />
                <div>
                  <p className="font-semibold">{summary.participants.user.name}</p>
                  <p className="text-sm text-gray-500">Fan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Time Details */}
          <Card>
            <CardHeader>
              <CardTitle>Détails temporels</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Calendar className="w-4 h-4" />
                    <span>Date prévue</span>
                  </div>
                  <p className="font-semibold">
                    {new Date(summary.callOffer.scheduledDateTime).toLocaleDateString('fr-FR', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                  <p className="text-sm text-gray-600">
                    {new Date(summary.callOffer.scheduledDateTime).toLocaleTimeString('fr-FR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
                    <Clock className="w-4 h-4" />
                    <span>Durée prévue</span>
                  </div>
                  <p className="font-semibold">{summary.callOffer.scheduledDuration} minutes</p>
                </div>
              </div>

              {summary.callDetails.actualStartTime && (
                <>
                  <div className="border-t pt-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Heure de début réelle</p>
                        <p className="font-semibold">
                          {new Date(summary.callDetails.actualStartTime).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>

                      {summary.callDetails.actualEndTime && (
                        <div>
                          <p className="text-sm text-gray-500 mb-1">Heure de fin réelle</p>
                          <p className="font-semibold">
                            {new Date(summary.callDetails.actualEndTime).toLocaleTimeString('fr-FR', {
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                            })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Durée effective</p>
                    <p className="text-2xl font-bold text-purple-600">
                      {formatDuration(summary.callDetails.actualDuration)}
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Call Timeline (for debugging/admin only in production) */}
          {summary.logs.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>Chronologie de l'appel</CardTitle>
                <CardDescription>
                  Événements enregistrés durant l'appel
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {summary.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-3 text-sm">
                      <div className="w-2 h-2 bg-purple-600 rounded-full mt-2"></div>
                      <div className="flex-1">
                        <p className="font-semibold">{log.event.replace('CALL_', '').replace(/_/g, ' ')}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Actions */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/dashboard/user/history">
            <Button variant="outline">
              Voir l'historique
            </Button>
          </Link>
          <Link href="/dashboard/user">
            <Button className="bg-gradient-to-r from-purple-600 to-pink-600">
              Retour au dashboard
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
