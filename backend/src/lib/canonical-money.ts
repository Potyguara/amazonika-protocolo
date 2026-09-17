import {
  MoneyCents,
  assertPrismaIntCents,
  formatBRL,
  multiplyCents,
  parseReaisInput,
  sumCents,
} from "./money";

export type LegacyMoneyStorage = "integer-reais" | "decimal-reais";
export type LegacyMoneyClassification = "LEGACY_CONFIRMED" | "AMBIGUOUS";
export type OperationalMoneySource = "CANONICAL" | "LEGACY_CONFIRMED";

export class AmbiguousMoneyError extends Error {
  readonly code = "AMBIGUOUS_MONEY_VALUE";

  constructor(label: string) {
    super(`${label} não possui valor canônico em centavos nem classificação histórica confirmada.`);
    this.name = "AmbiguousMoneyError";
  }
}

export function resolveOperationalMoney(input: {
  canonicalCents: unknown;
  legacyReais?: unknown;
  legacyClassification?: LegacyMoneyClassification;
  label?: string;
}): { amountCents: MoneyCents; source: OperationalMoneySource } {
  const label = input.label ?? "Valor";

  if (input.canonicalCents !== null && input.canonicalCents !== undefined) {
    return {
      amountCents: assertPrismaIntCents(input.canonicalCents),
      source: "CANONICAL",
    };
  }

  if (input.legacyClassification !== "LEGACY_CONFIRMED") {
    throw new AmbiguousMoneyError(label);
  }

  return {
    amountCents: reaisInputToCents(input.legacyReais, `${label} legado`),
    source: "LEGACY_CONFIRMED",
  };
}

export function requirePositiveOperationalCents(input: Parameters<typeof resolveOperationalMoney>[0]) {
  const resolved = resolveOperationalMoney(input);
  if (resolved.amountCents <= 0) {
    throw new RangeError(`${input.label ?? "Valor"} deve ser maior que zero.`);
  }
  return resolved.amountCents;
}

export function requireCanonicalCents(value: unknown, label = "Valor") {
  return resolveOperationalMoney({
    canonicalCents: value,
    legacyClassification: "AMBIGUOUS",
    label,
  }).amountCents;
}

export function formatCanonicalCents(value: unknown, label = "Valor") {
  return formatBRL(requireCanonicalCents(value, label));
}

export function validateProposalItemCents(input: {
  unitAmountCents: unknown;
  totalAmountCents: unknown;
  quantity: number;
}) {
  const unitAmountCents = requireCanonicalCents(
    input.unitAmountCents,
    "Valor unitário do item",
  );
  const totalAmountCents = requireCanonicalCents(
    input.totalAmountCents,
    "Valor total do item",
  );
  const expectedTotalCents = assertPrismaIntCents(
    multiplyCents(unitAmountCents, input.quantity),
  );

  if (totalAmountCents !== expectedTotalCents) {
    throw new RangeError("O total canônico do item diverge da quantidade e do valor unitário.");
  }
  return { unitAmountCents, totalAmountCents };
}

export function sumOperationalMoney(
  items: ReadonlyArray<{ amountCents?: unknown; amount?: unknown }>,
  options: { legacyClassification: LegacyMoneyClassification; label: string },
) {
  return sumCents(items.map((item, index) => resolveOperationalMoney({
    canonicalCents: item.amountCents,
    legacyReais: item.amount,
    legacyClassification: options.legacyClassification,
    label: `${options.label} ${index + 1}`,
  }).amountCents));
}

export function resolvePaidAmountCents(input: {
  obligationAmountCents: unknown;
  paidAmountCents?: unknown;
  paidAmountReais?: unknown;
  legacyObligationReais?: unknown;
}) {
  const obligationAmountCents = requirePositiveOperationalCents({
    canonicalCents: input.obligationAmountCents,
    legacyClassification: "AMBIGUOUS",
    label: "Valor da cobrança",
  });
  const hasCanonicalPaidAmount =
    input.paidAmountCents !== null &&
    input.paidAmountCents !== undefined &&
    input.paidAmountCents !== "";
  const hasLegacyPaidAmount =
    input.paidAmountReais !== null &&
    input.paidAmountReais !== undefined &&
    input.paidAmountReais !== "";

  let amountCents = obligationAmountCents;
  if (hasCanonicalPaidAmount) {
    amountCents = assertPrismaIntCents(input.paidAmountCents);
  } else if (hasLegacyPaidAmount) {
    const requestedCents = reaisInputToCents(input.paidAmountReais, "Valor pago");
    const isLegacyUiDefault = input.legacyObligationReais !== null &&
      input.legacyObligationReais !== undefined &&
      requestedCents === reaisInputToCents(
        input.legacyObligationReais,
        "Espelho legado da cobrança",
      );

    // Compatibilidade temporária: a UI anterior envia charge.amount sem edição.
    // Esse espelho inteiro não pode substituir a obrigação canônica com centavos.
    amountCents = isLegacyUiDefault ? obligationAmountCents : requestedCents;
  }

  if (amountCents <= 0) throw new RangeError("O valor pago deve ser maior que zero.");
  return amountCents;
}

