-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MANUAL_CHAT_SPACE_ADMIN';

-- CreateTable
CREATE TABLE "ManualChatSpaceAdmin" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ManualChatSpaceAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ManualChatSpaceAdmin_userId_idx" ON "ManualChatSpaceAdmin"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "ManualChatSpaceAdmin_spaceId_userId_key" ON "ManualChatSpaceAdmin"("spaceId", "userId");

-- AddForeignKey
ALTER TABLE "ManualChatSpaceAdmin" ADD CONSTRAINT "ManualChatSpaceAdmin_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ManualChatSpaceAdmin" ADD CONSTRAINT "ManualChatSpaceAdmin_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
