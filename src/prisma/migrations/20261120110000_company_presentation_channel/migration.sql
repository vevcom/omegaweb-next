-- Postgres cannot use an enum value in the transaction that adds it, so the migration before this
-- one adds the values and this one uses them.
-- The own channel of a company presentation sat under the channel of all events, and sits under
-- the channel of the company presentations from now on. The channel is made here, since the
-- presentations that exist must be moved under it once, and the seeder brings it in line with its
-- config afterwards. A user with no row for a channel follows the nearest channel above it they
-- have a row for, and has every method off when there is none. So a user is given a row on the new
-- channel with what they had for the events when they have a row of their own for the events, or
-- when what they have for Contactor differs from it, and hears of presentations as before.
DO $$
DECLARE
    contactor_id INTEGER;
    events RECORD;
    methods_id INTEGER;
    presentations_id INTEGER;
    choice RECORD;
BEGIN
    SELECT "id" INTO contactor_id FROM "NotificationChannel" WHERE "special" = 'CONTACTOR';
    SELECT "id", "mailAliasId" INTO events FROM "NotificationChannel" WHERE "special" = 'EVENT';
    IF contactor_id IS NULL OR events."id" IS NULL THEN
        IF EXISTS (SELECT 1 FROM "Event" WHERE "kind" = 'COMPANY_PRESENTATION') THEN
            RAISE EXCEPTION 'The company presentations cannot be moved, since the special notification channel CONTACTOR or EVENT is missing';
        END IF;
        -- A database that is yet to be seeded has neither channel, and no presentations to move.
        RETURN;
    END IF;

    INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push") VALUES (true, true, true)
    RETURNING "id" INTO methods_id;
    INSERT INTO "NotificationChannel" (
        "name", "description", "special", "purpose", "parentId", "availableMethodsId", "mailAliasId"
    ) VALUES (
        'Bedriftspresentasjoner', '', 'COMPANY_PRESENTATION', 'SPECIAL', contactor_id, methods_id, events."mailAliasId"
    ) RETURNING "id" INTO presentations_id;

    UPDATE "NotificationChannel" SET "parentId" = presentations_id
    WHERE "id" IN (SELECT "notificationChannelId" FROM "Event" WHERE "kind" = 'COMPANY_PRESENTATION');

    FOR choice IN
        WITH RECURSIVE "chain" ("startId", "channelId", "depth") AS (
            SELECT "id", "id", 0 FROM "NotificationChannel" WHERE "id" IN (events."id", contactor_id)
            UNION ALL
            SELECT "chain"."startId", "NotificationChannel"."parentId", "chain"."depth" + 1
            FROM "chain"
            JOIN "NotificationChannel" ON "NotificationChannel"."id" = "chain"."channelId"
            WHERE "NotificationChannel"."parentId" <> "NotificationChannel"."id"
        ), "nearest" AS (
            SELECT DISTINCT ON ("startId", "userId") "startId", "userId", "email", "emailWeekly", "push"
            FROM "chain"
            JOIN "NotificationSubscription" ON "NotificationSubscription"."channelId" = "chain"."channelId"
            JOIN "NotificationMethod" ON "NotificationMethod"."id" = "NotificationSubscription"."methodsId"
            ORDER BY "startId", "userId", "depth"
        ), "effective" AS (
            SELECT "startId", "userId",
                COALESCE("email", false) AS "email",
                COALESCE("emailWeekly", false) AS "emailWeekly",
                COALESCE("push", false) AS "push"
            FROM (VALUES (events."id"), (contactor_id)) AS "start" ("startId")
            CROSS JOIN (SELECT DISTINCT "userId" FROM "nearest") AS "user"
            LEFT JOIN "nearest" USING ("startId", "userId")
        )
        SELECT "before"."userId", "before"."email", "before"."emailWeekly", "before"."push"
        FROM "effective" AS "before"
        JOIN "effective" AS "after" ON "after"."userId" = "before"."userId" AND "after"."startId" = contactor_id
        WHERE "before"."startId" = events."id"
            AND (
                ("before"."email", "before"."emailWeekly", "before"."push")
                    <> ("after"."email", "after"."emailWeekly", "after"."push")
                OR EXISTS (
                    SELECT 1 FROM "NotificationSubscription"
                    WHERE "userId" = "before"."userId" AND "channelId" = events."id"
                )
            )
    LOOP
        INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push")
        VALUES (choice."email", choice."emailWeekly", choice."push")
        RETURNING "id" INTO methods_id;
        INSERT INTO "NotificationSubscription" ("userId", "channelId", "methodsId", "updatedAt")
        VALUES (choice."userId", presentations_id, methods_id, CURRENT_TIMESTAMP);
    END LOOP;
END $$;
