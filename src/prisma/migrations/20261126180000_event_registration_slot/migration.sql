-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "slotId" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "EventRegistration_slotId_key" ON "EventRegistration"("slotId");

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_slotId_fkey" FOREIGN KEY ("slotId") REFERENCES "EventSlot"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- A registration on the waiting list waits for any slot and holds none.
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_slot_state_check" CHECK (
    "slotId" IS NULL OR "state" = 'IN_QUOTA'
);
