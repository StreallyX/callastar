import { cn } from '@/lib/utils';
import { format, formatDistanceToNow, isValid, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

interface DateDisplayProps {
  date: string | Date;
  format?: 'short' | 'long' | 'relative' | 'datetime' | 'time';
  className?: string;
}

export function DateDisplay({ date, format: displayFormat = 'short', className }: DateDisplayProps) {
  const parseDate = (d: string | Date): Date => {
    if (d instanceof Date) return d;
    const parsed = parseISO(d);
    return isValid(parsed) ? parsed : new Date(d);
  };

  const dateObj = parseDate(date);

  if (!isValid(dateObj)) {
    return <span className={cn('text-gray-400', className)}>Date invalide</span>;
  }

  const getFormattedDate = () => {
    switch (displayFormat) {
      case 'short':
        return format(dateObj, 'dd/MM/yyyy', { locale: fr });
      case 'long':
        return format(dateObj, 'dd MMMM yyyy', { locale: fr });
      case 'datetime':
        return format(dateObj, 'dd/MM/yyyy à HH:mm', { locale: fr });
      case 'time':
        return format(dateObj, 'HH:mm', { locale: fr });
      case 'relative':
        return formatDistanceToNow(dateObj, { addSuffix: true, locale: fr });
      default:
        return format(dateObj, 'dd/MM/yyyy', { locale: fr });
    }
  };

  return (
    <span className={className} title={format(dateObj, 'dd/MM/yyyy HH:mm:ss', { locale: fr })}>
      {getFormattedDate()}
    </span>
  );
}
