import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import { reaisFormValueToCents, centsToReaisFormValue, formatOptionalMoneyCents,
  distributeMoneyCents, multiplyMoneyCents, moneyPreviewText } from "../src/lib/money.ts";

test("2C2-E strict input, zero, invalid precision and absence", () => {
  for (const [input, cents] of [["0,01",1],["1,50",150],["123,45",12345],["0",0],["0,00",0],["1.50",150]] as const) {
    assert.equal(reaisFormValueToCents(input), cents);
    assert.equal(reaisFormValueToCents(centsToReaisFormValue(cents)), cents);
  }
  for (const input of ["abc","1,005","", "1.234,56", "NaN", "Infinity"]) {
    assert.throws(() => reaisFormValueToCents(input));
    assert.notEqual(moneyPreviewText(() => String(reaisFormValueToCents(input))), "0");
  }
  for (const [cents, output] of [[1,"R$ 0,01"],[150,"R$ 1,50"],[12345,"R$ 123,45"],[0,"R$ 0,00"]] as const) {
    assert.equal(formatOptionalMoneyCents(cents),output);
  }
  assert.equal(formatOptionalMoneyCents(null),"—");
  assert.equal(formatOptionalMoneyCents(undefined),"—");
  for (const value of [NaN,Infinity,123.45,"150",true]) assert.throws(() => formatOptionalMoneyCents(value as number));
});

test("2C2-E standalone uses last-installment remainder and established quantity rounding", () => {
  assert.deepEqual(distributeMoneyCents(10000,3,"last"),[3333,3333,3334]);
  assert.equal(distributeMoneyCents(10000,3,"last").reduce((a,b)=>a+b,0),10000);
  assert.deepEqual(distributeMoneyCents(10000-150,3,"last"),[3283,3283,3284]);
  assert.equal(multiplyMoneyCents(101,1.5),152);
  assert.throws(()=>distributeMoneyCents(2,3,"last"));
});

test("2C2-E affected components use shared boundaries", () => {
  const files = ["src/pages/CatalogPage.tsx","src/pages/StandaloneProposalEditorPage.tsx",
    "src/pages/StandaloneProposalsPage.tsx","src/components/finance/PartnerCommissionsPanel.tsx",
    "src/components/finance/PartnersFinanceTab.tsx","src/components/partners/PartnerReferralPanel.tsx"];
  for (const file of files) {
    const source = fs.readFileSync(file,"utf8");
    assert.match(source,/formatOptionalMoneyCents/);
    assert.doesNotMatch(source,/Number\(value\s*(?:\|\||\?\?)\s*0\)\s*\/\s*100/);
    assert.doesNotMatch(source,/Math\.round\([^;]*\*\s*100\)/);
  }
  const editor=fs.readFileSync(files[1],"utf8");
  assert.match(editor,/distributeMoneyCents\(total - entry, qty, "last"\)/);
  assert.doesNotMatch(editor,/Math\.round/);
  assert.match(editor,/moneyPreviewText\(commercialInstallmentsText\)/);
  assert.match(editor,/reaisFormValueToCents as currencyInputToCents/);
});

test("2C2-E real editor preview text and scalar preserve exact terms", async () => {
  const ts = (await import("typescript")).default;
  const vm = await import("node:vm");
  const source = ts.createSourceFile("editor.tsx",fs.readFileSync("src/pages/StandaloneProposalEditorPage.tsx","utf8"),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  const names = new Set(["commercialTotalPreview","commercialEntryPreview","commercialInstallmentsPreview","commercialInstallmentPreview","commercialInstallmentsText","generatedPaymentText"]);
  const declarations: string[] = [];
  function visit(node: import("typescript").Node) {
    if (ts.isFunctionDeclaration(node) && node.name && names.has(node.name.text)) declarations.push(node.getText(source));
    ts.forEachChild(node,visit);
  }
  visit(source);
  assert.equal(declarations.length,names.size);
  const js = ts.transpileModule(declarations.join("\n"),{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText;
  const context = vm.createContext({
    proposal:{subtotalAmount:10000},commercialDiscount:"0",commercialAddition:"0",
    commercialPaymentMode:"PARCELADO",commercialInstallmentQty:"3",commercialEntryAmount:"0",
    currencyInputToCents:reaisFormValueToCents,distributeMoneyCents,money:formatOptionalMoneyCents,
  });
  vm.runInContext(js,context);
  assert.equal(vm.runInContext("commercialInstallmentsPreview().reduce((a,b)=>a+b,0)",context),10000);
  assert.equal(vm.runInContext("commercialInstallmentPreview()",context),null);
  assert.equal(vm.runInContext("generatedPaymentText()",context),"Pagamento em 2 parcela(s) de R$ 33,33 e última parcela de R$ 33,34.");
  context.commercialEntryAmount="1,50";
  context.commercialPaymentMode="ENTRADA_PARCELAS";
  assert.equal(vm.runInContext("commercialInstallmentsPreview().reduce((a,b)=>a+b,0) + commercialEntryPreview()",context),10000);
  context.commercialDiscount="abc";
  assert.throws(()=>vm.runInContext("commercialTotalPreview()",context));
});
