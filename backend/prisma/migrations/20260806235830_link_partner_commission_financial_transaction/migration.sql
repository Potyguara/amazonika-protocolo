-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_PartnerCommission" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "partnerId" INTEGER NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "contractId" INTEGER,
    "percent" REAL NOT NULL,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "commissionAmount" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'PREVISTA',
    "dueDate" DATETIME,
    "paidAt" DATETIME,
    "financialTransactionId" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PartnerCommission_financialTransactionId_fkey" FOREIGN KEY ("financialTransactionId") REFERENCES "FinancialTransaction" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PartnerCommission_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "Partner" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartnerCommission_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PartnerCommission_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_PartnerCommission" ("baseAmount", "commissionAmount", "contractId", "createdAt", "dueDate", "id", "notes", "paidAt", "partnerId", "percent", "protocolId", "status", "updatedAt") SELECT "baseAmount", "commissionAmount", "contractId", "createdAt", "dueDate", "id", "notes", "paidAt", "partnerId", "percent", "protocolId", "status", "updatedAt" FROM "PartnerCommission";
DROP TABLE "PartnerCommission";
ALTER TABLE "new_PartnerCommission" RENAME TO "PartnerCommission";
CREATE UNIQUE INDEX "PartnerCommission_financialTransactionId_key" ON "PartnerCommission"("financialTransactionId");
CREATE INDEX "PartnerCommission_partnerId_idx" ON "PartnerCommission"("partnerId");
CREATE INDEX "PartnerCommission_protocolId_idx" ON "PartnerCommission"("protocolId");
CREATE INDEX "PartnerCommission_contractId_idx" ON "PartnerCommission"("contractId");
CREATE INDEX "PartnerCommission_status_idx" ON "PartnerCommission"("status");
CREATE UNIQUE INDEX "PartnerCommission_partnerId_contractId_key" ON "PartnerCommission"("partnerId", "contractId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
