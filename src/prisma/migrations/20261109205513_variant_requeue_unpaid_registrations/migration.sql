-- AlterTable
ALTER TABLE "EventVariant" ADD COLUMN     "requeueUnpaidRegistrations" BOOLEAN NOT NULL DEFAULT false;
