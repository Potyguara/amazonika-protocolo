import {
  applyRateCents, assertPrismaIntCents, parseReaisInput, percentToBasisPoints, sumCents,
} from "../../lib/money";

type CommissionContract = {
  paymentSchedule?: readonly { amountCents: number }[];
  proposal?: { totalAmount: number } | null;
  contractValue?: number | null;
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
  // Fronteira legada explícita: Proposal.totalAmount e Contract.contractValue ainda são REAIS.
  // Apenas contratos sem cronograma usam esta origem. Não acessar os campos opcionais da 2A.
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

/** Temporary outbound boundary until Financeiro 2B: its amount is Int in REAIS. */
export function commissionToLegacyFinanceReais(commissionAmount: number): number {
  const cents = assertPrismaIntCents(commissionAmount);
  if (cents <= 0 || cents % 100 !== 0) {
    throw new RangeError("Comissão com centavos não pode ser paga pelo Financeiro legado. Aguarde a migração monetária do Financeiro.");
  }
  return cents / 100;
}
