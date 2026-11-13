-- CreateTable
CREATE TABLE "ChatSpaceRoom" (
    "id" SERIAL NOT NULL,
    "spaceId" INTEGER NOT NULL,
    "matrixRoomId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatSpaceRoom_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ChatSpaceRoom_matrixRoomId_key" ON "ChatSpaceRoom"("matrixRoomId");

-- CreateIndex
CREATE INDEX "ChatSpaceRoom_spaceId_idx" ON "ChatSpaceRoom"("spaceId");

-- AddForeignKey
ALTER TABLE "ChatSpaceRoom" ADD CONSTRAINT "ChatSpaceRoom_spaceId_fkey" FOREIGN KEY ("spaceId") REFERENCES "ChatSpace"("id") ON DELETE CASCADE ON UPDATE CASCADE;
