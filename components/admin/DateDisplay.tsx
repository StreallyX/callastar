import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { fr, enUS } from 'date-fns/locale';

interface DateDisplayProps {
  date: string | Date;
  format?: 'short' | 'long' | 'relative' | 'datetime' | 'time';
  className?: string;
  locale?: string;
}

export function DateDisplay({ date, format: displayFormat = 'short', className, locale = 'fr' }: DateDisplayProps) {
  const parseDate = (d: string | Date): Date => {
    if (d instanceof Date) return d;
    const parsed = parseISO(d);
    return isValid(parsed) ? parsed : new Date(d);
  };

  const dateObj = parseDate(date);
  const dateFnsLocale = locale === 'fr' ? fr : enUS;
  const invalidText = locale === 'fr' ? 'Date invalide' : 'Invalid date';

  if (!isValid(dateObj)) {
    return <span className={cn('text-gray-400', className)}>{invalidText}</span>;
  }

  const getFormattedDate = () => {
    switch (displayFormat) {
      case 'short':
        return format(dateObj, 'dd/MM/yyyy', { locale: dateFnsLocale });
      case 'long':
        return format(dateObj, 'dd MMMM yyyy', { locale: dateFnsLocale });
      case 'datetime':
        return format(dateObj, 'dd/MM/yyyy à HH:mm', { locale: dateFnsLocale });
      case 'time':
        return format(dateObj, 'HH:mm', { locale: dateFnsLocale });
      case 'relative':
        return formatDistanceToNow(dateObj, { addSuffix: true, locale: dateFnsLocale });
      default:
        return format(dateObj, 'dd/MM/yyyy', { locale: dateFnsLocale });
    }
  };

  return (
    <span className={className} title={format(dateObj, 'dd/MM/yyyy HH:mm:ss', { locale: dateFnsLocale })}>
      {getFormattedDate()}
    </span>
  );
}
