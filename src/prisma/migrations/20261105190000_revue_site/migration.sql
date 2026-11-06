-- CreateEnum
CREATE TYPE "RevueGroupMemberType" AS ENUM ('USER', 'DETAILS');

-- CreateTable
CREATE TABLE "Revue" (
    "id" SERIAL NOT NULL,
    "year" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "articleId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Revue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevueGroup" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "revueId" INTEGER NOT NULL,
    "articleSectionId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevueGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevueGroupMember" (
    "id" SERIAL NOT NULL,
    "type" "RevueGroupMemberType" NOT NULL,
    "name" TEXT,
    "userId" INTEGER,
    "groupId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevueGroupMember_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RevueGroupMember_type_fields_check" CHECK (
        ("type" = 'USER' AND "userId" IS NOT NULL AND "name" IS NULL)
        OR ("type" = 'DETAILS' AND "name" IS NOT NULL AND "userId" IS NULL)
    )
);

-- CreateIndex
CREATE UNIQUE INDEX "Revue_year_key" ON "Revue"("year");

-- CreateIndex
CREATE UNIQUE INDEX "Revue_name_key" ON "Revue"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Revue_articleId_key" ON "Revue"("articleId");

-- CreateIndex
CREATE UNIQUE INDEX "RevueGroup_articleSectionId_key" ON "RevueGroup"("articleSectionId");

-- CreateIndex
CREATE UNIQUE INDEX "RevueGroup_revueId_name_key" ON "RevueGroup"("revueId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "RevueGroupMember_groupId_userId_key" ON "RevueGroupMember"("groupId", "userId");

-- AddForeignKey
ALTER TABLE "Revue" ADD CONSTRAINT "Revue_articleId_fkey" FOREIGN KEY ("articleId") REFERENCES "Article"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroup" ADD CONSTRAINT "RevueGroup_revueId_fkey" FOREIGN KEY ("revueId") REFERENCES "Revue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroup" ADD CONSTRAINT "RevueGroup_articleSectionId_fkey" FOREIGN KEY ("articleSectionId") REFERENCES "ArticleSection"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroupMember" ADD CONSTRAINT "RevueGroupMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RevueGroupMember" ADD CONSTRAINT "RevueGroupMember_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "RevueGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

