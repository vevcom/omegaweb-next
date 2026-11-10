-- CreateEnum
CREATE TYPE "StoreFilePurpose" AS ENUM ('OMBUL', 'ORIGINAL_IMAGE', 'CACHE_IMAGE');

-- CreateEnum
CREATE TYPE "StoreFileLocation" AS ENUM ('S3', 'VOLUME');

-- CreateTable
CREATE TABLE "StoreFile" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "purpose" "StoreFilePurpose" NOT NULL,
    "location" "StoreFileLocation" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoreFile_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StoreFile_name_key" ON "StoreFile"("name");

-- CreateIndex
CREATE INDEX "StoreFile_purpose_location_idx" ON "StoreFile"("purpose", "location");

-- Every file a row refers to gets its StoreFile, before the foreign keys below require one. The
-- files are said to be in the bucket, which is where production has them all. Where they are on
-- the volume instead, as in development, the store finds them there, and the first run of the
-- store's workers corrects the rows.
INSERT INTO "StoreFile" ("name", "purpose", "location", "createdAt")
SELECT "fsLocation", 'OMBUL', 'S3', "createdAt" FROM "Ombul";

INSERT INTO "StoreFile" ("name", "purpose", "location", "createdAt")
SELECT "fsLocationOriginal", 'ORIGINAL_IMAGE', 'S3', "createdAt" FROM "Image";

INSERT INTO "StoreFile" ("name", "purpose", "location", "createdAt")
SELECT "variant"."name", 'CACHE_IMAGE', 'S3', "files"."createdAt"
FROM "ProcessedImageFiles" AS "files"
CROSS JOIN LATERAL (VALUES
    ("files"."fsLocationMicroSize"),
    ("files"."fsLocationTinySize"),
    ("files"."fsLocationSmallSize"),
    ("files"."fsLocationMediumSize"),
    ("files"."fsLocationLargeSize"),
    ("files"."fsLocationHugeSize")
) AS "variant" ("name")
WHERE "variant"."name" IS NOT NULL;

-- AddForeignKey
ALTER TABLE "Image" ADD CONSTRAINT "Image_fsLocationOriginal_fkey" FOREIGN KEY ("fsLocationOriginal") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedImageFiles" ADD CONSTRAINT "ProcessedImageFiles_fsLocationMicroSize_fkey" FOREIGN KEY ("fsLocationMicroSize") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedImageFiles" ADD CONSTRAINT "ProcessedImageFiles_fsLocationTinySize_fkey" FOREIGN KEY ("fsLocationTinySize") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedImageFiles" ADD CONSTRAINT "ProcessedImageFiles_fsLocationSmallSize_fkey" FOREIGN KEY ("fsLocationSmallSize") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedImageFiles" ADD CONSTRAINT "ProcessedImageFiles_fsLocationMediumSize_fkey" FOREIGN KEY ("fsLocationMediumSize") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedImageFiles" ADD CONSTRAINT "ProcessedImageFiles_fsLocationLargeSize_fkey" FOREIGN KEY ("fsLocationLargeSize") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProcessedImageFiles" ADD CONSTRAINT "ProcessedImageFiles_fsLocationHugeSize_fkey" FOREIGN KEY ("fsLocationHugeSize") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ombul" ADD CONSTRAINT "Ombul_fsLocation_fkey" FOREIGN KEY ("fsLocation") REFERENCES "StoreFile"("name") ON DELETE RESTRICT ON UPDATE CASCADE;
