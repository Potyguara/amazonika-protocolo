/*
  Warnings:

  - Made the column `installmentNumber` on table `ProposalPaymentSchedule` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ProposalPaymentSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "totalInstallments" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProposalPaymentSchedule_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_ProposalPaymentSchedule" ("amountCents", "createdAt", "dueDate", "id", "installmentNumber", "proposalId", "totalInstallments", "type", "updatedAt") SELECT "amountCents", "createdAt", "dueDate", "id", "installmentNumber", "proposalId", "totalInstallments", "type", "updatedAt" FROM "ProposalPaymentSchedule";
DROP TABLE "ProposalPaymentSchedule";
ALTER TABLE "new_ProposalPaymentSchedule" RENAME TO "ProposalPaymentSchedule";
CREATE INDEX "ProposalPaymentSchedule_proposalId_idx" ON "ProposalPaymentSchedule"("proposalId");
CREATE INDEX "ProposalPaymentSchedule_dueDate_idx" ON "ProposalPaymentSchedule"("dueDate");
CREATE UNIQUE INDEX "ProposalPaymentSchedule_proposalId_installmentNumber_key" ON "ProposalPaymentSchedule"("proposalId", "installmentNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
