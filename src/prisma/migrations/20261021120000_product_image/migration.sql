-- AlterTable
ALTER TABLE "Product" ADD COLUMN "imageId" INTEGER;

-- Every existing product gets an empty cms image, as a new one does when it is created.
DO $$
DECLARE
    product_row RECORD;
    new_image_id INTEGER;
BEGIN
    FOR product_row IN SELECT "id" FROM "Product" LOOP
        INSERT INTO "CmsImage" ("name", "updatedAt")
        VALUES (gen_random_uuid()::text, CURRENT_TIMESTAMP)
        RETURNING "id" INTO new_image_id;
        UPDATE "Product" SET "imageId" = new_image_id WHERE "id" = product_row."id";
    END LOOP;
END $$;

ALTER TABLE "Product" ALTER COLUMN "imageId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Product_imageId_key" ON "Product"("imageId");

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_imageId_fkey" FOREIGN KEY ("imageId") REFERENCES "CmsImage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
