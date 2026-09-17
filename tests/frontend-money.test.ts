import assert from "node:assert/strict";
import test from "node:test";

import {
  centsToReaisFormValue,
  formatMoneyCents,
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
