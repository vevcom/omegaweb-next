-- AlterEnum
BEGIN;

-- NOTIFICATION_CREATE was granted to every committee; the new model has no committee-level
-- notification permission, so drop those grants instead of escalating them to NOTIFICATION_ADMIN.
--
-- The NOTIFICATION_SUBSCRIPTION_* permissions are dropped for the same reason. They only let the
-- holder read or edit the subscriptions of other users, while NOTIFICATION_ADMIN also sends
-- notifications and manages channels. Whoever should have that is granted NOTIFICATION_ADMIN anew.
DELETE FROM "GroupPermission" WHERE "permission"::text IN (
    'NOTIFICATION_CREATE',
    'NOTIFICATION_SUBSCRIPTION_READ',
    'NOTIFICATION_SUBSCRIPTION_READ_OTHER',
    'NOTIFICATION_SUBSCRIPTION_UPDATE',
    'NOTIFICATION_SUBSCRIPTION_UPDATE_OTHER'
);
DELETE FROM "DefaultPermission" WHERE "permission"::text IN (
    'NOTIFICATION_CREATE',
    'NOTIFICATION_SUBSCRIPTION_READ',
    'NOTIFICATION_SUBSCRIPTION_READ_OTHER',
    'NOTIFICATION_SUBSCRIPTION_UPDATE',
    'NOTIFICATION_SUBSCRIPTION_UPDATE_OTHER'
);
UPDATE "ApiKey" SET "permissions" = ARRAY(
    SELECT elem FROM unnest("permissions") AS elem
    WHERE elem::text NOT IN (
        'NOTIFICATION_CREATE',
        'NOTIFICATION_SUBSCRIPTION_READ',
        'NOTIFICATION_SUBSCRIPTION_READ_OTHER',
        'NOTIFICATION_SUBSCRIPTION_UPDATE',
        'NOTIFICATION_SUBSCRIPTION_UPDATE_OTHER'
    )
)
WHERE "permissions" IS NOT NULL;

CREATE TABLE "_PermissionRenameMap" (
    "oldValue" TEXT PRIMARY KEY,
    "newValue" TEXT NOT NULL
);

INSERT INTO "_PermissionRenameMap" ("oldValue", "newValue") VALUES
    ('JOBAD_CREATE', 'JOBAD_ADMIN'),
    ('JOBAD_UPDATE', 'JOBAD_ADMIN'),
    ('JOBAD_DESTROY', 'JOBAD_ADMIN'),
    ('JOBAD_READ', 'JOBAD_USE'),
    ('OMEGAQUOTES_WRITE', 'OMEGAQUOTES_USE'),
    ('OMEGAQUOTES_READ', 'OMEGAQUOTES_USE'),
    ('OMBUL_CREATE', 'OMBUL_ADMIN'),
    ('OMBUL_UPDATE', 'OMBUL_ADMIN'),
    ('OMBUL_DESTROY', 'OMBUL_ADMIN'),
    ('OMBUL_READ', 'OMBUL_USE'),
    ('OMEGA_ORDER_READ', 'OMEGA_ORDER_USE'),
    ('OMEGA_ORDER_CREATE', 'OMEGA_ORDER_ADMIN'),
    ('CLASS_READ', 'CLASS_USE'),
    ('COMMITTEE_READ', 'COMMITTEE_USE'),
    ('INTEREST_GROUP_READ', 'INTEREST_GROUP_USE'),
    ('MANUAL_GROUP_READ', 'MANUAL_GROUP_USE'),
    ('OMEGA_MEMBERSHIP_GROUP_READ', 'OMEGA_MEMBERSHIP_GROUP_USE'),
    ('STUDY_PROGRAMME_READ', 'STUDY_PROGRAMME_USE'),
    ('USERS_READ', 'USERS_USE'),
    ('USERS_UPDATE', 'USERS_ADMIN'),
    ('USERS_DESTROY', 'USERS_ADMIN'),
    ('USERS_CREATE', 'USERS_ADMIN'),
    ('IMAGE_COLLECTION_CREATE', 'IMAGE_CREATE'),
    ('NOTIFICATION_CHANNEL_CREATE', 'NOTIFICATION_ADMIN'),
    ('NOTIFICATION_CHANNEL_UPDATE', 'NOTIFICATION_ADMIN'),
    ('MAIL_SEND', 'MAIL_USE'),
    ('MAILALIAS_READ', 'MAILALIAS_USE'),
    ('MAILINGLIST_READ', 'MAILINGLIST_USE'),
    ('MAILADDRESS_EXTERNAL_CREATE', 'MAILADDRESS_EXTERNAL_ADMIN'),
    ('MAILADDRESS_EXTERNAL_UPDATE', 'MAILADDRESS_EXTERNAL_ADMIN'),
    ('MAILADDRESS_EXTERNAL_DESTROY', 'MAILADDRESS_EXTERNAL_ADMIN'),
    ('MAILADDRESS_EXTERNAL_READ', 'MAILADDRESS_EXTERNAL_USE'),
    ('ADMISSION_TRIAL_ADMIN', 'ADMISSION_USE'),
    ('SCREEN_READ', 'SCREEN_USE'),
    ('SCHOOLS_READ', 'SCHOOLS_USE'),
    ('COURSES_READ', 'COURSES_USE'),
    ('COMPANY_READ', 'COMPANY_USE'),
    ('CABIN_CALENDAR_READ', 'CABIN_USE'),
    ('CABIN_BOOKING_CABIN_CREATE', 'CABIN_USE'),
    ('CABIN_BOOKING_BED_CREATE', 'CABIN_USE'),
    ('CABIN_BOOKING_ADMIN', 'CABIN_ADMIN'),
    ('CABIN_PRODUCTS_ADMIN', 'CABIN_ADMIN'),
    ('SHOP_READ', 'SHOP_USE'),
    ('PRODUCT_READ', 'PRODUCT_USE'),
    ('PURCHASE_CREATE', 'PURCHASE_USE'),
    ('PURCHASE_CREATE_ONBEHALF', 'PURCHASE_ADMIN'),
    ('PERMISSION_GROUP_READ', 'PERMISSION_USE'),
    ('PERMISSION_GROUP_ADMIN', 'PERMISSION_ADMIN'),
    ('PERMISSION_DEFAULT_ADMIN', 'PERMISSION_ADMIN'),
    ('APPLICATION_WRITE', 'APPLICATION_USE');

