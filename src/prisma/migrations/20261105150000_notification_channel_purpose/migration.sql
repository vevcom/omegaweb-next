-- CreateEnum
CREATE TYPE "NotificationChannelPurpose" AS ENUM ('SPECIAL', 'MANUAL');

-- AlterTable
-- Every channel so far is either special or made on the admin pages, so the purpose follows from
-- whether it is special.
ALTER TABLE "NotificationChannel" ADD COLUMN "purpose" "NotificationChannelPurpose";

UPDATE "NotificationChannel"
SET "purpose" = CASE WHEN "special" IS NULL THEN 'MANUAL' ELSE 'SPECIAL' END::"NotificationChannelPurpose";

ALTER TABLE "NotificationChannel" ALTER COLUMN "purpose" SET NOT NULL;
