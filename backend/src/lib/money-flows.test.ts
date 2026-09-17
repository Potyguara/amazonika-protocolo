import assert from "node:assert/strict";
import { test } from "node:test";
import { copyPaymentSchedule } from "./payment-schedule";
import { calculateCommission, getContractBaseAmount } from "../modules/partners/commission-money";
import { standaloneDraftTerms, standaloneDocumentTerms, standaloneItemTotal, standalonePaymentTerms, standaloneTotals } from "../modules/standalone-proposals/standalone-money";
import { releasePartnerCommissionForEntryPayment } from "../modules/partners/partner-commission.service";
import { registerPartnerCommissionRoutes } from "../modules/partners/partner-commissions.routes";
import { registerStandaloneProposalRoutes } from "../modules/standalone-proposals/standalone-proposals.routes";

test("ProposalPaymentSchedule -> ContractPaymentSchedule preserves 12345 cents", () => {
  const row = Object.freeze({ type: "PARCELA", amountCents: 12345, installmentNumber: 1,
    totalInstallments: 1, dueDate: new Date("2026-10-01T12:00:00Z") });
  const result = copyPaymentSchedule([row]);
  assert.deepEqual(result, [row]);
  assert.notEqual(result[0], row);
  for (const invalid of [123.45, 0, -1, NaN, 2147483648]) {
    assert.throws(() => copyPaymentSchedule([{ ...row, amountCents: invalid }]));
  }
});

test("StandaloneProposal conserves 10000/3 and persists exact text with no false scalar", () => {
  const result = standalonePaymentTerms({ totalAmount: 10000, entryAmount: 0, installmentQty: 3, paymentMode: "PARCELADO" });
  assert.deepEqual(result.installmentAmounts, [3333, 3333, 3334]);
  assert.equal(result.installmentAmounts!.reduce((sum, amount) => sum + amount, 0), 10000);
  assert.equal(result.installmentAmount, null);
  assert.equal(result.paymentText, "Pagamento em 2 parcela(s) de R$ 33,33 e última parcela de R$ 33,34.");
});

test("StandaloneProposal distributes 3/3, entry plus installments, and rejects zero obligations", () => {
  const input = { totalAmount: 3, entryAmount: 0, installmentQty: 3, paymentMode: "ENTRADA_PARCELAS" };
  assert.deepEqual(standalonePaymentTerms(input).installmentAmounts, [1, 1, 1]);
  assert.throws(() => standalonePaymentTerms({ ...input, installmentQty: 4 }));
  assert.throws(() => standalonePaymentTerms({ ...input, installmentQty: 1.5 }));
  const result = standalonePaymentTerms({ ...input, totalAmount: 30003, entryAmount: 20000 });
  assert.equal(result.installmentAmounts!.reduce((sum, value) => sum + value, result.entryAmount), 30003);
});

test("StandaloneProposalItem validates cents and calculates fractional quantities centrally", () => {
  assert.equal(standaloneItemTotal(100, 0.29), 29);
  assert.equal(standaloneItemTotal(12345, 1.5), 18518);
  for (const amount of [123.45, null, NaN, "100", -1]) assert.throws(() => standaloneItemTotal(amount, 1));
  assert.deepEqual(standaloneTotals([{ totalAmount: 12345 }], 100, 200), { subtotalAmount: 12345, totalAmount: 12445 });
  assert.throws(() => standaloneTotals([{ totalAmount: 2147483647 }, { totalAmount: 1 }], 0, 0));
});

test("editing a draft clears stale terms when its positive installments are no longer possible", () => {
  assert.deepEqual(standaloneDraftTerms({ totalAmount: 2, entryAmount: 0, installmentQty: 3,
    installmentAmount: 3333, paymentText: "texto antigo", paymentMode: "PARCELADO" }),
  { installmentAmount: null, paymentText: null });
  const custom = standalonePaymentTerms({ totalAmount: 10000, entryAmount: 0, installmentQty: null,
    paymentText: "Condições específicas", paymentMode: "PERSONALIZADO" });
  assert.equal(custom.paymentText, "Condições específicas");
  assert.equal(custom.installmentAmounts, null);
});

test("documents preserve existing agreed text and derive exact terms only when absent", () => {
  const input = { totalAmount: 10000, entryAmount: 0, installmentQty: 3, paymentMode: "PARCELADO" };
  assert.equal(standaloneDocumentTerms({ ...input, paymentText: "Texto anteriormente pactuado" }).paymentText,
    "Texto anteriormente pactuado");
  assert.deepEqual(standaloneDocumentTerms(input).installmentAmounts, [3333, 3333, 3334]);
});

test("commission canonical path never reads legacy reais; base 123456 at 12.34% is deterministic", () => {
  const contract = {
    paymentSchedule: [{ amountCents: 123456 }],
    get proposal(): never { throw new Error("Legacy reais must not be read"); },
    get contractValue(): never { throw new Error("Legacy reais must not be read"); },
  };
  const base = getContractBaseAmount(contract);
  assert.equal(base, 123456);
  // 123456 * 1234 / 10000 = 15234.4704 centavos; arredonda para 15234.
  assert.equal(calculateCommission(base, 12.34), 15234);
  assert.equal(calculateCommission(base, 12.34), 15234);
  assert.throws(() => calculateCommission(1234.56, 10));
  assert.throws(() => calculateCommission(base, 12.345));
});

