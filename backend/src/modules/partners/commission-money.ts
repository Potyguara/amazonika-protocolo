import {
  applyRateCents, assertPrismaIntCents, percentToBasisPoints, sumCents,
} from "../../lib/money";
import {
  resolveOperationalMoney,
} from "../../lib/canonical-money";
import type { LegacyMoneyClassification } from "../../lib/canonical-money";

type CommissionContract = {
  paymentSchedule?: readonly { amountCents: number }[];
  proposal?: { totalAmount: number; totalAmountCents?: number | null } | null;
  contractValue?: number | null;
  contractValueCents?: number | null;
  legacyClassification?: LegacyMoneyClassification;
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

  // Fronteira legada disponível somente para contrato histórico classificado.
  const legacyReais = contract.proposal?.totalAmount ?? contract.contractValue;
  const cents = resolveOperationalMoney({
    canonicalCents: null,
    legacyReais,
    legacyClassification: contract.legacyClassification,
    label: "Base histórica da comissão",
  }).amountCents;
  if (cents < 0) throw new RangeError("Base contratual negativa.");
  return cents;
}

export function calculateCommission(baseAmount: number, percent: number) {
  const base = assertPrismaIntCents(baseAmount);
  if (base < 0 || percent > 100) throw new RangeError("Base/percentual de comissão inválido.");
  return assertPrismaIntCents(applyRateCents(base, percentToBasisPoints(percent)));
}
