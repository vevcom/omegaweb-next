-- AlterTable
ALTER TABLE "MailAlias" ADD COLUMN     "hasMailbox" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "mailboxAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MailAlias_mailboxAccountId_key" ON "MailAlias"("mailboxAccountId");

