-- AlterTable
ALTER TABLE "Committee" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Membership" ADD COLUMN     "position" INTEGER NOT NULL DEFAULT 0;

-- Keep the order committees were listed in before, which was by id.
UPDATE "Committee" SET "position" = ranked."position"
FROM (SELECT "id", ROW_NUMBER() OVER (ORDER BY "id") - 1 AS "position" FROM "Committee") AS ranked
WHERE "Committee"."id" = ranked."id";

-- Members had no order before, so each group and order starts with its admins, then by name.
UPDATE "Membership" SET "position" = ranked."position"
FROM (
    SELECT "Membership"."userId", "Membership"."groupId", "Membership"."order",
        ROW_NUMBER() OVER (
            PARTITION BY "Membership"."groupId", "Membership"."order"
            ORDER BY "Membership"."admin" DESC, "User"."firstname", "User"."lastname", "User"."id"
        ) - 1 AS "position"
    FROM "Membership" JOIN "User" ON "User"."id" = "Membership"."userId"
) AS ranked
WHERE "Membership"."userId" = ranked."userId"
    AND "Membership"."groupId" = ranked."groupId"
    AND "Membership"."order" = ranked."order";
