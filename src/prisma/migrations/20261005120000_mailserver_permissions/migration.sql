-- Replaces the six mail alias, mailing list and external address permissions with MAILSERVER_USE and
-- MAILSERVER_ADMIN. Only MAILALIAS_ADMIN becomes MAILSERVER_ADMIN; every other old grant becomes
-- MAILSERVER_USE.
BEGIN;

CREATE FUNCTION pg_temp.mailserver_permission(permission text) RETURNS text AS $$
    SELECT CASE
        WHEN permission = 'MAILALIAS_ADMIN' THEN 'MAILSERVER_ADMIN'
        WHEN permission IN (
            'MAILALIAS_USE',
            'MAILINGLIST_USE',
            'MAILINGLIST_ADMIN',
            'MAILADDRESS_EXTERNAL_USE',
            'MAILADDRESS_EXTERNAL_ADMIN'
        ) THEN 'MAILSERVER_USE'
        ELSE permission
    END
$$ LANGUAGE sql IMMUTABLE;

CREATE FUNCTION pg_temp.mailserver_permissions(permissions text[]) RETURNS text[] AS $$
    SELECT COALESCE(array_agg(DISTINCT pg_temp.mailserver_permission(permission)), '{}')
    FROM unnest(permissions) AS permission
$$ LANGUAGE sql IMMUTABLE;

DELETE FROM "GroupPermission" duplicate USING "GroupPermission" kept
WHERE duplicate."groupId" = kept."groupId"
    AND duplicate.ctid > kept.ctid
    AND pg_temp.mailserver_permission(duplicate."permission"::text) = pg_temp.mailserver_permission(kept."permission"::text);

DELETE FROM "DefaultPermission" duplicate USING "DefaultPermission" kept
WHERE duplicate.ctid > kept.ctid
    AND pg_temp.mailserver_permission(duplicate."permission"::text) = pg_temp.mailserver_permission(kept."permission"::text);

-- AlterEnum
CREATE TYPE "Permission_new" AS ENUM ('JOBAD_ADMIN', 'JOBAD_USE', 'OMEGAQUOTES_USE', 'OMBUL_ADMIN', 'OMBUL_USE', 'OMEGA_ORDER_USE', 'OMEGA_ORDER_ADMIN', 'CLASS_USE', 'CLASS_ADMIN', 'COMMITTEE_USE', 'COMMITTEE_ADMIN', 'INTEREST_GROUP_ADMIN', 'INTEREST_GROUP_USE', 'MANUAL_GROUP_ADMIN', 'MANUAL_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_ADMIN', 'STUDY_PROGRAMME_USE', 'STUDY_PROGRAMME_ADMIN', 'LOCKER_ADMIN', 'LOCKER_USE', 'FRONTPAGE_ADMIN', 'USERS_USE', 'USERS_ADMIN', 'IMAGE_CREATE', 'IMAGE_ADMIN', 'EVENT_ADMIN', 'EVENT_CREATE', 'NOTIFICATION_ADMIN', 'MAIL_USE', 'MAILSERVER_USE', 'MAILSERVER_ADMIN', 'ADMISSION_USE', 'APIKEY_ADMIN', 'SCREEN_USE', 'SCREEN_ADMIN', 'SCHOOLS_USE', 'SCHOOLS_ADMIN', 'COURSES_USE', 'COURSES_ADMIN', 'COMPANY_USE', 'COMPANY_ADMIN', 'DOTS_ADMIN', 'CABIN_USE', 'CABIN_ADMIN', 'SHOP_USE', 'SHOP_ADMIN', 'PRODUCT_USE', 'PRODUCT_ADMIN', 'PURCHASE_USE', 'PURCHASE_ADMIN', 'LICENSE_ADMIN', 'PERMISSION_USE', 'PERMISSION_ADMIN', 'APPLICATION_ADMIN', 'APPLICATION_USE', 'NEW_STUDENT_ADMIN', 'REPORT_ADMIN', 'LEDGER_ADMIN', 'LEDGER_USE', 'FLAIR_ADMIN', 'BULLSHIT_WRITE', 'BULLSHIT_USE', 'NEWS_CREATE', 'NEWS_ADMIN');
ALTER TABLE "ApiKey" ALTER COLUMN "permissions" TYPE "Permission_new"[] USING (pg_temp.mailserver_permissions("permissions"::text[])::"Permission_new"[]);
ALTER TABLE "GroupPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING (pg_temp.mailserver_permission("permission"::text)::"Permission_new");
ALTER TABLE "DefaultPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING (pg_temp.mailserver_permission("permission"::text)::"Permission_new");
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "Permission_old";

COMMIT;
