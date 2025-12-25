import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  amount: number | string;
  currency?: string;
  className?: string;
  showSymbol?: boolean;
}

export function CurrencyDisplay({ 
  amount, 
  currency = 'EUR', 
  className,
  showSymbol = true 
}: CurrencyDisplayProps) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  const getCurrencySymbol = (curr: string) => {
    switch (curr.toUpperCase()) {
      case 'EUR':
        return '€';
      case 'USD':
        return '$';
      case 'GBP':
        return '£';
      default:
        return curr;
    }
  };

  const formatAmount = (value: number) => {
    return value.toFixed(2);
  };

  const symbol = getCurrencySymbol(currency);
  const formattedAmount = formatAmount(numAmount);

  return (
    <span className={cn('font-medium', className)}>
      {showSymbol && symbol}{formattedAmount}{!showSymbol && ` ${currency}`}
    </span>
  );
}
