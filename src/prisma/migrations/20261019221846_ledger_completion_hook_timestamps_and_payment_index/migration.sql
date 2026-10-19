-- Existing transactions keep both timestamps null, since their completion hooks already ran inline.

-- AlterTable
ALTER TABLE "LedgerTransaction" ADD COLUMN     "completionHookRanAt" TIMESTAMP(3),
ADD COLUMN     "completionHookRequestedAt" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "LedgerTransaction_paymentId_idx" ON "LedgerTransaction"("paymentId");

-- CreateIndex
CREATE INDEX "LedgerTransaction_completionHookRanAt_completionHookRequest_idx" ON "LedgerTransaction"("completionHookRanAt", "completionHookRequestedAt");
