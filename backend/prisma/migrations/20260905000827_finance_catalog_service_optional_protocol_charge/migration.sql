-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Contract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "proposalId" INTEGER,
    "createdById" INTEGER,
    "contractNumber" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "templateType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'GERADO',
    "contractValue" REAL,
    "entryAmount" INTEGER,
    "paymentMode" TEXT,
    "title" TEXT,
    "objectText" TEXT,
    "obligationsText" TEXT,
    "paymentText" TEXT,
    "deadlineText" TEXT,
    "legalText" TEXT,
    "htmlSnapshot" TEXT,
    "generatedPdfPath" TEXT,
    "signedPdfPath" TEXT,
    "sentToClientAt" DATETIME,
    "signedAt" DATETIME,
    "signerName" TEXT,
    "signerCpfCnpj" TEXT,
    "signerEmail" TEXT,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,
    "startDate" DATETIME,
    "deadlineDate" DATETIME,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Contract_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("clientId", "contractNumber", "contractValue", "createdAt", "createdById", "deadlineDate", "deadlineText", "entryAmount", "generatedPdfPath", "htmlSnapshot", "id", "legalText", "notes", "objectText", "obligationsText", "paymentMode", "paymentText", "proposalId", "protocolId", "publicToken", "sentToClientAt", "signedAt", "signedPdfPath", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerUserAgent", "startDate", "status", "templateType", "title", "updatedAt") SELECT "clientId", "contractNumber", "contractValue", "createdAt", "createdById", "deadlineDate", "deadlineText", "entryAmount", "generatedPdfPath", "htmlSnapshot", "id", "legalText", "notes", "objectText", "obligationsText", "paymentMode", "paymentText", "proposalId", "protocolId", "publicToken", "sentToClientAt", "signedAt", "signedPdfPath", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerUserAgent", "startDate", "status", "templateType", "title", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE UNIQUE INDEX "Contract_publicToken_key" ON "Contract"("publicToken");
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
    "catalogServiceId" INTEGER,
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
    CONSTRAINT "FinancialTransaction_catalogServiceId_fkey" FOREIGN KEY ("catalogServiceId") REFERENCES "CatalogService" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FinancialCategory" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FinancialTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_FinancialTransaction" ("amount", "autoChargeEnabled", "categoryId", "chargeCreatedAt", "chargeExpiresAt", "chargeStatus", "clientId", "clientName", "competenceMonth", "createdAt", "createdById", "description", "dueDate", "id", "installmentGroupId", "installmentNumber", "lastNotificationAt", "notes", "notificationCount", "paidAt", "paymentConfirmedAt", "paymentProvider", "protocolId", "providerChargeId", "providerTxId", "source", "status", "totalInstallments", "type", "updatedAt", "webhookLastReceivedAt") SELECT "amount", "autoChargeEnabled", "categoryId", "chargeCreatedAt", "chargeExpiresAt", "chargeStatus", "clientId", "clientName", "competenceMonth", "createdAt", "createdById", "description", "dueDate", "id", "installmentGroupId", "installmentNumber", "lastNotificationAt", "notes", "notificationCount", "paidAt", "paymentConfirmedAt", "paymentProvider", "protocolId", "providerChargeId", "providerTxId", "source", "status", "totalInstallments", "type", "updatedAt", "webhookLastReceivedAt" FROM "FinancialTransaction";
DROP TABLE "FinancialTransaction";
ALTER TABLE "new_FinancialTransaction" RENAME TO "FinancialTransaction";
CREATE INDEX "FinancialTransaction_clientId_idx" ON "FinancialTransaction"("clientId");
CREATE INDEX "FinancialTransaction_catalogServiceId_idx" ON "FinancialTransaction"("catalogServiceId");
CREATE INDEX "FinancialTransaction_installmentGroupId_idx" ON "FinancialTransaction"("installmentGroupId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
