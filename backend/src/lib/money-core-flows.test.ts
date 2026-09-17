import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { test } from "node:test";
import ts from "typescript";
import {
  AmbiguousMoneyError,
  canonicalCentsOrLegacy,
  legacyReaisFromCents,
  moneyWriteFromReais,
  normalizeFinancialPlanMoney,
  proposalItemMoney,
  proposalToContractMoney,
  proposalToProtocolMoney,
  reaisInputToCents,
  requirePositiveOperationalCents,
  resolveOperationalMoney,
  resolvePaidAmountCents,
  sumOperationalMoney,
} from "./canonical-money";
import {
  assertMoneyCents,
  centsToBbValue,
  divideCents,
  formatBRL,
  parseReaisInput,
  sumCents,
} from "./money";

test("2C1 canonical real inputs map exactly to integer cents", () => {
  assert.equal(reaisInputToCents("1.00"), 100);
  assert.equal(reaisInputToCents("1.50"), 150);
  assert.equal(reaisInputToCents("123.45"), 12345);
  assert.equal(reaisInputToCents("1234.56"), 123456);
  assert.equal(parseReaisInput("R$ 1.234,56", "pt-BR"), 123456);
  assert.equal(formatBRL(assertMoneyCents(123456)), "R$ 1.234,56");
  for (const value of [null, undefined, "", "1.234", NaN, Infinity]) {
    assert.throws(() => reaisInputToCents(value));
  }
});

test("core model boundaries derive legacy mirrors from canonical cents", () => {
  const cases = [
    ["FinancialTransaction", "integer-reais"],
    ["BillingCharge", "integer-reais"],
    ["FixedCost", "integer-reais"],
    ["EmployeeSalary", "integer-reais"],
    ["ProLaboreAdvance", "integer-reais"],
    ["FiscalDocument", "integer-reais"],
    ["Proposal", "integer-reais"],
    ["Payment", "decimal-reais"],
    ["Contract", "decimal-reais"],
    ["Protocol", "decimal-reais"],
  ] as const;
  for (const [model, storage] of cases) {
    const result = moneyWriteFromReais("123.45", storage);
    assert.equal(result.amountCents, 12345, model);
    assert.equal(result.amount, storage === "integer-reais" ? 123 : 123.45, model);
  }
});

