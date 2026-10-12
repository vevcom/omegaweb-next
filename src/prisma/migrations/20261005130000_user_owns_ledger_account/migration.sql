-- Every User must have exactly one LedgerAccount. The FK moves from LedgerAccount.userId
-- (optional, lazily created via readOrCreate) to User.ledgerAccountId (required, unique).
--
-- This is an expand/contract migration because production has Users with no LedgerAccount yet
-- (readOrCreate only ever created one on first use): add the new column nullable, backfill it
-- for every user (reusing an existing account where one exists, creating one otherwise), then
-- tighten the column to NOT NULL UNIQUE and drop the old column.

-- 1. Add the new column, nullable for now so existing rows are valid.
ALTER TABLE "User" ADD COLUMN "ledgerAccountId" INTEGER;

-- 2. Backfill users that already have a LedgerAccount pointing at them.
UPDATE "User"
SET "ledgerAccountId" = "LedgerAccount"."id"
FROM "LedgerAccount"
WHERE "LedgerAccount"."userId" = "User"."id" AND "LedgerAccount"."type" = 'USER';

-- 3. Backfill every remaining user with a fresh LedgerAccount. Done row-by-row (not a bulk
-- INSERT ... SELECT ... RETURNING) because Postgres does not guarantee RETURNING output order
-- matches the SELECT order, and each new account must be correlated back to the right user.
DO $$
DECLARE
    missing_user RECORD;
    new_account_id INTEGER;
BEGIN
    FOR missing_user IN SELECT "id" FROM "User" WHERE "ledgerAccountId" IS NULL LOOP
        INSERT INTO "LedgerAccount" ("type", "frozen", "createdAt", "updatedAt")
        VALUES ('USER', false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING "id" INTO new_account_id;

        UPDATE "User" SET "ledgerAccountId" = new_account_id WHERE "id" = missing_user."id";
    END LOOP;
END $$;

-- 4. Every user now has a ledgerAccountId: make it required and unique.
ALTER TABLE "User" ALTER COLUMN "ledgerAccountId" SET NOT NULL;
CREATE UNIQUE INDEX "User_ledgerAccountId_key" ON "User"("ledgerAccountId");
ALTER TABLE "User" ADD CONSTRAINT "User_ledgerAccountId_fkey" FOREIGN KEY ("ledgerAccountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- 5. Drop the old FK from LedgerAccount - User now owns the relationship.
ALTER TABLE "LedgerAccount" DROP CONSTRAINT "LedgerAccount_userId_fkey";
DROP INDEX "LedgerAccount_userId_key";
ALTER TABLE "LedgerAccount" DROP COLUMN "userId";
