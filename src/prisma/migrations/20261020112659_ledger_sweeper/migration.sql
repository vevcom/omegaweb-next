-- A review gets a required problem enum next to its free-text problemDescription, and can now be
-- about a payment instead of, or as well as, a transaction, or about neither. Existing reviews all
-- came from one of the call sites below, recognised by their text.
-- Existing transactions keep both completion hook timestamps null, since their hooks already ran inline.

-- CreateEnum
CREATE TYPE "ManualReviewProblem" AS ENUM ('STRIPE_DISPUTE', 'STRIPE_REFUND', 'COMPLETION_HOOK_FAILED', 'CABIN_DOUBLE_BOOKING', 'STALE_PENDING', 'UNCLAIMED_PAYMENT', 'UNBALANCED');

-- AlterTable
ALTER TABLE "LedgerTransaction" ADD COLUMN     "completionHookRanAt" TIMESTAMP(3),
ADD COLUMN     "completionHookRequestedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ManualTransactionReview" ADD COLUMN     "paymentId" INTEGER,
ADD COLUMN     "problem" "ManualReviewProblem",
ALTER COLUMN "transactionId" DROP NOT NULL;

-- A failed automatic reimbursement is now the ledger sweeper's UNCLAIMED_PAYMENT. Any text not
-- listed here is left NULL, so the NOT NULL below stops the migration instead of guessing.
UPDATE "ManualTransactionReview" SET "problem" = (CASE
    WHEN "problemDescription" LIKE 'Stripe-betalingen er bestridt%' THEN 'STRIPE_DISPUTE'
    WHEN "problemDescription" LIKE 'Stripe-betalingen ble refundert%' THEN 'STRIPE_REFUND'
    WHEN "problemDescription" LIKE 'Fullføringshook for%' THEN 'COMPLETION_HOOK_FAILED'
    WHEN "problemDescription" LIKE 'Hytta ble dobbeltbooket%' THEN 'CABIN_DOUBLE_BOOKING'
    WHEN "problemDescription" LIKE 'Automatisk tilbakebetaling mislyktes%' THEN 'UNCLAIMED_PAYMENT'
END)::"ManualReviewProblem";

-- Reviews of these problems are about the payment, which the ledger sweeper looks them up by.
UPDATE "ManualTransactionReview" AS r SET "paymentId" = t."paymentId"
FROM "LedgerTransaction" AS t
WHERE r."transactionId" = t."id"
    AND r."problem" IN ('STRIPE_DISPUTE', 'STRIPE_REFUND', 'UNCLAIMED_PAYMENT');

ALTER TABLE "ManualTransactionReview" ALTER COLUMN "problem" SET NOT NULL;

-- CreateIndex
CREATE INDEX "LedgerTransaction_paymentId_idx" ON "LedgerTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_completionHookRanAt_completionHookRequest_idx" ON "LedgerTransaction"("completionHookRanAt", "completionHookRequestedAt");

-- AddForeignKey
ALTER TABLE "ManualTransactionReview" ADD CONSTRAINT "ManualTransactionReview_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
