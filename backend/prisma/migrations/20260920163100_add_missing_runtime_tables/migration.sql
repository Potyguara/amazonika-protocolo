-- CreateTable
CREATE TABLE "FinanceAutoChargeSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "issueDaysBeforeDue" INTEGER NOT NULL DEFAULT 7,
    "firstNoticeDaysBeforeDue" INTEGER NOT NULL DEFAULT 5,
    "secondNoticeDaysBeforeDue" INTEGER NOT NULL DEFAULT 2,
    "sendDueDateNotice" BOOLEAN NOT NULL DEFAULT true,
    "overdueNoticeDaysAfterDue" INTEGER NOT NULL DEFAULT 1,
    "overdueNoticeRepeatEveryDays" INTEGER NOT NULL DEFAULT 3,
    "overdueNoticeMaxCount" INTEGER NOT NULL DEFAULT 3,
    "sendEmail" BOOLEAN NOT NULL DEFAULT true,
    "sendWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "defaultFiscalMode" TEXT NOT NULL DEFAULT 'RECIBO_POSTERIOR',
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContractSignature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractId" INTEGER NOT NULL,
    "signerRole" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "signerName" TEXT NOT NULL,
    "signerCpfCnpj" TEXT NOT NULL,
    "signerEmail" TEXT NOT NULL,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,
    "signerUserId" INTEGER,
    "acceptedTermsText" TEXT,
    "acceptedAt" DATETIME,
    "signedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "documentHash" TEXT NOT NULL,
    "signatureHash" TEXT NOT NULL,
    "evidenceJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractSignatureOtp" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractId" INTEGER NOT NULL,
    "signerName" TEXT,
    "signerCpfCnpj" TEXT,
    "signerEmail" TEXT NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "verifiedAt" DATETIME,
    "usedAt" DATETIME,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "requesterIp" TEXT,
    "requesterUserAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractSignatureOtp_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ContractSignature_signatureHash_key" ON "ContractSignature"("signatureHash");

-- CreateIndex
CREATE INDEX "ContractSignature_contractId_idx" ON "ContractSignature"("contractId");

-- CreateIndex
CREATE INDEX "ContractSignature_signerEmail_idx" ON "ContractSignature"("signerEmail");

-- CreateIndex
CREATE INDEX "ContractSignature_signatureHash_idx" ON "ContractSignature"("signatureHash");

-- CreateIndex
CREATE INDEX "ContractSignatureOtp_contractId_idx" ON "ContractSignatureOtp"("contractId");

-- CreateIndex
CREATE INDEX "ContractSignatureOtp_signerEmail_idx" ON "ContractSignatureOtp"("signerEmail");

-- CreateIndex
CREATE INDEX "ContractSignatureOtp_expiresAt_idx" ON "ContractSignatureOtp"("expiresAt");
