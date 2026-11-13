-- CreateEnum
CREATE TYPE "ChatSpacePurpose" AS ENUM ('COMMITTEE', 'MANUAL');

-- DropForeignKey
ALTER TABLE "ChatUser" DROP CONSTRAINT "ChatUser_userId_fkey";

-- AlterTable
ALTER TABLE "ChatUser" ADD COLUMN     "deactivatedAt" TIMESTAMP(3),
ADD COLUMN     "syncedName" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateTable
CREATE TABLE "ChatSpace" (
    "id" SERIAL NOT NULL,
    "purpose" "ChatSpacePurpose" NOT NULL,
    "name" TEXT NOT NULL,
    "matrixRoomId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "destroyedAt" TIMESTAMP(3),

    CONSTRAINT "ChatSpace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChatSpaceMember" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "chatUserId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSpaceMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSpace_matrixRoomId_key" ON "ChatSpace"("matrixRoomId");

-- CreateIndex
CREATE INDEX "ChatSpaceMember_chatUserId_idx" ON "ChatSpaceMember"("chatUserId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSpaceMember_spaceId_chatUserId_key" ON "ChatSpaceMember"("spaceId", "chatUserId");

-- AddForeignKey
ALTER TABLE "ChatUser" ADD CONSTRAINT "ChatUser_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSpaceMember" ADD CONSTRAINT "ChatSpaceMember_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSpaceMember" ADD CONSTRAINT "ChatSpaceMember_chatUserId_fkey" FOREIGN KEY ("chatUserId") REFERENCES "ChatUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
