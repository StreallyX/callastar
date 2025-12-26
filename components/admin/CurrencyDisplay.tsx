import { cn } from '@/lib/utils';

interface CurrencyDisplayProps {
  amount: number | string;
  currency?: string;
  className?: string;
  showSymbol?: boolean;
}

/**
 * CurrencyDisplay Component
 * Displays monetary amounts with proper currency formatting
 * Supports multiple currencies: EUR, USD, GBP, CHF, CAD, AUD, etc.
 */
export function CurrencyDisplay({ 
  amount, 
  currency = 'EUR', 
  className,
  showSymbol = true 
}: CurrencyDisplayProps) {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // ✅ ENHANCED: Support for more currencies
  const getCurrencySymbol = (curr: string) => {
    switch (curr.toUpperCase()) {
      case 'EUR':
        return '€';
      case 'USD':
        return '$';
      case 'GBP':
        return '£';
      case 'CHF':
        return 'CHF'; // Swiss Franc (no symbol, use code)
      case 'CAD':
        return 'CA$'; // Canadian Dollar
      case 'AUD':
        return 'A$'; // Australian Dollar
      case 'JPY':
        return '¥'; // Japanese Yen
      case 'CNY':
        return '¥'; // Chinese Yuan
      default:
        return curr.toUpperCase(); // Fallback to currency code
    }
  };

  const formatAmount = (value: number) => {
    return value.toFixed(2);
  };

  const symbol = getCurrencySymbol(currency);
  const formattedAmount = formatAmount(numAmount);
  const currencyCode = currency.toUpperCase();

  // ✅ IMPROVED: Better display logic for currencies with/without symbols
  const hasSymbol = !['CHF', 'CAD', 'AUD'].includes(currencyCode);

  return (
    <span className={cn('font-medium', className)}>
      {showSymbol && hasSymbol && symbol}
      {formattedAmount}
      {' '}
      {showSymbol && !hasSymbol && symbol}
      {!showSymbol && currencyCode}
    </span>
  );
}
