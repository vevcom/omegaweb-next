-- AlterEnum
ALTER TYPE "SpecialNotificationChannel" ADD VALUE 'CHAT_DIRECT_AND_GROUP';

-- AlterTable
ALTER TABLE "ChatRoomMessage" ADD COLUMN     "standaloneMatrixRoomId" TEXT,
ALTER COLUMN "roomId" DROP NOT NULL;
