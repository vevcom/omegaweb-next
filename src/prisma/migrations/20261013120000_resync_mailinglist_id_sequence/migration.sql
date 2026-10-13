-- DobbelOmega inserted MailingList rows with explicit ids, which does not advance the id
-- sequence, so every insert afterwards (the seeder, the admin pages) collided with a
-- migrated row on MailingList_pkey. Re-point the sequence past the highest id in the table.
SELECT setval(
    pg_get_serial_sequence('"MailingList"', 'id'),
    COALESCE(MAX(id), 1),
    COALESCE(MAX(id), 0) > 0
) FROM "MailingList";
