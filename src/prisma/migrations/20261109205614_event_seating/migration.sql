-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "seatingPublishedAt" TIMESTAMP(3),
ADD COLUMN     "seatingWishesEnd" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "seatLocked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tableId" INTEGER;

-- CreateTable
CREATE TABLE "EventTable" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "seats" INTEGER NOT NULL,

    CONSTRAINT "EventTable_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EventSeatingWish" (
    "registrationId" INTEGER NOT NULL,
    "wishedRegistrationId" INTEGER NOT NULL,
    "rank" INTEGER NOT NULL,

    CONSTRAINT "EventSeatingWish_pkey" PRIMARY KEY ("registrationId","wishedRegistrationId")
);

-- CreateIndex
CREATE UNIQUE INDEX "EventTable_eventId_order_key" ON "EventTable"("eventId", "order");

-- CreateIndex
CREATE INDEX "EventSeatingWish_wishedRegistrationId_idx" ON "EventSeatingWish"("wishedRegistrationId");

-- CreateIndex
CREATE UNIQUE INDEX "EventSeatingWish_registrationId_rank_key" ON "EventSeatingWish"("registrationId", "rank");

-- CreateIndex
CREATE INDEX "EventRegistration_tableId_idx" ON "EventRegistration"("tableId");

-- AddForeignKey
ALTER TABLE "EventTable" ADD CONSTRAINT "EventTable_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeatingWish" ADD CONSTRAINT "EventSeatingWish_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventSeatingWish" ADD CONSTRAINT "EventSeatingWish_wishedRegistrationId_fkey" FOREIGN KEY ("wishedRegistrationId") REFERENCES "EventRegistration"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "EventTable"("id") ON DELETE SET NULL ON UPDATE CASCADE;

