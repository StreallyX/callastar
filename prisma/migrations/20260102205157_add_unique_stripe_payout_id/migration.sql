/*
  Warnings:

  - You are about to drop the column `payoutBlocked` on the `Creator` table. All the data in the column will be lost.
  - You are about to drop the column `payoutBlockedReason` on the `Creator` table. All the data in the column will be lost.
  - A unique constraint covering the columns `[stripeAccountId]` on the table `Creator` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[stripePayoutId]` on the table `PayoutAuditLog` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterEnum
ALTER TYPE "LogType" ADD VALUE 'AUTH_LOGIN';

-- AlterTable
ALTER TABLE "Creator" DROP COLUMN "payoutBlocked",
DROP COLUMN "payoutBlockedReason";

-- CreateIndex
CREATE UNIQUE INDEX "Creator_stripeAccountId_key" ON "Creator"("stripeAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "PayoutAuditLog_stripePayoutId_key" ON "PayoutAuditLog"("stripePayoutId");
