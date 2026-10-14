-- The career page becomes Contactor's site inside Omega's: its frontpage gets a hero image and a
-- hero paragraph of its own in the CMS, and the link to contactor.no goes. That link was the only
-- special CMS link there was, so the special-link machinery goes with it.

-- AlterEnum
ALTER TYPE "SpecialCmsImage" ADD VALUE 'CAREER_HERO';
ALTER TYPE "SpecialCmsParagraph" ADD VALUE 'CAREER_HERO';

BEGIN;

-- The special link row is of no use once nothing can address it.
DELETE FROM "CmsLink" WHERE "special" IS NOT NULL;

-- DropIndex
DROP INDEX "CmsLink_special_key";

-- AlterTable
ALTER TABLE "CmsLink" DROP COLUMN "special";

-- DropEnum
DROP TYPE "SpecialCmsLink";

COMMIT;
