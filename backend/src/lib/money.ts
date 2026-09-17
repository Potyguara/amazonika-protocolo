/** Canonical money is an integer count of cents. No legacy-unit fallback. */
declare const moneyCentsBrand: unique symbol;
export type MoneyCents = number & { readonly [moneyCentsBrand]: true };
export type MoneyLocale = "pt-BR" | "en-US";

export function assertMoneyCents(value: unknown): MoneyCents {
  if (typeof value !== "number" || !Number.isSafeInteger(value)) {
    throw new TypeError("MoneyCents must be a safe integer; null is not zero.");
  }
  return (value === 0 ? 0 : value) as MoneyCents;
}

/** Validate individual Prisma Int fields separately from larger aggregate sums. */
export function assertPrismaIntCents(value: unknown): MoneyCents {
  const cents = assertMoneyCents(value);
  if (cents < -2147483648 || cents > 2147483647) {
    throw new RangeError("Money exceeds the signed 32-bit Prisma Int range.");
  }
  return cents;
}

function fromBigInt(value: bigint): MoneyCents {
  if (value < BigInt(Number.MIN_SAFE_INTEGER) || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError("Money exceeds the safe integer range.");
  }
  return assertMoneyCents(Number(value));
}

/** Locale is mandatory. Grouping must be valid; fractions have at most two digits. */
export function parseReaisInput(text: string, locale: MoneyLocale): MoneyCents {
  if (typeof text !== "string" || (locale !== "pt-BR" && locale !== "en-US")) {
    throw new TypeError("A monetary string and explicit locale are required.");
  }
  const input = text.trim();
  const pattern = locale === "pt-BR"
    ? /^(-?)(?:R\$\s*)?(\d+|[1-9]\d{0,2}(?:\.\d{3})+)(?:,(\d{1,2}))?$/
    : /^(-?)(\d+|[1-9]\d{0,2}(?:,\d{3})+)(?:\.(\d{1,2}))?$/;
  const match = pattern.exec(input);
  if (!match) throw new TypeError("Invalid or ambiguous monetary input for this locale.");
  const whole = match[2].replace(/[.,]/g, "");
  const fraction = (match[3] ?? "").padEnd(2, "0");
  const cents = BigInt(whole) * 100n + BigInt(fraction);
  return fromBigInt(match[1] === "-" ? -cents : cents);
}

function parts(value: MoneyCents): { negative: boolean; whole: string; fraction: string } {
  const validated = BigInt(assertMoneyCents(value));
  const absolute = validated < 0n ? -validated : validated;
  return {
    negative: validated < 0n,
    whole: (absolute / 100n).toString(),
    fraction: (absolute % 100n).toString().padStart(2, "0"),
  };
}

export function formatBRL(cents: MoneyCents): string {
  const { negative, whole, fraction } = parts(cents);
  return `${negative ? "-" : ""}R$ ${whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".")},${fraction}`;
}

/** BB charge amounts must be positive. Serialization only; no network access. */
export function centsToBbValue(cents: MoneyCents): string {
  assertMoneyCents(cents);
  if (cents <= 0) throw new RangeError("BB charge amount must be positive.");
  const { whole, fraction } = parts(cents);
  return `${whole}.${fraction}`;
}

/** Returns future installments only; all remainder goes to the last installment. */
export function distributeCents(
  total: MoneyCents,
  entry: MoneyCents,
  count: number,
): MoneyCents[] {
  assertMoneyCents(total);
  assertMoneyCents(entry);
  if (total <= 0 || entry < 0 || entry >= total) {
    throw new RangeError("A positive balance and an entry between zero and total are required.");
  }
  if (!Number.isSafeInteger(count) || count <= 0 || count > 0xffffffff) {
    throw new RangeError("Installment count must be a positive valid array length.");
  }
  const balance = BigInt(total) - BigInt(entry);
  const quantity = BigInt(count);
  if (quantity > balance) throw new RangeError("Each installment must be at least one cent.");
  const base = balance / quantity;
  const remainder = balance % quantity;
  return Array.from({ length: count }, (_, index) =>
    fromBigInt(base + (index === count - 1 ? remainder : 0n)),
  );
}

/** Integer basis points: 100 = 1%, 10000 = 100%. Half cents round away from zero.
 * Rounding is explicit here, only on the fractional RESULT of the rate calculation.
 * Base cents and rate inputs are never rounded. BigInt protects intermediate products.
 */
export function applyRateCents(base: MoneyCents, rateBasisPoints: number): MoneyCents {
  assertMoneyCents(base);
  if (!Number.isSafeInteger(rateBasisPoints) || rateBasisPoints < 0) {
    throw new TypeError("Rate must be nonnegative integer basis points.");
  }
  const product = BigInt(base) * BigInt(rateBasisPoints);
  return roundRatioCents(product, 10000n);
}

export function sumCents(values: readonly MoneyCents[]): MoneyCents {
  return fromBigInt(values.reduce((sum, value) => sum + BigInt(assertMoneyCents(value)), 0n));
}

/** Divide a cent amount by an integer count; half cents round away from zero. */
export function divideCents(cents: MoneyCents, divisor: number): MoneyCents {
  assertMoneyCents(cents);
  if (!Number.isSafeInteger(divisor) || divisor <= 0) {
    throw new RangeError("Money divisor must be a positive safe integer.");
  }
  return roundRatioCents(BigInt(cents), BigInt(divisor));
}

function decimalRatio(value: number): [bigint, bigint] {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new TypeError("Quantity/rate must be a finite number.");
  }
  const [mantissa, exponent = "0"] = String(value).toLowerCase().split("e");
  const [whole, fraction = ""] = mantissa.split(".");
  const numerator = BigInt(whole + fraction);
  const scale = fraction.length - Number(exponent);
  return scale >= 0
    ? [numerator, 10n ** BigInt(scale)]
    : [numerator * 10n ** BigInt(-scale), 1n];
}

function roundRatioCents(numerator: bigint, denominator: bigint): MoneyCents {
  const absolute = numerator < 0n ? -numerator : numerator;
  const quotient = absolute / denominator;
  const rounded = quotient + (2n * (absolute % denominator) >= denominator ? 1n : 0n);
  return fromBigInt(numerator < 0n ? -rounded : rounded);
}

/** Quantity is not money. Only the resulting fractional cent is rounded, half away from zero. */
export function multiplyCents(unitAmount: MoneyCents, quantity: number): MoneyCents {
  const [numerator, denominator] = decimalRatio(quantity);
  if (numerator <= 0n) throw new RangeError("Quantity must be positive.");
  return roundRatioCents(BigInt(assertMoneyCents(unitAmount)) * numerator, denominator);
}

/** Percentage boundary: exact conversion to integer basis points, with no rounding. */
export function percentToBasisPoints(percent: number): number {
  const [numerator, denominator] = decimalRatio(percent);
  const scaled = numerator * 100n;
  if (scaled < 0n || scaled % denominator !== 0n) {
    throw new RangeError("Percent must be nonnegative with at most two decimal places.");
  }
  const result = Number(scaled / denominator);
  if (!Number.isSafeInteger(result)) throw new RangeError("Rate exceeds safe integer range.");
  return result;
}