-- GroupPermission: stage the mapped value, then drop rows that would collide with
-- another row for the same group once several old values collapse onto one new value.
ALTER TABLE "GroupPermission" ADD COLUMN "_newPermission" TEXT;

UPDATE "GroupPermission" SET "_newPermission" = COALESCE(
    (SELECT "newValue" FROM "_PermissionRenameMap" WHERE "oldValue" = "permission"::text),
    "permission"::text
);

DELETE FROM "GroupPermission" a
USING "GroupPermission" b
WHERE a.ctid > b.ctid
    AND a."groupId" = b."groupId"
    AND a."_newPermission" = b."_newPermission";

-- DefaultPermission: same remap, deduplicated globally since it's unique on its own.
ALTER TABLE "DefaultPermission" ADD COLUMN "_newPermission" TEXT;

UPDATE "DefaultPermission" SET "_newPermission" = COALESCE(
    (SELECT "newValue" FROM "_PermissionRenameMap" WHERE "oldValue" = "permission"::text),
    "permission"::text
);

DELETE FROM "DefaultPermission" a
USING "DefaultPermission" b
WHERE a.ctid > b.ctid
    AND a."_newPermission" = b."_newPermission";

-- ApiKey.permissions: remap each array element, deduplicating within the array.
-- NULL arrays stay NULL. An empty array stays empty: array_agg over no rows is NULL, hence the
-- COALESCE.
ALTER TABLE "ApiKey" ADD COLUMN "_newPermissions" TEXT[];

UPDATE "ApiKey" SET "_newPermissions" = CASE
    WHEN "permissions" IS NULL THEN NULL
    ELSE (
        SELECT COALESCE(array_agg(DISTINCT mapped.value), '{}')
        FROM (
            SELECT COALESCE(
                (SELECT "newValue" FROM "_PermissionRenameMap" WHERE "oldValue" = elem::text),
                elem::text
            ) AS value
            FROM unnest("permissions") AS elem
        ) mapped
    )
END;

DROP TABLE "_PermissionRenameMap";

CREATE TYPE "Permission_new" AS ENUM ('JOBAD_ADMIN', 'JOBAD_USE', 'OMEGAQUOTES_USE', 'OMBUL_ADMIN', 'OMBUL_USE', 'OMEGA_ORDER_USE', 'OMEGA_ORDER_ADMIN', 'CLASS_USE', 'CLASS_ADMIN', 'COMMITTEE_USE', 'COMMITTEE_ADMIN', 'INTEREST_GROUP_ADMIN', 'INTEREST_GROUP_USE', 'MANUAL_GROUP_ADMIN', 'MANUAL_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_ADMIN', 'STUDY_PROGRAMME_USE', 'STUDY_PROGRAMME_ADMIN', 'LOCKER_ADMIN', 'LOCKER_USE', 'FRONTPAGE_ADMIN', 'USERS_USE', 'USERS_ADMIN', 'IMAGE_CREATE', 'IMAGE_ADMIN', 'EVENT_ADMIN', 'EVENT_CREATE', 'NOTIFICATION_ADMIN', 'MAIL_USE', 'MAILALIAS_USE', 'MAILALIAS_ADMIN', 'MAILINGLIST_USE', 'MAILINGLIST_ADMIN', 'MAILADDRESS_EXTERNAL_ADMIN', 'MAILADDRESS_EXTERNAL_USE', 'ADMISSION_USE', 'APIKEY_ADMIN', 'SCREEN_USE', 'SCREEN_ADMIN', 'SCHOOLS_USE', 'SCHOOLS_ADMIN', 'COURSES_USE', 'COURSES_ADMIN', 'COMPANY_USE', 'COMPANY_ADMIN', 'DOTS_ADMIN', 'CABIN_USE', 'CABIN_ADMIN', 'SHOP_USE', 'SHOP_ADMIN', 'PRODUCT_USE', 'PRODUCT_ADMIN', 'PURCHASE_USE', 'PURCHASE_ADMIN', 'LICENSE_ADMIN', 'PERMISSION_USE', 'PERMISSION_ADMIN', 'APPLICATION_ADMIN', 'APPLICATION_USE', 'NEW_STUDENT_ADMIN', 'REPORT_ADMIN', 'LEDGER_ADMIN', 'LEDGER_USE', 'FLAIR_ADMIN', 'NEWS_CREATE', 'NEWS_ADMIN');
ALTER TABLE "ApiKey" ALTER COLUMN "permissions" TYPE "Permission_new"[] USING ("_newPermissions"::"Permission_new"[]);
ALTER TABLE "GroupPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("_newPermission"::"Permission_new");
ALTER TABLE "DefaultPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("_newPermission"::"Permission_new");
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "public"."Permission_old";

ALTER TABLE "ApiKey" DROP COLUMN "_newPermissions";
ALTER TABLE "GroupPermission" DROP COLUMN "_newPermission";
ALTER TABLE "DefaultPermission" DROP COLUMN "_newPermission";
COMMIT;
