import { PrismaClient } from "@prisma/client";

import { calculateCommission, getContractBaseAmount } from "./commission-money";

export async function releasePartnerCommissionForEntryPayment(
  prisma: PrismaClient,
  params: {
    protocolId: number;
    contractId?: number | null;
    paidAt: Date;
  }
) {
  const commission =
    await prisma.partnerCommission.findFirst({
      where: {
        protocolId: params.protocolId,
        status: {
          in: [
            "PREVISTA",
            "DISPONIVEL_PARA_PAGAMENTO",
          ],
        },
      },
      orderBy: {
        updatedAt: "desc",
        contractValueCents: true,
      },
    });

  if (!commission) {
    return null;
  }

  const contractId =
    params.contractId ||
    commission.contractId;

  if (!contractId) {
    return null;
  }

  const contract =
    await prisma.contract.findUnique({
      where: {
        id: contractId,
      },
      include: {
        paymentSchedule: { select: { amountCents: true } },
        proposal: {
          select: {
            totalAmount: true,
            totalAmountCents: true,
          },
        },
      },
    });

  if (!contract) {
    return null;
  }

  if (
    contract.status === "CANCELADO" ||
    contract.status === "SUBSTITUIDO"
  ) {
    return null;
  }

  const baseAmount = getContractBaseAmount(contract);

  if (baseAmount <= 0) {
    return null;
  }

  const commissionAmount =
    calculateCommission(
      baseAmount,
      commission.percent
    );

  if (commissionAmount <= 0) {
    return null;
  }

  return prisma.partnerCommission.update({
    where: {
      id: commission.id,
    },
    data: {
      contractId: contract.id,
      baseAmount,
      commissionAmount,

      status:
        "DISPONIVEL_PARA_PAGAMENTO",

      /*
       * A data em que a empresa recebeu a entrada
       * passa a ser a data de liberação da comissão.
       */
      dueDate:
        commission.dueDate ||
        params.paidAt,
    },
    include: {
      partner: true,
      contract: true,
      protocol: true,
    },
  });
}
