'use client';

import { sendGAEvent } from '@next/third-parties/google';

/**
 * Track custom events in Google Analytics
 * @param eventName - Name of the event (e.g., 'booking_completed', 'creator_profile_viewed')
 * @param params - Additional parameters to track with the event
 */
export const trackEvent = (eventName: string, params?: Record<string, any>) => {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    sendGAEvent({ event: eventName, ...params });
  }
};

/**
 * Track page views (automatically handled by GoogleAnalytics component)
 * This function can be used for manual page view tracking if needed
 */
export const trackPageView = (url: string) => {
  if (typeof window !== 'undefined' && process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID) {
    sendGAEvent({ event: 'page_view', page_path: url });
  }
};

/**
 * Predefined events for common actions
 */
export const AnalyticsEvents = {
  // User Authentication
  USER_SIGNUP: 'user_signup',
  USER_LOGIN: 'user_login',
  USER_LOGOUT: 'user_logout',
  
  // Creator Actions
  CREATOR_PROFILE_VIEWED: 'creator_profile_viewed',
  CREATOR_CALL_OFFER_CREATED: 'creator_call_offer_created',
  
  // Booking Flow
  BOOKING_INITIATED: 'booking_initiated',
  BOOKING_COMPLETED: 'booking_completed',
  BOOKING_CANCELLED: 'booking_cancelled',
  
  // Payment
  PAYMENT_INITIATED: 'payment_initiated',
  PAYMENT_COMPLETED: 'payment_completed',
  PAYMENT_FAILED: 'payment_failed',
  
  // Video Call
  VIDEO_CALL_STARTED: 'video_call_started',
  VIDEO_CALL_ENDED: 'video_call_ended',
  
  // Reviews
  REVIEW_SUBMITTED: 'review_submitted',
  
  // Call Requests
  CALL_REQUEST_SUBMITTED: 'call_request_submitted',
  CALL_REQUEST_ACCEPTED: 'call_request_accepted',
  CALL_REQUEST_REJECTED: 'call_request_rejected',
};
