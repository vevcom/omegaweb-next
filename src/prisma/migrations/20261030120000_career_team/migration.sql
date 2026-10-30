-- AlterEnum
ALTER TYPE "SpecialCollection" ADD VALUE 'PERSONIMAGES';

-- CreateTable
CREATE TABLE "CareerTeamDepartment" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "paragraphId" INTEGER NOT NULL,
    "order" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerTeamDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CmsPerson" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT,
    "imageId" INTEGER,
    "order" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "careerTeamDepartmentId" INTEGER,

    CONSTRAINT "CmsPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareerTeamDepartment_paragraphId_key" ON "CareerTeamDepartment"("paragraphId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerTeamDepartment_order_key" ON "CareerTeamDepartment"("order");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPerson_imageId_key" ON "CmsPerson"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "CmsPerson_careerTeamDepartmentId_order_key" ON "CmsPerson"("careerTeamDepartmentId", "order");

-- AddForeignKey
ALTER TABLE "CareerTeamDepartment" ADD CONSTRAINT "CareerTeamDepartment_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "CmsParagraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPerson" ADD CONSTRAINT "CmsPerson_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CmsPerson" ADD CONSTRAINT "CmsPerson_careerTeamDepartmentId_fkey" FOREIGN KEY ("careerTeamDepartmentId") REFERENCES "CareerTeamDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

