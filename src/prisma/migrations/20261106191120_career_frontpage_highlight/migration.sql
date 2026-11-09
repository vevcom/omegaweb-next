-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'CAREER_FRONTPAGE_HIGHLIGHT_ADMIN';

-- CreateTable
CREATE TABLE "CareerFrontpageHighlight" (
    "id" SERIAL NOT NULL,
    "eventId" INTEGER,
    "jobAdId" INTEGER,
    "start" TIMESTAMP(3) NOT NULL,
    "end" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CareerFrontpageHighlight_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "CareerFrontpageHighlight_target_check" CHECK (num_nonnulls("eventId", "jobAdId") = 1),
    CONSTRAINT "CareerFrontpageHighlight_period_check" CHECK ("start" < "end")
);

-- AddForeignKey
ALTER TABLE "CareerFrontpageHighlight" ADD CONSTRAINT "CareerFrontpageHighlight_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CareerFrontpageHighlight" ADD CONSTRAINT "CareerFrontpageHighlight_jobAdId_fkey" FOREIGN KEY ("jobAdId") REFERENCES "JobAd"("id") ON DELETE CASCADE ON UPDATE CASCADE;
