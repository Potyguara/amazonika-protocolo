-- CreateTable
CREATE TABLE "ContractPaymentSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "installmentNumber" INTEGER NOT NULL,
    "totalInstallments" INTEGER,
    "amountCents" INTEGER NOT NULL,
    "dueDate" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractPaymentSchedule_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ContractPaymentSchedule_contractId_idx" ON "ContractPaymentSchedule"("contractId");

-- CreateIndex
CREATE INDEX "ContractPaymentSchedule_dueDate_idx" ON "ContractPaymentSchedule"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "ContractPaymentSchedule_contractId_type_installmentNumber_key" ON "ContractPaymentSchedule"("contractId", "type", "installmentNumber");
