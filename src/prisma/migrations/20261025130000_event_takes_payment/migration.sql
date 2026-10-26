-- AlterTable
ALTER TABLE "Event" ADD COLUMN "takesPayment" BOOLEAN NOT NULL DEFAULT false;

-- A price of 0 counted as free.
UPDATE "Event" SET "takesPayment" = true WHERE "price" > 0;
UPDATE "Event" SET "price" = NULL, "paymentStart" = NULL, "paymentEnd" = NULL WHERE NOT "takesPayment";
