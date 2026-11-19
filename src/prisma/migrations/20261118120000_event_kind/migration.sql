-- CreateEnum
CREATE TYPE "EventKind" AS ENUM ('ORDINARY', 'COMPANY_PRESENTATION');

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "kind" "EventKind" NOT NULL DEFAULT 'ORDINARY';

-- The events carrying the special tag are the company presentations.
UPDATE "Event" SET "kind" = 'COMPANY_PRESENTATION'
WHERE EXISTS (
    SELECT 1 FROM "EventTagEvent"
    JOIN "EventTag" ON "EventTag"."id" = "EventTagEvent"."tagId"
    WHERE "EventTagEvent"."eventId" = "Event"."id" AND "EventTag"."special" = 'COMPANY_PRESENTATION'
);
