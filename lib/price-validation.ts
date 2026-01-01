import { Decimal } from '@prisma/client/runtime/library';

/**
 * Convertit une valeur en number de manière sécurisée
 * Lève une erreur si la conversion échoue
 */
export function safeToNumber(
  value: Decimal | number | string | null | undefined,
  fieldName: string
): number {
  // Cas null/undefined
  if (value === null || value === undefined) {
    throw new Error(`${fieldName} is null or undefined`);
  }

  // Cas Decimal (de Prisma)
  if (value instanceof Decimal) {
    const num = value.toNumber();
    if (isNaN(num) || !isFinite(num)) {
      throw new Error(`${fieldName} Decimal conversion resulted in ${num}`);
    }
    return num;
  }

  // Cas string (métadonnées Stripe)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      throw new Error(`${fieldName} is an empty string`);
    }
    const num = Number(trimmed);
    if (isNaN(num) || !isFinite(num)) {
      throw new Error(`${fieldName} string "${value}" cannot be converted to a valid number`);
    }
    return num;
  }

  // Cas number
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      throw new Error(`${fieldName} is ${value}`);
    }
    return value;
  }

  throw new Error(`${fieldName} has unsupported type: ${typeof value}`);
}

/**
 * Convertit une valeur en number de manière sécurisée, retourne 0 en cas d'erreur
 * Version permissive pour le frontend qui ne lève pas d'exception
 */
export function safeToNumberOrZero(
  value: Decimal | number | string | null | undefined
): number {
  // Cas null/undefined
  if (value === null || value === undefined) {
    console.warn('[safeToNumberOrZero] Value is null or undefined, returning 0');
    return 0;
  }

  // Cas Decimal (de Prisma)
  if (value instanceof Decimal) {
    const num = value.toNumber();
    if (isNaN(num) || !isFinite(num)) {
      console.error('[safeToNumberOrZero] Decimal conversion resulted in', num, 'returning 0');
      return 0;
    }
    return num;
  }

  // Cas string (métadonnées Stripe)
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') {
      console.warn('[safeToNumberOrZero] Empty string, returning 0');
      return 0;
    }
    const num = Number(trimmed);
    if (isNaN(num) || !isFinite(num)) {
      console.error('[safeToNumberOrZero] String cannot be converted:', value, 'returning 0');
      return 0;
    }
    return num;
  }

  // Cas number
  if (typeof value === 'number') {
    if (isNaN(value) || !isFinite(value)) {
      console.error('[safeToNumberOrZero] Number is', value, 'returning 0');
      return 0;
    }
    return value;
  }

  // Cas objet (peut-être un Decimal sérialisé)
  if (typeof value === 'object') {
    console.error('[safeToNumberOrZero] Unexpected object type:', value, 'returning 0');
    return 0;
  }

  console.error('[safeToNumberOrZero] Unsupported type:', typeof value, 'returning 0');
  return 0;
}

/**
 * Valide qu'un montant est positif
 */
export function validatePositiveAmount(amount: number, fieldName: string): void {
  if (amount <= 0) {
    throw new Error(`${fieldName} must be positive, got ${amount}`);
  }
}

/**
 * Valide qu'un montant n'est pas négatif
 */
export function validateNonNegativeAmount(amount: number, fieldName: string): void {
  if (amount < 0) {
    throw new Error(`${fieldName} must be non-negative, got ${amount}`);
  }
}

/**
 * Calcule les frais de plateforme de manière sécurisée
 */
export function calculatePlatformFee(
  amount: number,
  platformFeePercentage: number,
  platformFeeFixed: number = 0
): number {
  validatePositiveAmount(amount, 'amount');
  validateNonNegativeAmount(platformFeePercentage, 'platformFeePercentage');
  validateNonNegativeAmount(platformFeeFixed, 'platformFeeFixed');

  const percentageFee = (amount * platformFeePercentage) / 100;
  const totalFee = percentageFee + platformFeeFixed;

  if (isNaN(totalFee) || !isFinite(totalFee)) {
    throw new Error(`Platform fee calculation resulted in ${totalFee}`);
  }

  return totalFee;
}

/**
 * Calcule le montant du créateur de manière sécurisée
 */
export function calculateCreatorAmount(
  amount: number,
  platformFee: number
): number {
  validatePositiveAmount(amount, 'amount');
  validateNonNegativeAmount(platformFee, 'platformFee');

  if (platformFee > amount) {
    throw new Error(`Platform fee (${platformFee}) cannot exceed amount (${amount})`);
  }

  const creatorAmount = amount - platformFee;

  if (isNaN(creatorAmount) || !isFinite(creatorAmount) || creatorAmount < 0) {
    throw new Error(`Creator amount calculation resulted in ${creatorAmount}`);
  }

  return creatorAmount;
}

/**
 * Log des valeurs de prix pour le débogage
 */
export function logPriceCalculation(
  context: string,
  values: Record<string, any>
): void {
  console.log(`[Price Calculation] ${context}:`, {
    ...values,
    timestamp: new Date().toISOString(),
  });
}
