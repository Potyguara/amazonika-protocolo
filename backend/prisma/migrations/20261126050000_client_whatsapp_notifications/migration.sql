-- CreateTable
CREATE TABLE "ClientWhatsAppNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "clientId" INTEGER,
    "transactionId" INTEGER,
    "billingChargeId" INTEGER,
    "kind" TEXT NOT NULL,
    "dedupeKey" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "errorText" TEXT,
    "messageId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE UNIQUE INDEX "ClientWhatsAppNotification_dedupeKey_key" ON "ClientWhatsAppNotification"("dedupeKey");

-- CreateIndex
CREATE INDEX "ClientWhatsAppNotification_clientId_idx" ON "ClientWhatsAppNotification"("clientId");

-- CreateIndex
CREATE INDEX "ClientWhatsAppNotification_transactionId_idx" ON "ClientWhatsAppNotification"("transactionId");

-- CreateIndex
CREATE INDEX "ClientWhatsAppNotification_createdAt_idx" ON "ClientWhatsAppNotification"("createdAt");

