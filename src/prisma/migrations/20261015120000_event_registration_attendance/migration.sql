-- AlterTable
ALTER TABLE "EventRegistration" ADD COLUMN     "attendanceRegisteredById" INTEGER,
ADD COLUMN     "attendedAt" TIMESTAMP(3);

-- AddForeignKey
ALTER TABLE "EventRegistration" ADD CONSTRAINT "EventRegistration_attendanceRegisteredById_fkey" FOREIGN KEY ("attendanceRegisteredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
