-- The special tag said which events are company presentations, which their kind says now.
DELETE FROM "EventTagEvent" WHERE "tagId" IN (SELECT "id" FROM "EventTag" WHERE "special" IS NOT NULL);
DELETE FROM "EventTag" WHERE "special" IS NOT NULL;

-- DropIndex
DROP INDEX "EventTag_special_key";

-- AlterTable
ALTER TABLE "EventTag" DROP COLUMN "special";

-- DropEnum
DROP TYPE "SpecialEventTags";
