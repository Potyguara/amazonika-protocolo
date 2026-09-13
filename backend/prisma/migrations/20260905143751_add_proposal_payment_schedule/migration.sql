-- CreateTable
CREATE TABLE "ProposalPaymentSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "installmentNumber" INTEGER,
    "totalInstallments" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProposalPaymentSchedule_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ProposalPaymentSchedule_proposalId_idx" ON "ProposalPaymentSchedule"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalPaymentSchedule_dueDate_idx" ON "ProposalPaymentSchedule"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProposalPaymentSchedule_proposalId_type_installmentNumber_key" ON "ProposalPaymentSchedule"("proposalId", "type", "installmentNumber");
