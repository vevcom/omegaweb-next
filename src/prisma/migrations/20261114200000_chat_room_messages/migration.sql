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
