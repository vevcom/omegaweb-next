-- DropIndex
DROP INDEX "LedgerTransaction_paymentId_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "claimedByTransactionId" INTEGER;

-- Backfill the claim for every payment already backing a transaction that succeeded before this
-- column existed. The dropped LedgerTransaction_paymentId_key above guaranteed at most one
-- transaction ever referenced a given payment, so this can't violate the unique index added
-- below. Without this, advance()'s claim check would treat such a payment as unclaimed and let a
-- newly created transaction reusing the same paymentId also claim and succeed with it.
UPDATE "Payment" AS p
SET "claimedByTransactionId" = t."id"
FROM "LedgerTransaction" AS t
WHERE t."paymentId" = p."id"
  AND t."state" = 'SUCCEEDED';

-- CreateEnum
CREATE TYPE "ManualReviewState" AS ENUM ('OPEN', 'RESOLVED');

-- CreateTable
CREATE TABLE "ManualTransactionReview" (
    "id" SERIAL NOT NULL,
    "transactionId" INTEGER NOT NULL,
    "state" "ManualReviewState" NOT NULL DEFAULT 'OPEN',
    "problemDescription" TEXT NOT NULL,
    "resolutionDescription" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ManualTransactionReview_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Payment_claimedByTransactionId_key" ON "Payment"("claimedByTransactionId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_claimedByTransactionId_fkey" FOREIGN KEY ("claimedByTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualTransactionReview" ADD CONSTRAINT "ManualTransactionReview_transactionId_fkey" FOREIGN KEY ("transactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
