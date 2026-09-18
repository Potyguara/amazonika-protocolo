export type MoneyCents = number & { readonly __moneyCents: unique symbol };

export function assertMoneyCents(
  value: unknown,
  label = "Valor monetário"
): MoneyCents {
  if (
    typeof value !== "number" ||
    !Number.isSafeInteger(value)
  ) {
    throw new TypeError(`${label} deve ser um inteiro seguro em centavos.`);
  }

  return value as MoneyCents;
}

export function formatMoneyCents(cents: unknown): string {
  const value = assertMoneyCents(cents);

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value / 100);
}

export function centsToReaisFormValue(cents: unknown): string {
  const value = assertMoneyCents(cents);
  const sign = value < 0 ? "-" : "";
  const absolute = Math.abs(value);
  const whole = Math.floor(absolute / 100);
  const fraction = String(absolute % 100).padStart(2, "0");

  return `${sign}${whole}.${fraction}`;
}

export function reaisFormValueToCents(value: string | number): MoneyCents {
  const normalized = String(value).trim();
  const match = /^([+-]?)(\d+)(?:[.,](\d{1,2}))?$/.exec(normalized);

  if (!match) {
    throw new TypeError(
      "Valor em reais inválido. Use no máximo duas casas decimais, sem separador de milhar."
    );
  }

  const sign = match[1] === "-" ? -1 : 1;
  const whole = Number(match[2]);
  const fraction = Number((match[3] || "").padEnd(2, "0"));

  if (!Number.isSafeInteger(whole)) {
    throw new RangeError("Valor em reais excede o limite seguro.");
  }

  const cents = whole * 100 + fraction;

  if (!Number.isSafeInteger(cents)) {
    throw new RangeError("Valor em centavos excede o limite seguro.");
  }

  return assertMoneyCents(sign * cents);
}

function fromBigInt(value: bigint): MoneyCents {
  const result = Number(value);

  if (!Number.isSafeInteger(result)) {
    throw new RangeError("Valor em centavos excede o limite seguro.");
  }

  return assertMoneyCents(result);
}

function decimalRatio(value: number): [bigint, bigint] {
  if (!Number.isFinite(value)) {
    throw new TypeError("Quantidade deve ser finita.");
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
  const rounded = quotient +
    (2n * (absolute % denominator) >= denominator ? 1n : 0n);

  return fromBigInt(numerator < 0n ? -rounded : rounded);
}

export function multiplyMoneyCents(
  unitAmountCents: unknown,
  quantity: number
): MoneyCents {
  const cents = assertMoneyCents(unitAmountCents);
  const [numerator, denominator] = decimalRatio(quantity);

  if (numerator <= 0n) {
    throw new RangeError("Quantidade deve ser positiva.");
  }

  return roundRatioCents(BigInt(cents) * numerator, denominator);
}

export function applyRateCents(
  cents: unknown,
  basisPoints: number
): MoneyCents {
  const value = assertMoneyCents(cents);

  if (!Number.isSafeInteger(basisPoints) || basisPoints < 0) {
    throw new RangeError("Taxa deve usar basis points inteiros não negativos.");
  }

  return roundRatioCents(BigInt(value) * BigInt(basisPoints), 10000n);
}

export function distributeMoneyCents(
  totalCents: unknown,
  quantity: number,
  remainderPlacement: "first" | "last" = "first"
): MoneyCents[] {
  const total = assertMoneyCents(totalCents);

  if (!Number.isSafeInteger(quantity) || quantity <= 0) {
    throw new RangeError("Quantidade de parcelas deve ser um inteiro positivo.");
  }

  if (total < quantity) {
    throw new RangeError(
      "O total não permite parcelas positivas de pelo menos um centavo."
    );
  }

  const base = Math.floor(total / quantity);
  const remainder = total - base * quantity;

  return Array.from({ length: quantity }, (_, index) =>
    assertMoneyCents(base + (remainderPlacement === "last"
      ? (index === quantity - 1 ? remainder : 0)
      : (index < remainder ? 1 : 0)))
  );
}

/** Missing monetary data is distinct from a legitimate zero. */
export function formatOptionalMoneyCents(value: number | null | undefined): string {
  return value == null ? "—" : formatMoneyCents(value);
}

/** Presentation boundary for drafts while the user is typing invalid/incomplete input. */
export function moneyPreviewText(render: () => string): string {
  try { return render(); }
  catch (error) {
    if (error instanceof TypeError || error instanceof RangeError) return error.message;
    throw error;
  }
}

/** Draft state wraps the strict parser; absence and invalid input are not zero. */
export type MoneyInputState =
  | { status: "ABSENT" }
  | { status: "VALID"; cents: MoneyCents }
  | { status: "INVALID"; message: string };

export function moneyInputState(value: string): MoneyInputState {
  if (!value.trim()) return { status: "ABSENT" };
  try {
    return { status: "VALID", cents: reaisFormValueToCents(value) };
  } catch (error) {
    if (!(error instanceof TypeError || error instanceof RangeError)) throw error;
    return { status: "INVALID", message: error.message };
  }
}

/** The financial planner already permits no entry. Only ABSENT means no entry;
 * supplied invalid input is rejected. Display state remains distinct from zero.
 */
export function optionalEntryInputCents(value: string): MoneyCents {
  const input = moneyInputState(value);
  if (input.status === "INVALID") throw new TypeError(input.message);
  return input.status === "ABSENT" ? assertMoneyCents(0) : input.cents;
}

/** A missing/invalid item makes the whole draft total unavailable. */
export function sumValidMoneyCents(values: readonly (number | null)[]): MoneyCents | null {
  if (values.some(value => value == null)) return null;
  return assertMoneyCents(values.reduce<number>((sum, value) => sum + assertMoneyCents(value), 0));
}

/** Snapshot of the monetary inputs used to build/load a proposal schedule. */
export function proposalScheduleSource(
  items: readonly { quantity: string; unitAmount: string }[],
  mode: string, entry: string, quantity: string,
): string {
  return JSON.stringify([items.map(item => [item.quantity, item.unitAmount]), mode, entry, quantity]);
}

export function financeMoneyPreview(totalText: string, entryText: string, installmentTexts: string[]) {
  const total = moneyInputState(totalText);
  const entry = moneyInputState(entryText);
  const installments = installmentTexts.map(moneyInputState);
  const totalCents = total.status === "VALID" ? total.cents : null;
  const entryCents = entry.status === "VALID" ? entry.cents : null;
  const effectiveEntry = entry.status === "ABSENT" ? 0 : entryCents;
  const balanceCents = totalCents != null && totalCents > 0 && effectiveEntry != null &&
    effectiveEntry >= 0 && effectiveEntry <= totalCents
    ? assertMoneyCents(totalCents - effectiveEntry) : null;
  let futureCents: number | null = 0;
  for (const value of installments) {
    if (value.status !== "VALID" || value.cents <= 0) {
      futureCents = null;
      break;
    }
    futureCents = assertMoneyCents(futureCents + value.cents);
  }
  const distributedCents = balanceCents != null && futureCents != null && effectiveEntry != null
    ? assertMoneyCents(effectiveEntry + futureCents) : null;
  const differenceCents = totalCents != null && distributedCents != null
    ? assertMoneyCents(totalCents - distributedCents) : null;
  return {
    total, entry, installments, totalCents, entryCents, balanceCents, futureCents,
    distributedCents, differenceCents,
    canDistribute: balanceCents != null && !installments.some(value =>
      value.status === "INVALID" || (value.status === "VALID" && value.cents < 0)),
  };
}
