'use client';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface EarlyArrivalMessageProps {
  timeUntilAllowed: number; // in seconds
}

export function EarlyArrivalMessage({ timeUntilAllowed }: EarlyArrivalMessageProps) {
  const t = useTranslations('call.room');
  
  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  return (
    <Alert className="bg-blue-50 border-blue-200">
      <Clock className="h-4 w-4 text-blue-600" />
      <AlertDescription className="text-blue-800">
        <strong>{t('tooEarlyTitle')}</strong> 
        {t('tooEarlyDesc', { time: formatTime(timeUntilAllowed) })}
      </AlertDescription>
    </Alert>
  );
}
