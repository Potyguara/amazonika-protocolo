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
