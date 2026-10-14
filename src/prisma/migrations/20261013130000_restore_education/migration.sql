-- Brings the education feature - schools and the course catalogue - back, with its four
-- permissions, after 20261013120000_remove_education took it out for the launch.

-- CreateEnum
CREATE TYPE "StandardSchool" AS ENUM ('NTNU');

-- AlterEnum

ALTER TYPE "Permission" ADD VALUE 'SCHOOLS_USE';
ALTER TYPE "Permission" ADD VALUE 'SCHOOLS_ADMIN';
ALTER TYPE "Permission" ADD VALUE 'COURSES_USE';
ALTER TYPE "Permission" ADD VALUE 'COURSES_ADMIN';

-- CreateTable
CREATE TABLE "Course" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ectsPoints" INTEGER NOT NULL,
    "schoolId" INTEGER NOT NULL,
    "cmsParagraphId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseStudyProgram" (
    "courseId" INTEGER NOT NULL,
    "studyProgramId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseStudyProgram_pkey" PRIMARY KEY ("courseId","studyProgramId")
);

-- CreateTable
CREATE TABLE "CourseApprovedAs" (
    "id" SERIAL NOT NULL,
    "courseId" INTEGER NOT NULL,
    "courseApprovedAsId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseApprovedAs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "shortName" TEXT NOT NULL,
    "standardSchool" "StandardSchool",
    "desctiption" TEXT NOT NULL DEFAULT '',
    "cmsParagraphId" INTEGER NOT NULL,
    "cmsImageId" INTEGER NOT NULL,
    "cmsLinkId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Course_cmsParagraphId_key" ON "Course"("cmsParagraphId");

-- CreateIndex
CREATE UNIQUE INDEX "School_name_key" ON "School"("name");

-- CreateIndex
CREATE UNIQUE INDEX "School_shortName_key" ON "School"("shortName");

-- CreateIndex
CREATE UNIQUE INDEX "School_standardSchool_key" ON "School"("standardSchool");

-- CreateIndex
CREATE UNIQUE INDEX "School_cmsParagraphId_key" ON "School"("cmsParagraphId");

-- CreateIndex
CREATE UNIQUE INDEX "School_cmsImageId_key" ON "School"("cmsImageId");

-- CreateIndex
CREATE UNIQUE INDEX "School_cmsLinkId_key" ON "School"("cmsLinkId");

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Course" ADD CONSTRAINT "Course_cmsParagraphId_fkey" FOREIGN KEY ("cmsParagraphId") REFERENCES "CmsParagraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseStudyProgram" ADD CONSTRAINT "CourseStudyProgram_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseStudyProgram" ADD CONSTRAINT "CourseStudyProgram_studyProgramId_fkey" FOREIGN KEY ("studyProgramId") REFERENCES "StudyProgramme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseApprovedAs" ADD CONSTRAINT "CourseApprovedAs_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseApprovedAs" ADD CONSTRAINT "CourseApprovedAs_courseApprovedAsId_fkey" FOREIGN KEY ("courseApprovedAsId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_cmsParagraphId_fkey" FOREIGN KEY ("cmsParagraphId") REFERENCES "CmsParagraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_cmsImageId_fkey" FOREIGN KEY ("cmsImageId") REFERENCES "CmsImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_cmsLinkId_fkey" FOREIGN KEY ("cmsLinkId") REFERENCES "CmsLink"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
