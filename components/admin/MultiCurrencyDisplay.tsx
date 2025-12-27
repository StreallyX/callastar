import { cn } from '@/lib/utils';
import { CurrencyDisplay } from './CurrencyDisplay';

interface MultiCurrencyDisplayProps {
  amounts: Record<string, number>;
  className?: string;
  orientation?: 'horizontal' | 'vertical';
  emptyMessage?: string;
  showLabels?: boolean;
  labelPosition?: 'before' | 'after';
}

/**
 * MultiCurrencyDisplay Component
 * Displays multiple currency amounts in a clean, organized way
 * 
 * Example usage:
 * <MultiCurrencyDisplay 
 *   amounts={{ CHF: 1000, EUR: 500 }}
 *   orientation="vertical"
 * />
 * 
 * Renders:
 * 1,000.00 CHF
 * 500.00 EUR
 */
export function MultiCurrencyDisplay({ 
  amounts, 
  className,
  orientation = 'vertical',
  emptyMessage = 'Aucun montant',
  showLabels = false,
  labelPosition = 'before'
}: MultiCurrencyDisplayProps) {
  const currencies = Object.keys(amounts);
  
  if (currencies.length === 0) {
    return (
      <span className={cn('text-sm text-gray-400', className)}>
        {emptyMessage}
      </span>
    );
  }

  // Sort currencies alphabetically for consistency
  const sortedCurrencies = currencies.sort();

  const containerClasses = cn(
    'flex gap-2',
    orientation === 'vertical' ? 'flex-col' : 'flex-row flex-wrap',
    className
  );

  return (
    <div className={containerClasses}>
      {sortedCurrencies.map((currency) => {
        const amount = amounts[currency];
        return (
          <div 
            key={currency} 
            className={cn(
              'flex items-center gap-1',
              orientation === 'horizontal' && 'after:content-["|"] after:ml-2 after:text-gray-300 last:after:content-none'
            )}
          >
            {showLabels && labelPosition === 'before' && (
              <span className="text-xs text-gray-500 uppercase">{currency}:</span>
            )}
            <CurrencyDisplay 
              amount={amount} 
              currency={currency}
              showSymbol={true}
            />
            {showLabels && labelPosition === 'after' && (
              <span className="text-xs text-gray-400">({currency})</span>
            )}
          </div>
        );
      })}
    </div>
  );
}

/**
 * MultiCurrencyDisplayCompact Component
 * Compact inline display for multiple currencies
 * Example: "1,000.00 CHF | 500.00 EUR"
 */
export function MultiCurrencyDisplayCompact({ 
  amounts, 
  className 
}: { amounts: Record<string, number>; className?: string }) {
  return (
    <MultiCurrencyDisplay 
      amounts={amounts}
      orientation="horizontal"
      className={cn('text-sm', className)}
    />
  );
}

/**
 * MultiCurrencyDisplayCard Component
 * Card-style display with borders and background
 */
export function MultiCurrencyDisplayCard({ 
  amounts,
  title,
  className 
}: { 
  amounts: Record<string, number>;
  title?: string;
  className?: string;
}) {
  return (
    <div className={cn('rounded-lg border bg-gray-50 p-3', className)}>
      {title && (
        <p className="text-xs text-gray-600 mb-2 font-medium">{title}</p>
      )}
      <MultiCurrencyDisplay 
        amounts={amounts}
        orientation="vertical"
        className="space-y-1"
      />
    </div>
  );
}
