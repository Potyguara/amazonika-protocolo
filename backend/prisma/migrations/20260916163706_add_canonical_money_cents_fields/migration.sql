-- Etapa 2C1 — infraestrutura canônica monetária.
-- Migração estritamente aditiva: 16 colunas INTEGER nullable, sem default.
-- Não altera, converte ou remove qualquer coluna monetária legada.
-- O backfill/reconciliação é deliberadamente separado desta migration.

ALTER TABLE "FinancialTransaction" ADD COLUMN "amountCents" INTEGER;

ALTER TABLE "BillingCharge" ADD COLUMN "paidAmountCents" INTEGER;

ALTER TABLE "Proposal" ADD COLUMN "totalAmountCents" INTEGER;
ALTER TABLE "Proposal" ADD COLUMN "entryAmountCents" INTEGER;
ALTER TABLE "Proposal" ADD COLUMN "installmentAmountCents" INTEGER;

ALTER TABLE "ProposalItem" ADD COLUMN "unitAmountCents" INTEGER;
ALTER TABLE "ProposalItem" ADD COLUMN "totalAmountCents" INTEGER;

ALTER TABLE "Contract" ADD COLUMN "contractValueCents" INTEGER;
ALTER TABLE "Contract" ADD COLUMN "entryAmountCents" INTEGER;

ALTER TABLE "FixedCost" ADD COLUMN "amountCents" INTEGER;

ALTER TABLE "EmployeeSalary" ADD COLUMN "amountCents" INTEGER;

ALTER TABLE "ProLaboreAdvance" ADD COLUMN "amountCents" INTEGER;

ALTER TABLE "Payment" ADD COLUMN "amountCents" INTEGER;

ALTER TABLE "FiscalDocument" ADD COLUMN "amountCents" INTEGER;

ALTER TABLE "Protocol" ADD COLUMN "estimatedValueCents" INTEGER;
ALTER TABLE "Protocol" ADD COLUMN "finalValueCents" INTEGER;
