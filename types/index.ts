// Common types used throughout the application
import { Prisma } from '@prisma/client';

// Creator with related data
export type CreatorWithUser = Prisma.CreatorGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        email: true;
      };
    };
    callOffers: true;
  };
}>;

// Creator with minimal data for cards
export type CreatorCardData = {
  id: string;
  bio?: string | null;
  profileImage?: string | null;
  user: {
    id: string;
    name: string;
  };
  callOffers?: Array<{
    id: string;
    title: string;
    price: number | Prisma.Decimal;
    dateTime?: Date;
  }>;
};

// Booking with related data
export type BookingWithDetails = Prisma.BookingGetPayload<{
  include: {
    callOffer: {
      include: {
        creator: {
          include: {
            user: true;
          };
        };
      };
    };
    user: true;
  };
}>;

// Review with related data
export type ReviewWithUser = Prisma.ReviewGetPayload<{
  include: {
    user: {
      select: {
        id: true;
        name: true;
        image: true;
      };
    };
  };
}>;

// Call offer with creator
export type CallOfferWithCreator = Prisma.CallOfferGetPayload<{
  include: {
    creator: {
      include: {
        user: true;
      };
    };
  };
}>;

// Error response type
export interface ErrorResponse {
  error: string;
  details?: unknown;
}

// API response wrapper
export type ApiResponse<T> = 
  | { success: true; data: T }
  | { success: false; error: string; details?: unknown };
