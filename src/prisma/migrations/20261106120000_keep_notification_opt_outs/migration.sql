-- A user without a row for a channel used to get nothing on it, and now follows the channel above.
-- Turning every method off used to delete the row, so a user who did that would start receiving what
-- they turned off. Everyone who would start receiving something therefore gets a row with every method
-- off. Event channels are left out, as they are new with this release and nobody has turned them off.
WITH RECURSIVE chain AS (
    SELECT "id" AS "channelId", "id" AS "ancestorId", "parentId", 0 AS "depth"
    FROM "NotificationChannel"
    WHERE "purpose" IN ('SPECIAL', 'MANUAL')
    UNION ALL
    SELECT chain."channelId", parent."id", parent."parentId", chain."depth" + 1
    FROM chain
    JOIN "NotificationChannel" parent ON parent."id" = chain."parentId"
    -- ROOT is its own parent.
    WHERE chain."ancestorId" <> chain."parentId"
),
deciding AS (
    SELECT DISTINCT ON (s."userId", chain."channelId")
        s."userId", chain."channelId", chain."depth", m."email", m."emailWeekly", m."push"
    FROM chain
    JOIN "NotificationSubscription" s ON s."channelId" = chain."ancestorId"
    JOIN "NotificationMethod" m ON m."id" = s."methodsId"
    ORDER BY s."userId", chain."channelId", chain."depth"
),
turned_off AS (
    SELECT deciding."userId", deciding."channelId", row_number() OVER () AS "number"
    FROM deciding
    JOIN "NotificationChannel" c ON c."id" = deciding."channelId"
    JOIN "NotificationMethod" available ON available."id" = c."availableMethodsId"
    WHERE deciding."depth" > 0 AND (
        (deciding."email" AND available."email")
        OR (deciding."emailWeekly" AND available."emailWeekly")
        OR (deciding."push" AND available."push")
    )
),
methods AS (
    INSERT INTO "NotificationMethod" ("email", "emailWeekly", "push")
    SELECT false, false, false FROM turned_off
    RETURNING "id"
),
numbered_methods AS (
    SELECT "id", row_number() OVER () AS "number" FROM methods
)
INSERT INTO "NotificationSubscription" ("userId", "channelId", "methodsId", "updatedAt")
SELECT turned_off."userId", turned_off."channelId", numbered_methods."id", CURRENT_TIMESTAMP
FROM turned_off
JOIN numbered_methods ON numbered_methods."number" = turned_off."number";
