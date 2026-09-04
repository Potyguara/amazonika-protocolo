-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinancialTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "type" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "competenceMonth" TEXT,
    "clientName" TEXT,
    "notes" TEXT,
    "clientId" INTEGER,
    "protocolId" INTEGER,
    "installmentGroupId" TEXT,
    "installmentNumber" INTEGER,
    "totalInstallments" INTEGER,
    "categoryId" INTEGER,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "autoChargeEnabled" BOOLEAN NOT NULL DEFAULT false,
    "paymentProvider" TEXT,
    "providerChargeId" TEXT,
    "providerTxId" TEXT,
    "chargeStatus" TEXT,
    "chargeCreatedAt" DATETIME,
    "chargeExpiresAt" DATETIME,
    "paymentConfirmedAt" DATETIME,
    "lastNotificationAt" DATETIME,
    "notificationCount" INTEGER NOT NULL DEFAULT 0,
    "webhookLastReceivedAt" DATETIME,
    CONSTRAINT "FinancialTransaction_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialTransaction" ("amount", "categoryId", "clientId", "clientName", "competenceMonth", "createdAt", "createdById", "description", "dueDate", "id", "installmentGroupId", "installmentNumber", "notes", "paidAt", "protocolId", "source", "status", "totalInstallments", "type", "updatedAt") SELECT "amount", "categoryId", "clientId", "clientName", "competenceMonth", "createdAt", "createdById", "description", "dueDate", "id", "installmentGroupId", "installmentNumber", "notes", "paidAt", "protocolId", "source", "status", "totalInstallments", "type", "updatedAt" FROM "FinancialTransaction";
DROP TABLE "FinancialTransaction";
ALTER TABLE "new_FinancialTransaction" RENAME TO "FinancialTransaction";
CREATE INDEX "FinancialTransaction_clientId_idx" ON "FinancialTransaction"("clientId");
CREATE INDEX "FinancialTransaction_installmentGroupId_idx" ON "FinancialTransaction"("installmentGroupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
