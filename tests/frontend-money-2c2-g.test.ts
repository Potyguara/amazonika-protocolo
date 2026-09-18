import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";
import * as money from "../src/lib/money.ts";

const appSource = ts.createSourceFile("App.tsx", fs.readFileSync("src/App.tsx", "utf8"), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function actualFunction(name: string, dependencies: object = {}) {
  let result: ts.FunctionDeclaration | undefined;
  function visit(node: ts.Node) {
    if (ts.isFunctionDeclaration(node) && node.name?.text === name) result = node;
    ts.forEachChild(node, visit);
  }
  visit(appSource);
  assert.ok(result);
  const js = ts.transpileModule(`(${result.getText(appSource)})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  return vm.runInNewContext(js, { ...money, ...dependencies });
}

test("2C2-G invalid proposal item makes draft total unavailable", () => {
  assert.equal(money.sumValidMoneyCents([10000, null]), null);
  assert.equal(money.sumValidMoneyCents([10000, 5000]), 15000);
  assert.equal(money.sumValidMoneyCents([10000, 0]), 10000);
});

test("2C2-G real save handler refuses a stale schedule after current entry changes", async () => {
  let persisted = 0;
  let error = "";
  const items = [{ serviceName: "Serviço", description: "", quantity: "1", unitAmount: "100.00" }];
  const staleSource = money.proposalScheduleSource(items, "ENTRADA_PARCELAS", "30.00", "2");
  const handler = actualFunction("handleSaveProposal", {
    setSaving: () => {}, setError: (value: string) => { error = value; }, setSuccess: () => {},
    title: "Proposta", items, description: "", technicalScope: "", paymentMode: "ENTRADA_PARCELAS",
    entryAmount: "100.00", installmentQty: "2", paymentScheduleSource: staleSource,
    paymentSchedule: [{ type: "ENTRADA", installmentNumber: 0, totalInstallments: null, amount: "30.00", dueDate: "2026-09-17" },
      { type: "PARCELA", installmentNumber: 1, totalInstallments: 2, amount: "35.00", dueDate: "2026-10-17" },
      { type: "PARCELA", installmentNumber: 2, totalInstallments: 2, amount: "35.00", dueDate: "2026-11-17" }],
    renumberPaymentSchedule: (rows: unknown[]) => rows, executionDays: "30", validUntil: "", clientMessage: "", internalNotes: "",
    protocol: { id: 1 }, editingProposal: null, api: { createProposal: async () => { persisted++; } },
    resetForm: () => {}, setShowForm: () => {}, loadProposals: async () => {}, onReload: undefined,
  });
  await handler();
  assert.equal(persisted, 0);
  assert.match(error, /cronograma financeiro está desatualizado/i);
});

test("2C2-G proposal schedule source changes with governing monetary input", () => {
  const items = [{ quantity: "1", unitAmount: "100.00" }];
  const oldSource = money.proposalScheduleSource(items, "ENTRADA_PARCELAS", "30.00", "2");
  assert.notEqual(oldSource, money.proposalScheduleSource(items, "ENTRADA_PARCELAS", "100.00", "2"));
  assert.notEqual(oldSource, money.proposalScheduleSource([{ quantity: "1", unitAmount: "120.00" }], "ENTRADA_PARCELAS", "30.00", "2"));
  const app = fs.readFileSync("src/App.tsx", "utf8");
  assert.match(app, /paymentScheduleSource !== currentScheduleSource/);
  assert.match(app, /cronograma financeiro está desatualizado/i);
});

test("2C2-G POR_FAIXA manual pricing is editable and backend preserves authorized override", () => {
  const editor = fs.readFileSync("src/pages/StandaloneProposalEditorPage.tsx", "utf8");
  assert.doesNotMatch(editor, /disabled=\{\s*selectedCatalogService\.pricingMode ===\s*"POR_FAIXA"/);
  assert.match(editor, /selectedCatalogService\.allowManualPrice/);
  const backend = fs.readFileSync("backend/src/modules/standalone-proposals/standalone-proposals.routes.ts", "utf8");
  assert.match(backend, /if \(!\(service\.allowManualPrice && manualPrice\)\)/);
  assert.match(backend, /unitAmount = nonnegativeCents\(tier\.unitAmount\)/);
});
