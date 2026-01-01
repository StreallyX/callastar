-- CreateEnum
CREATE TYPE "Role" AS ENUM ('USER', 'CREATOR', 'ADMIN');

-- CreateEnum
CREATE TYPE "CallOfferStatus" AS ENUM ('AVAILABLE', 'BOOKED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "CallRequestStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('REQUESTED', 'APPROVED', 'PROCESSING', 'PAID', 'FAILED', 'REJECTED', 'CANCELED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('BOOKING_CONFIRMED', 'BOOKING_CANCELLED', 'CALL_REQUEST', 'REVIEW_RECEIVED', 'PAYOUT_COMPLETED', 'SYSTEM', 'PAYMENT_RECEIVED', 'PAYOUT_REQUEST', 'PAYOUT_APPROVED', 'PAYOUT_FAILED', 'REFUND_CREATED', 'DISPUTE_CREATED', 'DEBT_DEDUCTED', 'TRANSFER_FAILED', 'DEBT_THRESHOLD_EXCEEDED');

-- CreateEnum
CREATE TYPE "PayoutSchedule" AS ENUM ('DAILY', 'WEEKLY', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayoutAction" AS ENUM ('TRIGGERED', 'BLOCKED', 'UNBLOCKED', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "PayoutMode" AS ENUM ('AUTOMATIC', 'MANUAL');

-- CreateEnum
CREATE TYPE "PayoutFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "TransactionEventType" AS ENUM ('PAYMENT_CREATED', 'PAYMENT_SUCCEEDED', 'PAYMENT_FAILED', 'REFUND_CREATED', 'REFUND_SUCCEEDED', 'REFUND_FAILED', 'PAYOUT_CREATED', 'PAYOUT_PAID', 'PAYOUT_FAILED', 'TRANSFER_CREATED', 'TRANSFER_SUCCEEDED', 'TRANSFER_FAILED', 'WEBHOOK_RECEIVED', 'DISPUTE_CREATED', 'DISPUTE_UPDATED', 'DISPUTE_CLOSED');

-- CreateEnum
CREATE TYPE "LogLevel" AS ENUM ('INFO', 'WARNING', 'ERROR', 'CRITICAL');

-- CreateEnum
CREATE TYPE "LogActor" AS ENUM ('USER', 'CREATOR', 'ADMIN', 'SYSTEM', 'GUEST');

-- CreateEnum
CREATE TYPE "LogType" AS ENUM ('EMAIL_SENT', 'EMAIL_ERROR', 'CRON_RUN', 'CRON_ERROR', 'DAILY_ROOM_DELETED', 'DAILY_ROOM_ERROR', 'BOOKING_CREATED', 'BOOKING_ERROR', 'PAYMENT_SUCCESS', 'PAYMENT_ERROR', 'PAYMENT_REFUND', 'PAYOUT_SUCCESS', 'PAYOUT_ERROR', 'STRIPE_WEBHOOK', 'STRIPE_WEBHOOK_ERROR', 'DAILY_ROOM_CREATED', 'NOTIFICATION_SENT', 'NOTIFICATION_ERROR', 'SYSTEM_ERROR', 'API_ERROR', 'CALL_EVENT', 'PAYMENT_INTENT_CREATION_INITIATED', 'PAYMENT_INTENT_CREATED_SUCCESS', 'PAYMENT_INTENT_UNAUTHORIZED', 'PAYMENT_INTENT_OFFER_NOT_FOUND', 'PAYMENT_INTENT_OFFER_NOT_AVAILABLE', 'PAYMENT_INTENT_OFFER_ALREADY_BOOKED', 'PAYMENT_INTENT_OFFER_EXPIRED', 'PAYMENT_INTENT_VALIDATION_ERROR', 'WEBHOOK_SIGNATURE_VERIFIED', 'WEBHOOK_SIGNATURE_VERIFICATION_FAILED', 'WEBHOOK_NO_SIGNATURE', 'WEBHOOK_PROCESSING_STARTED', 'WEBHOOK_PROCESSING_SUCCESS');

-- CreateEnum
CREATE TYPE "LogStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateEnum
CREATE TYPE "EntityType" AS ENUM ('PAYMENT', 'PAYOUT', 'REFUND', 'DISPUTE', 'TRANSFER');

-- CreateEnum
CREATE TYPE "RefundStatus" AS ENUM ('PENDING', 'SUCCEEDED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DisputeStatus" AS ENUM ('WARNING_NEEDS_RESPONSE', 'WARNING_UNDER_REVIEW', 'WARNING_CLOSED', 'NEEDS_RESPONSE', 'UNDER_REVIEW', 'CHARGE_REFUNDED', 'WON', 'LOST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT,
    "name" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "role" "Role" NOT NULL DEFAULT 'USER',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Creator" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "bio" TEXT,
    "expertise" TEXT,
    "profileImage" TEXT,
    "bannerImage" TEXT,
    "stripeAccountId" TEXT,
    "isStripeOnboarded" BOOLEAN NOT NULL DEFAULT false,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris',
    "socialLinks" JSONB,
    "payoutSchedule" "PayoutSchedule" NOT NULL DEFAULT 'WEEKLY',
    "payoutMinimum" DECIMAL(10,2) NOT NULL DEFAULT 10,
    "isPayoutBlocked" BOOLEAN NOT NULL DEFAULT false,
    "payoutBlockReason" TEXT,
    "payoutBlocked" BOOLEAN NOT NULL DEFAULT false,
    "payoutBlockedReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Creator_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallOffer" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "price" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "dateTime" TIMESTAMP(3) NOT NULL,
    "duration" INTEGER NOT NULL,
    "status" "CallOfferStatus" NOT NULL DEFAULT 'AVAILABLE',
    "maxParticipants" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallOffer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "callOfferId" TEXT NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "totalPrice" DECIMAL(10,2) NOT NULL,
    "stripePaymentIntentId" TEXT,
    "dailyRoomUrl" TEXT,
    "dailyRoomName" TEXT,
    "isTestBooking" BOOLEAN NOT NULL DEFAULT false,
    "reminderSent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "stripePaymentIntentId" TEXT NOT NULL,
    "status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "platformFee" DECIMAL(10,2) NOT NULL,
    "creatorAmount" DECIMAL(10,2) NOT NULL,
    "refundedAmount" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "disputeStatus" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payoutStatus" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "payoutReleaseDate" TIMESTAMP(3),
    "stripeTransferId" TEXT,
    "payoutDate" TIMESTAMP(3),
    "transferId" TEXT,
    "transferStatus" TEXT,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CallRequest" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "proposedPrice" DECIMAL(10,2) NOT NULL,
    "proposedDateTime" TIMESTAMP(3) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "CallRequestStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CallRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "comment" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payout" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "status" "PayoutStatus" NOT NULL DEFAULT 'REQUESTED',
    "stripePayoutId" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "rejectionReason" TEXT,
    "failureReason" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payout_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdminSettings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdminSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutAuditLog" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "payoutId" TEXT,
    "action" "PayoutAction" NOT NULL,
    "amount" DECIMAL(10,2),
    "status" "PayoutStatus",
    "stripePayoutId" TEXT,
    "adminId" TEXT,
    "reason" TEXT,
    "metadata" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL,
    "platformFeePercentage" DECIMAL(5,2) NOT NULL,
    "platformFeeFixed" DECIMAL(10,2),
    "minimumPayoutAmount" DECIMAL(10,2) NOT NULL,
    "holdingPeriodDays" INTEGER NOT NULL,
    "payoutMode" "PayoutMode" NOT NULL DEFAULT 'AUTOMATIC',
    "payoutFrequencyOptions" TEXT[],
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TransactionLog" (
    "id" TEXT NOT NULL,
    "eventType" "TransactionEventType" NOT NULL,
    "entityType" "EntityType" NOT NULL,
    "entityId" TEXT NOT NULL,
    "stripeEventId" TEXT,
    "amount" DECIMAL(10,2),
    "currency" TEXT,
    "status" TEXT,
    "metadata" JSONB,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentId" TEXT,
    "payoutId" TEXT,
    "refundId" TEXT,

    CONSTRAINT "TransactionLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "reason" TEXT NOT NULL,
    "status" "RefundStatus" NOT NULL DEFAULT 'PENDING',
    "stripeRefundId" TEXT,
    "initiatedById" TEXT NOT NULL,
    "creatorDebt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "reversalId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dispute" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "stripeDisputeId" TEXT NOT NULL,
    "amount" DECIMAL(10,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'EUR',
    "reason" TEXT NOT NULL,
    "status" "DisputeStatus" NOT NULL,
    "evidenceDetails" JSONB,
    "creatorDebt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "reconciled" BOOLEAN NOT NULL DEFAULT false,
    "reconciledAt" TIMESTAMP(3),
    "reconciledBy" TEXT,
    "reversalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dispute_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PayoutScheduleNew" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "mode" "PayoutMode" NOT NULL DEFAULT 'AUTOMATIC',
    "frequency" "PayoutFrequency" NOT NULL DEFAULT 'WEEKLY',
    "nextPayoutDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PayoutScheduleNew_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Log" (
    "id" TEXT NOT NULL,
    "type" "LogType" NOT NULL,
    "status" "LogStatus" NOT NULL,
    "message" TEXT NOT NULL,
    "context" JSONB,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_token_key" ON "VerificationToken"("token");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Creator_userId_key" ON "Creator"("userId");

-- CreateIndex
CREATE INDEX "Creator_userId_idx" ON "Creator"("userId");

-- CreateIndex
CREATE INDEX "Creator_isPayoutBlocked_idx" ON "Creator"("isPayoutBlocked");

-- CreateIndex
CREATE INDEX "Creator_currency_idx" ON "Creator"("currency");

-- CreateIndex
CREATE INDEX "CallOffer_creatorId_idx" ON "CallOffer"("creatorId");

-- CreateIndex
CREATE INDEX "CallOffer_status_idx" ON "CallOffer"("status");

-- CreateIndex
CREATE INDEX "CallOffer_dateTime_idx" ON "CallOffer"("dateTime");

-- CreateIndex
CREATE INDEX "CallOffer_currency_idx" ON "CallOffer"("currency");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_callOfferId_key" ON "Booking"("callOfferId");

-- CreateIndex
CREATE INDEX "Booking_userId_idx" ON "Booking"("userId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_isTestBooking_idx" ON "Booking"("isTestBooking");

-- CreateIndex
CREATE INDEX "Booking_reminderSent_idx" ON "Booking"("reminderSent");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_bookingId_key" ON "Payment"("bookingId");

-- CreateIndex
CREATE INDEX "Payment_stripePaymentIntentId_idx" ON "Payment"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "Payment_payoutStatus_idx" ON "Payment"("payoutStatus");

-- CreateIndex
CREATE INDEX "Payment_currency_idx" ON "Payment"("currency");

-- CreateIndex
CREATE INDEX "Payment_transferId_idx" ON "Payment"("transferId");

-- CreateIndex
CREATE INDEX "CallRequest_userId_idx" ON "CallRequest"("userId");

-- CreateIndex
CREATE INDEX "CallRequest_creatorId_idx" ON "CallRequest"("creatorId");

-- CreateIndex
CREATE INDEX "CallRequest_status_idx" ON "CallRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

-- CreateIndex
CREATE INDEX "Review_userId_idx" ON "Review"("userId");

-- CreateIndex
CREATE INDEX "Review_creatorId_idx" ON "Review"("creatorId");

-- CreateIndex
CREATE INDEX "Review_rating_idx" ON "Review"("rating");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- CreateIndex
CREATE INDEX "Notification_read_idx" ON "Notification"("read");

-- CreateIndex
CREATE INDEX "Notification_createdAt_idx" ON "Notification"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_stripePayoutId_key" ON "Payout"("stripePayoutId");

-- CreateIndex
CREATE INDEX "Payout_creatorId_idx" ON "Payout"("creatorId");

-- CreateIndex
CREATE INDEX "Payout_status_idx" ON "Payout"("status");

-- CreateIndex
CREATE INDEX "Payout_currency_idx" ON "Payout"("currency");

-- CreateIndex
CREATE INDEX "Payout_stripePayoutId_idx" ON "Payout"("stripePayoutId");

-- CreateIndex
CREATE UNIQUE INDEX "AdminSettings_key_key" ON "AdminSettings"("key");

-- CreateIndex
CREATE INDEX "AdminSettings_key_idx" ON "AdminSettings"("key");

-- CreateIndex
CREATE INDEX "PayoutAuditLog_creatorId_idx" ON "PayoutAuditLog"("creatorId");

-- CreateIndex
CREATE INDEX "PayoutAuditLog_payoutId_idx" ON "PayoutAuditLog"("payoutId");

-- CreateIndex
CREATE INDEX "PayoutAuditLog_action_idx" ON "PayoutAuditLog"("action");

-- CreateIndex
CREATE INDEX "PayoutAuditLog_createdAt_idx" ON "PayoutAuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_eventType_idx" ON "TransactionLog"("eventType");

-- CreateIndex
CREATE INDEX "TransactionLog_entityType_idx" ON "TransactionLog"("entityType");

-- CreateIndex
CREATE INDEX "TransactionLog_entityId_idx" ON "TransactionLog"("entityId");

-- CreateIndex
CREATE INDEX "TransactionLog_createdAt_idx" ON "TransactionLog"("createdAt");

-- CreateIndex
CREATE INDEX "TransactionLog_stripeEventId_idx" ON "TransactionLog"("stripeEventId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_stripeRefundId_key" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Refund_paymentId_idx" ON "Refund"("paymentId");

-- CreateIndex
CREATE INDEX "Refund_status_idx" ON "Refund"("status");

-- CreateIndex
CREATE INDEX "Refund_stripeRefundId_idx" ON "Refund"("stripeRefundId");

-- CreateIndex
CREATE INDEX "Refund_reconciled_idx" ON "Refund"("reconciled");

-- CreateIndex
CREATE UNIQUE INDEX "Dispute_stripeDisputeId_key" ON "Dispute"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "Dispute_paymentId_idx" ON "Dispute"("paymentId");

-- CreateIndex
CREATE INDEX "Dispute_status_idx" ON "Dispute"("status");

-- CreateIndex
CREATE INDEX "Dispute_stripeDisputeId_idx" ON "Dispute"("stripeDisputeId");

-- CreateIndex
CREATE INDEX "Dispute_reconciled_idx" ON "Dispute"("reconciled");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutScheduleNew_creatorId_key" ON "PayoutScheduleNew"("creatorId");

-- CreateIndex
CREATE INDEX "PayoutScheduleNew_creatorId_idx" ON "PayoutScheduleNew"("creatorId");

-- CreateIndex
CREATE INDEX "PayoutScheduleNew_nextPayoutDate_idx" ON "PayoutScheduleNew"("nextPayoutDate");

-- CreateIndex
CREATE INDEX "PayoutScheduleNew_isActive_idx" ON "PayoutScheduleNew"("isActive");

-- CreateIndex
CREATE INDEX "Log_type_idx" ON "Log"("type");

-- CreateIndex
CREATE INDEX "Log_status_idx" ON "Log"("status");

-- CreateIndex
CREATE INDEX "Log_createdAt_idx" ON "Log"("createdAt");

-- CreateIndex
CREATE INDEX "Log_type_status_idx" ON "Log"("type", "status");

-- CreateIndex
CREATE INDEX "Log_type_createdAt_idx" ON "Log"("type", "createdAt");

-- CreateIndex
CREATE INDEX "Log_status_createdAt_idx" ON "Log"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Creator" ADD CONSTRAINT "Creator_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallOffer" ADD CONSTRAINT "CallOffer_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_callOfferId_fkey" FOREIGN KEY ("callOfferId") REFERENCES "CallOffer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRequest" ADD CONSTRAINT "CallRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CallRequest" ADD CONSTRAINT "CallRequest_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Review" ADD CONSTRAINT "Review_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAuditLog" ADD CONSTRAINT "PayoutAuditLog_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutAuditLog" ADD CONSTRAINT "PayoutAuditLog_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_payoutId_fkey" FOREIGN KEY ("payoutId") REFERENCES "Payout"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TransactionLog" ADD CONSTRAINT "TransactionLog_refundId_fkey" FOREIGN KEY ("refundId") REFERENCES "Refund"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_initiatedById_fkey" FOREIGN KEY ("initiatedById") REFERENCES "Creator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PayoutScheduleNew" ADD CONSTRAINT "PayoutScheduleNew_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "Creator"("id") ON DELETE CASCADE ON UPDATE CASCADE;
