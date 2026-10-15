-- The recruitment text and video move from the committee onto its participation in a period. Every
-- participation that already exists starts out with a copy of what its committee had.
INSERT INTO "CmsParagraph" ("name", "contentMd", "contentHtml", "updatedAt")
SELECT
    'committeeParticipationApplication-' || participation."id",
    paragraph."contentMd",
    paragraph."contentHtml",
    CURRENT_TIMESTAMP
FROM "CommitteeParticipationInApplicationPeriod" AS participation
JOIN "Committee" AS committee ON committee."id" = participation."committeeId"
JOIN "CmsParagraph" AS paragraph ON paragraph."id" = committee."applicationParagraphId";

-- A committee with no url migrated gets the same './' a newly created participation gets, which the
-- applications page reads as "no video set".
INSERT INTO "CmsLink" ("name", "text", "url", "updatedAt")
SELECT
    'committeeParticipationVideo-' || participation."id",
    'Komitévideo',
    coalesce(committee."videoLink", './'),
    CURRENT_TIMESTAMP
FROM "CommitteeParticipationInApplicationPeriod" AS participation
JOIN "Committee" AS committee ON committee."id" = participation."committeeId";

-- AlterTable
ALTER TABLE "CommitteeParticipationInApplicationPeriod" ADD COLUMN     "paragraphId" INTEGER,
ADD COLUMN     "videoLinkId" INTEGER;

UPDATE "CommitteeParticipationInApplicationPeriod" AS participation
SET "paragraphId" = paragraph."id"
FROM "CmsParagraph" AS paragraph
WHERE paragraph."name" = 'committeeParticipationApplication-' || participation."id";

UPDATE "CommitteeParticipationInApplicationPeriod" AS participation
SET "videoLinkId" = link."id"
FROM "CmsLink" AS link
WHERE link."name" = 'committeeParticipationVideo-' || participation."id";

ALTER TABLE "CommitteeParticipationInApplicationPeriod" ALTER COLUMN "paragraphId" SET NOT NULL,
ALTER COLUMN "videoLinkId" SET NOT NULL;

-- DropForeignKey
ALTER TABLE "Committee" DROP CONSTRAINT "Committee_applicationParagraphId_fkey";

-- Nothing points at the committee's own paragraph any more; its content lives on in the copies above.
DELETE FROM "CmsParagraph"
WHERE "id" IN (SELECT "applicationParagraphId" FROM "Committee");

-- DropIndex
DROP INDEX "Committee_applicationParagraphId_key";

-- AlterTable
ALTER TABLE "Committee" DROP COLUMN "applicationParagraphId",
DROP COLUMN "videoLink";

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeParticipationInApplicationPeriod_paragraphId_key" ON "CommitteeParticipationInApplicationPeriod"("paragraphId");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeParticipationInApplicationPeriod_videoLinkId_key" ON "CommitteeParticipationInApplicationPeriod"("videoLinkId");

-- AddForeignKey
ALTER TABLE "CommitteeParticipationInApplicationPeriod" ADD CONSTRAINT "CommitteeParticipationInApplicationPeriod_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "CmsParagraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeParticipationInApplicationPeriod" ADD CONSTRAINT "CommitteeParticipationInApplicationPeriod_videoLinkId_fkey" FOREIGN KEY ("videoLinkId") REFERENCES "CmsLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
