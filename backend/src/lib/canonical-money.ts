import {
  assertPrismaIntCents,
  multiplyCents,
  parseReaisInput,
  sumCents,
} from "./money";

export type LegacyMoneyStorage = "integer-reais" | "decimal-reais";

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
