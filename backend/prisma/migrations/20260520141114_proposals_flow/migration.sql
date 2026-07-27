-- CreateTable
CREATE TABLE "Proposal" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalNumber" TEXT NOT NULL,
    "protocolId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "createdById" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "title" TEXT NOT NULL,
    "description" TEXT,
    "technicalScope" TEXT,
    "paymentMode" TEXT NOT NULL DEFAULT 'ENTRADA_PARCELAS',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "entryAmount" INTEGER NOT NULL DEFAULT 0,
    "installmentQty" INTEGER,
    "installmentAmount" INTEGER,
    "executionDays" INTEGER,
    "validUntil" DATETIME,
    "sentAt" DATETIME,
    "acceptedAt" DATETIME,
    "refusedAt" DATETIME,
    "adjustmentRequestedAt" DATETIME,
    "clientMessage" TEXT,
    "internalNotes" TEXT,
    "publicToken" TEXT NOT NULL,
    "rawSnapshot" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Proposal_protocolId_fkey" FOREIGN KEY ("protocolId") REFERENCES "Protocol" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Proposal_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Proposal_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProposalItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "proposalId" INTEGER NOT NULL,
    "serviceName" TEXT NOT NULL,
    "description" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "unitAmount" INTEGER NOT NULL,
    "totalAmount" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProposalItem_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "Proposal" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_proposalNumber_key" ON "Proposal"("proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Proposal_publicToken_key" ON "Proposal"("publicToken");
