-- A channel's default methods decided what a new user was subscribed to. Nothing is on for a new
-- user now, so the column goes, with the method rows it pointed at. Subscriptions are untouched.
ALTER TABLE "NotificationChannel" DROP CONSTRAINT "NotificationChannel_defaultMethodsId_fkey";

DELETE FROM "NotificationMethod"
WHERE "id" IN (SELECT "defaultMethodsId" FROM "NotificationChannel");

ALTER TABLE "NotificationChannel" DROP COLUMN "defaultMethodsId";
