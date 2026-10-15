-- Brings the info screens feature - screens and the pages they show - back on the current service
-- plumbing, with its two permissions, after 20261014140000_remove_screens took it out. The tables
-- are as before, except that deleting a screen or a page also deletes the rows placing pages on
-- screens, where before the delete was refused.

-- CreateEnum
CREATE TYPE "ScreenOrientation" AS ENUM ('PORTRAIT', 'LANDSCAPE');

-- CreateEnum
CREATE TYPE "ScreenPageType" AS ENUM ('IMAGE', 'TEXT_AND_IMAGE', 'JOBAD', 'EVENT', 'EVENT_TAG');

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'SCREEN_USE';
ALTER TYPE "Permission" ADD VALUE IF NOT EXISTS 'SCREEN_ADMIN';

-- CreateTable
CREATE TABLE "Screen" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "orientation" "ScreenOrientation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Screen_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ScreenPageScreen" (
    "screenPageId" INTEGER NOT NULL,
    "screenId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenPageScreen_pkey" PRIMARY KEY ("screenPageId","screenId")
);

-- CreateTable
CREATE TABLE "ScreenPage" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "type" "ScreenPageType" NOT NULL,
    "jobAdId" INTEGER,
    "eventId" INTEGER,
    "eventTagId" INTEGER,
    "cmsImageId" INTEGER NOT NULL,
    "cmsParagraphId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScreenPage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Screen_name_key" ON "Screen"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPageScreen_order_screenId_key" ON "ScreenPageScreen"("order", "screenId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPage_name_key" ON "ScreenPage"("name");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPage_cmsImageId_key" ON "ScreenPage"("cmsImageId");

-- CreateIndex
CREATE UNIQUE INDEX "ScreenPage_cmsParagraphId_key" ON "ScreenPage"("cmsParagraphId");

-- AddForeignKey
ALTER TABLE "ScreenPageScreen" ADD CONSTRAINT "ScreenPageScreen_screenPageId_fkey" FOREIGN KEY ("screenPageId") REFERENCES "ScreenPage"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenPageScreen" ADD CONSTRAINT "ScreenPageScreen_screenId_fkey" FOREIGN KEY ("screenId") REFERENCES "Screen"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenPage" ADD CONSTRAINT "ScreenPage_jobAdId_fkey" FOREIGN KEY ("jobAdId") REFERENCES "JobAd"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenPage" ADD CONSTRAINT "ScreenPage_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenPage" ADD CONSTRAINT "ScreenPage_eventTagId_fkey" FOREIGN KEY ("eventTagId") REFERENCES "EventTag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenPage" ADD CONSTRAINT "ScreenPage_cmsImageId_fkey" FOREIGN KEY ("cmsImageId") REFERENCES "CmsImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ScreenPage" ADD CONSTRAINT "ScreenPage_cmsParagraphId_fkey" FOREIGN KEY ("cmsParagraphId") REFERENCES "CmsParagraph"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
