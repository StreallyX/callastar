/**
 * CurrencyDisplay Component
 * 
 * Unified component for displaying amounts with currency symbols
 * Ensures consistent currency display across the platform
 */

import { getCurrencySymbol } from '@/lib/currency-converter';

interface CurrencyDisplayProps {
  amount: number;
  currency: string;
  className?: string;
  showSymbol?: boolean; // If true, shows symbol (€), if false shows code (EUR)
}

export function CurrencyDisplay({ 
  amount, 
  currency, 
  className = '',
  showSymbol = false 
}: CurrencyDisplayProps) {
  const displayCurrency = showSymbol ? getCurrencySymbol(currency) : currency.toUpperCase();
  
  return (
    <span className={className}>
      {amount.toFixed(2)} {displayCurrency}
    </span>
  );
}

/**
 * CurrencyInput Component
 * 
 * Input field with currency symbol display
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
  const symbol = getCurrencySymbol(currency);
  
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
      <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500">
        {symbol}
      </span>
    </div>
  );
}

/**
 * CurrencyLabel Component
 * 
 * Label with currency symbol for form fields
 */
interface CurrencyLabelProps {
  children: React.ReactNode;
  currency: string;
  showSymbol?: boolean;
}

export function CurrencyLabel({ 
  children, 
  currency, 
  showSymbol = false 
}: CurrencyLabelProps) {
  const displayCurrency = showSymbol ? getCurrencySymbol(currency) : currency.toUpperCase();
  
  return (
    <span>
      {children} ({displayCurrency})
    </span>
  );
}
