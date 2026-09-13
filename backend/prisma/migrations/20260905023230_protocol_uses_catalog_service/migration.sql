-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Protocol" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolNumber" TEXT NOT NULL,
    "clientId" INTEGER NOT NULL,
    "serviceTypeId" INTEGER NOT NULL,
    "createdByUserId" INTEGER,
    "responsibleUserId" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'NOVO',
    "description" TEXT,
    "priority" TEXT,
    "estimatedValue" REAL,
    "finalValue" REAL,
    "deadlineDate" DATETIME,
    "closedAt" DATETIME,
    "finishedAt" DATETIME,
    "cancelReason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Protocol_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Protocol_serviceTypeId_fkey" FOREIGN KEY ("serviceTypeId") REFERENCES "CatalogService" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Protocol_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Protocol_responsibleUserId_fkey" FOREIGN KEY ("responsibleUserId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Protocol" ("cancelReason", "clientId", "closedAt", "createdAt", "createdByUserId", "deadlineDate", "description", "estimatedValue", "finalValue", "finishedAt", "id", "priority", "protocolNumber", "responsibleUserId", "serviceTypeId", "status", "updatedAt") SELECT "cancelReason", "clientId", "closedAt", "createdAt", "createdByUserId", "deadlineDate", "description", "estimatedValue", "finalValue", "finishedAt", "id", "priority", "protocolNumber", "responsibleUserId", "serviceTypeId", "status", "updatedAt" FROM "Protocol";
DROP TABLE "Protocol";
ALTER TABLE "new_Protocol" RENAME TO "Protocol";
CREATE UNIQUE INDEX "Protocol_protocolNumber_key" ON "Protocol"("protocolNumber");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
