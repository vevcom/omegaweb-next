-- Removes the education feature - schools and the course catalogue - with its four permissions.
-- The site launches without it.
BEGIN;

-- Grants of the removed permissions go first, since the rebuilt enum below cannot hold them. A
-- notification restricted to one of them would otherwise become unrestricted, so it goes too.
DELETE FROM "GroupPermission" WHERE "permission" IN ('SCHOOLS_USE', 'SCHOOLS_ADMIN', 'COURSES_USE', 'COURSES_ADMIN');
DELETE FROM "DefaultPermission" WHERE "permission" IN ('SCHOOLS_USE', 'SCHOOLS_ADMIN', 'COURSES_USE', 'COURSES_ADMIN');
DELETE FROM "Notification" WHERE "permission" IN ('SCHOOLS_USE', 'SCHOOLS_ADMIN', 'COURSES_USE', 'COURSES_ADMIN');

-- AlterEnum
CREATE TYPE "Permission_new" AS ENUM ('JOBAD_ADMIN', 'JOBAD_USE', 'OMEGAQUOTES_USE', 'OMBUL_ADMIN', 'OMBUL_USE', 'OMEGA_ORDER_USE', 'OMEGA_ORDER_ADMIN', 'CLASS_USE', 'CLASS_ADMIN', 'COMMITTEE_USE', 'COMMITTEE_ADMIN', 'INTEREST_GROUP_ADMIN', 'INTEREST_GROUP_USE', 'MANUAL_GROUP_ADMIN', 'MANUAL_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_ADMIN', 'STUDY_PROGRAMME_USE', 'STUDY_PROGRAMME_ADMIN', 'LOCKER_ADMIN', 'LOCKER_USE', 'FRONTPAGE_ADMIN', 'USERS_USE', 'USERS_ADMIN', 'IMAGE_CREATE', 'IMAGE_ADMIN', 'EVENT_ADMIN', 'EVENT_CREATE', 'NOTIFICATION_ADMIN', 'MAIL_USE', 'MAILSERVER_USE', 'MAILSERVER_ADMIN', 'ADMISSION_USE', 'APIKEY_ADMIN', 'SCREEN_USE', 'SCREEN_ADMIN', 'COMPANY_USE', 'COMPANY_ADMIN', 'DOTS_ADMIN', 'CABIN_USE', 'CABIN_ADMIN', 'SHOP_USE', 'SHOP_ADMIN', 'PRODUCT_USE', 'PRODUCT_ADMIN', 'PURCHASE_USE', 'PURCHASE_ADMIN', 'LICENSE_ADMIN', 'PERMISSION_USE', 'PERMISSION_ADMIN', 'APPLICATION_ADMIN', 'APPLICATION_USE', 'NEW_STUDENT_ADMIN', 'REPORT_ADMIN', 'LEDGER_ADMIN', 'LEDGER_USE', 'FLAIR_ADMIN', 'BULLSHIT_WRITE', 'BULLSHIT_USE', 'NEWS_CREATE', 'NEWS_ADMIN', 'ARTICLE_CATEGORY_ADMIN');
ALTER TABLE "ApiKey" ALTER COLUMN "permissions" TYPE "Permission_new"[] USING (array_remove(array_remove(array_remove(array_remove("permissions"::text[], 'SCHOOLS_USE'), 'SCHOOLS_ADMIN'), 'COURSES_USE'), 'COURSES_ADMIN')::"Permission_new"[]);
ALTER TABLE "Notification" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "GroupPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "DefaultPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "Permission_old";

-- The CMS image, paragraph and link of every school, and the paragraph of every course, belong to
-- them alone. They are collected before the rows that point at them are dropped, and deleted after.
CREATE TEMPORARY TABLE "removed_cms_image" ON COMMIT DROP AS SELECT "cmsImageId" AS id FROM "School";
CREATE TEMPORARY TABLE "removed_cms_link" ON COMMIT DROP AS SELECT "cmsLinkId" AS id FROM "School";
CREATE TEMPORARY TABLE "removed_cms_paragraph" ON COMMIT DROP AS
    SELECT "cmsParagraphId" AS id FROM "School" UNION SELECT "cmsParagraphId" FROM "Course";

-- DropForeignKey
ALTER TABLE "Course" DROP CONSTRAINT "Course_schoolId_fkey";
ALTER TABLE "Course" DROP CONSTRAINT "Course_cmsParagraphId_fkey";
ALTER TABLE "CourseStudyProgram" DROP CONSTRAINT "CourseStudyProgram_courseId_fkey";
ALTER TABLE "CourseStudyProgram" DROP CONSTRAINT "CourseStudyProgram_studyProgramId_fkey";
ALTER TABLE "CourseApprovedAs" DROP CONSTRAINT "CourseApprovedAs_courseId_fkey";
ALTER TABLE "CourseApprovedAs" DROP CONSTRAINT "CourseApprovedAs_courseApprovedAsId_fkey";
ALTER TABLE "School" DROP CONSTRAINT "School_cmsParagraphId_fkey";
ALTER TABLE "School" DROP CONSTRAINT "School_cmsImageId_fkey";
ALTER TABLE "School" DROP CONSTRAINT "School_cmsLinkId_fkey";

-- DropTable
DROP TABLE "Course";
DROP TABLE "CourseStudyProgram";
DROP TABLE "CourseApprovedAs";
DROP TABLE "School";

-- DropEnum
DROP TYPE "StandardSchool";

DELETE FROM "CmsImage" WHERE "id" IN (SELECT id FROM "removed_cms_image");
DELETE FROM "CmsLink" WHERE "id" IN (SELECT id FROM "removed_cms_link");
DELETE FROM "CmsParagraph" WHERE "id" IN (SELECT id FROM "removed_cms_paragraph");

COMMIT;
