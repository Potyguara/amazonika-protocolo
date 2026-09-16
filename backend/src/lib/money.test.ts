import assert from "node:assert/strict";
import { test } from "node:test";
import {
  applyRateCents, assertMoneyCents, assertPrismaIntCents, centsToBbValue,
  distributeCents, formatBRL, MoneyCents, MoneyLocale, parseReaisInput,
} from "./money";

const cents = assertMoneyCents;
const examples: [string, number, string][] = [
  ["R$ 1,00", 100, "1.00"],
  ["R$ 1,50", 150, "1.50"],
  ["R$ 123,45", 12345, "123.45"],
  ["R$ 1.234,56", 123456, "1234.56"],
  ["R$ 0,01", 1, "0.01"],
];
for (const [display, value, bb] of examples) {
  test(`round trip and BB serialization: ${display}`, () => {
    assert.equal(parseReaisInput(display, "pt-BR"), value);
    assert.equal(formatBRL(cents(value)), display);
    assert.equal(centsToBbValue(cents(value)), bb);
    assert.equal(parseReaisInput(bb, "en-US"), value);
  });
}

test("explicit locale, sign, zero and short fractions", () => {
  assert.equal(parseReaisInput("1,234.56", "en-US"), 123456);
  assert.equal(parseReaisInput("1.234", "pt-BR"), 123400);
  assert.equal(parseReaisInput("1,5", "pt-BR"), 150);
  assert.equal(parseReaisInput("0", "pt-BR"), 0);
  assert.equal(formatBRL(cents(0)), "R$ 0,00");
  assert.equal(parseReaisInput("-R$ 1,50", "pt-BR"), -150);
  assert.equal(formatBRL(cents(-150)), "-R$ 1,50");
});

test("invalid, ambiguous and overprecise input is rejected without rounding", () => {
  for (const input of ["", " ", "1.50", "1,234", "12.34,56", "1,234.56", "1e2", "NaN", "Infinity", "1 234,56", "R$", "0,001", "1,00x"]) {
    assert.throws(() => parseReaisInput(input, "pt-BR"), input);
  }
  assert.throws(() => parseReaisInput("1.234", "en-US"));
  assert.throws(() => parseReaisInput("1,234", undefined as unknown as MoneyLocale));
  assert.throws(() => parseReaisInput(null as unknown as string, "pt-BR"));
});

test("cent inputs reject null, coercion, fractions and unsafe integers", () => {
  for (const value of [null, undefined, "100", true, NaN, Infinity, -Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => cents(value));
  }
  assert.equal(cents(Number.MAX_SAFE_INTEGER), Number.MAX_SAFE_INTEGER);
  assert.equal(cents(Number.MIN_SAFE_INTEGER), Number.MIN_SAFE_INTEGER);
  assert.equal(Object.is(cents(-0), -0), false);
  assert.throws(() => formatBRL(1.5 as MoneyCents));
  assert.throws(() => centsToBbValue(NaN as MoneyCents));
  assert.throws(() => centsToBbValue(cents(0)));
  assert.throws(() => centsToBbValue(cents(-1)));
});

test("safe integer and Prisma Int limits are distinct and checked", () => {
  assert.equal(parseReaisInput("90.071.992.547.409,91", "pt-BR"), Number.MAX_SAFE_INTEGER);
  assert.equal(formatBRL(cents(Number.MAX_SAFE_INTEGER)), "R$ 90.071.992.547.409,91");
  assert.equal(centsToBbValue(cents(Number.MAX_SAFE_INTEGER)), "90071992547409.91");
  assert.throws(() => parseReaisInput("90.071.992.547.409,92", "pt-BR"));
  assert.throws(() => parseReaisInput("-90.071.992.547.409,92", "pt-BR"));
  assert.equal(assertPrismaIntCents(2147483647), 2147483647);
  assert.equal(assertPrismaIntCents(-2147483648), -2147483648);
  assert.throws(() => assertPrismaIntCents(2147483648));
  assert.throws(() => assertPrismaIntCents(-2147483649));
});

test("A-D: exact distribution with deterministic remainder", () => {
  for (const [total, entry, count, expected] of [
    [100000, 20000, 4, [20000, 20000, 20000, 20000]],
    [100001, 20000, 3, [26667, 26667, 26667]],
    [10000, 0, 3, [3333, 3333, 3334]],
    [3, 0, 3, [1, 1, 1]],
  ] as const) {
    const result = distributeCents(cents(total), cents(entry), count);
    assert.deepEqual(result, expected);
    assert.equal(result.reduce((sum, value) => sum + value, entry), total);
    assert.ok(result.every(value => value > 0 && Number.isSafeInteger(value)));
  }
});

test("distribution rejects zero installments, invalid counts and insufficient cents", () => {
  for (const count of [0, -1, 1.5, NaN, Infinity, Number.MAX_SAFE_INTEGER, 4]) {
    assert.throws(() => distributeCents(cents(3), cents(0), count));
  }
  for (const entry of [-1, 3, 4]) {
    assert.throws(() => distributeCents(cents(3), cents(entry), 1));
  }
  assert.throws(() => distributeCents(1.5 as MoneyCents, cents(0), 1));
  const result = distributeCents(cents(Number.MAX_SAFE_INTEGER), cents(0), 7);
  assert.equal(result.reduce((sum, value) => sum + BigInt(value), 0n), BigInt(Number.MAX_SAFE_INTEGER));
});

test("rates use integer basis points and explicit half-away-from-zero rounding", () => {
  assert.equal(applyRateCents(cents(12345), 1000), 1235);
  assert.equal(applyRateCents(cents(1), 5000), 1);
  assert.equal(applyRateCents(cents(-1), 5000), -1);
  assert.equal(applyRateCents(cents(1), 4999), 0);
  assert.equal(applyRateCents(cents(100), 0), 0);
  assert.equal(applyRateCents(cents(Number.MAX_SAFE_INTEGER), 10000), Number.MAX_SAFE_INTEGER);
  assert.throws(() => applyRateCents(cents(Number.MAX_SAFE_INTEGER), 20000));
  for (const rate of [1.5, -1, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => applyRateCents(cents(100), rate));
  }
  assert.throws(() => applyRateCents(1.5 as MoneyCents, 100));
});
