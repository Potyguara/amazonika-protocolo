import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import ts from "typescript";
import * as money from "./money";
import * as canonical from "./canonical-money";

// Extract real functions only: never initialize the server, Prisma, PDF or network.
const source = ts.createSourceFile("server.ts", fs.readFileSync("src/server.ts", "utf8"), ts.ScriptTarget.Latest, true);
function find(predicate: (node: ts.Node) => boolean) {
  let result: ts.Node | undefined;
  function visit(node: ts.Node) {
    if (predicate(node)) result = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(result);
  return result;
}
function fn(name: string) {
  return find(node => ts.isFunctionDeclaration(node) && node.name?.text === name);
}
function route(url: string) {
  const node = find(node => ts.isCallExpression(node) && node.expression.getText(source) === "app.post" &&
    ts.isStringLiteral(node.arguments[0]) && node.arguments[0].text === url) as ts.CallExpression;
  return node.arguments.at(-1)!;
}
function evaluate(node: ts.Node, dependencies: object = {}) {
  const js = ts.transpileModule(`(${node.getText(source)})`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  return vm.runInNewContext(js, { ...money, ...canonical, console, ...dependencies });
}
function response() {
  return { code: 200, body: undefined as any, status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; } };
}

test("2C2-F prolabore real route accepts one cent and rejects nonpositive amounts", async () => {
  const writes: any[] = [];
  const handler = evaluate(route("/management/prolabore-advances"), {
    getCompetenceMonth: () => "2026-09",
    prisma: {
      user: { findFirst: async () => ({ id: 1, name: "Manager" }) },
      proLaboreAdvance: { create: async ({ data }: any) => { writes.push(data); return { id: 1, ...data }; } },
      auditLog: { create: async () => ({}) },
    },
  });
  for (const [amount, expected] of [["0.01", 1], ["1.50", 150]] as const) {
    const res = response();
    await handler({ body: { managerUserId: 1, amount }, user: {} }, res);
    assert.equal(res.code, 201);
    assert.equal(writes.at(-1).amountCents, expected);
  }
  assert.equal(writes[0].amount, 0); // mirror is never used for validation
  for (const amount of ["0", "-0.01"]) {
    const res = response();
    await handler({ body: { managerUserId: 1, amount }, user: {} }, res);
    assert.equal(res.code, 400);
  }
  assert.equal(writes.length, 2);
});

test("2C2-F current payment reais is exact; no mirror-based inference", () => {
  for (const [reais, cents] of [["0.01", 1], ["1.50", 150], ["123.00", 12300]] as const) {
    assert.equal(canonical.resolvePaidAmountCents({ obligationAmountCents: 12345, paidAmountReais: reais }), cents);
  }
  assert.equal(canonical.resolvePaidAmountCents({ obligationAmountCents: 12345 }), 12345);
  assert.equal(canonical.resolvePaidAmountCents({ obligationAmountCents: 12345, paidAmountCents: 1, paidAmountReais: "123.00" }), 1);
  for (const invalid of [0, -1, 1.5, NaN, Infinity, ""]) {
    assert.throws(() => canonical.resolvePaidAmountCents({ obligationAmountCents: 12345, paidAmountCents: invalid, paidAmountReais: "123.00" }));
  }
  for (const invalid of ["abc", "1.005", ""]) {
    assert.throws(() => canonical.resolvePaidAmountCents({ obligationAmountCents: 12345, paidAmountReais: invalid }));
  }
  assert.throws(() => canonical.resolvePaidAmountCents({ obligationAmountCents: null }), canonical.AmbiguousMoneyError);
  assert.doesNotMatch(fn("calculateProposalTotals").getText(source), /item\.amount\s*\?\?\s*0/);
});

test("2C2-F receipt payment provenance requires explicit historical classification", () => {
  assert.equal(canonical.resolveReceiptPaidAmountCents({ paidAmountCents: 0, paidAmountReais: 40 }), 0);
  assert.equal(canonical.resolveReceiptPaidAmountCents({ paidAmountReais: 40, legacyClassification: "LEGACY_CONFIRMED" }), 4000);
  assert.throws(() => canonical.resolveReceiptPaidAmountCents({ paidAmountReais: 40 }), canonical.AmbiguousMoneyError);
  assert.throws(() => canonical.resolveReceiptPaidAmountCents({ paidAmountReais: 40, legacyClassification: "AMBIGUOUS" }), canonical.AmbiguousMoneyError);
  assert.throws(() => canonical.resolveReceiptPaidAmountCents({ legacyClassification: "LEGACY_CONFIRMED" }));
});

test("2C2-F real proposal route distinguishes explicit zero from absent/invalid price", async (t) => {
  t.mock.method(console, "error", () => {});
  const writes: any[] = [];
  const calculateProposalTotals = evaluate(fn("calculateProposalTotals"));
  const normalizeProposalPaymentSchedule = evaluate(fn("normalizeProposalPaymentSchedule"), {
    ProposalPaymentScheduleType: { ENTRADA: "ENTRADA", PARCELA: "PARCELA" },
    formatCurrencyBRFromCents: canonical.formatCanonicalCents,
  });
  const handler = evaluate(route("/proposals"), {
    calculateProposalTotals, normalizeProposalPaymentSchedule,
    generateProposalNumber: async () => "TEST", generatePublicToken: () => "LOCAL",
    createProposalHistory: async () => {},
    prisma: {
      protocol: { findUnique: async () => ({ id: 1, clientId: 1, protocolNumber: "P", client: { name: "C" }, serviceType: { name: "S" } }) },
      proposal: { create: async ({ data }: any) => { writes.push(data); return { id: 1, ...data }; } },
      auditLog: { create: async () => {} },
    },
  });
  for (const [price, accepted] of [[{ unitAmountCents: 0 }, true], [{ unitAmount: "0.00" }, true], [{}, false],
    [{ unitAmountCents: "abc" }, false], [{ unitAmountCents: 1.5 }, false], [{ unitAmount: "abc" }, false]] as const) {
    const res = response();
    const before = writes.length;
    await handler({ body: { protocolId: 1, title: "Test", paymentMode: "A_VISTA",
      items: [{ serviceName: "Priced", quantity: 1, unitAmountCents: 10000 }, { serviceName: "Second", quantity: 1, ...price }],
      paymentSchedule: [{ type: "ENTRADA", installmentNumber: 0, amountCents: 10000, dueDate: "2026-10-01" }] } }, res);
    if (accepted) {
      assert.equal(res.code, 201);
      assert.equal(writes.at(-1).items.create[1].unitAmountCents, 0);
    } else {
      assert.ok(res.code >= 400);
      assert.equal(writes.length, before);
    }
  }
});

test("2C2-F whole receipt function uses paid fact; ambiguity fails before IO", async () => {
  let texts: string[] = [];
  let io = 0;
  function FakeDoc() {
    let proxy: any;
    proxy = new Proxy({ y: 100 }, { get(target, key) {
      if (key === "y") return target.y;
      return (...args: any[]) => { if (key === "text") texts.push(args[0]); return proxy; };
    } });
    return proxy;
  }
  const receipt = evaluate(fn("generateReceiptPdfForBillingCharge"), {
    path, process: { cwd: () => "/private/tmp" }, PDFDocument: FakeDoc,
    getCompanySettings: async () => { io++; return {}; },
    getBillingChargeStageLabel: () => "parcela", formatCurrencyBRFromCents: canonical.formatCanonicalCents,
    fs: { mkdirSync: () => { io++; }, createWriteStream: () => ({ on(event: string, cb: Function) { if (event === "finish") cb(); return this; } }) },
  });
  const historical = { id: 1, amountCents: 10000, amount: 100, paidAmount: 40, paidAmountCents: null };
  await receipt(historical, "LEGACY_CONFIRMED");
  assert.ok(texts.includes("Valor recebido: R$ 40,00"));
  for (const [cents, formatted] of [[1, "R$ 0,01"], [0, "R$ 0,00"]] as const) {
    texts = [];
    await receipt({ ...historical, paidAmountCents: cents });
    assert.ok(texts.includes(`Valor recebido: ${formatted}`));
  }
  const before = io;
  await assert.rejects(receipt(historical), canonical.AmbiguousMoneyError);
  await assert.rejects(receipt({ id: 1, amountCents: 10000, amount: 100 }, "LEGACY_CONFIRMED"));
  assert.equal(io, before);
});
