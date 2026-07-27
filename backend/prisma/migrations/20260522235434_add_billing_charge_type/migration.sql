-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_BillingCharge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "createdById" INTEGER,
    "provider" TEXT NOT NULL DEFAULT 'BANCO_DO_BRASIL',
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_DOCUMENTO_FISCAL',
    "chargeType" TEXT NOT NULL DEFAULT 'ENTRADA',
    "fiscalMode" TEXT NOT NULL DEFAULT 'NOTA_FISCAL_ANTES',
    "description" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
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
    "rawRequest" TEXT,
    "rawResponse" TEXT,
    "rawWebhook" TEXT,
    "errorMessage" TEXT,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "BillingCharge_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillingCharge_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "BillingCharge_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "BillingCharge_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_BillingCharge" ("amount", "barcode", "boletoUrl", "clientId", "contractId", "createdAt", "createdById", "description", "dueDate", "errorMessage", "externalId", "fiscalMode", "id", "installmentNumber", "linhaDigitavel", "nossoNumero", "notes", "paidAmount", "paidAt", "pixCopyPaste", "pixKey", "pixQrCode", "protocolId", "provider", "rawRequest", "rawResponse", "rawWebhook", "sentToClientAt", "status", "totalInstallments", "txid", "updatedAt") SELECT "amount", "barcode", "boletoUrl", "clientId", "contractId", "createdAt", "createdById", "description", "dueDate", "errorMessage", "externalId", "fiscalMode", "id", "installmentNumber", "linhaDigitavel", "nossoNumero", "notes", "paidAmount", "paidAt", "pixCopyPaste", "pixKey", "pixQrCode", "protocolId", "provider", "rawRequest", "rawResponse", "rawWebhook", "sentToClientAt", "status", "totalInstallments", "txid", "updatedAt" FROM "BillingCharge";
DROP TABLE "BillingCharge";
ALTER TABLE "new_BillingCharge" RENAME TO "BillingCharge";
CREATE INDEX "BillingCharge_protocolId_idx" ON "BillingCharge"("protocolId");
CREATE INDEX "BillingCharge_clientId_idx" ON "BillingCharge"("clientId");
CREATE INDEX "BillingCharge_contractId_idx" ON "BillingCharge"("contractId");
CREATE INDEX "BillingCharge_status_idx" ON "BillingCharge"("status");
CREATE INDEX "BillingCharge_provider_idx" ON "BillingCharge"("provider");
CREATE INDEX "BillingCharge_txid_idx" ON "BillingCharge"("txid");
CREATE INDEX "BillingCharge_externalId_idx" ON "BillingCharge"("externalId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
