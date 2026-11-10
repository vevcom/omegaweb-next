-- Removes the MAIL_USE permission. It guarded writing a mail by hand from an alias, which is gone:
-- correspondence is written in the webmail, and what goes out to many is a notification.
BEGIN;

-- Grants of the removed permission go first, since the rebuilt enum below cannot hold them. A
-- notification restricted to it would otherwise become unrestricted, so it goes too.
DELETE FROM "GroupPermission" WHERE "permission" = 'MAIL_USE';
DELETE FROM "DefaultPermission" WHERE "permission" = 'MAIL_USE';
DELETE FROM "Notification" WHERE "permission" = 'MAIL_USE';

-- AlterEnum
CREATE TYPE "Permission_new" AS ENUM ('JOBAD_ADMIN', 'JOBAD_USE', 'OMEGAQUOTES_USE', 'OMBUL_ADMIN', 'OMBUL_USE', 'OMEGA_ORDER_USE', 'OMEGA_ORDER_ADMIN', 'CLASS_USE', 'CLASS_ADMIN', 'COMMITTEE_USE', 'COMMITTEE_ADMIN', 'INTEREST_GROUP_ADMIN', 'INTEREST_GROUP_USE', 'MANUAL_GROUP_ADMIN', 'MANUAL_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_ADMIN', 'STUDY_PROGRAMME_USE', 'STUDY_PROGRAMME_ADMIN', 'LOCKER_ADMIN', 'LOCKER_USE', 'FRONTPAGE_ADMIN', 'USERS_USE', 'USERS_ADMIN', 'IMAGE_CREATE', 'IMAGE_ADMIN', 'EVENT_ADMIN', 'EVENT_CREATE', 'NOTIFICATION_ADMIN', 'MAILSERVER_USE', 'MAILSERVER_ADMIN', 'MAIL_ALIAS_CREATE', 'MAIL_LIST_CREATE', 'ADMISSION_USE', 'APIKEY_ADMIN', 'COMPANY_USE', 'COMPANY_ADMIN', 'CAREER_FRONTPAGE_HIGHLIGHT_ADMIN', 'DOTS_ADMIN', 'CABIN_USE', 'CABIN_ADMIN', 'SHOP_ADMIN', 'PURCHASE_USE', 'PURCHASE_ADMIN', 'LICENSE_ADMIN', 'PERMISSION_USE', 'PERMISSION_ADMIN', 'APPLICATION_ADMIN', 'APPLICATION_USE', 'NEW_STUDENT_ADMIN', 'REPORT_ADMIN', 'REVUE_ADMIN', 'LEDGER_ADMIN', 'LEDGER_USE', 'FLAIR_ADMIN', 'BULSHIT_WRITE', 'BULSHIT_USE', 'NEWS_CREATE', 'NEWS_ADMIN', 'ARTICLE_CATEGORY_ADMIN');
ALTER TABLE "ApiKey" ALTER COLUMN "permissions" TYPE "Permission_new"[] USING (array_remove("permissions"::text[], 'MAIL_USE')::"Permission_new"[]);
ALTER TABLE "Notification" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "GroupPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "DefaultPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "Permission_old";

COMMIT;
