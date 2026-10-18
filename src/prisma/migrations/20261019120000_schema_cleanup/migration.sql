-- Schema cleanup before launch. Every rename is done in place, so existing data is kept.

-- Misspelled columns get their correct names (they were previously hidden behind @map).
ALTER TABLE "Event" RENAME COLUMN "canBeViewdBy" TO "canBeViewedBy";
ALTER TABLE "Event" RENAME COLUMN "hostedByCommiteeId" TO "hostedByCommitteeId";
ALTER TABLE "Event" RENAME CONSTRAINT "Event_hostedByCommiteeId_fkey" TO "Event_hostedByCommitteeId_fkey";

ALTER TABLE "Application" RENAME COLUMN "applicationPeriodCommiteeId" TO "applicationPeriodCommitteeId";
ALTER INDEX "Application_userId_applicationPeriodCommiteeId_key" RENAME TO "Application_userId_applicationPeriodCommitteeId_key";
ALTER TABLE "Application" RENAME CONSTRAINT "Application_applicationPeriodCommiteeId_applicationPeriodI_fkey" TO "Application_applicationPeriodCommitteeId_applicationPeriod_fkey";

ALTER TABLE "StudyProgramme" RENAME COLUMN "insititueCode" TO "instituteCode";

ALTER TABLE "ArticleCategory" RENAME COLUMN "created_at" TO "createdAt";
ALTER TABLE "ArticleCategory" RENAME COLUMN "updated_at" TO "updatedAt";

ALTER TYPE "SEX" RENAME TO "Sex";

-- Bulshit (OmBul -> BulShit) is the correct spelling.
ALTER TABLE "Bullshit" RENAME TO "Bulshit";
ALTER TABLE "Bulshit" RENAME COLUMN "bullshitPosterId" TO "bulshitPosterId";
ALTER TABLE "Bulshit" RENAME CONSTRAINT "Bullshit_pkey" TO "Bulshit_pkey";
ALTER TABLE "Bulshit" RENAME CONSTRAINT "Bullshit_bullshitPosterId_fkey" TO "Bulshit_bulshitPosterId_fkey";
ALTER SEQUENCE "Bullshit_id_seq" RENAME TO "Bulshit_id_seq";
ALTER TYPE "Permission" RENAME VALUE 'BULLSHIT_WRITE' TO 'BULSHIT_WRITE';
ALTER TYPE "Permission" RENAME VALUE 'BULLSHIT_USE' TO 'BULSHIT_USE';

-- Timestamps. Existing rows get the time of the migration.
ALTER TABLE "Booking" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Booking" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "CabinProduct" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "CabinProduct" ALTER COLUMN "updatedAt" DROP DEFAULT;

ALTER TABLE "Membership" ADD COLUMN "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Membership" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- The pensioned flag moves from the group types that can be pensioned onto Group itself.
ALTER TABLE "Group" ADD COLUMN "pensioned" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Group" SET "pensioned" = true
FROM "Committee" WHERE "Committee"."groupId" = "Group"."id" AND "Committee"."pensioned";
UPDATE "Group" SET "pensioned" = true
FROM "InterestGroup" WHERE "InterestGroup"."groupId" = "Group"."id" AND "InterestGroup"."pensioned";
UPDATE "Group" SET "pensioned" = true
FROM "ManualGroup" WHERE "ManualGroup"."groupId" = "Group"."id" AND "ManualGroup"."pensioned";

ALTER TABLE "Committee" DROP COLUMN "pensioned";
ALTER TABLE "InterestGroup" DROP COLUMN "pensioned";
ALTER TABLE "ManualGroup" DROP COLUMN "pensioned";

-- Never used.
DROP TABLE "RegisterStudentCardQueue";

-- Deleting an event takes its registrations with it. Their ledger transactions already set the
-- registration to null.
ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_eventId_fkey";
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Indexes on foreign keys that no existing index leads with.
CREATE INDEX "EventRegistration_userId_idx" ON "EventRegistration"("userId");
CREATE INDEX "Image_collectionId_idx" ON "Image"("collectionId");
CREATE INDEX "Membership_groupId_idx" ON "Membership"("groupId");
