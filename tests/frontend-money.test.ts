import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  applyRateCents,
  centsToReaisFormValue,
  distributeMoneyCents,
  formatMoneyCents,
  multiplyMoneyCents,
  reaisFormValueToCents,
} from "../src/lib/money.ts";

test("frontend formats canonical cents at the display boundary", () => {
  assert.equal(formatMoneyCents(1), "R$ 0,01");
  assert.equal(formatMoneyCents(150), "R$ 1,50");
  assert.equal(formatMoneyCents(12345), "R$ 123,45");
  assert.equal(formatMoneyCents(100001), "R$ 1.000,01");
});

test("frontend converts form reais without floating-point multiplication", () => {
  assert.equal(reaisFormValueToCents("1.00"), 100);
  assert.equal(reaisFormValueToCents("1,50"), 150);
  assert.equal(reaisFormValueToCents("123.45"), 12345);
  assert.equal(centsToReaisFormValue(100001), "1000.01");
});

test("payment plan preserves its exact canonical total", () => {
  assert.equal(20000 + 26667 + 26667 + 26667, 100001);
});

test("mark-paid uses canonical cents and preserves zero without fallback", () => {
  const charge = { amount: 123, amountCents: 12345 };

  assert.equal(charge.amountCents, 12345);
  assert.equal(formatMoneyCents(charge.amountCents), "R$ 123,45");
  assert.equal(formatMoneyCents(0), "R$ 0,00");
  assert.throws(() => formatMoneyCents(null));
});

test("ambiguous or unsafe form values are rejected", () => {
  assert.throws(() => reaisFormValueToCents("1.234,56"));
  assert.throws(() => reaisFormValueToCents("1.005"));
  assert.throws(() => reaisFormValueToCents("Infinity"));
  assert.throws(() => formatMoneyCents(Number.MAX_SAFE_INTEGER + 1));
});

test("proposal calculations remain in canonical cents", () => {
  assert.equal(multiplyMoneyCents(12345, 1), 12345);
  assert.equal(formatMoneyCents(multiplyMoneyCents(12345, 1)), "R$ 123,45");
  assert.equal(applyRateCents(100001, 3000), 30000);
  assert.deepEqual(distributeMoneyCents(80001, 3), [26667, 26667, 26667]);
});

test("canonical presentation covers protocol, proposal, contract, charge and fiscal values", () => {
  const protocol = { estimatedValueCents: 1 };
  const proposalItem = { unitAmountCents: 12345 };
  const proposal = { totalAmountCents: 100001 };
  const proposalSchedule = [20000, 26667, 26667, 26667];
  const contract = { contractValueCents: 100001 };
  const contractSchedule = { amountCents: 1 };
  const charge = { amountCents: 1, paidAmountCents: 150 };
  const fiscalDocument = { amountCents: 12345 };

  assert.equal(formatMoneyCents(protocol.estimatedValueCents), "R$ 0,01");
  assert.equal(formatMoneyCents(proposalItem.unitAmountCents), "R$ 123,45");
  assert.equal(formatMoneyCents(proposal.totalAmountCents), "R$ 1.000,01");
  assert.equal(proposalSchedule.reduce((sum, value) => sum + value, 0), 100001);
  assert.equal(formatMoneyCents(contract.contractValueCents), "R$ 1.000,01");
  assert.equal(formatMoneyCents(contractSchedule.amountCents), "R$ 0,01");
  assert.equal(formatMoneyCents(charge.amountCents), "R$ 0,01");
  assert.equal(formatMoneyCents(charge.paidAmountCents), "R$ 1,50");
  assert.equal(formatMoneyCents(fiscalDocument.amountCents), "R$ 123,45");
});

test("canonical zero never falls back to a nonzero legacy value", () => {
  const charge = { amountCents: 0, amount: 999 };
  assert.equal(formatMoneyCents(charge.amountCents), "R$ 0,00");
});

test("new proposal calculations do not round values expressed in reais", () => {
  const appSource = fs.readFileSync(path.resolve(process.cwd(), "src/App.tsx"), "utf8");
  const proposalStart = appSource.indexOf("function ProposalPanel");
  const proposalEnd = appSource.indexOf("function BillingPanel", proposalStart);
  const proposalSource = appSource.slice(proposalStart, proposalEnd);
  const moneySource = fs.readFileSync(path.resolve(process.cwd(), "src/lib/money.ts"), "utf8");

  assert.ok(proposalStart >= 0 && proposalEnd > proposalStart);
  assert.doesNotMatch(proposalSource, /Math\.round/);
  assert.doesNotMatch(moneySource, /parseFloat\([^)]*\)\s*\*\s*100/);
});
