import { PlatformSettings, PayoutMode, Prisma } from "@prisma/client";
import prisma from "@/lib/db";

// Type for updating settings (all fields optional except those that can't be null)
export type PlatformSettingsUpdate = {
  platformFeePercentage?: number;
  platformFeeFixed?: number | null;
  minimumPayoutAmount?: number;
  holdingPeriodDays?: number;
  payoutMode?: PayoutMode;
  payoutFrequencyOptions?: string[];
  currency?: string;
};

// Type for settings response
export type PlatformSettingsResponse = {
  id: string;
  platformFeePercentage: number;
  platformFeeFixed: number | null;
  minimumPayoutAmount: number;
  holdingPeriodDays: number;
  payoutMode: PayoutMode;
  payoutFrequencyOptions: string[];
  currency: string;
  createdAt: Date;
  updatedAt: Date;
};

// In-memory cache for settings
let settingsCache: PlatformSettings | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 60000; // 60 seconds

/**
 * Get default platform settings
 */
export function getDefaultSettings(): Omit<PlatformSettings, "id" | "createdAt" | "updatedAt"> {
  return {
    platformFeePercentage: new Prisma.Decimal(15.0),
    platformFeeFixed: null,
    minimumPayoutAmount: new Prisma.Decimal(10.0),
    holdingPeriodDays: 7,
    payoutMode: PayoutMode.AUTOMATIC,
    payoutFrequencyOptions: ["DAILY", "WEEKLY", "MONTHLY"],
    currency: "EUR",
  };
}

/**
 * Get platform settings (with caching)
 * If no settings exist, creates default settings
 */
export async function getPlatformSettings(): Promise<PlatformSettings> {
  // Check cache
  const now = Date.now();
  if (settingsCache && (now - cacheTimestamp) < CACHE_TTL) {
    return settingsCache;
  }

  try {
    // Try to fetch from database
    let settings = await prisma.platformSettings.findFirst();

    // If no settings exist, create default settings
    if (!settings) {
      const defaultSettings = getDefaultSettings();
      settings = await prisma.platformSettings.create({
        data: defaultSettings,
      });
    }

    // Update cache
    settingsCache = settings;
    cacheTimestamp = now;

    return settings;
  } catch (error) {
    console.error("Error fetching platform settings:", error);
    throw new Error("Failed to fetch platform settings");
  }
}

/**
 * Update platform settings
 * Validates input and updates the settings
 */
export async function updatePlatformSettings(
  data: PlatformSettingsUpdate
): Promise<PlatformSettings> {
  try {
    // Validate input
    if (data.platformFeePercentage !== undefined) {
      if (data.platformFeePercentage < 0 || data.platformFeePercentage > 100) {
        throw new Error("Platform fee percentage must be between 0 and 100");
      }
    }

    if (data.minimumPayoutAmount !== undefined) {
      if (data.minimumPayoutAmount <= 0) {
        throw new Error("Minimum payout amount must be greater than 0");
      }
    }

    if (data.holdingPeriodDays !== undefined) {
      if (data.holdingPeriodDays < 0) {
        throw new Error("Holding period days cannot be negative");
      }
    }

    if (data.platformFeeFixed !== undefined && data.platformFeeFixed !== null) {
      if (data.platformFeeFixed < 0) {
        throw new Error("Platform fixed fee cannot be negative");
      }
    }

    // Get current settings (or create if doesn't exist)
    let currentSettings = await prisma.platformSettings.findFirst();

    if (!currentSettings) {
      // Create with default values and apply updates
      const defaultSettings = getDefaultSettings();
      currentSettings = await prisma.platformSettings.create({
        data: convertToCreateData(data, defaultSettings),
      });
    } else {
      // Update existing settings
      currentSettings = await prisma.platformSettings.update({
        where: { id: currentSettings.id },
        data: convertToDecimalData(data),
      });
    }

    // Invalidate cache
    settingsCache = currentSettings;
    cacheTimestamp = Date.now();

    return currentSettings;
  } catch (error) {
    console.error("Error updating platform settings:", error);
    throw error;
  }
}

/**
 * Convert numeric values to Prisma Decimal for database storage (for updates)
 */
function convertToDecimalData(data: PlatformSettingsUpdate): Prisma.PlatformSettingsUpdateInput {
  const updateData: Prisma.PlatformSettingsUpdateInput = {};

  if (data.platformFeePercentage !== undefined) {
    updateData.platformFeePercentage = new Prisma.Decimal(data.platformFeePercentage);
  }

  if (data.platformFeeFixed !== undefined) {
    updateData.platformFeeFixed = data.platformFeeFixed !== null 
      ? new Prisma.Decimal(data.platformFeeFixed) 
      : null;
  }

  if (data.minimumPayoutAmount !== undefined) {
    updateData.minimumPayoutAmount = new Prisma.Decimal(data.minimumPayoutAmount);
  }

  if (data.holdingPeriodDays !== undefined) {
    updateData.holdingPeriodDays = data.holdingPeriodDays;
  }

  if (data.payoutMode !== undefined) {
    updateData.payoutMode = data.payoutMode;
  }

  if (data.payoutFrequencyOptions !== undefined) {
    updateData.payoutFrequencyOptions = data.payoutFrequencyOptions;
  }

  if (data.currency !== undefined) {
    updateData.currency = data.currency;
  }

  return updateData;
}

/**
 * Convert update data to create input format
 */
function convertToCreateData(data: PlatformSettingsUpdate, defaults: Omit<PlatformSettings, "id" | "createdAt" | "updatedAt">): Prisma.PlatformSettingsCreateInput {
  return {
    platformFeePercentage: data.platformFeePercentage !== undefined 
      ? new Prisma.Decimal(data.platformFeePercentage) 
      : defaults.platformFeePercentage,
    platformFeeFixed: data.platformFeeFixed !== undefined 
      ? (data.platformFeeFixed !== null ? new Prisma.Decimal(data.platformFeeFixed) : null)
      : defaults.platformFeeFixed,
    minimumPayoutAmount: data.minimumPayoutAmount !== undefined 
      ? new Prisma.Decimal(data.minimumPayoutAmount) 
      : defaults.minimumPayoutAmount,
    holdingPeriodDays: data.holdingPeriodDays ?? defaults.holdingPeriodDays,
    payoutMode: data.payoutMode ?? defaults.payoutMode,
    payoutFrequencyOptions: data.payoutFrequencyOptions ?? defaults.payoutFrequencyOptions,
    currency: data.currency ?? defaults.currency,
  };
}

/**
 * Clear the settings cache (useful for testing or forced refresh)
 */
export function clearSettingsCache(): void {
  settingsCache = null;
  cacheTimestamp = 0;
}

/**
 * Convert PlatformSettings to response format with proper number types
 */
export function formatSettingsResponse(settings: PlatformSettings): PlatformSettingsResponse {
  return {
    id: settings.id,
    platformFeePercentage: Number(settings.platformFeePercentage),
    platformFeeFixed: settings.platformFeeFixed ? Number(settings.platformFeeFixed) : null,
    minimumPayoutAmount: Number(settings.minimumPayoutAmount),
    holdingPeriodDays: settings.holdingPeriodDays,
    payoutMode: settings.payoutMode,
    payoutFrequencyOptions: settings.payoutFrequencyOptions,
    currency: settings.currency,
    createdAt: settings.createdAt,
    updatedAt: settings.updatedAt,
  };
}
