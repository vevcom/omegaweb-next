-- A channel's default methods decided what a new user was subscribed to. Nothing is on for a new
-- user now, so the column goes, with the method rows it pointed at.
ALTER TABLE "NotificationChannel" DROP CONSTRAINT "NotificationChannel_defaultMethodsId_fkey";

DELETE FROM "NotificationMethod"
WHERE "id" IN (SELECT "defaultMethodsId" FROM "NotificationChannel");

ALTER TABLE "NotificationChannel" DROP COLUMN "defaultMethodsId";

-- The root had every method on by default, so nearly everyone is subscribed to it, and a new channel
-- takes its subscribers from its parent: every new channel under the root would reach everyone with
-- everything. Nothing is sent in the root itself, so its subscriptions go, through the method rows
-- they cascade from. Subscriptions to the other channels are untouched.
DELETE FROM "NotificationMethod"
WHERE "id" IN (
    SELECT s."methodsId" FROM "NotificationSubscription" s
    JOIN "NotificationChannel" c ON c."id" = s."channelId"
    WHERE c."special" = 'ROOT'
);
