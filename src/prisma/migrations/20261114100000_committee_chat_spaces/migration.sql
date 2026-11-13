-- AlterTable
ALTER TABLE "Committee" ADD COLUMN     "chatSpaceId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Committee_chatSpaceId_key" ON "Committee"("chatSpaceId");

-- AddForeignKey
ALTER TABLE "Committee" ADD CONSTRAINT "Committee_chatSpaceId_fkey" FOREIGN KEY ("chatSpaceId") REFERENCES "ChatSpace"("id") ON DELETE SET NULL ON UPDATE CASCADE;
