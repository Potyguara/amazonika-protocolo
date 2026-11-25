-- CreateTable
CREATE TABLE "ManagerExpense" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "managerUserId" INTEGER NOT NULL,
    "competenceMonth" TEXT NOT NULL,
    "expenseDate" DATETIME NOT NULL,
    "description" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "notes" TEXT,
    "receiptOriginalName" TEXT,
    "receiptStoredName" TEXT,
    "receiptMimeType" TEXT,
    "receiptSize" INTEGER,
    "receiptPath" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE_RESTITUICAO',
    "reimbursedAt" DATETIME,
    "reimbursementNotes" TEXT,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerExpense_managerUserId_fkey" FOREIGN KEY ("managerUserId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "ManagerExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ManagerExpense_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ManagerExpenseMonth" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "competenceMonth" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ABERTO',
    "closedAt" DATETIME,
    "closedById" INTEGER,
    "reopenedAt" DATETIME,
    "reopenedById" INTEGER,
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ManagerExpenseMonth_closedById_fkey" FOREIGN KEY ("closedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "ManagerExpenseMonth_reopenedById_fkey" FOREIGN KEY ("reopenedById") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "ManagerExpense_managerUserId_idx" ON "ManagerExpense"("managerUserId");

-- CreateIndex
CREATE INDEX "ManagerExpense_competenceMonth_idx" ON "ManagerExpense"("competenceMonth");

-- CreateIndex
CREATE INDEX "ManagerExpense_expenseDate_idx" ON "ManagerExpense"("expenseDate");

-- CreateIndex
CREATE INDEX "ManagerExpense_status_idx" ON "ManagerExpense"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ManagerExpenseMonth_competenceMonth_key" ON "ManagerExpenseMonth"("competenceMonth");

-- CreateIndex
CREATE INDEX "ManagerExpenseMonth_status_idx" ON "ManagerExpenseMonth"("status");
