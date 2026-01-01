/**
 * Currency Utilities
 * 
 * CRITICAL: Understanding Stripe amounts vs Database amounts
 * 
 * RÈGLE FONDAMENTALE :
 * - API Stripe → Montants EN CENTIMES (ex: 1700 centimes = 17.00 EUR)
 * - Base de données → Montants EN UNITÉS (ex: 17.00 EUR)
 * - Metadata Stripe (créés par nous) → EN UNITÉS (ex: "17.00")
 * 
 * ⚠️ ATTENTION : Ne JAMAIS diviser par 100 un montant déjà en unités !
 */

/**
 * Convert Stripe amount (in cents) to display amount (in currency units)
 * 
 * @param amountInCents - Amount from Stripe API (always in smallest currency unit / cents)
 * @returns Amount in currency units (e.g., 1700 → 17.00)
 * 
 * Usage: When receiving data directly from Stripe API
 * Example: stripePayout.amount, stripeBalance.available[0].amount
 */
export function stripeAmountToUnits(amountInCents: number): number {
  return amountInCents / 100;
}

/**
 * Convert currency units to Stripe amount (in cents)
 * 
 * @param amount - Amount in currency units (e.g., 17.00)
 * @returns Amount in cents for Stripe API (e.g., 17.00 → 1700)
 * 
 * Usage: When sending data to Stripe API
 * Example: Creating payment intents, transfers, payouts
 */
export function unitsToStripeAmount(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Format amount from database for display
 * 
 * @param amount - Amount from database (already in currency units)
 * @param decimals - Number of decimal places (default: 2)
 * @returns Formatted amount as string
 * 
 * Usage: Displaying amounts from Payment, Payout, Booking models
 * Example: payment.amount, payout.amount, booking.totalPrice
 */
export function formatDbAmount(amount: number | string | null | undefined, decimals: number = 2): string {
  // ✅ Handle null/undefined
  if (amount === null || amount === undefined) {
    console.warn('formatDbAmount: amount is null/undefined');
    return (0).toFixed(decimals);
  }
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  // ✅ Check if amount is NaN
  if (isNaN(numAmount)) {
    console.error('formatDbAmount: amount is NaN', { originalAmount: amount });
    return (0).toFixed(decimals);
  }
  
  return numAmount.toFixed(decimals);
}

/**
 * Format amount with currency CODE (not symbol)
 * 
 * @param amount - Amount in currency units
 * @param currency - Currency code (EUR, USD, CHF, etc.)
 * @returns Formatted amount with currency code (e.g., "500.00 GBP", "1250.50 EUR")
 * 
 * Usage: Displaying amounts in UI consistently
 * Note: Always displays as "amount CODE" format to avoid symbol confusion
 */
export function formatCurrency(
  amount: number | string | null | undefined, 
  currency: string = 'EUR'
): string {
  // ✅ Handle null/undefined
  if (amount === null || amount === undefined) {
    console.warn('formatCurrency: amount is null/undefined');
    return `0.00 ${currency.toUpperCase()}`;
  }
  
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  const currencyCode = currency.toUpperCase();
  
  // ✅ Check if amount is NaN
  if (isNaN(numAmount)) {
    console.error('formatCurrency: amount is NaN', { originalAmount: amount, currency });
    return `0.00 ${currencyCode}`;
  }
  
  return `${numAmount.toFixed(2)} ${currencyCode}`;
}

/**
 * Format amount with currency symbol (legacy, use formatCurrency instead)
 * 
 * @param amount - Amount in currency units
 * @param currency - Currency code (EUR, USD, CHF, etc.)
 * @param locale - Locale for formatting (default: 'fr-FR')
 * @returns Formatted amount with currency symbol
 * 
 * @deprecated Use formatCurrency() for consistent "amount CODE" formatting
 */
export function formatCurrencyWithSymbol(
  amount: number | string, 
  currency: string = 'EUR',
  locale: string = 'fr-FR'
): string {
  const numAmount = typeof amount === 'string' ? parseFloat(amount) : amount;
  
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: currency.toUpperCase(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numAmount);
}

/**
 * Format amount for Stripe amount (in cents) for display
 * 
 * @param amountInCents - Amount from Stripe API (in cents)
 * @param currency - Currency code
 * @param locale - Locale for formatting
 * @returns Formatted amount with currency symbol
 * 
 * Usage: Displaying amounts directly from Stripe API objects
 */
export function formatStripeAmount(
  amountInCents: number,
  currency: string = 'EUR',
  locale: string = 'fr-FR'
): string {
  const amountInUnits = stripeAmountToUnits(amountInCents);
  return formatCurrency(amountInUnits, currency);
}

/**
 * Type guard to determine if an amount is from Stripe API or Database
 * 
 * This is a helper for code clarity - you should always know the source
 * of your data, but this can help during refactoring
 */
export enum AmountSource {
  STRIPE_API = 'STRIPE_API',      // Amount in cents (needs /100)
  DATABASE = 'DATABASE',           // Amount in units (no conversion)
  STRIPE_METADATA = 'METADATA',   // Amount in units (created by us)
}

/**
 * Convert amount based on its source
 * 
 * @param amount - The amount to convert
 * @param source - Where the amount comes from
 * @returns Amount in currency units
 */
export function normalizeAmount(amount: number, source: AmountSource): number {
  switch (source) {
    case AmountSource.STRIPE_API:
      return stripeAmountToUnits(amount);
    case AmountSource.DATABASE:
    case AmountSource.STRIPE_METADATA:
      return amount; // Already in correct format
    default:
      throw new Error(`Unknown amount source: ${source}`);
  }
}

/**
 * Examples of correct usage:
 * 
 * ✅ CORRECT:
 * 
 * // From Stripe API (balance, payout object):
 * const balance = await stripe.balance.retrieve();
 * const availableEur = stripeAmountToUnits(balance.available[0].amount); // 1700 → 17.00
 * 
 * // From Database:
 * const payout = await prisma.payout.findUnique({ where: { id } });
 * const display = formatDbAmount(payout.amount); // 17.00 → "17.00"
 * 
 * // From Stripe metadata (created by us):
 * const paymentIntent = await stripe.paymentIntents.retrieve(id);
 * const creatorAmount = Number(paymentIntent.metadata.creatorAmount); // "17.00" → 17.00
 * 
 * // For display with currency:
 * const formatted = formatCurrency(payout.amount, 'EUR'); // "17,00 €"
 * 
 * ❌ INCORRECT:
 * 
 * // DON'T divide DB amount by 100:
 * const wrong = payout.amount / 100; // 17.00 → 0.17 ❌
 * 
 * // DON'T forget to convert Stripe amount:
 * const wrong = stripePayout.amount; // 1700 instead of 17.00 ❌
 */
