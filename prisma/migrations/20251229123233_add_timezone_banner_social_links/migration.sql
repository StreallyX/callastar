-- AlterTable
ALTER TABLE "Creator" ADD COLUMN     "bannerImage" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "timezone" TEXT NOT NULL DEFAULT 'Europe/Paris';
