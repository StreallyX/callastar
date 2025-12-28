-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "isTestBooking" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Booking_isTestBooking_idx" ON "Booking"("isTestBooking");
