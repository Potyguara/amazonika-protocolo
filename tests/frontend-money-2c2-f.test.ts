import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as money from "../src/lib/money.ts";

const source = ts.createSourceFile("App.tsx", fs.readFileSync("src/App.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actualFunction(name: string, dependencies: object = {}) {
  let result: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node;
    ts.forEachChild(node, visit);
  }
  visit(source);
  assert.ok(result);
  const js = ts.transpileModule(`(${result.getText(source)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(js, { ...money, ...dependencies });
}

test("2C2-F money draft distinguishes absent, zero, valid and invalid", () => {
  assert.deepEqual(money.moneyInputState(""), { status: "ABSENT" });
  assert.deepEqual(money.moneyInputState("0"), { status: "VALID", cents: 0 });
  assert.deepEqual(money.moneyInputState("0,01"), { status: "VALID", cents: 1 });
  for (const value of ["abc", "1,005"]) {
    assert.equal(money.moneyInputState(value).status, "INVALID");
    assert.throws(() => money.optionalEntryInputCents(value));
  }
  assert.equal(money.optionalEntryInputCents(""), 0); // explicitly permitted absent entry
});

test("2C2-F finance preview and real distribution action never use invalid input as zero", () => {
  for (const [total, entry, installments] of [["100", "abc", ["", ""]], ["abc", "0", ["", ""]],
    ["100", "0", ["abc", "50"]], ["100", "1,005", ["", ""]]] as [string, string, string[]][]) {
    const preview = money.financeMoneyPreview(total, entry, installments);
    assert.equal(preview.canDistribute, false);
    assert.equal(preview.differenceCents, null);
    let distributed = false;
    let error = "";
    actualFunction("distributeFinanceBalanceEqually", {
      financePreview: preview, financeBalanceCents: preview.balanceCents, transactionInstallmentQty: "2",
      setTransactionInstallmentAmounts: () => { distributed = true; }, setError: (value: string) => { error = value; },
    })();
    assert.equal(distributed, false);
    assert.ok(error);
  }
  const zero = money.financeMoneyPreview("100", "0", ["50", "50"]);
  assert.equal(zero.entry.status, "VALID");
  assert.equal(zero.entryCents, 0);
  assert.equal(zero.differenceCents, 0);
  const absent = money.financeMoneyPreview("100", "", ["", ""]);
  assert.equal(absent.entry.status, "ABSENT");
  assert.equal(absent.entryCents, null);
  assert.equal(absent.canDistribute, true);
  let amounts: string[] = [];
  actualFunction("distributeFinanceBalanceEqually", {
    financePreview: absent, financeBalanceCents: absent.balanceCents, transactionInstallmentQty: "3",
    setTransactionInstallmentAmounts: (value: string[]) => { amounts = value; }, setError: () => {},
  })();
  assert.equal(amounts.reduce((sum, value) => sum + money.reaisFormValueToCents(value), 0), 10000);
});

test("2C2-F real proposal rebuild reserves 30 percent for absent entry only", () => {
  for (const input of ["abc", "1,005", "0", "-1"]) {
    let writes = 0;
    let error = "";
    actualFunction("rebuildPaymentSchedule", {
      proposalTotalCents: 10000, paymentMode: "ENTRADA_PARCELAS", entryAmount: input, installmentQty: "2", today: "2026-09-17",
      setError: (value: string) => { error = value; }, setEntryAmount: () => { writes++; },
      setInstallmentQty: () => { writes++; }, setPaymentSchedule: () => { writes++; },
      addDaysToIsoDate: () => "2026-10-17",
    })();
    assert.equal(writes, 0);
    assert.ok(error);
  }
  for (const [input, expected] of [["", "30.00"], ["0,01", "0.01"], ["1,50", "1.50"]]) {
    let entry: string | undefined;
    let rows: { amount: string }[] = [];
    actualFunction("rebuildPaymentSchedule", {
      proposalTotalCents: 10000, paymentMode: "ENTRADA_PARCELAS", entryAmount: input, installmentQty: "2", today: "2026-09-17",
      setError: () => {}, setEntryAmount: (value: string) => { entry = value; }, setInstallmentQty: () => {},
      setPaymentSchedule: (value: { amount: string }[]) => { rows = value; }, addDaysToIsoDate: () => "2026-10-17",
    })();
    assert.equal(entry, expected);
    assert.equal(rows.reduce((sum, row) => sum + money.reaisFormValueToCents(row.amount), 0), 10000);
  }
});

test("2C2-F1 real proposal rebuild rejects incompatible explicit entry without rewriting it", () => {
  const cases = [
    { label: "A", total: 10000, input: "99.98", qty: "2", expected: [9998, 1, 1] },
    { label: "B", total: 10000, input: "99.99", qty: "2", error: /saldo/i },
    { label: "C", total: 10000, input: "100.00", qty: "2", error: /entrada deve ser menor/i },
    { label: "D", total: 10000, input: "150.00", qty: "2", error: /entrada deve ser menor/i },
    { label: "E", total: 2, input: "0.02", qty: "1", error: /entrada deve ser menor/i },
    { label: "F", total: 10000, input: "", qty: "2", expected: [3000, 3500, 3500] },
    { label: "G", total: 10000, input: "abc", qty: "2", error: /inválido/i },
  ];
  for (const scenario of cases) {
    let entry = scenario.input;
    let writes = 0;
    let error = "";
    let rows: { amount: string }[] = [];
    actualFunction("rebuildPaymentSchedule", {
      proposalTotalCents: scenario.total, paymentMode: "ENTRADA_PARCELAS",
      entryAmount: scenario.input, installmentQty: scenario.qty, today: "2026-09-17",
      setError: (value: string) => { error = value; },
      setEntryAmount: (value: string) => { writes++; entry = value; },
      setInstallmentQty: () => { writes++; },
      setPaymentSchedule: (value: { amount: string }[]) => { writes++; rows = value; },
      addDaysToIsoDate: () => "2026-10-17",
    })();
    if (scenario.error) {
      assert.match(error, scenario.error, scenario.label);
      assert.equal(writes, 0, scenario.label);
      assert.equal(entry, scenario.input, scenario.label);
    } else {
      assert.equal(error, "", scenario.label);
      const cents = Array.from(rows, row => money.reaisFormValueToCents(row.amount));
      assert.deepEqual(cents, scenario.expected, scenario.label);
      assert.ok(cents.every(value => value > 0), scenario.label);
      assert.equal(cents.reduce((sum, value) => sum + value, 0), scenario.total, scenario.label);
    }
  }
});

test("2C2-F manager presentation keeps absence distinct from zero", () => {
  const format = actualFunction("formatOptionalMoneyCents");
  for (const value of [null, undefined]) assert.equal(format(value), "Valor canônico indisponível");
  assert.equal(format(0), "R$ 0,00");
  assert.equal(format(1), "R$ 0,01");
  const text = source.getFullText();
  const panel = text.slice(text.indexOf("function ManagementMoneyCards"), text.indexOf("const maxChartValue"));
  assert.doesNotMatch(panel, /currentManager\?\.(?:saldoReceberCents|advancesCents)\s*\?\?\s*0/);
  assert.doesNotMatch(panel, /currentManager\?\.proLaboreCents\s*\?\?\s*data\.proLaboreIndividualCents/);
  assert.match(panel, /formatOptionalMoneyCents\(data\.currentManager\?\.saldoReceberCents\)/);
});
