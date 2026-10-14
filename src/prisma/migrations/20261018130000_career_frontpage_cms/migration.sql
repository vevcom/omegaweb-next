-- Contactor's frontpage after contactor.no, with its content in the CMS. Special links return (the
-- contact link and the four study programme links; the enum went when its one value did). The hero
-- is static, so its paragraph goes and its image becomes the "om oss" image; the career info
-- paragraph is the "om oss" paragraph; and "who we represent" gets three paragraphs of its own.

-- CreateEnum
CREATE TYPE "SpecialCmsLink" AS ENUM ('CAREER_CONTACT', 'CAREER_CYBERNETICS_FIVE_YEAR', 'CAREER_CYBERNETICS_TWO_YEAR', 'CAREER_ELECTRONICS_FIVE_YEAR', 'CAREER_ELECTRONICS_TWO_YEAR');

-- AlterTable
ALTER TABLE "CmsLink" ADD COLUMN "special" "SpecialCmsLink";

-- CreateIndex
CREATE UNIQUE INDEX "CmsLink_special_key" ON "CmsLink"("special");

BEGIN;

DELETE FROM "CmsParagraph" WHERE "special" = 'CAREER_HERO';

-- AlterEnum: CAREER_HERO becomes CAREER_ABOUT, keeping the row.
CREATE TYPE "SpecialCmsImage_new" AS ENUM ('FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4', 'CAREER_ABOUT');
ALTER TABLE "CmsImage" ALTER COLUMN "special" TYPE "SpecialCmsImage_new"
    USING (CASE "special"::text WHEN 'CAREER_HERO' THEN 'CAREER_ABOUT' ELSE "special"::text END)::"SpecialCmsImage_new";
ALTER TYPE "SpecialCmsImage" RENAME TO "SpecialCmsImage_old";
ALTER TYPE "SpecialCmsImage_new" RENAME TO "SpecialCmsImage";
DROP TYPE "SpecialCmsImage_old";

-- AlterEnum: CAREER_INFO becomes CAREER_ABOUT, keeping the row.
CREATE TYPE "SpecialCmsParagraph_new" AS ENUM ('FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4', 'INTEREST_GROUP_GENERAL_INFO', 'CAREER_ABOUT', 'CAREER_PROGRAMMES', 'CAREER_PROGRAMME_CYBERNETICS', 'CAREER_PROGRAMME_ELECTRONICS', 'CABIN_CONTRACT');
ALTER TABLE "CmsParagraph" ALTER COLUMN "special" TYPE "SpecialCmsParagraph_new"
    USING (CASE "special"::text WHEN 'CAREER_INFO' THEN 'CAREER_ABOUT' ELSE "special"::text END)::"SpecialCmsParagraph_new";
ALTER TYPE "SpecialCmsParagraph" RENAME TO "SpecialCmsParagraph_old";
ALTER TYPE "SpecialCmsParagraph_new" RENAME TO "SpecialCmsParagraph";
DROP TYPE "SpecialCmsParagraph_old";

COMMIT;
