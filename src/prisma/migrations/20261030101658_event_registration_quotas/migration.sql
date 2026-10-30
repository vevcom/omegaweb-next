-- CreateEnum
CREATE TYPE "EventRegistrationState" AS ENUM ('IN_QUOTA', 'WAITING_LIST');

-- CreateTable
CREATE TABLE "EventRegistrationQuota" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "places" INTEGER NOT NULL,
    "price" INTEGER,
    "registrationStart" TIMESTAMP(3) NOT NULL,
    "registrationEnd" TIMESTAMP(3) NOT NULL,
    "visibilityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventRegistrationQuota_pkey" PRIMARY KEY ("id")
);

-- Backfill: each event becomes one quota. An event without registration gets one only when its
-- regular visibility had requirements, with no places; otherwise it is viewable by all.
INSERT INTO "EventRegistrationQuota"
    ("eventId", "order", "name", "places", "price", "registrationStart", "registrationEnd", "visibilityId", "updatedAt")
SELECT
    e."id",
    0,
    'Påmelding',
    CASE WHEN e."takesRegistration" THEN e."places" ELSE 0 END,
    e."price",
    e."registrationStart",
    e."registrationEnd",
    e."visibilityRegularId",
    CURRENT_TIMESTAMP
FROM "Event" e
WHERE e."takesRegistration"
    OR EXISTS (SELECT 1 FROM "VisibilityRequirement" vr WHERE vr."visibilityId" = e."visibilityRegularId");

UPDATE "Event" e SET "canBeViewedBy" = 'ALL'
WHERE NOT EXISTS (SELECT 1 FROM "EventRegistrationQuota" q WHERE q."eventId" = e."id");

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "quotaId" INTEGER,
ADD COLUMN "state" "EventRegistrationState",
ALTER COLUMN "eventId" DROP NOT NULL;

-- The registrations within the places, in queue order, take the quota; the rest stay on the waiting list.
WITH ranked AS (
    SELECT r."id", r."eventId", ROW_NUMBER() OVER (PARTITION BY r."eventId" ORDER BY r."queuedAt", r."id") AS "position"
    FROM "EventRegistration" r
)
UPDATE "EventRegistration" r SET "quotaId" = q."id", "eventId" = NULL, "state" = 'IN_QUOTA'
FROM ranked, "EventRegistrationQuota" q
WHERE r."id" = ranked."id" AND q."eventId" = ranked."eventId" AND ranked."position" <= q."places";

UPDATE "EventRegistration" SET "state" = 'WAITING_LIST' WHERE "state" IS NULL;
ALTER TABLE "EventRegistration" ALTER COLUMN "state" SET NOT NULL;

-- The event is kept only by registrations on its waiting list.
ALTER TABLE "EventRegistration" RENAME COLUMN "eventId" TO "waitingListEventId";
ALTER TABLE "EventRegistration" RENAME CONSTRAINT "EventRegistration_eventId_fkey" TO "EventRegistration_waitingListEventId_fkey";
ALTER INDEX "EventRegistration_eventId_userId_key" RENAME TO "EventRegistration_waitingListEventId_userId_key";
ALTER INDEX "EventRegistration_eventId_queuedAt_idx" RENAME TO "EventRegistration_waitingListEventId_queuedAt_idx";

ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_state_relation_check" CHECK (
    ("state" = 'IN_QUOTA' AND "quotaId" IS NOT NULL AND "waitingListEventId" IS NULL)
    OR ("state" = 'WAITING_LIST' AND "waitingListEventId" IS NOT NULL AND "quotaId" IS NULL)
);

CREATE TEMPORARY TABLE "orphanedEventVisibility" AS
SELECT e."visibilityRegularId" AS "id" FROM "Event" e
WHERE NOT EXISTS (SELECT 1 FROM "EventRegistrationQuota" q WHERE q."visibilityId" = e."visibilityRegularId");

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_visibilityRegularId_fkey";

-- DropIndex
DROP INDEX "Event_visibilityRegularId_key";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "places",
DROP COLUMN "price",
DROP COLUMN "registrationEnd",
DROP COLUMN "registrationStart",
DROP COLUMN "takesRegistration",
DROP COLUMN "visibilityRegularId";

DELETE FROM "Visibility" v USING "orphanedEventVisibility" o WHERE v."id" = o."id";
DROP TABLE "orphanedEventVisibility";

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistrationQuota_visibilityId_key" ON "EventRegistrationQuota"("visibilityId");

-- CreateIndex
CREATE INDEX "EventRegistrationQuota_eventId_order_idx" ON "EventRegistrationQuota"("eventId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_quotaId_userId_key" ON "EventRegistration"("quotaId", "userId");

-- AddForeignKey
ALTER TABLE "EventRegistrationQuota" ADD CONSTRAINT "EventRegistrationQuota_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistrationQuota" ADD CONSTRAINT "EventRegistrationQuota_visibilityId_fkey" FOREIGN KEY ("visibilityId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "EventRegistrationQuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
