/*
  Warnings:

  - A unique constraint covering the columns `[publicToken]` on the table `Payment` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Payment" ADD COLUMN "boletoLinhaDigitavel" TEXT;
ALTER TABLE "Payment" ADD COLUMN "boletoUrl" TEXT;
ALTER TABLE "Payment" ADD COLUMN "fiscalDocumentId" INTEGER;
ALTER TABLE "Payment" ADD COLUMN "fiscalMode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "pixCopiaECola" TEXT;
ALTER TABLE "Payment" ADD COLUMN "pixQrCode" TEXT;
ALTER TABLE "Payment" ADD COLUMN "provider" TEXT;
ALTER TABLE "Payment" ADD COLUMN "providerChargeId" TEXT;
ALTER TABLE "Payment" ADD COLUMN "providerEnv" TEXT;
ALTER TABLE "Payment" ADD COLUMN "providerRaw" TEXT;
ALTER TABLE "Payment" ADD COLUMN "publicToken" TEXT;
ALTER TABLE "Payment" ADD COLUMN "sentToClientAt" DATETIME;
ALTER TABLE "Payment" ADD COLUMN "txid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Payment_publicToken_key" ON "Payment"("publicToken");
