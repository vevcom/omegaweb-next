-- AlterTable
ALTER TABLE "User" ADD COLUMN     "vevenMailAddress" TEXT;

-- CreateTable
CREATE TABLE "MailAddress" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "address" TEXT NOT NULL,
    "forwardsToPrivateEmail" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "MailAddress_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MailAddress_address_key" ON "MailAddress"("address");

-- CreateIndex
CREATE UNIQUE INDEX "User_vevenMailAddress_key" ON "User"("vevenMailAddress");

-- Every alias gets the row of its address, before the foreign key below requires one. The users
-- get theirs from the mail worker, since their addresses are on the main domain of the sites,
-- which the database does not know.
INSERT INTO "MailAddress" ("address", "createdAt", "updatedAt")
SELECT "address", "createdAt", CURRENT_TIMESTAMP FROM "MailAlias";

-- AddForeignKey
ALTER TABLE "MailAlias" ADD CONSTRAINT "MailAlias_address_fkey" FOREIGN KEY ("address") REFERENCES "MailAddress"("address") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_vevenMailAddress_fkey" FOREIGN KEY ("vevenMailAddress") REFERENCES "MailAddress"("address") ON DELETE RESTRICT ON UPDATE CASCADE;
