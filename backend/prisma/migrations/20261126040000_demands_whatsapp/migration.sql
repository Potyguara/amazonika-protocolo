-- CreateTable
CREATE TABLE "Demand" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL DEFAULT 'TRABALHO',
    "status" TEXT NOT NULL DEFAULT 'A_FAZER',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "dueAt" DATETIME,
    "remindBeforeMinutes" INTEGER NOT NULL DEFAULT 1440,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "assigneeId" INTEGER,
    "createdById" INTEGER,
    "protocolId" INTEGER,
    "clientId" INTEGER,
    "startedAt" DATETIME,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Demand_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Demand_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DemandNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "demandId" INTEGER,
    "userId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorText" TEXT,
    "messageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DemandNotification_demandId_fkey" FOREIGN KEY ("demandId") REFERENCES "Demand" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- AlterTable (ADD COLUMN preserva a tabela User e suas referências)
ALTER TABLE "User" ADD COLUMN "whatsappPhone" TEXT;
ALTER TABLE "User" ADD COLUMN "whatsappAlertsEnabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX "Demand_assigneeId_status_idx" ON "Demand"("assigneeId", "status");

-- CreateIndex
CREATE INDEX "Demand_dueAt_idx" ON "Demand"("dueAt");

-- CreateIndex
CREATE INDEX "Demand_status_idx" ON "Demand"("status");

-- CreateIndex
CREATE UNIQUE INDEX "DemandNotification_dedupeKey_key" ON "DemandNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "DemandNotification_demandId_idx" ON "DemandNotification"("demandId");

-- CreateIndex
CREATE INDEX "DemandNotification_userId_idx" ON "DemandNotification"("userId");

-- CreateIndex
CREATE INDEX "DemandNotification_createdAt_idx" ON "DemandNotification"("createdAt");

