-- The own channel of a company presentation sat under the channel of all events, and sits under
-- the channel of the company presentations from now on. The channel is made here, since the
-- presentations there are must be moved under it once, and the seeder brings it in line with its
-- config afterwards. A user with no choice of their own for a channel follows the one above it, so
-- everyone is given the choice they had for the events, and hears of presentations as before.
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
    -- A database that is yet to be seeded has neither channel, and no presentations to move.
    IF contactor_id IS NULL OR events."id" IS NULL THEN
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
        SELECT "userId", "email", "emailWeekly", "push"
        FROM "NotificationSubscription"
        JOIN "NotificationMethod" ON "NotificationMethod"."id" = "NotificationSubscription"."methodsId"
        WHERE "channelId" = events."id"
    LOOP
        INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push")
        VALUES (choice."email", choice."emailWeekly", choice."push")
        RETURNING "id" INTO methods_id;
        INSERT INTO "NotificationSubscription" ("userId", "channelId", "methodsId", "updatedAt")
        VALUES (choice."userId", presentations_id, methods_id, CURRENT_TIMESTAMP);
    END LOOP;
END $$;
