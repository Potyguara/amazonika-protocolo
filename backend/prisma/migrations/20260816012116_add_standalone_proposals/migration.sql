-- CreateTable
CREATE TABLE "StandaloneProposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalNumber" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "clientId" INTEGER,
    "clientName" TEXT NOT NULL,
    "clientCpfCnpj" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "clientWhatsapp" TEXT,
    "clientAddress" TEXT,
    "clientCity" TEXT,
    "clientState" TEXT,
    "createdById" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "approvalMode" TEXT NOT NULL DEFAULT 'NENHUM',
    "title" TEXT NOT NULL,
    "objectText" TEXT,
    "introText" TEXT,
    "scopeText" TEXT,
    "subtotalAmount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "additionAmount" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentMode" TEXT NOT NULL DEFAULT 'ENTRADA_PARCELAS',
    "entryAmount" INTEGER NOT NULL DEFAULT 0,
    "installmentQty" INTEGER,
    "installmentAmount" INTEGER,
    "paymentText" TEXT,
    "executionDays" INTEGER,
    "executionText" TEXT,
    "validUntil" DATETIME,
    "notes" TEXT,
    "internalNotes" TEXT,
    "generatedPdfPath" TEXT,
    "generatedPdfName" TEXT,
    "generatedPdfHash" TEXT,
    "signedPdfPath" TEXT,
    "signedPdfName" TEXT,
    "signedPdfHash" TEXT,
    "generatedAt" DATETIME,
    "sentAt" DATETIME,
    "verbalApprovedAt" DATETIME,
    "verbalApprovedBy" TEXT,
    "verbalApprovalNote" TEXT,
    "signedPdfUploadedAt" DATETIME,
    "linkedProtocolId" INTEGER,
    "convertedProposalId" INTEGER,
    "linkedAt" DATETIME,
    "rawSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StandaloneProposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "StandaloneProposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandaloneProposalItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "catalogServiceId" INTEGER,
    "catalogServiceCode" TEXT,
    "categoryName" TEXT,
    "serviceName" TEXT NOT NULL,
    "acronym" TEXT,
    "description" TEXT,
    "technicalDescription" TEXT,
    "legalText" TEXT,
    "pricingMode" TEXT,
    "quantity" REAL NOT NULL DEFAULT 1,
    "unitLabel" TEXT,
    "catalogUnitAmount" INTEGER,
    "unitAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "manualPrice" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StandaloneProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "StandaloneProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "StandaloneProposalItem_catalogServiceId_fkey" FOREIGN KEY ("catalogServiceId") REFERENCES "CatalogService" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandaloneProposalAttachment" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'LISTADO',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "fileName" TEXT,
    "filePath" TEXT,
    "mimeType" TEXT,
    "size" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StandaloneProposalAttachment_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "StandaloneProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandaloneProposalSignature" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "publicToken" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "expiresAt" DATETIME,
    "signerName" TEXT,
    "signerCpfCnpj" TEXT,
    "signerEmail" TEXT,
    "signerPhone" TEXT,
    "signedAt" DATETIME,
    "signerIp" TEXT,
    "signerUserAgent" TEXT,
    "documentHash" TEXT,
    "consentText" TEXT,
    "evidenceJson" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "StandaloneProposalSignature_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "StandaloneProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "StandaloneProposalEvent" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "actorUserId" INTEGER,
    "actorName" TEXT,
    "actorEmail" TEXT,
    "recipient" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StandaloneProposalEvent_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "StandaloneProposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "StandaloneProposal_proposalNumber_key" ON "StandaloneProposal"("proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "StandaloneProposal_publicToken_key" ON "StandaloneProposal"("publicToken");

-- CreateIndex
CREATE INDEX "StandaloneProposal_clientId_idx" ON "StandaloneProposal"("clientId");

-- CreateIndex
CREATE INDEX "StandaloneProposal_createdById_idx" ON "StandaloneProposal"("createdById");

-- CreateIndex
CREATE INDEX "StandaloneProposal_status_idx" ON "StandaloneProposal"("status");

-- CreateIndex
CREATE INDEX "StandaloneProposal_proposalNumber_idx" ON "StandaloneProposal"("proposalNumber");

-- CreateIndex
CREATE INDEX "StandaloneProposal_publicToken_idx" ON "StandaloneProposal"("publicToken");

-- CreateIndex
CREATE INDEX "StandaloneProposal_linkedProtocolId_idx" ON "StandaloneProposal"("linkedProtocolId");

-- CreateIndex
CREATE INDEX "StandaloneProposal_convertedProposalId_idx" ON "StandaloneProposal"("convertedProposalId");

-- CreateIndex
CREATE INDEX "StandaloneProposal_createdAt_idx" ON "StandaloneProposal"("createdAt");

-- CreateIndex
CREATE INDEX "StandaloneProposalItem_proposalId_idx" ON "StandaloneProposalItem"("proposalId");

-- CreateIndex
CREATE INDEX "StandaloneProposalItem_catalogServiceId_idx" ON "StandaloneProposalItem"("catalogServiceId");

-- CreateIndex
CREATE INDEX "StandaloneProposalItem_sortOrder_idx" ON "StandaloneProposalItem"("sortOrder");

-- CreateIndex
CREATE INDEX "StandaloneProposalAttachment_proposalId_idx" ON "StandaloneProposalAttachment"("proposalId");

-- CreateIndex
CREATE INDEX "StandaloneProposalAttachment_sortOrder_idx" ON "StandaloneProposalAttachment"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "StandaloneProposalSignature_publicToken_key" ON "StandaloneProposalSignature"("publicToken");

-- CreateIndex
CREATE INDEX "StandaloneProposalSignature_proposalId_idx" ON "StandaloneProposalSignature"("proposalId");

-- CreateIndex
CREATE INDEX "StandaloneProposalSignature_status_idx" ON "StandaloneProposalSignature"("status");

-- CreateIndex
CREATE INDEX "StandaloneProposalSignature_expiresAt_idx" ON "StandaloneProposalSignature"("expiresAt");

-- CreateIndex
CREATE INDEX "StandaloneProposalEvent_proposalId_idx" ON "StandaloneProposalEvent"("proposalId");

-- CreateIndex
CREATE INDEX "StandaloneProposalEvent_eventType_idx" ON "StandaloneProposalEvent"("eventType");

-- CreateIndex
CREATE INDEX "StandaloneProposalEvent_createdAt_idx" ON "StandaloneProposalEvent"("createdAt");
