'use client';

import { useEffect, useState } from 'react';
import { formatDateWithTimezone, formatTimeWithTimezone, formatTimeUntil, detectUserTimezone } from '@/lib/timezone';
import { useLocale } from 'next-intl';

interface DateTimeDisplayProps {
  date: Date | string;
  timezone?: string; // If not provided, auto-detect from browser
  format?: 'full' | 'time' | 'countdown'; // full = date + time, time = time only, countdown = time until
  className?: string;
}

/**
 * DateTimeDisplay Component
 * 
 * Displays date/time with timezone information
 * Automatically detects user's timezone if not provided
 * 
 * Usage:
 * - <DateTimeDisplay date={booking.dateTime} format="full" />
 * - <DateTimeDisplay date={booking.dateTime} format="time" />
 * - <DateTimeDisplay date={booking.dateTime} format="countdown" />
 * - <DateTimeDisplay date={booking.dateTime} timezone="America/New_York" format="full" />
 */
export function DateTimeDisplay({ 
  date, 
  timezone, 
  format = 'full',
  className = '' 
}: DateTimeDisplayProps) {
  const locale = useLocale();
  const [userTimezone, setUserTimezone] = useState<string>('Europe/Paris');
  const [mounted, setMounted] = useState(false);
  
  // Detect user's timezone on client side
  useEffect(() => {
    const detected = detectUserTimezone();
    setUserTimezone(detected);
    setMounted(true);
  }, []);
  
  // Use provided timezone or detected one
  const effectiveTimezone = timezone || userTimezone;
  
  // Get locale for date formatting
  const dateLocale = locale === 'fr' ? 'fr-FR' : 'en-US';
  
  // Server-side rendering fallback (show without timezone until hydration)
  if (!mounted) {
    return (
      <span className={className}>
        {new Date(date).toLocaleString(dateLocale)}
      </span>
    );
  }
  
  let displayText = '';
  
  switch (format) {
    case 'full':
      displayText = formatDateWithTimezone(date, effectiveTimezone);
      break;
    case 'time':
      displayText = formatTimeWithTimezone(date, effectiveTimezone);
      break;
    case 'countdown':
      displayText = formatTimeUntil(date, effectiveTimezone);
      break;
    default:
      displayText = formatDateWithTimezone(date, effectiveTimezone);
  }
  
  return (
    <span className={className} title={`Timezone: ${effectiveTimezone}`}>
      {displayText}
    </span>
  );
}

interface LiveCountdownProps {
  date: Date | string;
  timezone?: string;
  className?: string;
  onComplete?: () => void; // Callback when countdown reaches zero
}

/**
 * LiveCountdown Component
 * 
 * Displays a live countdown that updates every second
 * Shows "Commence dans X min" or "Commence à HH:MM TIMEZONE"
 */
export function LiveCountdown({ 
  date, 
  timezone, 
  className = '',
  onComplete
}: LiveCountdownProps) {
  const locale = useLocale();
  const [userTimezone, setUserTimezone] = useState<string>('Europe/Paris');
  const [mounted, setMounted] = useState(false);
  const [countdown, setCountdown] = useState<string>('');
  
  useEffect(() => {
    const detected = detectUserTimezone();
    setUserTimezone(detected);
    setMounted(true);
  }, []);
  
  const effectiveTimezone = timezone || userTimezone;
  
  // Translation text based on locale
  const inProgressText = locale === 'fr' ? 'En cours' : 'In progress';
  const loadingText = locale === 'fr' ? 'Chargement...' : 'Loading...';
  const timezoneText = locale === 'fr' ? 'Fuseau horaire' : 'Timezone';
  
  useEffect(() => {
    if (!mounted) return;
    
    const updateCountdown = () => {
      const now = new Date();
      const target = typeof date === 'string' ? new Date(date) : date;
      const diff = target.getTime() - now.getTime();
      
      if (diff <= 0) {
        setCountdown(inProgressText);
        if (onComplete) onComplete();
        return;
      }
      
      setCountdown(formatTimeUntil(date, effectiveTimezone));
    };
    
    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    
    return () => clearInterval(interval);
  }, [date, effectiveTimezone, mounted, onComplete, inProgressText]);
  
  if (!mounted) {
    return <span className={className}>{loadingText}</span>;
  }
  
  return (
    <span className={className} title={`${timezoneText}: ${effectiveTimezone}`}>
      {countdown}
    </span>
  );
}
