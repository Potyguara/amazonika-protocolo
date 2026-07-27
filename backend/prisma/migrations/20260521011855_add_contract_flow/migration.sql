/*
  Warnings:

  - Added the required column `publicToken` to the `Contract` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
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
INSERT INTO "new_Contract" ("clientId", "contractNumber", "contractValue", "createdAt", "deadlineDate", "generatedPdfPath", "id", "notes", "protocolId", "sentToClientAt", "signedAt", "signedPdfPath", "startDate", "status", "templateType", "updatedAt") SELECT "clientId", "contractNumber", "contractValue", "createdAt", "deadlineDate", "generatedPdfPath", "id", "notes", "protocolId", "sentToClientAt", "signedAt", "signedPdfPath", "startDate", "status", "templateType", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE UNIQUE INDEX "Contract_publicToken_key" ON "Contract"("publicToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "ProposalHistory_protocolId_idx" ON "ProposalHistory"("protocolId");

-- CreateIndex
CREATE INDEX "ProposalHistory_proposalId_idx" ON "ProposalHistory"("proposalId");

-- CreateIndex
CREATE INDEX "ProposalHistory_eventType_idx" ON "ProposalHistory"("eventType");
