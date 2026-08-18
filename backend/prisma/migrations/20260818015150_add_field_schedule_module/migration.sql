-- CreateTable
CREATE TABLE "FieldSchedule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PLANEJADO',
    "clientName" TEXT,
    "propertyName" TEXT,
    "municipality" TEXT,
    "state" TEXT,
    "location" TEXT,
    "reference" TEXT,
    "latitude" REAL,
    "longitude" REAL,
    "startDate" DATETIME NOT NULL,
    "endDate" DATETIME,
    "departureTime" TEXT,
    "returnTime" TEXT,
    "meetingPoint" TEXT,
    "alertEnabled" BOOLEAN NOT NULL DEFAULT true,
    "alertDaysBefore" INTEGER NOT NULL DEFAULT 3,
    "notes" TEXT,
    "createdById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FieldScheduleManager" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scheduleId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "FieldScheduleManager_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FieldSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "FieldScheduleNotification" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "scheduleId" INTEGER NOT NULL,
    "managerId" INTEGER NOT NULL,
    "daysBefore" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDENTE',
    "scheduledFor" DATETIME NOT NULL,
    "sentAt" DATETIME,
    "recipientEmail" TEXT NOT NULL,
    "subject" TEXT,
    "messageId" TEXT,
    "errorText" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "FieldScheduleNotification_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "FieldSchedule" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FieldScheduleNotification_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "FieldScheduleManager" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "FieldSchedule_startDate_idx" ON "FieldSchedule"("startDate");

-- CreateIndex
CREATE INDEX "FieldSchedule_status_idx" ON "FieldSchedule"("status");

-- CreateIndex
CREATE INDEX "FieldSchedule_type_idx" ON "FieldSchedule"("type");

-- CreateIndex
CREATE INDEX "FieldSchedule_createdById_idx" ON "FieldSchedule"("createdById");

-- CreateIndex
CREATE INDEX "FieldScheduleManager_scheduleId_idx" ON "FieldScheduleManager"("scheduleId");

-- CreateIndex
CREATE INDEX "FieldScheduleManager_userId_idx" ON "FieldScheduleManager"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldScheduleManager_scheduleId_userId_key" ON "FieldScheduleManager"("scheduleId", "userId");

-- CreateIndex
CREATE INDEX "FieldScheduleNotification_scheduledFor_idx" ON "FieldScheduleNotification"("scheduledFor");

-- CreateIndex
CREATE INDEX "FieldScheduleNotification_status_idx" ON "FieldScheduleNotification"("status");

-- CreateIndex
CREATE INDEX "FieldScheduleNotification_scheduleId_idx" ON "FieldScheduleNotification"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "FieldScheduleNotification_scheduleId_managerId_daysBefore_key" ON "FieldScheduleNotification"("scheduleId", "managerId", "daysBefore");
