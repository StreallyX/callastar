import { Decimal } from '@prisma/client/runtime/library';

/**
 * Convertit un objet Decimal de Prisma en number
 * Utile pour éviter les warnings React "Decimal objects are not supported"
 */
export function decimalToNumber(decimal: Decimal | number | null | undefined): number {
  if (decimal === null || decimal === undefined) {
    return 0;
  }
  
  if (typeof decimal === 'number') {
    return decimal;
  }
  
  return decimal.toNumber();
}

/**
 * Convertit un objet Decimal de Prisma en string
 */
export function decimalToString(decimal: Decimal | number | null | undefined): string {
  if (decimal === null || decimal === undefined) {
    return '0';
  }
  
  if (typeof decimal === 'number') {
    return decimal.toString();
  }
  
  return decimal.toString();
}

/**
 * Convertit récursivement tous les Decimal d'un objet en number
 * Et convertit les Date en string ISO pour une sérialisation correcte
 * Utile pour préparer des objets de base de données avant de les envoyer au frontend
 */
export function sanitizeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) {
    return obj;
  }
  
  // ✅ Convertir les Decimal en number
  if (Decimal.isDecimal(obj)) {
    return obj.toNumber() as any;
  }
  
  // ✅ Convertir les Date en string ISO
  if (obj instanceof Date) {
    return obj.toISOString() as any;
  }
  
  // ✅ Traiter les tableaux
  if (Array.isArray(obj)) {
    return obj.map(item => sanitizeDecimals(item)) as any;
  }
  
  // ✅ Traiter les objets
  if (typeof obj === 'object') {
    const sanitized: any = {};
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        sanitized[key] = sanitizeDecimals(obj[key]);
      }
    }
    return sanitized;
  }
  
  return obj;
}
