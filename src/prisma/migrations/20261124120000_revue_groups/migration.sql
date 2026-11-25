-- Nothing is carried over: the revue groups there are go, with their members and their article
-- sections, whose image, paragraph and link go with them. The revues stay.
DROP TABLE "RevueGroupMember";
DROP TYPE "RevueGroupMemberType";

ALTER TABLE "RevueGroup" DROP CONSTRAINT "RevueGroup_articleSectionId_fkey";
DELETE FROM "ArticleSection" WHERE "id" IN (SELECT "articleSectionId" FROM "RevueGroup");
DELETE FROM "RevueGroup";
ALTER TABLE "RevueGroup" ADD CONSTRAINT "RevueGroup_articleSectionId_fkey" FOREIGN KEY ("articleSectionId") REFERENCES "ArticleSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- CreateEnum
CREATE TYPE "RevueGroupType" AS ENUM ('COMMITTEE', 'REVUE_SUB_GROUP');

-- AlterEnum
ALTER TYPE "GroupType" ADD VALUE 'REVUE_SUB_GROUP';

-- DropForeignKey
ALTER TABLE "RevueGroup" DROP CONSTRAINT "RevueGroup_revueId_fkey";

-- DropIndex
DROP INDEX "RevueGroup_revueId_name_key";

-- AlterTable
ALTER TABLE "RevueGroup" DROP COLUMN "revueId",
ADD COLUMN     "committeeId" INTEGER,
ADD COLUMN     "revueSubGroupId" INTEGER,
ADD COLUMN     "type" "RevueGroupType" NOT NULL;

-- CreateTable
CREATE TABLE "RevueSubGroup" (
    "groupId" INTEGER NOT NULL,
    "id" SERIAL NOT NULL,

    CONSTRAINT "RevueSubGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevueGroupInRevue" (
    "revueId" INTEGER NOT NULL,
    "revueGroupId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,

    CONSTRAINT "RevueGroupInRevue_pkey" PRIMARY KEY ("revueId","revueGroupId")
);

-- CreateIndex
CREATE UNIQUE INDEX "RevueSubGroup_groupId_key" ON "RevueSubGroup"("groupId");

-- CreateIndex
CREATE UNIQUE INDEX "RevueGroup_name_key" ON "RevueGroup"("name");

-- CreateIndex
CREATE UNIQUE INDEX "RevueGroup_committeeId_key" ON "RevueGroup"("committeeId");

-- CreateIndex
CREATE UNIQUE INDEX "RevueGroup_revueSubGroupId_key" ON "RevueGroup"("revueSubGroupId");

-- AddForeignKey
ALTER TABLE "RevueSubGroup" ADD CONSTRAINT "RevueSubGroup_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroup" ADD CONSTRAINT "RevueGroup_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "Committee"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroup" ADD CONSTRAINT "RevueGroup_revueSubGroupId_fkey" FOREIGN KEY ("revueSubGroupId") REFERENCES "RevueSubGroup"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroupInRevue" ADD CONSTRAINT "RevueGroupInRevue_revueId_fkey" FOREIGN KEY ("revueId") REFERENCES "Revue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroupInRevue" ADD CONSTRAINT "RevueGroupInRevue_revueGroupId_fkey" FOREIGN KEY ("revueGroupId") REFERENCES "RevueGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroupInRevue" ADD CONSTRAINT "RevueGroupInRevue_order_fkey" FOREIGN KEY ("order") REFERENCES "OmegaOrder"("order") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RevueGroup" ADD CONSTRAINT "RevueGroup_type_check" CHECK (
    ("type" = 'COMMITTEE' AND "committeeId" IS NOT NULL AND "revueSubGroupId" IS NULL)
    OR ("type" = 'REVUE_SUB_GROUP' AND "revueSubGroupId" IS NOT NULL AND "committeeId" IS NULL)
);
