-- AlterTable
ALTER TABLE "MailAlias" ADD COLUMN     "mailboxAccountId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "MailAlias_mailboxAccountId_key" ON "MailAlias"("mailboxAccountId");

