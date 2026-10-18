-- An event can be held with or for a company, such as the company of a company presentation. The
-- columns kept from OW basic, which nothing reads, get a prefix saying so - which also frees the
-- name "company" on Event for the relation.

-- AlterTable
ALTER TABLE "Event" RENAME COLUMN "company" TO "legacy_ow_basic_company";
ALTER TABLE "Event" RENAME COLUMN "lead" TO "legacy_ow_basic_lead";
ALTER TABLE "Event" RENAME COLUMN "extraFields" TO "legacy_ow_basic_extraFields";
ALTER TABLE "Event" ADD COLUMN "companyId" INTEGER;

-- AlterTable
ALTER TABLE "EventRegistration" RENAME COLUMN "manuallyPaid" TO "legacy_ow_basic_manuallyPaid";
ALTER TABLE "EventRegistration" RENAME COLUMN "company" TO "legacy_ow_basic_company";
ALTER TABLE "EventRegistration" RENAME COLUMN "extraFieldChoices" TO "legacy_ow_basic_extraFieldChoices";

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
