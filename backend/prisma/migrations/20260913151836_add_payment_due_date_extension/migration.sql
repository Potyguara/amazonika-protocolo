-- CreateTable
CREATE TABLE "PaymentDueDateExtension" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractId" INTEGER NOT NULL,
    "contractPaymentScheduleId" INTEGER NOT NULL,
    "billingChargeId" INTEGER,
    "previousDueDate" DATETIME NOT NULL,
    "newDueDate" DATETIME NOT NULL,
    "justification" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ATIVA',
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "cancelledAt" DATETIME,
    "cancelledById" INTEGER,
    "cancellationReason" TEXT,
    CONSTRAINT "PaymentDueDateExtension_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentDueDateExtension_contractPaymentScheduleId_fkey" FOREIGN KEY ("contractPaymentScheduleId") REFERENCES "ContractPaymentSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PaymentDueDateExtension_billingChargeId_fkey" FOREIGN KEY ("billingChargeId") REFERENCES "BillingCharge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentDueDateExtension_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PaymentDueDateExtension_cancelledById_fkey" FOREIGN KEY ("cancelledById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "PaymentDueDateExtension_contractId_idx" ON "PaymentDueDateExtension"("contractId");

-- CreateIndex
CREATE INDEX "PaymentDueDateExtension_contractPaymentScheduleId_idx" ON "PaymentDueDateExtension"("contractPaymentScheduleId");

-- CreateIndex
CREATE INDEX "PaymentDueDateExtension_billingChargeId_idx" ON "PaymentDueDateExtension"("billingChargeId");

-- CreateIndex
CREATE INDEX "PaymentDueDateExtension_status_idx" ON "PaymentDueDateExtension"("status");

-- CreateIndex
CREATE INDEX "PaymentDueDateExtension_newDueDate_idx" ON "PaymentDueDateExtension"("newDueDate");