test("explicit legacy commission bases do not reinterpret canonical cents", () => {
  assert.equal(getContractBaseAmount({
    proposal: { totalAmount: 1234 },
    legacyClassification: "LEGACY_CONFIRMED",
  }), 123400);
  assert.equal(getContractBaseAmount({
    contractValue: 1234.56,
    legacyClassification: "LEGACY_CONFIRMED",
  }), 123456);
  assert.throws(() => getContractBaseAmount({
    contractValue: 1.234,
    legacyClassification: "LEGACY_CONFIRMED",
  }));
  assert.throws(() => getContractBaseAmount({ contractValue: 1234.56 }), /classificação histórica/);
});

test("commission release uses existing schedule columns and writes cents, with an in-memory repository", async () => {
  let written: any;
  const prisma = {
    partnerCommission: {
      findFirst: async () => ({ id: 1, contractId: 2, percent: 12.34, dueDate: null }),
      update: async (args: any) => { written = args.data; return args.data; },
    },
    contract: { findUnique: async (args: any) => {
      assert.deepEqual(args.select.paymentSchedule, { select: { amountCents: true } });
      return { id: 2, status: "ASSINADO", paymentSchedule: [{ amountCents: 123456 }],
        get proposal(): never { throw new Error("No cents -> reais -> cents"); } };
    } },
  };
  await releasePartnerCommissionForEntryPayment(prisma as any, { protocolId: 1, paidAt: new Date() });
  assert.equal(written.baseAmount, 123456);
  assert.equal(written.commissionAmount, 15234);
});

function fakeApp() {
  const routes = new Map<string, Function>();
  const app: any = {};
  for (const method of ["get", "put", "post", "delete", "patch"]) {
    app[method] = (path: string, ...handlers: Function[]) => routes.set(`${method} ${path}`, handlers[handlers.length - 1]);
  }
  return { app, routes };
}
function fakeResponse() {
  return { code: 200, body: undefined as any, status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; } };
}

test("commission payment writes canonical cents and only derives the legacy mirror", async () => {
  const { app, routes } = fakeApp();
  let financialWrite: any;
  const commission = {
    id: 1,
    commissionAmount: 12345,
    status: "DISPONIVEL_PARA_PAGAMENTO",
    financialTransactionId: null,
    financialTransaction: null,
    protocolId: 2,
    contractId: 3,
    partnerId: 4,
    percent: 10,
    dueDate: new Date("2026-10-01T12:00:00Z"),
    partner: { name: "Parceiro" },
    protocol: {
      protocolNumber: "P-1",
      client: { name: "Cliente" },
      serviceType: { name: "Serviço" },
    },
    contract: { contractNumber: "C-1" },
  };
  const tx = {
    financialCategory: { upsert: async () => ({ id: 5 }) },
    financialTransaction: {
      create: async ({ data }: any) => {
        financialWrite = data;
        return { id: 6, ...data };
      },
    },
    partnerCommission: {
      update: async () => ({ ...commission, status: "PAGA" }),
    },
    auditLog: { create: async () => ({}) },
  };
  const prisma = {
    partnerCommission: { findUnique: async () => commission },
    $transaction: async (callback: any) => callback(tx),
  };
  registerPartnerCommissionRoutes({ app, prisma: prisma as any, authMiddleware: () => {}, requireRoles: () => () => {} });
  const res = fakeResponse();
  await routes.get("post /partner-commissions/:id/pay")!({ params: { id: "1" }, body: {}, user: {} }, res);
  assert.equal(res.code, 200);
  assert.equal(financialWrite.amountCents, 12345);
  assert.equal(financialWrite.amount, 123);
});

test("StandaloneProposal route persists exact terms and rejects zero obligations before writing", async (t) => {
  const { app, routes } = fakeApp();
  let record: any = { id: 1, status: "RASCUNHO", subtotalAmount: 10000, totalAmount: 10000,
    discountAmount: 0, additionAmount: 0, entryAmount: 0, installmentQty: 3, paymentMode: "PARCELADO",
    items: [{ totalAmount: 10000 }] };
  const writes: any[] = [];
  const prisma = {
    standaloneProposal: {
      findUnique: async () => record,
      update: async ({ data }: any) => {
        assert.ok(!Object.keys(data).some(key => key.endsWith("Cents") || key === "installmentAmounts"));
        writes.push(data); record = { ...record, ...data }; return record;
      },
    },
    standaloneProposalEvent: { create: async () => ({}) },
  };
  registerStandaloneProposalRoutes({ app, prisma: prisma as any, authMiddleware: () => {}, requireRoles: () => () => {},
    upload: { single: () => () => {} }, createTransporterFromSettings: async () => ({}),
    getSmtpSettings: async () => ({}), getEmailImageAttachments: () => [] });
  const res = fakeResponse();
  await routes.get("put /standalone-proposals/:id")!({ params: { id: "1" }, body: { paymentMode: "PARCELADO", installmentQty: 3,
    installmentAmount: 3333, paymentText: "3 parcelas aproximadas" } }, res);
  assert.equal(res.code, 200);
  assert.ok(writes.length > 0);
  assert.equal(record.installmentAmount, null);
  assert.match(record.paymentText, /última parcela de R\$ 33,34/);
  assert.equal(record.totalAmount, 10000);
  record = { ...record, totalAmount: 3, subtotalAmount: 3, items: [{ totalAmount: 3 }] };
  const writesBefore = writes.length;
  const invalidResponse = fakeResponse();
  t.mock.method(console, "error", () => {});
  await routes.get("put /standalone-proposals/:id")!({ params: { id: "1" }, body: { installmentQty: 4 } }, invalidResponse);
  assert.equal(invalidResponse.code, 400);
  assert.equal(writes.length, writesBefore);
});
