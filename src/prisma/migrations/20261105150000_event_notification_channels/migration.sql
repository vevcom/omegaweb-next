-- CreateEnum
CREATE TYPE "NotificationChannelPurpose" AS ENUM ('SPECIAL', 'MANUAL', 'EVENT', 'EVENT_INFO', 'EVENT_GENERAL');

-- AlterTable
-- Every channel so far is either special or made on the admin pages, so the purpose follows from
-- whether it is special.
ALTER TABLE "NotificationChannel" ADD COLUMN "purpose" "NotificationChannelPurpose";

UPDATE "NotificationChannel"
SET "purpose" = CASE WHEN "special" IS NULL THEN 'MANUAL' ELSE 'SPECIAL' END::"NotificationChannelPurpose";

ALTER TABLE "NotificationChannel" ALTER COLUMN "purpose" SET NOT NULL;

-- The waiting list promotions move to the channels of the events, so that special channel goes. Its
-- subscriptions and notifications cascade with it, the method rows they point to do not.
UPDATE "NotificationChannel"
SET "parentId" = (SELECT "id" FROM "NotificationChannel" WHERE "special" = 'NEW_EVENT')
WHERE "parentId" = (SELECT "id" FROM "NotificationChannel" WHERE "special" = 'EVENT_WAITINGLIST_PROMOTION')
    AND EXISTS (SELECT 1 FROM "NotificationChannel" WHERE "special" = 'NEW_EVENT');

DELETE FROM "NotificationMethod"
WHERE "id" IN (
    SELECT s."methodsId" FROM "NotificationSubscription" s
    JOIN "NotificationChannel" c ON c."id" = s."channelId"
    WHERE c."special" = 'EVENT_WAITINGLIST_PROMOTION'
);

DELETE FROM "NotificationChannel" WHERE "special" = 'EVENT_WAITINGLIST_PROMOTION';

DELETE FROM "NotificationMethod"
WHERE NOT EXISTS (SELECT 1 FROM "NotificationChannel" c WHERE c."availableMethodsId" = "NotificationMethod"."id")
    AND NOT EXISTS (SELECT 1 FROM "NotificationSubscription" s WHERE s."methodsId" = "NotificationMethod"."id");

-- AlterEnum
CREATE TYPE "SpecialNotificationChannel_new" AS ENUM ('ROOT', 'EVENT', 'NEW_OMBUL', 'NEW_NEWS_ARTICLE', 'NEW_JOBAD', 'NEW_OMEGAQUOTE', 'CONTACTOR');
ALTER TABLE "NotificationChannel" ALTER COLUMN "special" TYPE "SpecialNotificationChannel_new" USING (
    CASE WHEN "special"::text = 'NEW_EVENT' THEN 'EVENT' ELSE "special"::text END::"SpecialNotificationChannel_new"
);
ALTER TYPE "SpecialNotificationChannel" RENAME TO "SpecialNotificationChannel_old";
ALTER TYPE "SpecialNotificationChannel_new" RENAME TO "SpecialNotificationChannel";
DROP TYPE "SpecialNotificationChannel_old";

-- The seeder brings the channel in line with its config; this keeps its name right until then.
UPDATE "NotificationChannel"
SET "name" = 'Arrangementer', "description" = 'Nye arrangementer, og det som skjer med dem du er meldt på'
WHERE "special" = 'EVENT' AND NOT EXISTS (SELECT 1 FROM "NotificationChannel" WHERE "name" = 'Arrangementer');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "generalNotificationChannelId" INTEGER,
ADD COLUMN     "infoNotificationChannelId" INTEGER,
ADD COLUMN     "notificationChannelId" INTEGER;

-- Backfill: every event gets its three channels, without the subscriptions a new channel takes over
-- from its parent. Those registered are subscribed to the info channel, as registering does, so
-- nobody on a waiting list misses their promotion.
DO $$
DECLARE
    event_row RECORD;
    registrant RECORD;
    parent_channel RECORD;
    channel_id INTEGER;
    info_id INTEGER;
    general_id INTEGER;
    methods_id INTEGER;
    event_name TEXT;
