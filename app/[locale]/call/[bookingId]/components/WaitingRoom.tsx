'use client';

import { useState, useRef } from 'react';
import { useRouter } from '@/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Video, Settings, Loader2, Info, CheckCircle2, AlertTriangle } from 'lucide-react';
import { CountdownTimer } from './CountdownTimer';
import { useTranslations, useLocale } from 'next-intl';

interface WaitingRoomProps {
  booking: any;
  onJoinCall: () => void;
  onTestMedia: () => Promise<void>;
}

export function WaitingRoom({ booking, onJoinCall, onTestMedia }: WaitingRoomProps) {
  const router = useRouter();
  const t = useTranslations('call.room');
  const locale = useLocale();
  const [isTestingMedia, setIsTestingMedia] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);

  const handleTestMedia = async () => {
    setIsTestingMedia(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      
      setLocalStream(stream);
      
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = stream;
      }
      
      await onTestMedia();
    } catch (error) {
      console.error('Media test error:', error);
    } finally {
      setIsTestingMedia(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-purple-50 to-white">
      <div className="container mx-auto max-w-4xl px-4 py-12">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between flex-wrap gap-4">
              <CardTitle className="flex items-center gap-3 flex-wrap">
                {t('waitingRoom')}
                {booking?.isTestBooking && (
                  <Badge className="bg-blue-500 text-white">
                    {t('testMode')}
                  </Badge>
                )}
              </CardTitle>
              {/* Branding Callastar */}
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-gradient-to-r from-purple-600 to-pink-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                  C
                </div>
                <span className="font-semibold text-purple-600">{t('callastar')}</span>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-4">
              {/* Call Info */}
              <div>
                <h2 className="text-xl font-bold mb-2">{booking?.callOffer?.title}</h2>
                <p className="text-gray-600">{t('with')} {booking?.callOffer?.creator?.user?.name}</p>
                <p className="text-sm text-gray-500">
                  {t('scheduledDuration')}: {booking?.callOffer?.duration} {t('minutes')}
                </p>
                <p className="text-sm text-gray-500 mt-1">
                  {t('scheduledFor')} {new Date(booking?.callOffer?.dateTime).toLocaleString(locale === 'fr' ? 'fr-FR' : 'en-US')}
                </p>
                {booking?.isTestBooking && (
                  <p className="text-sm text-blue-600 font-medium mt-2">
                    {t('testCallInfo')}
                  </p>
                )}
              </div>

              {/* Countdown Timer */}
              <CountdownTimer 
                targetDateTime={new Date(booking?.callOffer?.dateTime)}
              />

              {/* Call Rules */}
              <Card className="border-2 border-purple-200 bg-purple-50/50">
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Info className="w-5 h-5" />
                    {t('callRulesTitle')}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p><strong>{t('ruleDuration')}</strong> {booking?.callOffer?.duration} {t('minutesAllocated')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p><strong>{t('ruleBehavior')}</strong> {t('ruleeBehaviorDesc')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <CheckCircle2 className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <p><strong>{t('ruleConfidentiality')}</strong> {t('ruleConfidentialityDesc')}</p>
                  </div>
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="w-4 h-4 text-orange-600 mt-0.5 flex-shrink-0" />
                    <p><strong>{t('ruleDisconnection')}</strong> {t('ruleDisconnectionDesc')}</p>
                  </div>
                </CardContent>
              </Card>

              {/* Equipment Test */}
              <div className="bg-gray-100 rounded-lg p-6 space-y-4">
                <h3 className="font-semibold">{t('testEquipment')}</h3>
                
                <div className="aspect-video bg-gray-900 rounded-lg overflow-hidden relative">
                  <video
                    ref={previewVideoRef}
                    autoPlay
                    muted
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!localStream && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <Video className="w-16 h-16 text-gray-400" />
                    </div>
                  )}
                </div>

                <Button 
                  onClick={handleTestMedia}
                  disabled={isTestingMedia}
                  variant="outline"
                  className="w-full"
                >
                  {isTestingMedia ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {t('testInProgress')}
                    </>
                  ) : (
                    <>
                      <Settings className="w-4 h-4 mr-2" />
                      {t('testCameraAndMic')}
                    </>
                  )}
                </Button>

                <div className="space-y-2 text-sm text-gray-600">
                  <p>{t('checkCamera')}</p>
                  <p>{t('checkMic')}</p>
                  <p>{t('findQuietPlace')}</p>
                </div>
              </div>
              
              {/* Access Info */}
              <Alert className="bg-blue-50 border-blue-200">
                <Info className="h-4 w-4 text-blue-600" />
                <AlertDescription className="text-blue-800">
                  <strong>{t('freeAccessTitle')}</strong> {t('freeAccessDesc')}
                </AlertDescription>
              </Alert>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 flex-col sm:flex-row">
              <Button 
                onClick={() => router.push('/dashboard/user')} 
                variant="outline" 
                className="flex-1"
              >
                {t('backToDashboard')}
              </Button>
              <Button 
                onClick={onJoinCall} 
                className="flex-1 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
              >
                <Video className="w-4 h-4 mr-2" />
                {t('joinCall')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
