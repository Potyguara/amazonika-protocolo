-- AlterTable
ALTER TABLE "BillingCharge" ADD COLUMN "initialEmailError" TEXT;
ALTER TABLE "BillingCharge" ADD COLUMN "initialEmailLastAttemptAt" DATETIME;
ALTER TABLE "BillingCharge" ADD COLUMN "initialEmailSentAt" DATETIME;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_FinanceAutoChargeSettings" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT DEFAULT 1,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "issueDaysBeforeDue" INTEGER NOT NULL DEFAULT 7,
    "firstNoticeDaysBeforeDue" INTEGER NOT NULL DEFAULT 5,
    "secondNoticeDaysBeforeDue" INTEGER NOT NULL DEFAULT 2,
    "sendDueDateNotice" BOOLEAN NOT NULL DEFAULT true,
    "overdueNoticeDaysAfterDue" INTEGER NOT NULL DEFAULT 1,
    "overdueNoticeRepeatEveryDays" INTEGER NOT NULL DEFAULT 3,
    "overdueNoticeMaxCount" INTEGER NOT NULL DEFAULT 3,
    "sendEmail" BOOLEAN NOT NULL DEFAULT true,
    "sendWhatsapp" BOOLEAN NOT NULL DEFAULT false,
    "defaultFiscalMode" TEXT NOT NULL DEFAULT 'RECIBO_POSTERIOR',
    "schedulerTimeZone" TEXT NOT NULL DEFAULT 'America/Belem',
    "chargeRunHour" INTEGER NOT NULL DEFAULT 7,
    "chargeRunMinute" INTEGER NOT NULL DEFAULT 0,
    "noticeRunHour" INTEGER NOT NULL DEFAULT 8,
    "noticeRunMinute" INTEGER NOT NULL DEFAULT 0,
    "lastChargeRunStartedAt" DATETIME,
    "lastChargeRunCompletedAt" DATETIME,
    "lastChargeRunStatus" TEXT,
    "lastChargeRunSummary" TEXT,
    "lastNoticeRunStartedAt" DATETIME,
    "lastNoticeRunCompletedAt" DATETIME,
    "lastNoticeRunStatus" TEXT,
    "lastNoticeRunSummary" TEXT,
    "createdById" INTEGER,
    "updatedById" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_FinanceAutoChargeSettings" ("createdAt", "createdById", "defaultFiscalMode", "enabled", "firstNoticeDaysBeforeDue", "id", "issueDaysBeforeDue", "overdueNoticeDaysAfterDue", "overdueNoticeMaxCount", "overdueNoticeRepeatEveryDays", "secondNoticeDaysBeforeDue", "sendDueDateNotice", "sendEmail", "sendWhatsapp", "updatedAt", "updatedById") SELECT "createdAt", "createdById", "defaultFiscalMode", "enabled", "firstNoticeDaysBeforeDue", "id", "issueDaysBeforeDue", "overdueNoticeDaysAfterDue", "overdueNoticeMaxCount", "overdueNoticeRepeatEveryDays", "secondNoticeDaysBeforeDue", "sendDueDateNotice", "sendEmail", "sendWhatsapp", "updatedAt", "updatedById" FROM "FinanceAutoChargeSettings";
DROP TABLE "FinanceAutoChargeSettings";
ALTER TABLE "new_FinanceAutoChargeSettings" RENAME TO "FinanceAutoChargeSettings";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
