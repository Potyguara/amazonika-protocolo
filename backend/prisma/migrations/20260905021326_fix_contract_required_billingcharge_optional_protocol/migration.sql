/*
  Warnings:

  - Made the column `protocolId` on table `Contract` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BillingCharge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolId" INTEGER,
    "clientId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "createdById" INTEGER,
    "financialTransactionId" INTEGER,
    "provider" TEXT NOT NULL DEFAULT 'BANCO_DO_BRASIL',
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_DOCUMENTO_FISCAL',
    "chargeType" TEXT NOT NULL DEFAULT 'ENTRADA',
    "fiscalMode" TEXT NOT NULL DEFAULT 'NOTA_FISCAL_ANTES',
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "amountCents" INTEGER,
    "dueDate" DATETIME NOT NULL,
    "installmentNumber" INTEGER,
    "totalInstallments" INTEGER,
    "externalId" TEXT,
    "nossoNumero" TEXT,
    "txid" TEXT,
    "pixKey" TEXT,
    "pixCopyPaste" TEXT,
    "pixQrCode" TEXT,
    "boletoUrl" TEXT,
    "linhaDigitavel" TEXT,
    "barcode" TEXT,
    "paidAt" DATETIME,
    "paidAmount" INTEGER,
    "sentToClientAt" DATETIME,
    "documentNumber" TEXT,
    "serialNumber" TEXT,
    "publicToken" TEXT,
    "verificationHash" TEXT,
    "documentPdfPath" TEXT,
    "documentGeneratedAt" DATETIME,
    "paymentConfirmationEmailSentAt" DATETIME,
    "rawRequest" TEXT,
    "rawResponse" TEXT,
    "rawWebhook" TEXT,
    "errorMessage" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingCharge_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillingCharge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillingCharge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillingCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillingCharge_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BillingCharge" ("amount", "amountCents", "barcode", "boletoUrl", "chargeType", "clientId", "contractId", "createdAt", "createdById", "description", "documentGeneratedAt", "documentNumber", "documentPdfPath", "dueDate", "errorMessage", "externalId", "financialTransactionId", "fiscalMode", "id", "installmentNumber", "linhaDigitavel", "nossoNumero", "notes", "paidAmount", "paidAt", "paymentConfirmationEmailSentAt", "pixCopyPaste", "pixKey", "pixQrCode", "protocolId", "provider", "publicToken", "rawRequest", "rawResponse", "rawWebhook", "sentToClientAt", "serialNumber", "status", "totalInstallments", "txid", "updatedAt", "verificationHash") SELECT "amount", "amountCents", "barcode", "boletoUrl", "chargeType", "clientId", "contractId", "createdAt", "createdById", "description", "documentGeneratedAt", "documentNumber", "documentPdfPath", "dueDate", "errorMessage", "externalId", "financialTransactionId", "fiscalMode", "id", "installmentNumber", "linhaDigitavel", "nossoNumero", "notes", "paidAmount", "paidAt", "paymentConfirmationEmailSentAt", "pixCopyPaste", "pixKey", "pixQrCode", "protocolId", "provider", "publicToken", "rawRequest", "rawResponse", "rawWebhook", "sentToClientAt", "serialNumber", "status", "totalInstallments", "txid", "updatedAt", "verificationHash" FROM "BillingCharge";
DROP TABLE "BillingCharge";
ALTER TABLE "new_BillingCharge" RENAME TO "BillingCharge";
CREATE UNIQUE INDEX "BillingCharge_financialTransactionId_key" ON "BillingCharge"("financialTransactionId");
CREATE UNIQUE INDEX "BillingCharge_documentNumber_key" ON "BillingCharge"("documentNumber");
CREATE UNIQUE INDEX "BillingCharge_serialNumber_key" ON "BillingCharge"("serialNumber");
CREATE UNIQUE INDEX "BillingCharge_publicToken_key" ON "BillingCharge"("publicToken");
CREATE INDEX "BillingCharge_protocolId_idx" ON "BillingCharge"("protocolId");
CREATE INDEX "BillingCharge_clientId_idx" ON "BillingCharge"("clientId");
CREATE INDEX "BillingCharge_contractId_idx" ON "BillingCharge"("contractId");
CREATE INDEX "BillingCharge_status_idx" ON "BillingCharge"("status");
CREATE INDEX "BillingCharge_provider_idx" ON "BillingCharge"("provider");
CREATE INDEX "BillingCharge_txid_idx" ON "BillingCharge"("txid");
CREATE INDEX "BillingCharge_externalId_idx" ON "BillingCharge"("externalId");
CREATE TABLE "new_Contract" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolId" INTEGER NOT NULL,
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
    CONSTRAINT "Contract_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Contract_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("clientId", "contractNumber", "contractValue", "createdAt", "createdById", "deadlineDate", "deadlineText", "entryAmount", "generatedPdfPath", "htmlSnapshot", "id", "legalText", "notes", "objectText", "obligationsText", "paymentMode", "paymentText", "proposalId", "protocolId", "publicToken", "sentToClientAt", "signedAt", "signedPdfPath", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerUserAgent", "startDate", "status", "templateType", "title", "updatedAt") SELECT "clientId", "contractNumber", "contractValue", "createdAt", "createdById", "deadlineDate", "deadlineText", "entryAmount", "generatedPdfPath", "htmlSnapshot", "id", "legalText", "notes", "objectText", "obligationsText", "paymentMode", "paymentText", "proposalId", "protocolId", "publicToken", "sentToClientAt", "signedAt", "signedPdfPath", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerUserAgent", "startDate", "status", "templateType", "title", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE UNIQUE INDEX "Contract_publicToken_key" ON "Contract"("publicToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
