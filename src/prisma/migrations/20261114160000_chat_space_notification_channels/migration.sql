-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationChannelPurpose" ADD VALUE 'CHAT_SPACE_MENTIONS';
ALTER TYPE "NotificationChannelPurpose" ADD VALUE 'CHAT_SPACE_ALL';

-- AlterEnum
ALTER TYPE "SpecialNotificationChannel" ADD VALUE 'CHAT';

-- AlterTable
ALTER TABLE "ChatSpace" ADD COLUMN     "allNotificationChannelId" INTEGER NOT NULL,
ADD COLUMN     "mentionsNotificationChannelId" INTEGER NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "ChatSpace_mentionsNotificationChannelId_key" ON "ChatSpace"("mentionsNotificationChannelId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSpace_allNotificationChannelId_key" ON "ChatSpace"("allNotificationChannelId");

-- AddForeignKey
ALTER TABLE "ChatSpace" ADD CONSTRAINT "ChatSpace_mentionsNotificationChannelId_fkey" FOREIGN KEY ("mentionsNotificationChannelId") REFERENCES "NotificationChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSpace" ADD CONSTRAINT "ChatSpace_allNotificationChannelId_fkey" FOREIGN KEY ("allNotificationChannelId") REFERENCES "NotificationChannel"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
