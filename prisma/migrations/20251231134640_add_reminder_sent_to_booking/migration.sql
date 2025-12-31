-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "reminderSent" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Booking_reminderSent_idx" ON "Booking"("reminderSent");
