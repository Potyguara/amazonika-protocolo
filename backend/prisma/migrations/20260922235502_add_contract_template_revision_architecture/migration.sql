-- CreateTable
CREATE TABLE "ContractTemplate" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContractTemplateVersion" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateId" INTEGER NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "label" TEXT,
    "notes" TEXT,
    "publishedAt" DATETIME,
    "createdById" INTEGER,
    "approvedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractTemplateVersion_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "ContractTemplate" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractTemplateClause" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "templateVersionId" INTEGER NOT NULL,
    "clauseKey" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT false,
    "editable" BOOLEAN NOT NULL DEFAULT true,
    "deletable" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractTemplateClause_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ContractTemplateVersion" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ClauseLibrary" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "category" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ContractRevision" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "contractId" INTEGER NOT NULL,
    "revisionNumber" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RASCUNHO',
    "title" TEXT,
    "changeReason" TEXT,
    "htmlSnapshot" TEXT,
    "documentHash" TEXT,
    "createdById" INTEGER,
    "approvedById" INTEGER,
    "approvedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractRevision_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ContractClause" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "revisionId" INTEGER NOT NULL,
    "templateClauseId" INTEGER,
    "libraryClauseId" INTEGER,
    "clauseKey" TEXT,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "source" TEXT NOT NULL DEFAULT 'TEMPLATE',
    "required" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ContractClause_revisionId_fkey" FOREIGN KEY ("revisionId") REFERENCES "ContractRevision" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ContractClause_templateClauseId_fkey" FOREIGN KEY ("templateClauseId") REFERENCES "ContractTemplateClause" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ContractClause_libraryClauseId_fkey" FOREIGN KEY ("libraryClauseId") REFERENCES "ClauseLibrary" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_CatalogService" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
    "defaultContractTemplateId" INTEGER,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "acronym" TEXT,
    "shortDescription" TEXT,
    "proposalDescription" TEXT,
    "technicalDescription" TEXT,
    "legalText" TEXT,
    "pricingMode" TEXT NOT NULL,
    "baseAmount" INTEGER NOT NULL DEFAULT 0,
    "minimumAmount" INTEGER,
    "unitLabel" TEXT,
    "defaultExecutionDays" INTEGER,
    "allowManualPrice" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CatalogService_defaultContractTemplateId_fkey" FOREIGN KEY ("defaultContractTemplateId") REFERENCES "ContractTemplate" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_CatalogService" ("acronym", "active", "allowManualPrice", "baseAmount", "categoryId", "code", "createdAt", "defaultExecutionDays", "id", "legalText", "minimumAmount", "name", "pricingMode", "proposalDescription", "shortDescription", "sortOrder", "technicalDescription", "unitLabel", "updatedAt") SELECT "acronym", "active", "allowManualPrice", "baseAmount", "categoryId", "code", "createdAt", "defaultExecutionDays", "id", "legalText", "minimumAmount", "name", "pricingMode", "proposalDescription", "shortDescription", "sortOrder", "technicalDescription", "unitLabel", "updatedAt" FROM "CatalogService";
