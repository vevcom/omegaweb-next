-- CreateEnum
CREATE TYPE "EventRegistrationState" AS ENUM ('IN_QUOTA', 'WAITING_LIST');

-- CreateTable
CREATE TABLE "EventVariant" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "registrationStart" TIMESTAMP(3) NOT NULL,
    "registrationEnd" TIMESTAMP(3) NOT NULL,
    "takesPayment" BOOLEAN NOT NULL DEFAULT false,
    "price" INTEGER,
    "paymentStart" TIMESTAMP(3),
    "paymentEnd" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventVariant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventQuota" (
    "id" SERIAL NOT NULL,
    "variantId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "places" INTEGER NOT NULL,
    "visibilityId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EventQuota_pkey" PRIMARY KEY ("id")
);

-- Backfill: each event becomes one variant with one quota, holding its registration and payment
-- settings, places and regular visibility. An event without registration gets them only when its
-- regular visibility had requirements, with no places; otherwise it is viewable by all.
INSERT INTO "EventVariant"
    ("eventId", "order", "name", "registrationStart", "registrationEnd", "takesPayment", "price", "paymentStart", "paymentEnd", "updatedAt")
SELECT
    e."id", 0, 'Påmelding', e."registrationStart", e."registrationEnd",
    e."takesPayment", e."price", e."paymentStart", e."paymentEnd", CURRENT_TIMESTAMP
FROM "Event" e
WHERE e."takesRegistration"
    OR EXISTS (SELECT 1 FROM "VisibilityRequirement" vr WHERE vr."visibilityId" = e."visibilityRegularId");

INSERT INTO "EventQuota" ("variantId", "order", "name", "places", "visibilityId", "updatedAt")
SELECT v."id", 0, 'Påmelding', CASE WHEN e."takesRegistration" THEN e."places" ELSE 0 END, e."visibilityRegularId", CURRENT_TIMESTAMP
FROM "EventVariant" v JOIN "Event" e ON e."id" = v."eventId";

UPDATE "Event" e SET "canBeViewedBy" = 'ALL'
WHERE NOT EXISTS (SELECT 1 FROM "EventVariant" v WHERE v."eventId" = e."id");

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "quotaId" INTEGER,
ADD COLUMN "state" "EventRegistrationState",
ADD COLUMN "waitingListVariantId" INTEGER;

-- The registrations within the places, in queue order, take the quota; the rest wait on the variant.
WITH ranked AS (
    SELECT r."id", r."eventId", ROW_NUMBER() OVER (PARTITION BY r."eventId" ORDER BY r."queuedAt", r."id") AS "position"
    FROM "EventRegistration" r
)
UPDATE "EventRegistration" r SET "quotaId" = q."id", "state" = 'IN_QUOTA'
FROM ranked, "EventQuota" q JOIN "EventVariant" v ON v."id" = q."variantId"
WHERE r."id" = ranked."id" AND v."eventId" = ranked."eventId" AND ranked."position" <= q."places";

UPDATE "EventRegistration" r SET "waitingListVariantId" = v."id", "state" = 'WAITING_LIST'
FROM "EventVariant" v
WHERE r."state" IS NULL AND v."eventId" = r."eventId";

-- Registrations to an event that got no variant have nothing to belong to.
DELETE FROM "EventRegistration" WHERE "state" IS NULL;
ALTER TABLE "EventRegistration" ALTER COLUMN "state" SET NOT NULL;

ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_state_relation_check" CHECK (
    ("state" = 'IN_QUOTA' AND "quotaId" IS NOT NULL AND "waitingListVariantId" IS NULL)
    OR ("state" = 'WAITING_LIST' AND "waitingListVariantId" IS NOT NULL AND "quotaId" IS NULL)
);

CREATE TEMPORARY TABLE "orphanedEventVisibility" AS
SELECT e."visibilityRegularId" AS "id" FROM "Event" e
WHERE NOT EXISTS (SELECT 1 FROM "EventQuota" q WHERE q."visibilityId" = e."visibilityRegularId");

-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_visibilityRegularId_fkey";

-- DropForeignKey
ALTER TABLE "EventRegistration" DROP CONSTRAINT "EventRegistration_eventId_fkey";

-- DropIndex
DROP INDEX "Event_visibilityRegularId_key";

-- DropIndex
DROP INDEX "EventRegistration_eventId_queuedAt_idx";

-- DropIndex
DROP INDEX "EventRegistration_eventId_userId_key";

-- AlterTable
ALTER TABLE "Event" DROP COLUMN "places",
DROP COLUMN "price",
DROP COLUMN "paymentEnd",
DROP COLUMN "paymentStart",
DROP COLUMN "registrationEnd",
DROP COLUMN "registrationStart",
DROP COLUMN "takesPayment",
DROP COLUMN "takesRegistration",
DROP COLUMN "visibilityRegularId",
ADD COLUMN "allowRegistrationInMultipleVariants" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "EventRegistration" DROP COLUMN "eventId";

DELETE FROM "Visibility" v USING "orphanedEventVisibility" o WHERE v."id" = o."id";
DROP TABLE "orphanedEventVisibility";

-- CreateIndex
CREATE INDEX "EventVariant_eventId_order_idx" ON "EventVariant"("eventId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EventQuota_visibilityId_key" ON "EventQuota"("visibilityId");

-- CreateIndex
CREATE INDEX "EventQuota_variantId_order_idx" ON "EventQuota"("variantId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_quotaId_userId_key" ON "EventRegistration"("quotaId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_waitingListVariantId_userId_key" ON "EventRegistration"("waitingListVariantId", "userId");

-- CreateIndex
CREATE INDEX "EventRegistration_quotaId_queuedAt_idx" ON "EventRegistration"("quotaId", "queuedAt");

-- CreateIndex
CREATE INDEX "EventRegistration_waitingListVariantId_queuedAt_idx" ON "EventRegistration"("waitingListVariantId", "queuedAt");

-- AddForeignKey
ALTER TABLE "EventVariant" ADD CONSTRAINT "EventVariant_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventQuota" ADD CONSTRAINT "EventQuota_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "EventVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventQuota" ADD CONSTRAINT "EventQuota_visibilityId_fkey" FOREIGN KEY ("visibilityId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_quotaId_fkey" FOREIGN KEY ("quotaId") REFERENCES "EventQuota"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_waitingListVariantId_fkey" FOREIGN KEY ("waitingListVariantId") REFERENCES "EventVariant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
