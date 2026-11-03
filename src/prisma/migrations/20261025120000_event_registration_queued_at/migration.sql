-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN "queuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "EventRegistration" SET "queuedAt" = "createdAt";

-- CreateIndex
CREATE INDEX "EventRegistration_eventId_queuedAt_idx" ON "EventRegistration"("eventId", "queuedAt");
