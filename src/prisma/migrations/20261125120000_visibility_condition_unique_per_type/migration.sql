-- DropIndex
DROP INDEX "VisibilityRequirementGroup_visibilityRequirementId_groupId__key";

-- CreateIndex
CREATE UNIQUE INDEX "VisibilityRequirementGroup_visibilityRequirementId_groupId__key" ON "VisibilityRequirementGroup"("visibilityRequirementId", "groupId", "order", "type");
