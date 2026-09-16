import {
  assertPrismaIntCents, distributeCents, formatBRL, multiplyCents, sumCents,
} from "../../lib/money";

export function nonnegativeCents(value: unknown) {
  const cents = assertPrismaIntCents(value);
  if (cents < 0) throw new RangeError("O valor em centavos não pode ser negativo.");
  return cents;
}

export function standaloneItemTotal(unitAmount: unknown, quantity: number) {
  return assertPrismaIntCents(multiplyCents(nonnegativeCents(unitAmount), quantity));
}

export function standaloneTotals(items: readonly { totalAmount: number }[], discount: unknown, addition: unknown) {
  const subtotalAmount = assertPrismaIntCents(sumCents(items.map(item => nonnegativeCents(item.totalAmount))));
  const adjusted = sumCents([subtotalAmount, nonnegativeCents(addition), assertPrismaIntCents(-nonnegativeCents(discount))]);
  return { subtotalAmount, totalAmount: nonnegativeCents(Math.max(0, adjusted)) };
}

export type StandaloneTermsInput = {
  totalAmount: number;
  paymentMode: string;
  entryAmount: number;
  installmentQty: number | null;
  installmentAmount?: number | null;
  paymentText?: string | null;
};

/** Existing columns only. Unequal installments are represented by exact paymentText, not a false scalar. */
export function standalonePaymentTerms(input: StandaloneTermsInput) {
  const total = nonnegativeCents(input.totalAmount);
  const entry = nonnegativeCents(input.entryAmount);
  if (input.paymentMode === "PERSONALIZADO") {
    return {
      entryAmount: entry, installmentQty: input.installmentQty,
      installmentAmount: input.installmentAmount == null ? null : nonnegativeCents(input.installmentAmount),
      paymentText: input.paymentText ?? null,
      installmentAmounts: null,
    };
  }
  if (input.paymentMode === "A_VISTA") {
    return { entryAmount: total, installmentQty: null, installmentAmount: null,
      paymentText: `Pagamento à vista de ${formatBRL(total)}.`, installmentAmounts: [] };
  }
  if (input.paymentMode !== "PARCELADO" && input.paymentMode !== "ENTRADA_PARCELAS") {
    throw new RangeError("Modalidade de pagamento inválida.");
  }
  const effectiveEntry = input.paymentMode === "PARCELADO" ? nonnegativeCents(0) : entry;
  const installments = distributeCents(total, effectiveEntry, input.installmentQty as number);
  const first = installments[0];
  const last = installments[installments.length - 1];
  const equal = first === last;
  const description = equal
    ? `${installments.length} parcela(s) de ${formatBRL(first)}`
    : `${installments.length - 1} parcela(s) de ${formatBRL(first)} e última parcela de ${formatBRL(last)}`;
  return {
    entryAmount: effectiveEntry,
    installmentQty: installments.length,
    installmentAmount: equal ? first : null,
    paymentText: `${effectiveEntry > 0 ? `Entrada de ${formatBRL(effectiveEntry)} e ` : "Pagamento em "}${description}.`,
    installmentAmounts: installments,
  };
}

/** Item edits may leave a draft without valid conditions; never retain an obsolete installment/text. */
export function standaloneDraftTerms(input: StandaloneTermsInput) {
  if (input.paymentMode === "PERSONALIZADO") return {};
  const balance = input.totalAmount - (input.paymentMode === "PARCELADO" ? 0 : input.entryAmount);
  if (input.paymentMode !== "A_VISTA" &&
    (!Number.isSafeInteger(input.installmentQty) || !input.installmentQty || input.installmentQty < 1 || balance < input.installmentQty)) {
    return { installmentAmount: null, paymentText: null };
  }
  const { installmentAmounts, ...persisted } = standalonePaymentTerms(input);
  return persisted;
}

/** Documents must preserve previously saved/agreed text. Exact terms are saved by the editor route.
 * Derive only when no text exists; do not silently rewrite historical obligations during emission.
 */
export function standaloneDocumentTerms(input: StandaloneTermsInput) {
  if (input.paymentText?.trim()) {
    return { paymentText: input.paymentText, installmentAmounts: null };
  }
  return standalonePaymentTerms(input);
}
