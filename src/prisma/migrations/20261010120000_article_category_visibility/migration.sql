-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'ARTICLE_CATEGORY_ADMIN';

-- AlterTable
-- The columns are added nullable so the categories that already exist can be given their two
-- visibilities before the columns are made required.
ALTER TABLE "ArticleCategory" ADD COLUMN     "visibilityAdminId" INTEGER,
ADD COLUMN     "visibilityRegularId" INTEGER;

-- Every existing category stays readable by everyone: its regular level has no requirements. Its
-- admin level gets one requirement with no conditions, which no one can satisfy, so only holders of
-- ARTICLE_CATEGORY_ADMIN can edit it until they hand it to a group. An admin level with no
-- requirements at all would instead let everyone edit it.
DO $$
DECLARE
    category RECORD;
    regular_level_id INTEGER;
    admin_level_id INTEGER;
BEGIN
    FOR category IN SELECT "id" FROM "ArticleCategory" LOOP
        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO regular_level_id;
        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO admin_level_id;
        INSERT INTO "VisibilityRequirement" ("visibilityId") VALUES (admin_level_id);

        UPDATE "ArticleCategory"
        SET "visibilityRegularId" = regular_level_id, "visibilityAdminId" = admin_level_id
        WHERE "id" = category."id";
    END LOOP;
END $$;

ALTER TABLE "ArticleCategory" ALTER COLUMN "visibilityAdminId" SET NOT NULL,
ALTER COLUMN "visibilityRegularId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCategory_visibilityAdminId_key" ON "ArticleCategory"("visibilityAdminId");

-- CreateIndex
CREATE UNIQUE INDEX "ArticleCategory_visibilityRegularId_key" ON "ArticleCategory"("visibilityRegularId");

-- AddForeignKey
ALTER TABLE "ArticleCategory" ADD CONSTRAINT "ArticleCategory_visibilityAdminId_fkey" FOREIGN KEY ("visibilityAdminId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ArticleCategory" ADD CONSTRAINT "ArticleCategory_visibilityRegularId_fkey" FOREIGN KEY ("visibilityRegularId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