BEGIN
    IF NOT EXISTS (SELECT 1 FROM "Event") THEN
        RETURN;
    END IF;

    SELECT c."id", c."mailAliasId", m."email", m."emailWeekly", m."push" INTO parent_channel
    FROM "NotificationChannel" c JOIN "NotificationMethod" m ON m."id" = c."availableMethodsId"
    WHERE c."special" = 'EVENT';
    IF parent_channel IS NULL THEN
        RAISE EXCEPTION 'The EVENT notification channel is missing, so the events cannot be given their channels';
    END IF;

    FOR event_row IN SELECT "id", "name" FROM "Event" ORDER BY "id" LOOP
        event_name := event_row."name" || ' (#' || event_row."id" || ')';

        INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push")
        VALUES (parent_channel."email", parent_channel."emailWeekly", parent_channel."push")
        RETURNING "id" INTO methods_id;
        INSERT INTO "NotificationChannel" ("name", "description", "purpose", "parentId", "availableMethodsId", "mailAliasId")
        VALUES (event_name, 'Varslinger om arrangementet', 'EVENT', parent_channel."id", methods_id, parent_channel."mailAliasId")
        RETURNING "id" INTO channel_id;

        INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push")
        VALUES (true, false, true)
        RETURNING "id" INTO methods_id;
        INSERT INTO "NotificationChannel" ("name", "description", "purpose", "parentId", "availableMethodsId", "mailAliasId")
        VALUES (
            event_name || ': viktig informasjon',
            'Det de påmeldte må vite: opprykk fra ventelisten, betaling og viktige endringer i arrangementet',
            'EVENT_INFO', channel_id, methods_id, parent_channel."mailAliasId"
        )
        RETURNING "id" INTO info_id;

        FOR registrant IN
            SELECT DISTINCT r."userId"
            FROM "EventRegistration" r
            LEFT JOIN "EventQuota" q ON q."id" = r."quotaId"
            JOIN "EventVariant" v ON v."id" = COALESCE(q."variantId", r."waitingListVariantId")
            WHERE v."eventId" = event_row."id" AND r."userId" IS NOT NULL
        LOOP
            INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push")
            VALUES (true, false, true)
            RETURNING "id" INTO methods_id;
            INSERT INTO "NotificationSubscription" ("userId", "channelId", "methodsId", "updatedAt")
            VALUES (registrant."userId", info_id, methods_id, CURRENT_TIMESTAMP);
        END LOOP;

        INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push")
        VALUES (parent_channel."email", parent_channel."emailWeekly", parent_channel."push")
        RETURNING "id" INTO methods_id;
        INSERT INTO "NotificationChannel" ("name", "description", "purpose", "parentId", "availableMethodsId", "mailAliasId")
        VALUES (
            event_name || ': annen informasjon',
            'Annet arrangørene har å fortelle om arrangementet',
            'EVENT_GENERAL', channel_id, methods_id, parent_channel."mailAliasId"
        )
        RETURNING "id" INTO general_id;

        UPDATE "Event"
        SET "notificationChannelId" = channel_id, "infoNotificationChannelId" = info_id, "generalNotificationChannelId" = general_id
        WHERE "id" = event_row."id";
    END LOOP;
END $$;

ALTER TABLE "Event" ALTER COLUMN "generalNotificationChannelId" SET NOT NULL,
ALTER COLUMN "infoNotificationChannelId" SET NOT NULL,
ALTER COLUMN "notificationChannelId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Event_notificationChannelId_key" ON "Event"("notificationChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_infoNotificationChannelId_key" ON "Event"("infoNotificationChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "Event_generalNotificationChannelId_key" ON "Event"("generalNotificationChannelId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_notificationChannelId_fkey" FOREIGN KEY ("notificationChannelId") REFERENCES "NotificationChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_infoNotificationChannelId_fkey" FOREIGN KEY ("infoNotificationChannelId") REFERENCES "NotificationChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_generalNotificationChannelId_fkey" FOREIGN KEY ("generalNotificationChannelId") REFERENCES "NotificationChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "registeredForEventId" INTEGER;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_registeredForEventId_fkey" FOREIGN KEY ("registeredForEventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
