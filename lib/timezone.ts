/**
 * Timezone utilities for Callastar
 * Handles timezone detection, conversion, and formatting
 */

/**
 * Detect user's timezone using browser API
 * @returns IANA timezone string (e.g., "Europe/Paris", "America/New_York")
 */
export function detectUserTimezone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch (error) {
    console.error('Error detecting timezone:', error);
    return 'Europe/Paris'; // Default fallback
  }
}

/**
 * Get timezone abbreviation (e.g., "CET", "EST", "PST")
 * @param timezone - IANA timezone string
 * @param date - Date object (defaults to now)
 * @returns Timezone abbreviation
 */
export function getTimezoneAbbreviation(
  timezone: string,
  date: Date = new Date()
): string {
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'short',
    });
    const parts = formatter.formatToParts(date);
    const timeZonePart = parts.find((part) => part.type === 'timeZoneName');
    return timeZonePart?.value || timezone;
  } catch (error) {
    console.error('Error getting timezone abbreviation:', error);
    return timezone;
  }
}

/**
 * Format date with timezone display
 * @param date - Date object or ISO string
 * @param timezone - IANA timezone string
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string with timezone
 */
export function formatDateWithTimezone(
  date: Date | string,
  timezone: string,
  options: Intl.DateTimeFormatOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      ...options,
      timeZone: timezone,
    });
    
    const formattedDate = formatter.format(dateObj);
    const tzAbbr = getTimezoneAbbreviation(timezone, dateObj);
    
    return `${formattedDate} (${tzAbbr})`;
  } catch (error) {
    console.error('Error formatting date with timezone:', error);
    return new Date(date).toLocaleString('fr-FR');
  }
}

/**
 * Format time with timezone (short format)
 * Example: "18:30 CET" or "12:30 EST"
 * @param date - Date object or ISO string
 * @param timezone - IANA timezone string
 * @returns Formatted time string with timezone abbreviation
 */
