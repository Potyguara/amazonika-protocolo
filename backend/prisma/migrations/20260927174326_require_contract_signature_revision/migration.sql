/*
  Warnings:

  - Made the column `contractRevisionId` on table `ContractSignature` required. This step will fail if there are existing NULL values in that column.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ContractSignature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractId" INTEGER NOT NULL,
    "contractRevisionId" INTEGER NOT NULL,
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
    CONSTRAINT "ContractSignature_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ContractSignature_contractRevisionId_fkey" FOREIGN KEY ("contractRevisionId") REFERENCES "ContractRevision" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_ContractSignature" ("acceptedAt", "acceptedTermsText", "contractId", "contractRevisionId", "createdAt", "documentHash", "evidenceJson", "id", "method", "signatureHash", "signedAt", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerRole", "signerUserAgent", "signerUserId", "updatedAt") SELECT "acceptedAt", "acceptedTermsText", "contractId", "contractRevisionId", "createdAt", "documentHash", "evidenceJson", "id", "method", "signatureHash", "signedAt", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerRole", "signerUserAgent", "signerUserId", "updatedAt" FROM "ContractSignature";
DROP TABLE "ContractSignature";
ALTER TABLE "new_ContractSignature" RENAME TO "ContractSignature";
CREATE UNIQUE INDEX "ContractSignature_signatureHash_key" ON "ContractSignature"("signatureHash");
CREATE INDEX "ContractSignature_contractId_idx" ON "ContractSignature"("contractId");
CREATE INDEX "ContractSignature_contractRevisionId_idx" ON "ContractSignature"("contractRevisionId");
CREATE INDEX "ContractSignature_signerEmail_idx" ON "ContractSignature"("signerEmail");
CREATE INDEX "ContractSignature_signatureHash_idx" ON "ContractSignature"("signatureHash");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
