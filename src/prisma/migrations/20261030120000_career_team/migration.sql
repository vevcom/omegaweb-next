-- AlterEnum
ALTER TYPE "SpecialCollection" ADD VALUE 'CAREERTEAMIMAGES';

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
CREATE TABLE "CareerTeamPerson" (
    "id" SERIAL NOT NULL,
    "departmentId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "email" TEXT,
    "imageId" INTEGER,
    "order" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerTeamPerson_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CareerTeamDepartment_paragraphId_key" ON "CareerTeamDepartment"("paragraphId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerTeamDepartment_order_key" ON "CareerTeamDepartment"("order");

-- CreateIndex
CREATE UNIQUE INDEX "CareerTeamPerson_imageId_key" ON "CareerTeamPerson"("imageId");

-- CreateIndex
CREATE UNIQUE INDEX "CareerTeamPerson_departmentId_order_key" ON "CareerTeamPerson"("departmentId", "order");

-- AddForeignKey
ALTER TABLE "CareerTeamDepartment" ADD CONSTRAINT "CareerTeamDepartment_paragraphId_fkey" FOREIGN KEY ("paragraphId") REFERENCES "CmsParagraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerTeamPerson" ADD CONSTRAINT "CareerTeamPerson_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "CareerTeamDepartment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerTeamPerson" ADD CONSTRAINT "CareerTeamPerson_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;

