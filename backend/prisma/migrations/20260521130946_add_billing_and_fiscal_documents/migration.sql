-- CreateTable
CREATE TABLE "BillingCharge" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "createdById" INTEGER,
    "provider" TEXT NOT NULL DEFAULT 'BANCO_DO_BRASIL',
    "status" TEXT NOT NULL DEFAULT 'AGUARDANDO_DOCUMENTO_FISCAL',
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

-- CreateTable
CREATE TABLE "FiscalDocument" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "billingChargeId" INTEGER,
    "createdById" INTEGER,
    "type" TEXT NOT NULL,
    "moment" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ANEXADO',
    "number" TEXT,
    "issuedAt" DATETIME,
    "amount" INTEGER,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "mimeType" TEXT,
    "size" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FiscalDocument_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FiscalDocument_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FiscalDocument_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FiscalDocument_billingChargeId_fkey" FOREIGN KEY ("billingChargeId") REFERENCES "BillingCharge" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "FiscalDocument_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "BillingCharge_protocolId_idx" ON "BillingCharge"("protocolId");

-- CreateIndex
CREATE INDEX "BillingCharge_clientId_idx" ON "BillingCharge"("clientId");

-- CreateIndex
CREATE INDEX "BillingCharge_contractId_idx" ON "BillingCharge"("contractId");

-- CreateIndex
CREATE INDEX "BillingCharge_status_idx" ON "BillingCharge"("status");

-- CreateIndex
CREATE INDEX "BillingCharge_provider_idx" ON "BillingCharge"("provider");

-- CreateIndex
CREATE INDEX "BillingCharge_txid_idx" ON "BillingCharge"("txid");

-- CreateIndex
CREATE INDEX "BillingCharge_externalId_idx" ON "BillingCharge"("externalId");

-- CreateIndex
CREATE INDEX "FiscalDocument_protocolId_idx" ON "FiscalDocument"("protocolId");

-- CreateIndex
CREATE INDEX "FiscalDocument_clientId_idx" ON "FiscalDocument"("clientId");

-- CreateIndex
CREATE INDEX "FiscalDocument_contractId_idx" ON "FiscalDocument"("contractId");

-- CreateIndex
CREATE INDEX "FiscalDocument_billingChargeId_idx" ON "FiscalDocument"("billingChargeId");

-- CreateIndex
CREATE INDEX "FiscalDocument_type_idx" ON "FiscalDocument"("type");

-- CreateIndex
CREATE INDEX "FiscalDocument_moment_idx" ON "FiscalDocument"("moment");
