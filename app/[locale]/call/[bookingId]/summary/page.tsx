'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { Navbar } from '@/components/navbar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Loader2, CheckCircle2, Clock, Calendar, User, AlertCircle, 
  Info, TrendingUp, Activity, Video 
} from 'lucide-react';
import { Link } from '@/navigation';
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
  params: Promise<{ bookingId: string; locale: string }> | { bookingId: string; locale: string } 
}) {
  const router = useRouter();
  const t = useTranslations('call.summary');
  const locale = useLocale();
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
        throw new Error(t('cannotFetchSummary'));
      }

      const data = await response.json();
      setSummary(data.summary);
      
      // Logger la consultation du summary
      await logCallEvent(bookingId, 'SUMMARY_VIEW', {
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      setError(error.message || t('errorOccurred'));
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return <Badge className="bg-green-500">{t('completedNormally')}</Badge>;
      case 'completed-multiple-sessions':
        return <Badge className="bg-green-600">{t('completedMultiple')}</Badge>;
      case 'interrupted':
        return <Badge className="bg-orange-500">{t('interrupted')}</Badge>;
      case 'in-progress':
        return <Badge className="bg-blue-500">{t('inProgress')}</Badge>;
      case 'no-show':
        return <Badge variant="destructive">{t('noShow')}</Badge>;
      default:
        return <Badge variant="secondary">{t('unknown')}</Badge>;
    }
  };

  const getCallEfficiency = (observedDuration: number) => {
    if (!summary) return null;

    const scheduledDurationSeconds =
      summary.callOffer.scheduledDuration * 60;

    if (scheduledDurationSeconds <= 0) return null;

    const percentage =
      (observedDuration / scheduledDurationSeconds) * 100;

    let color = 'text-gray-600';

    if (percentage < 20) {
      color = 'text-red-600';        // très mauvais
    } else if (percentage < 60) {
      color = 'text-orange-600';     // faible
    } else if (percentage < 100) {
      color = 'text-green-600';      // bon
    } else {
      color = 'text-purple-600';     // 🔥 EXCELLENT / dépassement
    }

    return {
      percentage: Math.round(percentage),
      color,
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
                {t('error')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-gray-600">{error || t('notFound')}</p>
              <Button onClick={() => router.push('/dashboard/user')} variant="outline">
                {t('backToDashboard')}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ✅ Sessions réellement valides (terminées uniquement)
  const validSessions = summary.callDetails.sessions.filter(
    (s) => s.end && s.duration > 0
  );

  // ✅ Durée totale recalculée à partir des sessions valides uniquement
  const totalValidDuration = validSessions.reduce(
    (acc, s) => acc + s.duration,
    0
  );

  const totalObservedDuration =
  summary.callDetails.actualStartTime &&
  summary.callDetails.actualEndTime
    ? (new Date(summary.callDetails.actualEndTime).getTime() -
       new Date(summary.callDetails.actualStartTime).getTime()) / 1000
    : totalValidDuration;


  // ✅ Efficacité basée UNIQUEMENT sur la durée réelle valide
  const efficiency = getCallEfficiency(totalValidDuration);


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
            {t('title')}
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
                {t('status')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('status')}</span>
                {getStatusBadge(summary.callDetails.status)}
              </div>
            </CardContent>
          </Card>

          {/* Durée totale */}
          <Card className="border-2 border-green-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="w-5 h-5 text-green-600" />
                {t('totalDuration')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600">
                {formatDuration(totalValidDuration)}
              </div>
              {summary.callDetails.sessionsCount > 1 && (
                <p className="text-xs text-gray-500 mt-1">
                  {t('onSessions', { count: validSessions.length })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Efficacité */}
          <Card className="border-2 border-blue-200">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-blue-600" />
                {t('efficiency')}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {efficiency && (
                <>
                  <div className={`text-3xl font-bold ${efficiency.color}`}>
                    {efficiency.percentage}%
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {t('ofScheduled')} ({summary.callOffer.scheduledDuration} min)
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
                {t('participants')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-purple-50 rounded-lg">
                <div className="w-10 h-10 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold">
                  {summary.participants.creator.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{summary.participants.creator.name}</p>
                  <p className="text-sm text-gray-500">{t('creator')}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                <div className="w-10 h-10 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">
                  {summary.participants.user.name.charAt(0)}
                </div>
                <div>
                  <p className="font-semibold">{summary.participants.user.name}</p>
                  <p className="text-sm text-gray-500">{t('fan')}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Détails temporels */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5" />
                {t('temporalDetails')}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">{t('scheduledDate')}</p>
                <p className="font-semibold">
                  {new Date(summary.callOffer.scheduledDateTime).toLocaleDateString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </p>
                <p className="text-sm text-gray-600">
                  {new Date(summary.callOffer.scheduledDateTime).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>

              {summary.callDetails.actualStartTime && (
                <div className="border-t pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">{t('actualStart')}</p>
                      <p className="font-semibold">
                        {new Date(summary.callDetails.actualStartTime).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>

                    {summary.callDetails.actualEndTime && (
                      <div>
                        <p className="text-sm text-gray-500 mb-1">{t('actualEnd')}</p>
                        <p className="font-semibold">
                          {new Date(summary.callDetails.actualEndTime).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
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
                {t('sessions')} ({summary.callDetails.sessionsCount})
              </CardTitle>
              <CardDescription>
                {t('sessionsDescription')}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {validSessions.map((session, index) => (
                  <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">{t('session')} {index + 1}</p>
                      <p className="text-xs text-gray-500">
                        {new Date(session.start).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US')} 
                        {session.end && ` → ${new Date(session.end).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US')}`}
                      </p>
                    </div>
                    <div className="text-right">
                      {session.end ? (
                        <Badge variant="outline" className="font-mono">
                          {formatDuration(session.duration)}
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          {t('sessionIncomplete')}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))}
                
                <Alert className="mt-4">
                  <Info className="h-4 w-4" />
                  <AlertDescription>
                    {t('totalInfo')}
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
                {t('timeline')}
              </CardTitle>
              <CardDescription>
                {t('timelineDescription')}
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
                          {new Date(log.timestamp).toLocaleTimeString(locale === 'fr' ? 'fr-FR' : 'en-US', {
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
              {t('viewHistory')}
            </Button>
          </Link>
          <Link href="/">
            <Button size="lg" className="bg-gradient-to-r from-purple-600 to-pink-600">
              {t('backToDashboard')}
            </Button>
          </Link>
        </div>

        {/* Footer info */}
        <div className="mt-8 text-center">
          <Alert>
            <Info className="h-4 w-4" />
            <AlertDescription>
              {t('summaryInfo')}
            </AlertDescription>
          </Alert>
        </div>
      </div>
    </div>
  );
}