DROP TABLE "CatalogService";
ALTER TABLE "new_CatalogService" RENAME TO "CatalogService";
CREATE UNIQUE INDEX "CatalogService_code_key" ON "CatalogService"("code");
CREATE INDEX "CatalogService_categoryId_idx" ON "CatalogService"("categoryId");
CREATE INDEX "CatalogService_name_idx" ON "CatalogService"("name");
CREATE INDEX "CatalogService_active_idx" ON "CatalogService"("active");
CREATE INDEX "CatalogService_pricingMode_idx" ON "CatalogService"("pricingMode");
CREATE INDEX "CatalogService_sortOrder_idx" ON "CatalogService"("sortOrder");
CREATE TABLE "new_Contract" (
    "contractValueCents" INTEGER,
    "entryAmountCents" INTEGER,
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "protocolId" INTEGER NOT NULL,
    "clientId" INTEGER NOT NULL,
    "proposalId" INTEGER,
    "createdById" INTEGER,
    "contractNumber" TEXT NOT NULL,
    "publicToken" TEXT NOT NULL,
    "templateType" TEXT,
    "templateVersionId" INTEGER,
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
    CONSTRAINT "Contract_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Contract_templateVersionId_fkey" FOREIGN KEY ("templateVersionId") REFERENCES "ContractTemplateVersion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Contract" ("clientId", "contractNumber", "contractValue", "contractValueCents", "createdAt", "createdById", "deadlineDate", "deadlineText", "entryAmount", "entryAmountCents", "generatedPdfPath", "htmlSnapshot", "id", "legalText", "notes", "objectText", "obligationsText", "paymentMode", "paymentText", "proposalId", "protocolId", "publicToken", "sentToClientAt", "signedAt", "signedPdfPath", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerUserAgent", "startDate", "status", "templateType", "title", "updatedAt") SELECT "clientId", "contractNumber", "contractValue", "contractValueCents", "createdAt", "createdById", "deadlineDate", "deadlineText", "entryAmount", "entryAmountCents", "generatedPdfPath", "htmlSnapshot", "id", "legalText", "notes", "objectText", "obligationsText", "paymentMode", "paymentText", "proposalId", "protocolId", "publicToken", "sentToClientAt", "signedAt", "signedPdfPath", "signerCpfCnpj", "signerEmail", "signerIp", "signerName", "signerUserAgent", "startDate", "status", "templateType", "title", "updatedAt" FROM "Contract";
DROP TABLE "Contract";
ALTER TABLE "new_Contract" RENAME TO "Contract";
CREATE UNIQUE INDEX "Contract_contractNumber_key" ON "Contract"("contractNumber");
CREATE UNIQUE INDEX "Contract_publicToken_key" ON "Contract"("publicToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplate_code_key" ON "ContractTemplate"("code");

-- CreateIndex
CREATE INDEX "ContractTemplate_name_idx" ON "ContractTemplate"("name");

-- CreateIndex
CREATE INDEX "ContractTemplate_active_idx" ON "ContractTemplate"("active");

-- CreateIndex
CREATE INDEX "ContractTemplateVersion_templateId_idx" ON "ContractTemplateVersion"("templateId");

-- CreateIndex
CREATE INDEX "ContractTemplateVersion_status_idx" ON "ContractTemplateVersion"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ContractTemplateVersion_templateId_versionNumber_key" ON "ContractTemplateVersion"("templateId", "versionNumber");

-- CreateIndex
CREATE INDEX "ContractTemplateClause_templateVersionId_idx" ON "ContractTemplateClause"("templateVersionId");

-- CreateIndex
CREATE INDEX "ContractTemplateClause_sortOrder_idx" ON "ContractTemplateClause"("sortOrder");

-- CreateIndex
CREATE INDEX "ContractTemplateClause_clauseKey_idx" ON "ContractTemplateClause"("clauseKey");

-- CreateIndex
CREATE UNIQUE INDEX "ClauseLibrary_code_key" ON "ClauseLibrary"("code");

-- CreateIndex
CREATE INDEX "ClauseLibrary_category_idx" ON "ClauseLibrary"("category");

-- CreateIndex
CREATE INDEX "ClauseLibrary_active_idx" ON "ClauseLibrary"("active");

-- CreateIndex
CREATE INDEX "ContractRevision_contractId_idx" ON "ContractRevision"("contractId");

-- CreateIndex
CREATE INDEX "ContractRevision_status_idx" ON "ContractRevision"("status");

-- CreateIndex
CREATE INDEX "ContractRevision_createdAt_idx" ON "ContractRevision"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ContractRevision_contractId_revisionNumber_key" ON "ContractRevision"("contractId", "revisionNumber");

-- CreateIndex
CREATE INDEX "ContractClause_revisionId_idx" ON "ContractClause"("revisionId");

-- CreateIndex
CREATE INDEX "ContractClause_templateClauseId_idx" ON "ContractClause"("templateClauseId");

-- CreateIndex
CREATE INDEX "ContractClause_libraryClauseId_idx" ON "ContractClause"("libraryClauseId");

-- CreateIndex
CREATE INDEX "ContractClause_sortOrder_idx" ON "ContractClause"("sortOrder");

-- CreateIndex
CREATE INDEX "ContractClause_clauseKey_idx" ON "ContractClause"("clauseKey");
