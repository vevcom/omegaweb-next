-- AlterEnum
BEGIN;

-- The footer sponsor logos are no longer special cms images: the footer reads the sponsor
-- companies instead, so the cms images holding the old logos have nothing left pointing at them
-- and are dropped along with the enum values. The underlying images are kept.
DELETE FROM "CmsImage" WHERE "special"::text IN (
    'FOOTER_SPONSOR_1',
    'FOOTER_SPONSOR_2',
    'FOOTER_SPONSOR_3'
);

CREATE TYPE "SpecialCmsImage_new" AS ENUM ('FRONTPAGE_1', 'FRONTPAGE_2', 'FRONTPAGE_3', 'FRONTPAGE_4');
ALTER TABLE "CmsImage" ALTER COLUMN "special" TYPE "SpecialCmsImage_new" USING ("special"::text::"SpecialCmsImage_new");
ALTER TYPE "SpecialCmsImage" RENAME TO "SpecialCmsImage_old";
ALTER TYPE "SpecialCmsImage_new" RENAME TO "SpecialCmsImage";
DROP TYPE "SpecialCmsImage_old";
COMMIT;
