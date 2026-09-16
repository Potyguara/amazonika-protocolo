import { commissionToLegacyFinanceReais } from "./commission-money";
import { Express } from "express";
import { PrismaClient } from "@prisma/client";

type Params = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;
};

function competenceMonth(date: Date) {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: "America/Belem",
        year: "numeric",
        month: "2-digit",
      }
    ).formatToParts(date);

  const year =
    parts.find((item) => item.type === "year")
      ?.value;

  const month =
    parts.find((item) => item.type === "month")
      ?.value;

  return `${year}-${month}`;
}

export function registerPartnerCommissionRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
}: Params) {

  // ======================================================
  // LISTAGEM DAS COMISSÕES
  // ======================================================

  app.get(
    "/partner-commissions",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const status =
          req.query.status
            ? String(req.query.status)
            : null;

        const commissions =
          await prisma.partnerCommission.findMany({
            where: {
              ...(status
                ? { status: status as any }
                : {
                    status: {
                      not: "CANCELADA",
                    },
                  }),
            },

            include: {
              partner: true,

              protocol: {
                include: {
                  client: true,
                  serviceType: true,
                },
              },

              contract: {
                include: {
                  proposal: true,
                },
              },

              financialTransaction: true,
            },

            orderBy: [
              {
                status: "asc",
              },
              {
                createdAt: "desc",
              },
            ],
          });

        return res.json(commissions);
      } catch (error) {
        console.error(
          "Erro ao listar comissões:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao listar comissões dos parceiros.",
        });
      }
    }
  );

  // ======================================================
  // PAGAR COMISSÃO
  // ======================================================

  app.post(
    "/partner-commissions/:id/pay",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);

        if (!id) {
          return res.status(400).json({
            message:
              "ID da comissão inválido.",
          });
        }

        const commission =
          await prisma.partnerCommission.findUnique({
            where: {
              id,
            },

            include: {
              partner: true,

              protocol: {
                include: {
                  client: true,
                  serviceType: true,
                },
              },

              contract: true,

              financialTransaction: true,
            },
          });

        if (!commission) {
          return res.status(404).json({
            message:
              "Comissão não encontrada.",
          });
        }

        if (
          commission.status === "PAGA"
        ) {
          return res.status(400).json({
            message:
              "Esta comissão já foi paga.",
          });
        }

        if (
          commission.status !==
          "DISPONIVEL_PARA_PAGAMENTO"
        ) {
          return res.status(400).json({
            message:
              "A comissão ainda não está disponível para pagamento. A entrada do cliente precisa estar paga.",
          });
        }

        if (
          commission.financialTransactionId ||
          commission.financialTransaction
        ) {
          return res.status(400).json({
            message:
              "Esta comissão já possui lançamento financeiro vinculado.",
          });
        }

        if (
          commission.commissionAmount <= 0
        ) {
          return res.status(400).json({
            message:
              "O valor da comissão deve ser maior que zero.",
          });
        }

        // Proteção temporária da fronteira com FinancialTransaction.amount (Int em reais).
        let legacyFinanceAmount: number;
        try {
          legacyFinanceAmount = commissionToLegacyFinanceReais(commission.commissionAmount);
        } catch (error) {
          return res.status(409).json({ message: (error as Error).message });
        }

        const requestedPaidAt =
          req.body?.paidAt
            ? new Date(req.body.paidAt)
            : new Date();

        if (
          Number.isNaN(
            requestedPaidAt.getTime()
          )
        ) {
          return res.status(400).json({
            message:
              "Data de pagamento inválida.",
          });
        }

        const result =
          await prisma.$transaction(
            async (tx) => {

              const category =
                await tx.financialCategory.upsert({
                  where: {
                    name_type: {
                      name:
                        "Comissões de parceiros",

                      type:
                        "DESPESA",
                    },
                  },

                  update: {
                    active: true,
                  },

                  create: {
                    name:
                      "Comissões de parceiros",

                    type:
                      "DESPESA",

                    active: true,

                    color:
                      "#64748b",
                  },
                });

              const transaction =
                await tx.financialTransaction.create({
                  data: {
                    type: "SAIDA",

                    source:
                      "COMISSAO_PARCEIRO",

                    status: "PAGO",

                    categoryId:
                      category.id,

                    protocolId:
                      commission.protocolId,

                    description:
                      `Comissão de indicação - ${commission.partner.name} - ${
                        commission.contract?.contractNumber ||
                        commission.protocol.protocolNumber
                      }`,

                    // PartnerCommission é armazenada em centavos.
                    // FinancialTransaction usa valores em reais.
                    amount:
                      legacyFinanceAmount,

                    dueDate:
                      commission.dueDate,

                    paidAt:
                      requestedPaidAt,

                    competenceMonth:
                      competenceMonth(
                        requestedPaidAt
                      ),

                    clientName:
                      commission.partner.name,

                    notes:
                      req.body?.notes ||
                      `Comissão de ${commission.percent}% referente ao serviço ${commission.protocol.serviceType?.name || "-"} do cliente ${commission.protocol.client?.name || "-"}.`,

                    createdById:
                      req.user?.id || null,
                  },
                });

              const updated =
                await tx.partnerCommission.update({
                  where: {
                    id:
                      commission.id,
                  },

                  data: {
                    status: "PAGA",

                    paidAt:
                      requestedPaidAt,

                    financialTransactionId:
                      transaction.id,
                  },

                  include: {
                    partner: true,

                    protocol: {
                      include: {
                        client: true,
                        serviceType: true,
                      },
                    },

                    contract: true,

                    financialTransaction: true,
                  },
                });

              await tx.auditLog.create({
                data: {
                  userId:
                    req.user?.id || null,

                  userName:
                    req.user?.name || null,

                  userEmail:
                    req.user?.email || null,

                  userRole:
                    req.user?.role || null,

                  action:
                    "PAY_PARTNER_COMMISSION",

                  entity:
                    "PartnerCommission",

                  entityId:
                    String(
                      commission.id
                    ),

                  description:
                    `Comissão de ${commission.partner.name} paga no valor de ${commission.commissionAmount} centavos.`,

                  ipAddress:
                    req.ip,

                  metadata:
                    JSON.stringify({
                      partnerId:
                        commission.partnerId,

                      protocolId:
                        commission.protocolId,

                      contractId:
                        commission.contractId,

                      percent:
                        commission.percent,

                      commissionAmount:
                        commission.commissionAmount,

                      financialTransactionId:
                        transaction.id,

                      paidAt:
                        requestedPaidAt,
                    }),
                },
              });

              return updated;
            }
          );

        return res.json({
          message:
            "Comissão paga e saída financeira registrada com sucesso.",

          commission: result,
        });
      } catch (error) {
        console.error(
          "Erro ao pagar comissão:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao registrar pagamento da comissão.",
        });
      }
    }
  );
}
