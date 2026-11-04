-- AlterTable
ALTER TABLE "Notification" ADD COLUMN "canRegisterForEventId" INTEGER;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_canRegisterForEventId_fkey" FOREIGN KEY ("canRegisterForEventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;
