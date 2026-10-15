-- CreateEnum
CREATE TYPE "RefundType" AS ENUM ('REVERSAL', 'REIMBURSEMENT');

-- DropIndex
DROP INDEX "LedgerTransaction_paymentId_key";

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "claimedByTransactionId" INTEGER;

-- CreateTable
CREATE TABLE "Refund" (
    "id" SERIAL NOT NULL,
    "originalTransactionId" INTEGER NOT NULL,
    "refundTransactionId" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "type" "RefundType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Refund_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Refund_originalTransactionId_key" ON "Refund"("originalTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_refundTransactionId_key" ON "Refund"("refundTransactionId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_claimedByTransactionId_key" ON "Payment"("claimedByTransactionId");

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_originalTransactionId_fkey" FOREIGN KEY ("originalTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Refund" ADD CONSTRAINT "Refund_refundTransactionId_fkey" FOREIGN KEY ("refundTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_claimedByTransactionId_fkey" FOREIGN KEY ("claimedByTransactionId") REFERENCES "LedgerTransaction"("id") ON DELETE SET NULL ON UPDATE CASCADE;
