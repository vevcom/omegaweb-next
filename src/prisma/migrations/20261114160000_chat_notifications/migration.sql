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

-- CreateTable
CREATE TABLE "ChatRoomMessage" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "matrixEventId" TEXT NOT NULL,
    "senderMatrixId" TEXT NOT NULL,
    "mentionedMatrixIds" TEXT[],
    "mentionsRoom" BOOLEAN NOT NULL DEFAULT false,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "notifiedAt" TIMESTAMP(3),

    CONSTRAINT "ChatRoomMessage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatRoomMessage_matrixEventId_key" ON "ChatRoomMessage"("matrixEventId");

-- CreateIndex
CREATE INDEX "ChatRoomMessage_notifiedAt_idx" ON "ChatRoomMessage"("notifiedAt");

-- AddForeignKey
ALTER TABLE "ChatRoomMessage" ADD CONSTRAINT "ChatRoomMessage_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatSpaceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;
