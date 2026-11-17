-- A revue's name becomes the name of its article. The two were kept alike by the app, and the
-- article is made to follow where they are not.
UPDATE "Article"
SET "name" = "Revue"."name"
FROM "Revue"
WHERE "Revue"."articleId" = "Article"."id" AND "Article"."name" <> "Revue"."name";

-- DropForeignKey
ALTER TABLE "Revue" DROP CONSTRAINT "Revue_articleId_fkey";

-- CreateIndex
CREATE UNIQUE INDEX "Revue_articleId_name_key" ON "Revue"("articleId", "name");

-- AddForeignKey
ALTER TABLE "Revue" ADD CONSTRAINT "Revue_articleId_name_fkey" FOREIGN KEY ("articleId", "name") REFERENCES "Article"("id", "name") ON DELETE RESTRICT ON UPDATE CASCADE;