export function formatTimeWithTimezone(
  date: Date | string,
  timezone: string
): string {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    const formatter = new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: timezone,
    });
    
    const formattedTime = formatter.format(dateObj);
    const tzAbbr = getTimezoneAbbreviation(timezone, dateObj);
    
    return `${formattedTime} ${tzAbbr}`;
  } catch (error) {
    console.error('Error formatting time with timezone:', error);
    return new Date(date).toLocaleTimeString('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}

/**
 * Convert date from one timezone to another
 * @param date - Date object or ISO string
 * @param fromTimezone - Source timezone
 * @param toTimezone - Target timezone
 * @returns Date object in target timezone
 */
export function convertTimezone(
  date: Date | string,
  fromTimezone: string,
  toTimezone: string
): Date {
  try {
    const dateObj = typeof date === 'string' ? new Date(date) : date;
    
    // Get the date in the source timezone
    const sourceFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: fromTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    // Get the date in the target timezone
    const targetFormatter = new Intl.DateTimeFormat('en-US', {
      timeZone: toTimezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    
    return new Date(targetFormatter.format(dateObj));
  } catch (error) {
    console.error('Error converting timezone:', error);
    return new Date(date);
  }
}

/**
 * Get all available timezones (common ones)
 * @returns Array of timezone objects with label and value
 */
export function getCommonTimezones(): Array<{ label: string; value: string }> {
  return [
    // Europe
    { label: '🇫🇷 Paris (CET/CEST)', value: 'Europe/Paris' },
    { label: '🇬🇧 Londres (GMT/BST)', value: 'Europe/London' },
    { label: '🇩🇪 Berlin (CET/CEST)', value: 'Europe/Berlin' },
    { label: '🇪🇸 Madrid (CET/CEST)', value: 'Europe/Madrid' },
    { label: '🇮🇹 Rome (CET/CEST)', value: 'Europe/Rome' },
    { label: '🇨🇭 Zurich (CET/CEST)', value: 'Europe/Zurich' },
    { label: '🇳🇱 Amsterdam (CET/CEST)', value: 'Europe/Amsterdam' },
    { label: '🇸🇪 Stockholm (CET/CEST)', value: 'Europe/Stockholm' },
    { label: '🇵🇱 Varsovie (CET/CEST)', value: 'Europe/Warsaw' },
    { label: '🇬🇷 Athènes (EET/EEST)', value: 'Europe/Athens' },
    { label: '🇷🇺 Moscou (MSK)', value: 'Europe/Moscow' },
    
    // Americas
    { label: '🇺🇸 New York (EST/EDT)', value: 'America/New_York' },
    { label: '🇺🇸 Chicago (CST/CDT)', value: 'America/Chicago' },
    { label: '🇺🇸 Denver (MST/MDT)', value: 'America/Denver' },
    { label: '🇺🇸 Los Angeles (PST/PDT)', value: 'America/Los_Angeles' },
    { label: '🇨🇦 Toronto (EST/EDT)', value: 'America/Toronto' },
    { label: '🇨🇦 Vancouver (PST/PDT)', value: 'America/Vancouver' },
    { label: '🇲🇽 Mexico City (CST/CDT)', value: 'America/Mexico_City' },
    { label: '🇧🇷 São Paulo (BRT/BRST)', value: 'America/Sao_Paulo' },
    { label: '🇦🇷 Buenos Aires (ART)', value: 'America/Argentina/Buenos_Aires' },
    
    // Asia
    { label: '🇨🇳 Shanghai (CST)', value: 'Asia/Shanghai' },
    { label: '🇯🇵 Tokyo (JST)', value: 'Asia/Tokyo' },
    { label: '🇰🇷 Seoul (KST)', value: 'Asia/Seoul' },
    { label: '🇮🇳 Kolkata (IST)', value: 'Asia/Kolkata' },
    { label: '🇸🇬 Singapour (SGT)', value: 'Asia/Singapore' },
    { label: '🇭🇰 Hong Kong (HKT)', value: 'Asia/Hong_Kong' },
    { label: '🇦🇪 Dubai (GST)', value: 'Asia/Dubai' },
    
    // Pacific
    { label: '🇦🇺 Sydney (AEDT/AEST)', value: 'Australia/Sydney' },
    { label: '🇦🇺 Melbourne (AEDT/AEST)', value: 'Australia/Melbourne' },
    { label: '🇳🇿 Auckland (NZDT/NZST)', value: 'Pacific/Auckland' },
    
    // Africa
    { label: '🇿🇦 Johannesburg (SAST)', value: 'Africa/Johannesburg' },
    { label: '🇪🇬 Le Caire (EET)', value: 'Africa/Cairo' },
    { label: '🇳🇬 Lagos (WAT)', value: 'Africa/Lagos' },
  ];
}

/**
 * Calculate time difference between now and a future date in specific timezone
 * @param date - Target date
 * @param timezone - Timezone to calculate in
 * @returns Object with hours, minutes, and seconds until date
 */
export function getTimeUntil(
  date: Date | string,
  timezone: string
): { hours: number; minutes: number; seconds: number; totalSeconds: number } {
  const now = new Date();
  const target = typeof date === 'string' ? new Date(date) : date;
  
  const diff = target.getTime() - now.getTime();
  const totalSeconds = Math.max(0, Math.floor(diff / 1000));
  
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  
  return { hours, minutes, seconds, totalSeconds };
}

/**
 * Format time until with localized text
 * @param date - Target date
 * @param timezone - Timezone
 * @returns Human-readable string (e.g., "Commence dans 15 min", "Commence à 18:30 CET")
 */
export function formatTimeUntil(
  date: Date | string,
  timezone: string
): string {
  const { hours, minutes, totalSeconds } = getTimeUntil(date, timezone);
  
  // If less than 1 hour away, show "Commence dans X min"
  if (totalSeconds > 0 && totalSeconds < 3600) {
    return `Commence dans ${minutes} min`;
  }
  
  // If less than 24 hours away, show "Commence dans X h Y min"
  if (totalSeconds > 0 && totalSeconds < 86400) {
    return `Commence dans ${hours}h ${minutes}min`;
  }
  
  // Otherwise show "Commence à HH:MM TIMEZONE"
  return `Commence à ${formatTimeWithTimezone(date, timezone)}`;
}
