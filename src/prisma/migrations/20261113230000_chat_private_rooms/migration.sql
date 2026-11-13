-- AlterTable
ALTER TABLE "ChatSpaceRoom" ADD COLUMN     "isPrivate" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "ChatSpaceRoomMember" (
    "id" SERIAL NOT NULL,
    "roomId" INTEGER NOT NULL,
    "spaceMemberId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSpaceRoomMember_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ChatSpaceRoomMember_spaceMemberId_idx" ON "ChatSpaceRoomMember"("spaceMemberId");

-- CreateIndex
CREATE UNIQUE INDEX "ChatSpaceRoomMember_roomId_spaceMemberId_key" ON "ChatSpaceRoomMember"("roomId", "spaceMemberId");

-- AddForeignKey
ALTER TABLE "ChatSpaceRoomMember" ADD CONSTRAINT "ChatSpaceRoomMember_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "ChatSpaceRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChatSpaceRoomMember" ADD CONSTRAINT "ChatSpaceRoomMember_spaceMemberId_fkey" FOREIGN KEY ("spaceMemberId") REFERENCES "ChatSpaceMember"("id") ON DELETE CASCADE ON UPDATE CASCADE;
