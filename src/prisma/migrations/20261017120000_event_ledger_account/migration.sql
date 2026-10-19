-- A paid event is paid into an account linked to the event itself, chosen by those who administrate
-- it, rather than into whichever account of its hosting committee came first.

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "ledgerAccountId" INTEGER;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Carry over where payments went so far: the account of the hosting committee, where it has exactly
-- one, so no priced event that took payment before this stops taking it.
UPDATE "Event" SET "ledgerAccountId" = (
    SELECT "ledgerAccountId" FROM "GroupLedgerAccount" WHERE "groupId" = "Committee"."groupId"
)
FROM "Committee"
WHERE "Event"."hostedByCommiteeId" = "Committee"."id"
    AND "Event"."price" IS NOT NULL
    AND (SELECT COUNT(*) FROM "GroupLedgerAccount" WHERE "groupId" = "Committee"."groupId") = 1;
