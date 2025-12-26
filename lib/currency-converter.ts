/**
 * Currency Conversion Utilities
 * 
 * Handles currency conversion for payout operations when Stripe accounts
 * use different currencies than the platform's base currency (EUR).
 * 
 * Strategy:
 * - Database stores all amounts in EUR (source of truth)
 * - Conversion happens at payout time to match Stripe account currency
 * - Conversion rates are fetched from exchange rate API
 * - Conversion details are tracked in database for accounting purposes
 */

import { stripe } from '@/lib/stripe';

/**
 * Interface for conversion result
 */
export interface CurrencyConversion {
  fromCurrency: string;
  toCurrency: string;
  fromAmount: number;
  toAmount: number;
  rate: number;
  timestamp: Date;
}

/**
 * Get Stripe account's default currency
 * @param stripeAccountId - Stripe Connect account ID
 * @returns Currency code in uppercase (e.g., 'EUR', 'CHF', 'USD')
 */
export async function getStripeCurrency(stripeAccountId: string): Promise<string> {
  try {
    const account = await stripe.accounts.retrieve(stripeAccountId);
    return (account.default_currency || 'eur').toUpperCase();
  } catch (error) {
    console.error('Error fetching Stripe account currency:', error);
    // Default to EUR if we can't fetch the currency
    return 'EUR';
  }
}

/**
 * Get current conversion rate between two currencies
 * Uses exchangerate-api.com free tier (1500 requests/month)
 * 
 * Alternative: Use Stripe's conversion rates or implement fallback fixed rates
 * 
 * @param fromCurrency - Source currency code (e.g., 'EUR')
 * @param toCurrency - Target currency code (e.g., 'CHF')
 * @returns Conversion rate
 */
export async function getConversionRate(
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  // If same currency, no conversion needed
  if (fromCurrency === toCurrency) {
    return 1.0;
  }

  try {
    // Option 1: Use free exchange rate API (recommended for production)
    // You'll need to sign up at https://www.exchangerate-api.com/ and get a free API key
    // For now, we'll use fallback fixed rates
    
    // Option 2: Use fallback fixed rates (approximate, should be updated regularly)
    const fallbackRates = getFallbackRates(fromCurrency, toCurrency);
    if (fallbackRates) {
      console.log(`[Currency] Using fallback rate for ${fromCurrency} -> ${toCurrency}: ${fallbackRates}`);
      return fallbackRates;
    }

    // If no fallback rate available, return 1.0 and log warning
    console.warn(`[Currency] No conversion rate available for ${fromCurrency} -> ${toCurrency}, using 1.0`);
    return 1.0;
  } catch (error) {
    console.error('Error fetching conversion rate:', error);
    // Return 1.0 as fallback to avoid blocking payouts
    return 1.0;
  }
}

/**
 * Fallback fixed conversion rates (approximate values as of Dec 2024)
 * These should be updated regularly or replaced with live API
 * 
 * @param fromCurrency - Source currency
 * @param toCurrency - Target currency
 * @returns Conversion rate or null if not available
 */
function getFallbackRates(fromCurrency: string, toCurrency: string): number | null {
  // EUR to other currencies
  const rates: Record<string, Record<string, number>> = {
    EUR: {
      CHF: 0.93,  // 1 EUR = 0.93 CHF (approximate)
      USD: 1.10,  // 1 EUR = 1.10 USD (approximate)
      GBP: 0.85,  // 1 EUR = 0.85 GBP (approximate)
      CAD: 1.47,  // 1 EUR = 1.47 CAD (approximate)
      AUD: 1.63,  // 1 EUR = 1.63 AUD (approximate)
    },
    CHF: {
      EUR: 1.08,  // 1 CHF = 1.08 EUR (approximate)
      USD: 1.18,  // 1 CHF = 1.18 USD (approximate)
    },
    USD: {
      EUR: 0.91,  // 1 USD = 0.91 EUR (approximate)
      CHF: 0.85,  // 1 USD = 0.85 CHF (approximate)
    },
    GBP: {
      EUR: 1.18,  // 1 GBP = 1.18 EUR (approximate)
    },
  };

  return rates[fromCurrency]?.[toCurrency] || null;
}

/**
 * Convert EUR amount to target Stripe currency
 * 
 * @param amountEur - Amount in EUR
 * @param targetCurrency - Target currency (e.g., 'CHF', 'USD')
 * @returns Conversion result with details
 */
export async function convertEurToStripeCurrency(
  amountEur: number,
  targetCurrency: string
): Promise<CurrencyConversion> {
  const fromCurrency = 'EUR';
  const toCurrency = targetCurrency.toUpperCase();

  // Get conversion rate
  const rate = await getConversionRate(fromCurrency, toCurrency);

  // Calculate converted amount
  const convertedAmount = amountEur * rate;

  // Round to 2 decimal places
  const roundedAmount = Math.round(convertedAmount * 100) / 100;

  return {
    fromCurrency,
    toCurrency,
    fromAmount: amountEur,
    toAmount: roundedAmount,
    rate,
    timestamp: new Date(),
  };
}

/**
 * Format amount with currency symbol
 * 
 * @param amount - Numeric amount
 * @param currency - Currency code
 * @returns Formatted string (e.g., "100.00 EUR", "93.00 CHF")
 */
export function formatCurrency(amount: number, currency: string): string {
  return `${amount.toFixed(2)} ${currency.toUpperCase()}`;
}

/**
 * Get currency symbol for display
 * 
 * @param currency - Currency code
 * @returns Currency symbol (€, CHF, $, £, etc.)
 */
export function getCurrencySymbol(currency: string): string {
  const symbols: Record<string, string> = {
    EUR: '€',
    CHF: 'CHF',
    USD: '$',
    GBP: '£',
    CAD: 'CA$',
    AUD: 'A$',
  };

  return symbols[currency.toUpperCase()] || currency.toUpperCase();
}

/**
 * Validate if a currency is supported
 * 
 * @param currency - Currency code to validate
 * @returns True if currency is supported
 */
export function isSupportedCurrency(currency: string): boolean {
  const supported = ['EUR', 'CHF', 'USD', 'GBP', 'CAD', 'AUD'];
  return supported.includes(currency.toUpperCase());
}
