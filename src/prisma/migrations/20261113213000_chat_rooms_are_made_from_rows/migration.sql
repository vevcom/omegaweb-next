-- A row was the record of a room taken in from the chat, and has no name to make a room from.
DELETE FROM "ChatSpaceRoom";

-- AlterTable
ALTER TABLE "ChatSpaceRoom" ADD COLUMN     "destroyedAt" TIMESTAMP(3),
ADD COLUMN     "name" TEXT NOT NULL,
ALTER COLUMN "matrixRoomId" DROP NOT NULL;
