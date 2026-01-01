'use client';

import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTranslations } from 'next-intl';

interface CountdownTimerProps {
  targetDateTime: Date;
  onCountdownComplete?: () => void;
}

export function CountdownTimer({ targetDateTime, onCountdownComplete }: CountdownTimerProps) {
  const t = useTranslations('call.room');
  const [timeUntilCall, setTimeUntilCall] = useState<number>(0);
  const [isCallTime, setIsCallTime] = useState(false);

  useEffect(() => {
    const updateTimer = () => {
      const now = Date.now();
      const targetTime = new Date(targetDateTime).getTime();
      const diff = Math.max(0, Math.floor((targetTime - now) / 1000));
      
      setTimeUntilCall(diff);
      
      // Check if it's call time
      if (now >= targetTime && !isCallTime) {
        setIsCallTime(true);
        onCountdownComplete?.();
      }
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);

    return () => clearInterval(interval);
  }, [targetDateTime, isCallTime, onCountdownComplete]);

  const formatCountdown = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    // Format plus explicite en français
    const parts = [];
    if (hours > 0) {
      parts.push(`${hours} heure${hours > 1 ? 's' : ''}`);
    }
    if (mins > 0 || hours > 0) {
      parts.push(`${mins} minute${mins > 1 ? 's' : ''}`);
    }
    parts.push(`${secs} seconde${secs > 1 ? 's' : ''}`);
    
    return parts.join(' et ');
  };

  const getStatusColor = () => {
    if (isCallTime) return 'text-green-600';
    if (timeUntilCall < 900) return 'text-orange-600'; // Less than 15 minutes
    return 'text-purple-600';
  };

  const getStatusText = () => {
    if (isCallTime) return t('canStartNow');
    return `L'appel commence dans ${formatCountdown(timeUntilCall)}`;
  };

  return (
    <Card className="border-2 border-purple-200 bg-gradient-to-r from-purple-50 to-pink-50 shadow-md hover:shadow-lg transition-shadow">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-600" />
          {t('callStatusTitle')}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className={`text-lg font-bold ${getStatusColor()} leading-relaxed`}>
          {getStatusText()}
        </p>
        {isCallTime && (
          <p className="text-sm text-green-600 mt-2 font-medium animate-pulse">
            {t('youCanJoinNow')}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
