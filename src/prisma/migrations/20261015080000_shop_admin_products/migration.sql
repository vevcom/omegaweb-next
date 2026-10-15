-- The product catalogue is administered with SHOP_ADMIN: PRODUCT_ADMIN and PRODUCT_USE go, and
-- the grants of them with them (not turned into SHOP_ADMIN, which would hand whoever held them
-- every shop). Products get a suggested price for the next shop to connect them at.
BEGIN;

DELETE FROM "GroupPermission" WHERE "permission" IN ('PRODUCT_USE', 'PRODUCT_ADMIN');
DELETE FROM "DefaultPermission" WHERE "permission" IN ('PRODUCT_USE', 'PRODUCT_ADMIN');
DELETE FROM "Notification" WHERE "permission" IN ('PRODUCT_USE', 'PRODUCT_ADMIN');

-- AlterEnum: rebuilt from the values the enum holds now, minus the two, so values added by
-- migrations that sort before this one are kept whichever order they were applied in.
DO $$
DECLARE kept text;
BEGIN
    SELECT string_agg(quote_literal(enumlabel), ', ' ORDER BY enumsortorder) INTO kept
    FROM pg_enum
    WHERE enumtypid = '"Permission"'::regtype AND enumlabel NOT IN ('PRODUCT_USE', 'PRODUCT_ADMIN');
    EXECUTE format('CREATE TYPE "Permission_new" AS ENUM (%s)', kept);
END $$;
ALTER TABLE "ApiKey" ALTER COLUMN "permissions" TYPE "Permission_new"[]
    USING (array_remove(array_remove("permissions"::text[], 'PRODUCT_USE'), 'PRODUCT_ADMIN')::"Permission_new"[]);
ALTER TABLE "Notification" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "GroupPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TABLE "DefaultPermission" ALTER COLUMN "permission" TYPE "Permission_new" USING ("permission"::text::"Permission_new");
ALTER TYPE "Permission" RENAME TO "Permission_old";
ALTER TYPE "Permission_new" RENAME TO "Permission";
DROP TYPE "Permission_old";

-- AlterTable
ALTER TABLE "Product" ADD COLUMN "suggestedPrice" INTEGER;

COMMIT;
