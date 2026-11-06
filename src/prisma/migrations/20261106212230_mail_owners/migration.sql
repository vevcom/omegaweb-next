-- Aliases and mailing lists get an owner: a visibility whoever passes may see and wire them.
-- Those that exist get one requirement with no conditions, which no one passes, so only holders of
-- MAILSERVER_ADMIN own them until they hand them to a group. A visibility with no requirements at
-- all would instead hand them to everyone.
BEGIN;

-- AlterEnum
ALTER TYPE "Permission" ADD VALUE 'MAIL_ALIAS_CREATE';
ALTER TYPE "Permission" ADD VALUE 'MAIL_LIST_CREATE';

-- AlterTable
ALTER TABLE "MailAlias" ADD COLUMN     "ownerVisibilityId" INTEGER;
ALTER TABLE "MailingList" ADD COLUMN     "ownerVisibilityId" INTEGER;

DO $$
DECLARE
    row RECORD;
    visibility_id INTEGER;
BEGIN
    FOR row IN SELECT "id" FROM "MailAlias" LOOP
        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO visibility_id;
        INSERT INTO "VisibilityRequirement" ("ownerVisibilityId") VALUES (visibility_id);
        UPDATE "MailAlias" SET "ownerVisibilityId" = visibility_id WHERE "id" = row."id";
    END LOOP;
    FOR row IN SELECT "id" FROM "MailingList" LOOP
        INSERT INTO "Visibility" ("updatedAt") VALUES (CURRENT_TIMESTAMP) RETURNING "id" INTO visibility_id;
        INSERT INTO "VisibilityRequirement" ("ownerVisibilityId") VALUES (visibility_id);
        UPDATE "MailingList" SET "ownerVisibilityId" = visibility_id WHERE "id" = row."id";
    END LOOP;
END $$;

ALTER TABLE "MailAlias" ALTER COLUMN "ownerVisibilityId" SET NOT NULL;
ALTER TABLE "MailingList" ALTER COLUMN "ownerVisibilityId" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "MailAlias_ownerVisibilityId_key" ON "MailAlias"("ownerVisibilityId");

-- CreateIndex
CREATE UNIQUE INDEX "MailingList_ownerVisibilityId_key" ON "MailingList"("ownerVisibilityId");

-- AddForeignKey
ALTER TABLE "MailAlias" ADD CONSTRAINT "MailAlias_ownerVisibilityId_fkey" FOREIGN KEY ("ownerVisibilityId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MailingList" ADD CONSTRAINT "MailingList_ownerVisibilityId_fkey" FOREIGN KEY ("ownerVisibilityId") REFERENCES "Visibility"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
