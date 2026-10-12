-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Permission" ADD VALUE 'BULLSHIT_WRITE';
ALTER TYPE "Permission" ADD VALUE 'BULLSHIT_USE';

-- CreateTable
CREATE TABLE "Bullshit" (
    "id" SERIAL NOT NULL,
    "quote" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bullshitPosterId" INTEGER NOT NULL,

    CONSTRAINT "Bullshit_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Bullshit" ADD CONSTRAINT "Bullshit_bullshitPosterId_fkey" FOREIGN KEY ("bullshitPosterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
