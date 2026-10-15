-- Removes the info screens feature - screens and their pages - with its two permissions. It is
-- rebuilt later on the new service plumbing.
BEGIN;

-- Grants of the removed permissions go first, since the rebuilt enum below cannot hold them. A
-- notification restricted to one of them would otherwise become unrestricted, so it goes too.
DELETE FROM "GroupPermission" WHERE "permission" IN ('SCREEN_USE', 'SCREEN_ADMIN');
DELETE FROM "DefaultPermission" WHERE "permission" IN ('SCREEN_USE', 'SCREEN_ADMIN');
DELETE FROM "Notification" WHERE "permission" IN ('SCREEN_USE', 'SCREEN_ADMIN');

-- AlterEnum
CREATE TYPE "Permission_new" AS ENUM ('JOBAD_ADMIN', 'JOBAD_USE', 'OMEGAQUOTES_USE', 'OMBUL_ADMIN', 'OMBUL_USE', 'OMEGA_ORDER_USE', 'OMEGA_ORDER_ADMIN', 'CLASS_USE', 'CLASS_ADMIN', 'COMMITTEE_USE', 'COMMITTEE_ADMIN', 'INTEREST_GROUP_ADMIN', 'INTEREST_GROUP_USE', 'MANUAL_GROUP_ADMIN', 'MANUAL_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_ADMIN', 'STUDY_PROGRAMME_USE', 'STUDY_PROGRAMME_ADMIN', 'LOCKER_ADMIN', 'LOCKER_USE', 'FRONTPAGE_ADMIN', 'USERS_USE', 'USERS_ADMIN', 'IMAGE_CREATE', 'IMAGE_ADMIN', 'EVENT_ADMIN', 'EVENT_CREATE', 'NOTIFICATION_ADMIN', 'MAIL_USE', 'MAILSERVER_USE', 'MAILSERVER_ADMIN', 'ADMISSION_USE', 'APIKEY_ADMIN', 'COMPANY_USE', 'COMPANY_ADMIN', 'DOTS_ADMIN', 'CABIN_USE', 'CABIN_ADMIN', 'SHOP_USE', 'SHOP_ADMIN', 'PRODUCT_USE', 'PRODUCT_ADMIN', 'PURCHASE_USE', 'PURCHASE_ADMIN', 'LICENSE_ADMIN', 'PERMISSION_USE', 'PERMISSION_ADMIN', 'APPLICATION_ADMIN', 'APPLICATION_USE', 'NEW_STUDENT_ADMIN', 'REPORT_ADMIN', 'LEDGER_ADMIN', 'LEDGER_USE', 'FLAIR_ADMIN', 'BULLSHIT_WRITE', 'BULLSHIT_USE', 'NEWS_CREATE', 'NEWS_ADMIN', 'ARTICLE_CATEGORY_ADMIN');
ALTER TABLE "ApiKey" ALTER COLUMN "permissions" TYPE "Permission_new"[] USING (array_remove(array_remove("permissions"::text[], 'SCREEN_USE'), 'SCREEN_ADMIN')::"Permission_new"[]);
ALTER TABLE "Notification" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "GroupPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "DefaultPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "Permission_old";

-- The CMS image and paragraph of every screen page belong to it alone. They are collected before
-- the rows that point at them are dropped, and deleted after.
CREATE TEMPORARY TABLE "removed_cms_image" ON COMMIT DROP AS SELECT "cmsImageId" AS id FROM "ScreenPage";
CREATE TEMPORARY TABLE "removed_cms_paragraph" ON COMMIT DROP AS SELECT "cmsParagraphId" AS id FROM "ScreenPage";

-- DropForeignKey
ALTER TABLE "ScreenPageScreen" DROP CONSTRAINT "ScreenPageScreen_screenPageId_fkey";
ALTER TABLE "ScreenPageScreen" DROP CONSTRAINT "ScreenPageScreen_screenId_fkey";
ALTER TABLE "ScreenPage" DROP CONSTRAINT "ScreenPage_jobAdId_fkey";
ALTER TABLE "ScreenPage" DROP CONSTRAINT "ScreenPage_cmsImageId_fkey";
ALTER TABLE "ScreenPage" DROP CONSTRAINT "ScreenPage_cmsParagraphId_fkey";
ALTER TABLE "ScreenPage" DROP CONSTRAINT "ScreenPage_eventId_fkey";
ALTER TABLE "ScreenPage" DROP CONSTRAINT "ScreenPage_eventTagId_fkey";

-- DropTable
DROP TABLE "ScreenPageScreen";
DROP TABLE "ScreenPage";
DROP TABLE "Screen";

-- DropEnum
DROP TYPE "ScreenOrientation";
DROP TYPE "ScreenPageType";

DELETE FROM "CmsImage" WHERE "id" IN (SELECT id FROM "removed_cms_image");
DELETE FROM "CmsParagraph" WHERE "id" IN (SELECT id FROM "removed_cms_paragraph");

COMMIT;
