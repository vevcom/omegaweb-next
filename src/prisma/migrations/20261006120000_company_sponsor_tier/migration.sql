-- CreateEnum
CREATE TYPE "CompanySponsorTier" AS ENUM ('MAIN', 'SPONSOR', 'NONE');

-- AlterTable
ALTER TABLE "Company" ADD COLUMN     "sponsorTier" "CompanySponsorTier" NOT NULL DEFAULT 'NONE',
ADD COLUMN     "website" TEXT;

-- CreateIndex
CREATE INDEX "Company_sponsorTier_idx" ON "Company"("sponsorTier");

-- Backfill the standard sponsors seeded before these columns existed; the seeder leaves
-- existing companies alone, so nothing else would ever set their tier.
UPDATE "Company" SET "sponsorTier" = 'MAIN', "website" = 'https://www.nordicsemi.com'
WHERE "name" = 'Nordic Semiconductor';
UPDATE "Company" SET "sponsorTier" = 'SPONSOR', "website" = 'https://www.kongsberg.com'
WHERE "name" = 'Kongsberg Gruppen';
