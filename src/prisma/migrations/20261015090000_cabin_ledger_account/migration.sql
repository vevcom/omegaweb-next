-- The account cabin bookings are paid into becomes a role on the account itself (the CABIN marker,
-- unique so one account at a time holds it), replacing the CabinSettings singleton table.

-- CreateEnum
CREATE TYPE "SpecialLedgerAccount" AS ENUM ('CABIN');

-- AlterTable
ALTER TABLE "LedgerAccount" ADD COLUMN     "special" "SpecialLedgerAccount";

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_special_key" ON "LedgerAccount"("special");

-- Carry the account linked through the settings row over, if any.
UPDATE "LedgerAccount" SET "special" = 'CABIN'
WHERE "id" = (SELECT "ledgerAccountId" FROM "CabinSettings" WHERE "ledgerAccountId" IS NOT NULL ORDER BY "id" LIMIT 1);

-- DropForeignKey
ALTER TABLE "CabinSettings" DROP CONSTRAINT "CabinSettings_ledgerAccountId_fkey";

-- DropTable
DROP TABLE "CabinSettings";
