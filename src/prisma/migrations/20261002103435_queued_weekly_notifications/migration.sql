-- CreateTable
CREATE TABLE "QueuedWeeklyNotification" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER NOT NULL,
    "notificationId" INTEGER NOT NULL,

    CONSTRAINT "QueuedWeeklyNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QueuedWeeklyNotification_userId_notificationId_key" ON "QueuedWeeklyNotification"("userId", "notificationId");

-- AddForeignKey
ALTER TABLE "QueuedWeeklyNotification" ADD CONSTRAINT "QueuedWeeklyNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QueuedWeeklyNotification" ADD CONSTRAINT "QueuedWeeklyNotification_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "Notification"("id") ON DELETE CASCADE ON UPDATE CASCADE;