export function reaisInputToCents(value: unknown, label = "Valor") {
  if (value === null || value === undefined || value === "") {
    throw new TypeError(`${label} é obrigatório.`);
  }
  return assertPrismaIntCents(parseReaisInput(String(value), "en-US"));
}

export function legacyReaisFromCents(
  value: unknown,
  storage: LegacyMoneyStorage,
) {
  const cents = assertPrismaIntCents(value);
  return storage === "integer-reais"
    ? Math.round(cents / 100)
    : cents / 100;
}

export function moneyWriteFromReais(
  value: unknown,
  storage: LegacyMoneyStorage,
  label = "Valor",
) {
  const amountCents = reaisInputToCents(value, label);
  return {
    amountCents,
    amount: legacyReaisFromCents(amountCents, storage),
  };
}

export function canonicalCentsOrLegacy(
  canonicalCents: unknown,
  legacyReais: unknown,
  label = "Valor",
) {
  if (canonicalCents !== null && canonicalCents !== undefined) {
    return assertPrismaIntCents(canonicalCents);
  }
  return reaisInputToCents(legacyReais, `${label} legado`);
}

export function normalizeFinancialPlanMoney(input: {
  total: unknown;
  entry?: unknown;
  installments: readonly unknown[];
}) {
  const totalAmountCents = reaisInputToCents(input.total, "Valor total");
  const entryAmountCents =
    input.entry === null || input.entry === undefined || input.entry === ""
      ? assertPrismaIntCents(0)
      : reaisInputToCents(input.entry, "Entrada");
  const installmentAmountsCents = input.installments.map((value, index) => {
    const cents = reaisInputToCents(value, `Parcela ${index + 1}`);
    if (cents <= 0) throw new RangeError(`A parcela ${index + 1} deve ser positiva.`);
    return cents;
  });

  if (totalAmountCents <= 0) throw new RangeError("O valor total deve ser positivo.");
  if (entryAmountCents < 0 || entryAmountCents > totalAmountCents) {
    throw new RangeError("O valor da entrada é inválido.");
  }
  const distributedAmountCents = sumCents([
    entryAmountCents,
    ...installmentAmountsCents,
  ]);
  if (distributedAmountCents !== totalAmountCents) {
    throw new RangeError("A entrada somada às parcelas deve ser igual ao valor total.");
  }
  return { totalAmountCents, entryAmountCents, installmentAmountsCents };
}

export function proposalItemMoney(quantity: number, unitAmountReais: unknown) {
  const unitAmountCents = reaisInputToCents(unitAmountReais, "Valor unitário");
  const totalAmountCents = assertPrismaIntCents(
    multiplyCents(unitAmountCents, quantity),
  );
  return {
    unitAmountCents,
    totalAmountCents,
    unitAmount: legacyReaisFromCents(unitAmountCents, "integer-reais"),
    totalAmount: legacyReaisFromCents(totalAmountCents, "integer-reais"),
  };
}

export function proposalToContractMoney(
  totalAmountCentsValue: unknown,
  entryAmountCentsValue: unknown,
) {
  const contractValueCents = assertPrismaIntCents(totalAmountCentsValue);
  const entryAmountCents = assertPrismaIntCents(entryAmountCentsValue);
  if (contractValueCents <= 0 || entryAmountCents < 0 || entryAmountCents > contractValueCents) {
    throw new RangeError("Valores canônicos da proposta são inválidos para o contrato.");
  }
  return {
    contractValueCents,
    entryAmountCents,
    contractValue: legacyReaisFromCents(contractValueCents, "decimal-reais"),
    entryAmount: legacyReaisFromCents(entryAmountCents, "integer-reais"),
  };
}

export function proposalToProtocolMoney(totalAmountCentsValue: unknown) {
  const finalValueCents = assertPrismaIntCents(totalAmountCentsValue);
  if (finalValueCents <= 0) {
    throw new RangeError("Valor canônico da proposta é inválido para o protocolo.");
  }
  return {
    finalValueCents,
    finalValue: legacyReaisFromCents(finalValueCents, "decimal-reais"),
  };
}
