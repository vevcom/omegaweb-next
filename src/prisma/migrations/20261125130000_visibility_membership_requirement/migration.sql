-- A condition says the order, or any order, and whether only active memberships and only admins
-- count, in place of its type. An ACTIVE condition becomes the active memberships of any order, and
-- an ORDER one the memberships of its order. The order an ACTIVE one was stored with was Omega's at
-- the time it was saved, which nothing read.

-- DropIndex
DROP INDEX "VisibilityRequirementGroup_visibilityRequirementId_groupId__key";

-- AlterTable
ALTER TABLE "VisibilityRequirementGroup" ADD COLUMN "onlyActive" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "onlyAdmins" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "order" DROP NOT NULL;

UPDATE "VisibilityRequirementGroup" SET "order" = NULL, "onlyActive" = true WHERE "type" = 'ACTIVE';

-- Two ACTIVE conditions of one group in one requirement, saved at different orders, now say the same.
DELETE FROM "VisibilityRequirementGroup" AS later
USING "VisibilityRequirementGroup" AS earlier
WHERE later."type" = 'ACTIVE' AND earlier."type" = 'ACTIVE'
    AND later."visibilityRequirementId" = earlier."visibilityRequirementId"
    AND later."groupId" = earlier."groupId"
    AND later."id" > earlier."id";

ALTER TABLE "VisibilityRequirementGroup" DROP COLUMN "type",
ALTER COLUMN "onlyActive" DROP DEFAULT,
ALTER COLUMN "onlyAdmins" DROP DEFAULT;

-- DropEnum
DROP TYPE "VisibilityRequirementGroupType";

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityRequirementGroup_visibilityRequirementId_groupId__key" ON "VisibilityRequirementGroup"("visibilityRequirementId", "groupId", "order", "onlyActive", "onlyAdmins");

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityRequirementGroup_any_order_key" ON "VisibilityRequirementGroup"("visibilityRequirementId", "groupId", "onlyActive", "onlyAdmins") WHERE ("order" IS NULL);
