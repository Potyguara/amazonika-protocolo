-- AlterTable
ALTER TABLE "ContractRevision" ADD COLUMN "signingDocumentHash" TEXT;
ALTER TABLE "ContractRevision" ADD COLUMN "signingSnapshotCreatedAt" DATETIME;
ALTER TABLE "ContractRevision" ADD COLUMN "signingSnapshotJson" TEXT;
ALTER TABLE "ContractRevision" ADD COLUMN "signingSnapshotVersion" INTEGER;
