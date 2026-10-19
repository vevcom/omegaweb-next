-- CreateTable
CREATE TABLE "BrowserPushSubscription" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" INTEGER NOT NULL,
    "pushServiceUrl" TEXT NOT NULL,
    "publicKey" TEXT NOT NULL,
    "authSecret" TEXT NOT NULL,

    CONSTRAINT "BrowserPushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BrowserPushSubscription_pushServiceUrl_key" ON "BrowserPushSubscription"("pushServiceUrl");

-- CreateIndex
CREATE INDEX "BrowserPushSubscription_userId_idx" ON "BrowserPushSubscription"("userId");

-- AddForeignKey
ALTER TABLE "BrowserPushSubscription" ADD CONSTRAINT "BrowserPushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

