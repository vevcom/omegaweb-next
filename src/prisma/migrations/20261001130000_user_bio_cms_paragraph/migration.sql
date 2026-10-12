-- Every user gets a bio paragraph holding the bio they had. The bio was plain text shown as one
-- paragraph, so its HTML is the escaped text in a single <p> - which renders exactly as before. It is
-- rendered from markdown like any other paragraph the next time it is edited.
INSERT INTO "CmsParagraph" ("name", "contentMd", "contentHtml", "updatedAt")
SELECT
    'userBio-' || "id",
    "bio",
    CASE
        WHEN "bio" = '' THEN ''
        ELSE '<p>' || replace(replace(replace(replace(replace(
            "bio", '&', '&amp;'), '<', '&lt;'), '>', '&gt;'), '"', '&quot;'), '''', '&#39;') || '</p>'
    END,
    CURRENT_TIMESTAMP
FROM "User";

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "bioParagraphId" INTEGER;

UPDATE "User"
SET "bioParagraphId" = "CmsParagraph"."id"
FROM "CmsParagraph"
WHERE "CmsParagraph"."name" = 'userBio-' || "User"."id";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "bio",
ALTER COLUMN "bioParagraphId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_bioParagraphId_key" ON "User"("bioParagraphId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_bioParagraphId_fkey" FOREIGN KEY ("bioParagraphId") REFERENCES "CmsParagraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
