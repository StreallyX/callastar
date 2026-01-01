'use client';

import { Clock } from 'lucide-react';

export function LocalTime({
  utcDate,
  locale,
  creatorTimezone,
}: {
  utcDate: string;
  locale: string;
  creatorTimezone: string;
}) {
  const userTimezone =
    Intl.DateTimeFormat().resolvedOptions().timeZone;

  // Même fuseau → inutile d’afficher
  if (!userTimezone || userTimezone === creatorTimezone) {
    return null;
  }

  const date = new Date(utcDate);

  const creatorTime = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: creatorTimezone,
  });

  const userTime = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: userTimezone,
  });

  const creatorDate = date.toLocaleDateString(locale, {
    timeZone: creatorTimezone,
  });

  const userDate = date.toLocaleDateString(locale, {
    timeZone: userTimezone,
  });

  const dateChanged = creatorDate !== userDate;

  return (
    <div className="flex gap-1 text-xs text-gray-500 mt-1">
      <Clock className="w-3 h-3" />
      <span>
        {userTime} ({userTimezone})
        {dateChanged && ' · ' + userDate}
      </span>
    </div>
  );
}
