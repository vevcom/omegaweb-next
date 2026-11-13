-- Apart from 20261112100000_company_logos_collection because Postgres refuses to use an enum value
-- in the transaction that adds it, and the logos are moved into the COMPANYLOGOS collection here.

-- AlterTable
ALTER TABLE "Company" ADD COLUMN "logoImageId" INTEGER;

-- A company's logo was a CmsImage pointing at an image in an ordinary collection. It becomes an
-- image in the COMPANYLOGOS collection that the company alone owns, so the image is moved there
-- when nothing else uses it. A logo whose image is shared with other content is left empty and
-- has to be uploaded again: the image cannot be owned by the company while others show it.
DO $$
DECLARE
    logo_collection_id INTEGER;
    visibility_admin_id INTEGER;
    visibility_regular_id INTEGER;
BEGIN
    UPDATE "Company"
    SET "logoImageId" = "CmsImage"."imageId"
    FROM "CmsImage"
    JOIN "Image" ON "Image"."id" = "CmsImage"."imageId"
    JOIN "ImageCollection" ON "ImageCollection"."id" = "Image"."collectionId"
    WHERE "CmsImage"."id" = "Company"."logoId"
        AND "ImageCollection"."special" IS NULL
        AND "Image"."standardImage" IS NULL
        AND (SELECT COUNT(*) FROM "CmsImage" AS "usage" WHERE "usage"."imageId" = "Image"."id") = 1;

    IF NOT EXISTS (SELECT 1 FROM "Company" WHERE "logoImageId" IS NOT NULL) THEN
        RETURN;
    END IF;

    -- The collection is otherwise created by the app the first time it is read. Its name is unique
    -- among all collections, so one that already carries it gives the name up.
    SELECT "id" INTO logo_collection_id FROM "ImageCollection" WHERE "special" = 'COMPANYLOGOS';
    IF logo_collection_id IS NULL THEN
        UPDATE "ImageCollection" SET "name" = 'Bedriftslogoer (gammel)' WHERE "name" = 'Bedriftslogoer';

        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO visibility_admin_id;
        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO visibility_regular_id;
        INSERT INTO "ImageCollection" (
            "name", "description", "special", "updatedAt", "visibilityAdminId", "visibilityRegularId"
        ) VALUES (
            'Bedriftslogoer',
            'Logoene til bedriftene på karrieresidene. Hvert bilde tilhører nøyaktig én bedrift.',
            'COMPANYLOGOS',
            CURRENT_TIMESTAMP,
            visibility_admin_id,
            visibility_regular_id
        ) RETURNING "id" INTO logo_collection_id;
    END IF;

    -- A moved image can no longer be the cover of the collection it leaves.
    UPDATE "ImageCollection"
    SET "coverImageId" = NULL
    WHERE "coverImageId" IN (SELECT "logoImageId" FROM "Company" WHERE "logoImageId" IS NOT NULL);

    UPDATE "Image"
    SET "collectionId" = logo_collection_id
    WHERE "id" IN (SELECT "logoImageId" FROM "Company" WHERE "logoImageId" IS NOT NULL);
END $$;

-- DropForeignKey
ALTER TABLE "Company" DROP CONSTRAINT "Company_logoId_fkey";

-- The CmsImages that were the logos have no owner any more.
DELETE FROM "CmsImage" WHERE "id" IN (SELECT "logoId" FROM "Company");

-- DropIndex
DROP INDEX "Company_logoId_key";

-- AlterTable
ALTER TABLE "Company" DROP COLUMN "logoId";

-- CreateIndex
CREATE UNIQUE INDEX "Company_logoImageId_key" ON "Company"("logoImageId");

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_logoImageId_fkey" FOREIGN KEY ("logoImageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
