-- The cabin booking confirmation is system mail now, sent when the booking is paid, rather than a
-- notification channel the booker could unsubscribe from. The channel goes, and with it its
-- subscriptions and notifications (both cascade). Method rows are only ever referenced by a
-- channel or a subscription, so the ones left without either are the removed channel's.
DELETE FROM "NotificationChannel" WHERE "special" = 'CABIN_BOOKING_CONFIRMATION';
DELETE FROM "NotificationMethod" WHERE "id" NOT IN (
    SELECT "defaultMethodsId" FROM "NotificationChannel"
    UNION SELECT "availableMethodsId" FROM "NotificationChannel"
    UNION SELECT "methodsId" FROM "NotificationSubscription"
);

-- AlterEnum
CREATE TYPE "SpecialNotificationChannel_new" AS ENUM ('ROOT', 'NEW_EVENT', 'NEW_OMBUL', 'NEW_NEWS_ARTICLE', 'NEW_JOBAD', 'NEW_OMEGAQUOTE', 'EVENT_WAITINGLIST_PROMOTION');
ALTER TABLE "NotificationChannel" ALTER COLUMN "special" TYPE "SpecialNotificationChannel_new" USING ("special"::text::"SpecialNotificationChannel_new");
ALTER TYPE "SpecialNotificationChannel" RENAME TO "SpecialNotificationChannel_old";
ALTER TYPE "SpecialNotificationChannel_new" RENAME TO "SpecialNotificationChannel";
DROP TYPE "SpecialNotificationChannel_old";
