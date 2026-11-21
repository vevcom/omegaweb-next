-- AlterEnum
ALTER TYPE "SpecialCollection" ADD VALUE 'CHATPROFILEIMAGES';

-- AlterTable
ALTER TABLE "ChatUser" ADD COLUMN     "imageId" INTEGER,
ADD COLUMN     "syncedImageId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "ChatUser_imageId_key" ON "ChatUser"("imageId");

-- AddForeignKey
ALTER TABLE "ChatUser" ADD CONSTRAINT "ChatUser_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "Image"("id") ON DELETE SET NULL ON UPDATE CASCADE;
