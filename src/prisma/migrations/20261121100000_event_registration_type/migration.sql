-- CreateEnum
CREATE TYPE "EventRegistrationType" AS ENUM ('LIST', 'SLOTTED');

-- AlterTable
ALTER TABLE "EventVariant" ADD COLUMN     "registrationType" "EventRegistrationType" NOT NULL DEFAULT 'LIST';
