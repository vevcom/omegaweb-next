-- The career pages become Contactor's site inside Omega's, with its frontpage content in the CMS:
-- an "om oss" image and paragraph (the career info paragraph, renamed), three study programme
-- paragraphs, and special links for contact and the four study programmes in place of the one
-- link to contactor.no. The frontpage links stay as they are.

-- AlterEnum
ALTER TYPE "SpecialCmsImage" ADD VALUE 'CAREER_ABOUT';

-- AlterEnum: CAREER_INFO becomes CAREER_ABOUT, keeping the row.
BEGIN;
CREATE TYPE "SpecialCmsParagraph_new" AS ENUM ('FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4', 'INTEREST_GROUP_GENERAL_INFO', 'CAREER_ABOUT', 'CAREER_PROGRAMMES', 'CAREER_PROGRAMME_CYBERNETICS', 'CAREER_PROGRAMME_ELECTRONICS', 'CABIN_CONTRACT');
ALTER TABLE "CmsParagraph" ALTER COLUMN "special" TYPE "SpecialCmsParagraph_new"
    USING (CASE "special"::text WHEN 'CAREER_INFO' THEN 'CAREER_ABOUT' ELSE "special"::text END)::"SpecialCmsParagraph_new";
ALTER TYPE "SpecialCmsParagraph" RENAME TO "SpecialCmsParagraph_old";
ALTER TYPE "SpecialCmsParagraph_new" RENAME TO "SpecialCmsParagraph";
DROP TYPE "SpecialCmsParagraph_old";
COMMIT;

-- AlterEnum: the link to contactor.no goes, and its row with it.
BEGIN;
DELETE FROM "CmsLink" WHERE "special" = 'CAREER_LINK_TO_CONTACTOR';
CREATE TYPE "SpecialCmsLink_new" AS ENUM ('CAREER_CONTACT', 'CAREER_CYBERNETICS_FIVE_YEAR', 'CAREER_CYBERNETICS_TWO_YEAR', 'CAREER_ELECTRONICS_FIVE_YEAR', 'CAREER_ELECTRONICS_TWO_YEAR', 'FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4');
ALTER TABLE "CmsLink" ALTER COLUMN "special" TYPE "SpecialCmsLink_new" USING ("special"::text::"SpecialCmsLink_new");
ALTER TYPE "SpecialCmsLink" RENAME TO "SpecialCmsLink_old";
ALTER TYPE "SpecialCmsLink_new" RENAME TO "SpecialCmsLink";
DROP TYPE "SpecialCmsLink_old";
COMMIT;
