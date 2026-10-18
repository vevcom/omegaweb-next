-- Runs before `prisma migrate deploy`. Two pairs of migrations once shared a timestamp, and the second
-- of each pair was renamed so every migration has its own. A database that applied them under the
-- old names would otherwise see the new names as unapplied and run them again. Their contents are
-- unchanged, so the recorded checksums still match.
--
-- Does nothing on a fresh database, and nothing once the names are updated. Can be deleted once
-- every database we keep has been deployed past this change.
DO $$
BEGIN
    IF to_regclass('"_prisma_migrations"') IS NOT NULL THEN
        UPDATE "_prisma_migrations"
        SET "migration_name" = '20261001130001_user_bio_cms_paragraph'
        WHERE "migration_name" = '20261001130000_user_bio_cms_paragraph';

        UPDATE "_prisma_migrations"
        SET "migration_name" = '20261014120001_user_theme'
        WHERE "migration_name" = '20261014120000_user_theme';
    END IF;
END $$;
