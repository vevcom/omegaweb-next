/*
  Warnings:

  - You are about to drop the `QueuedWeeklyNotification` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "QueuedWeeklyNotification" DROP CONSTRAINT "QueuedWeeklyNotification_notificationId_fkey";

-- DropForeignKey
ALTER TABLE "QueuedWeeklyNotification" DROP CONSTRAINT "QueuedWeeklyNotification_userId_fkey";

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "emailDispatchStartedAt" TIMESTAMP(3),
ADD COLUMN     "emailDispatchedAt" TIMESTAMP(3),
ADD COLUMN     "emailWeeklyDispatchedAt" TIMESTAMP(3),
ADD COLUMN     "visibilityId" INTEGER;

-- DropTable
DROP TABLE "QueuedWeeklyNotification";

-- CreateTable
CREATE TABLE "WeeklyMailOutboxEntry" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "notificationId" INTEGER NOT NULL,

    CONSTRAINT "WeeklyMailOutboxEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_NotificationTargets" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,

    CONSTRAINT "_NotificationTargets_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "WeeklyMailOutboxEntry_userId_notificationId_key" ON "WeeklyMailOutboxEntry"("userId", "notificationId");

-- CreateIndex
CREATE INDEX "_NotificationTargets_B_index" ON "_NotificationTargets"("B");

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_visibilityId_fkey" FOREIGN KEY ("visibilityId") REFERENCES "Visibility"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMailOutboxEntry" ADD CONSTRAINT "WeeklyMailOutboxEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WeeklyMailOutboxEntry" ADD CONSTRAINT "WeeklyMailOutboxEntry_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NotificationTargets" ADD CONSTRAINT "_NotificationTargets_A_fkey" FOREIGN KEY ("A") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_NotificationTargets" ADD CONSTRAINT "_NotificationTargets_B_fkey" FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Notifications that exist before this migration were dispatched at create time by the old
-- system. Mark them dispatched so the worker does not re-send the entire history on first boot.
UPDATE "Notification" SET "emailDispatchedAt" = "createdAt", "emailWeeklyDispatchedAt" = "createdAt";
