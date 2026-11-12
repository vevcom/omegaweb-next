-- AlterTable
ALTER TABLE "CompanyUser" ADD COLUMN     "emailVerified" TIMESTAMP(3),
ADD COLUMN     "sessionEpoch" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "CompanyUserCredentials" (
    "companyUserId" INTEGER NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "credentialsUpdatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CompanyUserCredentials_pkey" PRIMARY KEY ("companyUserId")
);

-- AddForeignKey
ALTER TABLE "CompanyUserCredentials" ADD CONSTRAINT "CompanyUserCredentials_companyUserId_fkey" FOREIGN KEY ("companyUserId") REFERENCES "CompanyUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
