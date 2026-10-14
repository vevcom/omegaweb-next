-- A shop is now seen and bought in by those who pass its regular visibility level and administered
-- by those who pass its admin level. SHOP_USE goes: SHOP_ADMIN alone bypasses both levels.
BEGIN;

DELETE FROM "GroupPermission" WHERE "permission" = 'SHOP_USE';
DELETE FROM "DefaultPermission" WHERE "permission" = 'SHOP_USE';
-- A notification restricted to SHOP_USE holders would otherwise become unrestricted.
DELETE FROM "Notification" WHERE "permission" = 'SHOP_USE';

-- AlterEnum
CREATE TYPE "Permission_new" AS ENUM ('JOBAD_ADMIN', 'JOBAD_USE', 'OMEGAQUOTES_USE', 'OMBUL_ADMIN', 'OMBUL_USE', 'OMEGA_ORDER_USE', 'OMEGA_ORDER_ADMIN', 'CLASS_USE', 'CLASS_ADMIN', 'COMMITTEE_USE', 'COMMITTEE_ADMIN', 'INTEREST_GROUP_ADMIN', 'INTEREST_GROUP_USE', 'MANUAL_GROUP_ADMIN', 'MANUAL_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_USE', 'OMEGA_MEMBERSHIP_GROUP_ADMIN', 'STUDY_PROGRAMME_USE', 'STUDY_PROGRAMME_ADMIN', 'LOCKER_ADMIN', 'LOCKER_USE', 'FRONTPAGE_ADMIN', 'USERS_USE', 'USERS_ADMIN', 'IMAGE_CREATE', 'IMAGE_ADMIN', 'EVENT_ADMIN', 'EVENT_CREATE', 'NOTIFICATION_ADMIN', 'MAIL_USE', 'MAILSERVER_USE', 'MAILSERVER_ADMIN', 'ADMISSION_USE', 'APIKEY_ADMIN', 'COMPANY_USE', 'COMPANY_ADMIN', 'DOTS_ADMIN', 'CABIN_USE', 'CABIN_ADMIN', 'SHOP_ADMIN', 'PRODUCT_USE', 'PRODUCT_ADMIN', 'PURCHASE_USE', 'PURCHASE_ADMIN', 'LICENSE_ADMIN', 'PERMISSION_USE', 'PERMISSION_ADMIN', 'APPLICATION_ADMIN', 'APPLICATION_USE', 'NEW_STUDENT_ADMIN', 'REPORT_ADMIN', 'LEDGER_ADMIN', 'LEDGER_USE', 'FLAIR_ADMIN', 'BULLSHIT_WRITE', 'BULLSHIT_USE', 'NEWS_CREATE', 'NEWS_ADMIN', 'ARTICLE_CATEGORY_ADMIN');
ALTER TABLE "ApiKey" ALTER COLUMN "permissions" TYPE "Permission_new"[] USING (array_remove("permissions"::text[], 'SHOP_USE')::"Permission_new"[]);
ALTER TABLE "GroupPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "DefaultPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "Notification" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "Permission_old";

-- AlterTable
-- The columns are added nullable so the shops that already exist can be given their two
-- visibilities before the columns are made required.
ALTER TABLE "Shop" ADD COLUMN     "visibilityAdminId" INTEGER,
ADD COLUMN     "visibilityRegularId" INTEGER;

-- Every existing shop stays open to everyone: its regular level has no requirements. Its admin
-- level gets one requirement with no conditions, which no one can satisfy, so only holders of
-- SHOP_ADMIN can administer it until they hand it to a group. An admin level with no requirements
-- at all would instead let everyone administer it.
DO $$
DECLARE
    shop RECORD;
    regular_level_id INTEGER;
    admin_level_id INTEGER;
BEGIN
    FOR shop IN SELECT "id" FROM "Shop" LOOP
        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO regular_level_id;
        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO admin_level_id;
        INSERT INTO "VisibilityRequirement" ("visibilityId") VALUES (admin_level_id);

        UPDATE "Shop"
        SET "visibilityRegularId" = regular_level_id, "visibilityAdminId" = admin_level_id
        WHERE "id" = shop."id";
    END LOOP;
END $$;

ALTER TABLE "Shop" ALTER COLUMN "visibilityAdminId" SET NOT NULL,
ALTER COLUMN "visibilityRegularId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Shop_visibilityAdminId_key" ON "Shop"("visibilityAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "Shop_visibilityRegularId_key" ON "Shop"("visibilityRegularId");

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_visibilityAdminId_fkey" FOREIGN KEY ("visibilityAdminId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Shop" ADD CONSTRAINT "Shop_visibilityRegularId_fkey" FOREIGN KEY ("visibilityRegularId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
