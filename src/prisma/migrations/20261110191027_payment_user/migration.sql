-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "userId" INTEGER;

-- CreateIndex
CREATE INDEX "Payment_userId_idx" ON "Payment"("userId");

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- The payments made so far are from the user of the registration or booking they paid for, or of
-- the account they were deposited into.
UPDATE "Payment"
SET "userId" = "EventRegistration"."userId"
FROM "LedgerTransaction"
JOIN "EventRegistration" ON "EventRegistration"."id" = "LedgerTransaction"."eventRegistrationId"
WHERE "LedgerTransaction"."paymentId" = "Payment"."id"
    AND "EventRegistration"."userId" IS NOT NULL;

UPDATE "Payment"
SET "userId" = "Booking"."userId"
FROM "LedgerTransaction"
JOIN "Booking" ON "Booking"."id" = "LedgerTransaction"."bookingId"
WHERE "LedgerTransaction"."paymentId" = "Payment"."id"
    AND "Booking"."userId" IS NOT NULL;

UPDATE "Payment"
SET "userId" = "User"."id"
FROM "LedgerTransaction"
JOIN "LedgerEntry" ON "LedgerEntry"."ledgerTransactionId" = "LedgerTransaction"."id"
JOIN "User" ON "User"."ledgerAccountId" = "LedgerEntry"."ledgerAccountId"
WHERE "LedgerTransaction"."paymentId" = "Payment"."id"
    AND "LedgerTransaction"."purpose" = 'DEPOSIT';
