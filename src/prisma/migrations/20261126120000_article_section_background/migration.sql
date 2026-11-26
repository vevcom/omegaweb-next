-- CreateEnum
CREATE TYPE "SectionBackground" AS ENUM ('NONE', 'BASE_100', 'BASE_200', 'BASE_300');

-- AlterTable
ALTER TABLE "ArticleSection" ADD COLUMN     "background" "SectionBackground" NOT NULL DEFAULT 'NONE';

