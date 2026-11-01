-- Tags the Contactor channel the seeder has created by name until now. It is its own migration, since
-- Postgres cannot use an enum value in the transaction that adds it.
UPDATE "NotificationChannel" SET "special" = 'CONTACTOR' WHERE "name" = 'Contactor' AND "special" IS NULL;
