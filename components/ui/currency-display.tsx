/**
 * CurrencyDisplay Component
 * 
 * Unified component for displaying amounts with currency codes
 * Ensures consistent currency display across the platform
 * 
 * ✅ ALWAYS displays "amount CODE" format (e.g., "500.00 GBP")
 * ✅ Never displays incorrect symbols (e.g., no more "$500 GBP")
 */

import { formatCurrency } from '@/lib/currency-utils';

interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  className?: string;
}

export function CurrencyDisplay({ 
  amount, 
  currency, 
  className = ''
}: CurrencyDisplayProps) {
  // Always use formatCurrency from currency-utils for consistency
  const formattedAmount = formatCurrency(amount, currency);
  
  return (
    <span className={className}>
      {formattedAmount}
    </span>
  );
}

/**
 * CurrencyInput Component
 * 
 * Input field with currency code display
 */
interface CurrencyInputProps {
  value: string | number;
  onChange: (value: string) => void;
  currency: string;
  min?: number;
  max?: number;
  placeholder?: string;
  className?: string;
}

export function CurrencyInput({
  value,
  onChange,
  currency,
  min,
  max,
  placeholder,
  className = ''
}: CurrencyInputProps) {
  const currencyCode = currency.toUpperCase();
  
  return (
    <div className="relative">
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        min={min}
        max={max}
        step="0.01"
        placeholder={placeholder}
        className={className}
      />
      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 text-sm font-medium">
        {currencyCode}
      </span>
    </div>
  );
}

/**
 * CurrencyLabel Component
 * 
 * Label with currency code for form fields
 */
interface CurrencyLabelProps {
  children: React.ReactNode;
  currency: string;
}

export function CurrencyLabel({ 
  children, 
  currency
}: CurrencyLabelProps) {
  const currencyCode = currency.toUpperCase();
  
  return (
    <span>
      {children} ({currencyCode})
    </span>
  );
}
