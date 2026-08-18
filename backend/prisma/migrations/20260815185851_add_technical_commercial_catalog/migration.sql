-- CreateTable
CREATE TABLE "ServiceCategory" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "CatalogService" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "categoryId" INTEGER NOT NULL,
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
    CONSTRAINT "CatalogService_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "ServiceCategory" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CatalogServicePricingTier" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "serviceId" INTEGER NOT NULL,
    "minQuantity" REAL,
    "maxQuantity" REAL,
    "unitAmount" INTEGER NOT NULL,
    "minimumAmount" INTEGER,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CatalogServicePricingTier_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "CatalogService" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ServicePackage" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "proposalDescription" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "ServicePackageItem" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "packageId" INTEGER NOT NULL,
    "serviceId" INTEGER NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 1,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ServicePackageItem_packageId_fkey" FOREIGN KEY ("packageId") REFERENCES "ServicePackage" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ServicePackageItem_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "CatalogService" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "ServiceCategory_code_key" ON "ServiceCategory"("code");

-- CreateIndex
CREATE INDEX "ServiceCategory_name_idx" ON "ServiceCategory"("name");

-- CreateIndex
CREATE INDEX "ServiceCategory_active_idx" ON "ServiceCategory"("active");

-- CreateIndex
CREATE INDEX "ServiceCategory_sortOrder_idx" ON "ServiceCategory"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "CatalogService_code_key" ON "CatalogService"("code");

-- CreateIndex
CREATE INDEX "CatalogService_categoryId_idx" ON "CatalogService"("categoryId");

-- CreateIndex
CREATE INDEX "CatalogService_name_idx" ON "CatalogService"("name");

-- CreateIndex
CREATE INDEX "CatalogService_active_idx" ON "CatalogService"("active");

-- CreateIndex
CREATE INDEX "CatalogService_pricingMode_idx" ON "CatalogService"("pricingMode");

-- CreateIndex
CREATE INDEX "CatalogService_sortOrder_idx" ON "CatalogService"("sortOrder");

-- CreateIndex
CREATE INDEX "CatalogServicePricingTier_serviceId_idx" ON "CatalogServicePricingTier"("serviceId");

-- CreateIndex
CREATE INDEX "CatalogServicePricingTier_sortOrder_idx" ON "CatalogServicePricingTier"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePackage_code_key" ON "ServicePackage"("code");

-- CreateIndex
CREATE INDEX "ServicePackage_name_idx" ON "ServicePackage"("name");

-- CreateIndex
CREATE INDEX "ServicePackage_active_idx" ON "ServicePackage"("active");

-- CreateIndex
CREATE INDEX "ServicePackageItem_packageId_idx" ON "ServicePackageItem"("packageId");

-- CreateIndex
CREATE INDEX "ServicePackageItem_serviceId_idx" ON "ServicePackageItem"("serviceId");

-- CreateIndex
CREATE INDEX "ServicePackageItem_sortOrder_idx" ON "ServicePackageItem"("sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ServicePackageItem_packageId_serviceId_key" ON "ServicePackageItem"("packageId", "serviceId");
