-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "companyPresentationId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "Event_companyPresentationId_key" ON "Event"("companyPresentationId");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_companyPresentationId_fkey" FOREIGN KEY ("companyPresentationId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

