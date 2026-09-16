import {
  applyRateCents, assertPrismaIntCents, parseReaisInput, percentToBasisPoints, sumCents,
} from "../../lib/money";

type CommissionContract = {
  paymentSchedule?: readonly { amountCents: number }[];
  proposal?: { totalAmount: number; totalAmountCents?: number | null } | null;
  contractValue?: number | null;
  contractValueCents?: number | null;
};

export function getContractBaseAmount(contract: CommissionContract | null) {
  if (!contract) return assertPrismaIntCents(0);
  if (contract.paymentSchedule?.length) {
    return assertPrismaIntCents(sumCents(contract.paymentSchedule.map(row => {
      const amount = assertPrismaIntCents(row.amountCents);
      if (amount <= 0) throw new RangeError("Cronograma contratual inválido para comissão.");
      return amount;
    })));
  }
  // Cabeçalhos canônicos têm precedência quando já reconciliados.
  const canonicalCents =
    contract.contractValueCents ??
    contract.proposal?.totalAmountCents;
  if (canonicalCents != null) {
    const cents = assertPrismaIntCents(canonicalCents);
    if (cents < 0) throw new RangeError("Base contratual negativa.");
    return cents;
  }

  // Fronteira legada explícita apenas para contratos ainda não reconciliados.
  const legacyReais = contract.proposal?.totalAmount ?? contract.contractValue;
  if (legacyReais == null) return assertPrismaIntCents(0);
  const cents = assertPrismaIntCents(parseReaisInput(String(legacyReais), "en-US"));
  if (cents < 0) throw new RangeError("Base contratual negativa.");
  return cents;
}

export function calculateCommission(baseAmount: number, percent: number) {
  const base = assertPrismaIntCents(baseAmount);
  if (base < 0 || percent > 100) throw new RangeError("Base/percentual de comissão inválido.");
  return assertPrismaIntCents(applyRateCents(base, percentToBasisPoints(percent)));
}

