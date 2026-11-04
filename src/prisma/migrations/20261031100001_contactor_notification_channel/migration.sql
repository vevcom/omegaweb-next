-- Tags the Contactor channel the seeder has created by name until now, so the channel the users
-- subscribe to becomes the special one rather than the seeder adding a second. It is found by its
-- name or by the alias it mails from, since an administrator may have changed either. Should both
-- match different channels, the unique constraint on "special" fails the migration, for someone to
-- settle by hand. Its own migration, since Postgres cannot use an enum value in the transaction
-- that adds it.
UPDATE "NotificationChannel" AS channel SET "special" = 'CONTACTOR'
FROM "MailAlias" AS alias
WHERE alias."id" = channel."mailAliasId"
    AND channel."special" IS NULL
    AND (channel."name" = 'Contactor' OR alias."address" LIKE 'contactor@%');
