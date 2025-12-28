'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, CheckCircle2, Clock, Calendar, User, AlertCircle, 
  Info, TrendingUp, Activity, Video 
} from 'lucide-react';
import Link from 'next/link';
import { logCallEvent, formatDuration } from '@/lib/call-types';

interface CallSession {
  start: string;
  end: string | null;
  duration: number;
  actorId: string | null;
}

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
    status: 'completed' | 'interrupted' | 'no-show' | 'in-progress' | 'completed-multiple-sessions' | 'unknown';
    sessionsCount: number;
    sessions: CallSession[];
  };
  logs: Array<{
    event: string;
    timestamp: string;
    actor: string;
    actorId: string | null;
    metadata: any;
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
      
      // Logger la consultation du summary
      await logCallEvent(bookingId, 'SUMMARY_VIEW', {
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      setError(error.message || 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">✓ Terminé normalement</Badge>;
      case 'completed-multiple-sessions':
        return <Badge className="bg-green-600">✓ Terminé (sessions multiples)</Badge>;
      case 'interrupted':
        return <Badge className="bg-orange-500">⚠ Interrompu</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500">⏳ En cours</Badge>;
      case 'no-show':
        return <Badge variant="destructive">✗ Absent</Badge>;
      default:
        return <Badge variant="secondary">? Inconnu</Badge>;
    }
  };

  const getCallEfficiency = () => {
    if (!summary) return null;
    
    const { actualDuration, scheduledDuration } = summary.callDetails;
    const percentage = (actualDuration / scheduledDuration) * 100;
    
    return {
      percentage: Math.round(percentage),
      color: percentage >= 90 ? 'text-green-600' : percentage >= 60 ? 'text-orange-600' : 'text-red-600',
    };
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

  const efficiency = getCallEfficiency();

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <Navbar />

      <div className="container mx-auto max-w-6xl px-4 py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full mb-4">
            <CheckCircle2 className="w-10 h-10 text-purple-600" />
          </div>
          <h1 className="text-4xl font-bold mb-2 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
            Résumé de l'appel
          </h1>
          <p className="text-gray-600 text-lg">{summary.callOffer.title}</p>
        </div>

        {/* Summary Cards Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
          {/* Statut */}
          <Card className="border-2 border-purple-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Activity className="w-5 h-5 text-purple-600" />
                Statut
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">État</span>
                {getStatusBadge(summary.callDetails.status)}
              </div>
            </CardContent>
          </Card>

          {/* Durée totale */}
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-600" />
                Durée totale cumulée
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatDuration(summary.callDetails.actualDuration)}
              </div>
              {summary.callDetails.sessionsCount > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  Sur {summary.callDetails.sessionsCount} session{summary.callDetails.sessionsCount > 1 ? 's' : ''}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Efficacité */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                Efficacité
              </CardTitle>
            </CardHeader>
            <CardContent>
              {efficiency && (
                <>
                  <div className={`text-3xl font-bold ${efficiency.color}`}>
                    {efficiency.percentage}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    de la durée prévue ({summary.callOffer.scheduledDuration} min)
                  </p>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Participants */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Participants
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                  {summary.participants.creator.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{summary.participants.creator.name}</p>
                  <p className="text-sm text-gray-500">Créateur</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {summary.participants.user.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{summary.participants.user.name}</p>
                  <p className="text-sm text-gray-500">Fan</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Détails temporels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                Détails temporels
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Date prévue</p>
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

              {summary.callDetails.actualStartTime && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">Début réel</p>
                      <p className="font-semibold">
                        {new Date(summary.callDetails.actualStartTime).toLocaleTimeString('fr-FR', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {summary.callDetails.actualEndTime && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">Fin réelle</p>
                        <p className="font-semibold">
                          {new Date(summary.callDetails.actualEndTime).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sessions multiples */}
        {summary.callDetails.sessionsCount > 1 && (
          <Card className="mt-6 border-2 border-orange-200">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="w-5 h-5 text-orange-600" />
                Sessions d'appel ({summary.callDetails.sessionsCount})
              </CardTitle>
              <CardDescription>
                Cet appel a été interrompu et repris plusieurs fois. Voici le détail des sessions.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {summary.callDetails.sessions.map((session, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">Session {index + 1}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.start).toLocaleTimeString('fr-FR')} 
                        {session.end && ` → ${new Date(session.end).toLocaleTimeString('fr-FR')}`}
                      </p>
                    </div>
                    <div className="text-right">
                      <Badge variant="outline" className="font-mono">
                        {formatDuration(session.duration)}
                      </Badge>
                    </div>
                  </div>
                ))}
                
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    La durée totale affichée est la somme de toutes les sessions.
                  </AlertDescription>
                </Alert>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Chronologie */}
        {summary.logs.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Activity className="w-5 h-5" />
                Chronologie de l'appel
              </CardTitle>
              <CardDescription>
                Tous les événements enregistrés durant l'appel
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {summary.logs.map((log, index) => {
                  const eventName = log.event.replace('CALL_', '').replace(/_/g, ' ');
                  const isError = log.event.includes('ERROR');
                  const isImportant = log.event.includes('JOIN') || log.event.includes('LEAVE') || log.event.includes('START') || log.event.includes('END');
                  
                  return (
                    <div 
                      key={index} 
                      className={`flex items-start gap-3 text-sm p-2 rounded ${
                        isError ? 'bg-red-50' : isImportant ? 'bg-blue-50' : 'bg-gray-50'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-full mt-2 ${
                        isError ? 'bg-red-600' : isImportant ? 'bg-blue-600' : 'bg-gray-400'
                      }`}></div>
                      <div className="flex-1">
                        <p className="font-semibold capitalize">{eventName}</p>
                        <p className="text-xs text-gray-500">
                          {new Date(log.timestamp).toLocaleTimeString('fr-FR', {
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                          })}
                          {' • '}
                          <span className="capitalize">{log.actor.toLowerCase()}</span>
                        </p>
                        {log.metadata?.callId && (
                          <p className="text-xs text-gray-400 font-mono mt-1">
                            Call ID: {log.metadata.callId.substring(0, 8)}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Actions */}
        <div className="mt-8 flex gap-4 justify-center">
          <Link href="/dashboard/user/history">
            <Button variant="outline" size="lg">
              Voir l'historique
            </Button>
          </Link>
          <Link href="/dashboard/user">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600">
              Retour au dashboard
            </Button>
          </Link>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              Ce résumé est calculé dynamiquement à partir des logs de l'appel et reflète la durée réelle cumulée de toutes les sessions.
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