test("every direct core Prisma monetary writer pairs legacy and canonical fields", () => {
  const fileName = path.resolve(process.cwd(), "src/server.ts");
  const sourceText = fs.readFileSync(fileName, "utf8");
  const source = ts.createSourceFile(
    fileName,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const contracts: Record<string, ReadonlyArray<readonly [string, string]>> = {
    financialTransaction: [["amount", "amountCents"]],
    billingCharge: [["amount", "amountCents"], ["paidAmount", "paidAmountCents"]],
    fixedCost: [["amount", "amountCents"]],
    employeeSalary: [["amount", "amountCents"]],
    proLaboreAdvance: [["amount", "amountCents"]],
    payment: [["amount", "amountCents"]],
    fiscalDocument: [["amount", "amountCents"]],
    proposal: [
      ["totalAmount", "totalAmountCents"],
      ["entryAmount", "entryAmountCents"],
      ["installmentAmount", "installmentAmountCents"],
    ],
    contract: [["contractValue", "contractValueCents"], ["entryAmount", "entryAmountCents"]],
    protocol: [["estimatedValue", "estimatedValueCents"], ["finalValue", "finalValueCents"]],
  };

  const resultObjects = (node: ts.Expression): ts.ObjectLiteralExpression[] => {
    if (ts.isObjectLiteralExpression(node)) return [node];
    if (ts.isConditionalExpression(node)) {
      return [...resultObjects(node.whenTrue), ...resultObjects(node.whenFalse)];
    }
    if (ts.isParenthesizedExpression(node)) return resultObjects(node.expression);
    return [];
  };
  const propertyName = (property: ts.ObjectLiteralElementLike) =>
    property.name && ts.isIdentifier(property.name) ? property.name.text : null;
  const failures: string[] = [];

  const visit = (node: ts.Node) => {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const operation = node.expression.name.text;
      const receiver = node.expression.expression;
      if (["create", "update", "upsert"].includes(operation) && ts.isPropertyAccessExpression(receiver)) {
        const model = receiver.name.text;
        const pairs = contracts[model];
        const argument = node.arguments[0];
        if (pairs && argument && ts.isObjectLiteralExpression(argument)) {
          const data = argument.properties.find(
            (property): property is ts.PropertyAssignment =>
              ts.isPropertyAssignment(property) && propertyName(property) === "data"
          );
          if (data) {
            for (const object of resultObjects(data.initializer)) {
              const names = new Set(object.properties.map(propertyName).filter(Boolean));
              for (const [legacy, canonical] of pairs) {
                if (names.has(legacy) && !names.has(canonical)) {
                  const line = source.getLineAndCharacterOfPosition(object.getStart(source)).line + 1;
                  failures.push(`${model}.${operation} linha ${line}: ${legacy} sem ${canonical}`);
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.deepEqual(failures, []);
});

test("legacy mirrors are derived from canonical cents and never become authoritative", () => {
  assert.deepEqual(moneyWriteFromReais("123.45", "integer-reais"), {
    amountCents: 12345,
    amount: 123,
  });
  assert.deepEqual(moneyWriteFromReais("123.45", "decimal-reais"), {
    amountCents: 12345,
    amount: 123.45,
  });
  assert.equal(legacyReaisFromCents(150, "integer-reais"), 2);
  assert.equal(canonicalCentsOrLegacy(150, 999), 150);
  assert.equal(canonicalCentsOrLegacy(null, "1.50"), 150);
  assert.throws(() => canonicalCentsOrLegacy(1.5, 1.5));
});

test("financial plans A-D conserve their exact canonical totals", () => {
  const cases = [
    ["1000.00", "200.00", ["200.00", "200.00", "200.00", "200.00"], 100000],
    ["1000.01", "200.00", ["266.67", "266.67", "266.67"], 100001],
    ["100.00", "0.00", ["33.33", "33.33", "33.34"], 10000],
    ["0.03", "0.00", ["0.01", "0.01", "0.01"], 3],
  ] as const;
  for (const [total, entry, installments, expected] of cases) {
    const result = normalizeFinancialPlanMoney({ total, entry, installments });
    assert.equal(result.totalAmountCents, expected);
    assert.equal(
      result.entryAmountCents + result.installmentAmountsCents.reduce((sum, value) => sum + value, 0),
      expected,
    );
  }
  assert.throws(() => normalizeFinancialPlanMoney({
    total: "0.03", entry: "0.00", installments: ["0.01", "0.02", "0.01"],
  }));
  assert.throws(() => normalizeFinancialPlanMoney({
    total: "0.03", entry: "0.00", installments: ["0.00", "0.03"],
  }));
});

test("proposal items and BB serialization stay in cents internally", () => {
  assert.deepEqual(proposalItemMoney(2, "123.45"), {
    unitAmountCents: 12345,
    totalAmountCents: 24690,
    unitAmount: 123,
    totalAmount: 247,
  });
  assert.equal(centsToBbValue(assertMoneyCents(1)), "0.01");
  assert.equal(centsToBbValue(assertMoneyCents(150)), "1.50");
  assert.equal(centsToBbValue(assertMoneyCents(12345)), "123.45");
  assert.equal(centsToBbValue(assertMoneyCents(123456)), "1234.56");
});

test("Proposal copies canonical cents exactly to Contract and Protocol", () => {
  assert.deepEqual(proposalToContractMoney(100001, 20000), {
    contractValueCents: 100001,
    entryAmountCents: 20000,
    contractValue: 1000.01,
    entryAmount: 200,
  });
  assert.deepEqual(proposalToProtocolMoney(100001), {
    finalValueCents: 100001,
    finalValue: 1000.01,
  });
  assert.throws(() => proposalToContractMoney(100, 101));
  assert.throws(() => proposalToProtocolMoney(0));
});

test("2C2-A operational reads distinguish canonical, confirmed legacy and ambiguous values", () => {
  assert.deepEqual(resolveOperationalMoney({
    canonicalCents: 1,
    legacyReais: 0,
    legacyClassification: "AMBIGUOUS",
    label: "Transação",
  }), { amountCents: 1, source: "CANONICAL" });

  assert.deepEqual(resolveOperationalMoney({
    canonicalCents: 0,
    legacyReais: 999,
    legacyClassification: "LEGACY_CONFIRMED",
  }), { amountCents: 0, source: "CANONICAL" });

  assert.deepEqual(resolveOperationalMoney({
    canonicalCents: null,
    legacyReais: "1.50",
    legacyClassification: "LEGACY_CONFIRMED",
  }), { amountCents: 150, source: "LEGACY_CONFIRMED" });

  assert.throws(() => resolveOperationalMoney({
    canonicalCents: null,
    legacyReais: "1.50",
    legacyClassification: "AMBIGUOUS",
  }), AmbiguousMoneyError);
  assert.throws(() => resolveOperationalMoney({ canonicalCents: null, legacyReais: null }), AmbiguousMoneyError);
});

test("2C2-A operational eligibility and mark-paid preserve cents", () => {
  assert.equal(requirePositiveOperationalCents({
    canonicalCents: 1,
    legacyReais: 0,
    legacyClassification: "AMBIGUOUS",
    label: "Transação",
  }), 1);
  assert.throws(() => requirePositiveOperationalCents({
    canonicalCents: 0,
    legacyReais: 999,
    legacyClassification: "LEGACY_CONFIRMED",
  }), RangeError);
  assert.equal(resolvePaidAmountCents({ obligationAmountCents: 12345 }), 12345);
  assert.equal(resolvePaidAmountCents({
    obligationAmountCents: 12345,
    paidAmountReais: 123,
    legacyObligationReais: 123,
  }), 12345);
  assert.equal(resolvePaidAmountCents({
    obligationAmountCents: 99999,
    paidAmountReais: "123.45",
  }), 12345);
  assert.equal(resolvePaidAmountCents({
    obligationAmountCents: 99999,
    paidAmountCents: 12345,
    paidAmountReais: "1.00",
  }), 12345);
  assert.throws(() => resolvePaidAmountCents({ obligationAmountCents: null }), AmbiguousMoneyError);
});

test("2C2-A BB, payment-plan and summaries remain exact integer cents", () => {
  assert.equal(centsToBbValue(assertMoneyCents(1)), "0.01");
  assert.equal(centsToBbValue(assertMoneyCents(12345)), "123.45");

  const paymentPlan = [20000, 26667, 26667, 26667].map(assertMoneyCents);
  assert.equal(sumCents(paymentPlan), 100001);
  assert.equal(sumOperationalMoney(
    [{ amountCents: 1 }, { amountCents: 150 }, { amountCents: 12345 }],
    { legacyClassification: "AMBIGUOUS", label: "Resumo" },
  ), 12496);
  assert.equal(divideCents(assertMoneyCents(100), 3), 33);
});

test("2C2-A server exposes canonical payment-plan fields and avoids legacy real aggregations", () => {
  const sourceText = fs.readFileSync(path.resolve(process.cwd(), "src/server.ts"), "utf8");
  const paymentPlanStart = sourceText.indexOf('"/finance/transactions/:id/payment-plan"');
  const paymentPlanEnd = sourceText.indexOf("// Proteções emergenciais compartilhadas", paymentPlanStart);
  const paymentPlanRoute = sourceText.slice(paymentPlanStart, paymentPlanEnd);

  assert.ok(paymentPlanRoute.includes("amountCents: true"));
  assert.ok(paymentPlanRoute.includes("paidAmountCents: true"));
  assert.ok(paymentPlanRoute.includes("totalAmountCents"));
  assert.ok(paymentPlanRoute.includes("installmentAmountsCents"));
  assert.ok(!sourceText.includes("Math.round(baseLiquida *"));
  assert.ok(!sourceText.includes("sum + Number(item.amount || 0)"));
});
