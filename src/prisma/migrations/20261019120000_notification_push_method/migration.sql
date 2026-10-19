-- AlterTable
ALTER TABLE "NotificationMethod" ADD COLUMN     "push" BOOLEAN NOT NULL DEFAULT false;

-- Offer push on every existing channel that offers immediate email.
UPDATE "NotificationMethod" SET "push" = "email"
WHERE "id" IN (SELECT "availableMethodsId" FROM "NotificationChannel");
