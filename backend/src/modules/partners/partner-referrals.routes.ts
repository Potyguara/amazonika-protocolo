import { Express } from "express";
import { PrismaClient } from "@prisma/client";

type Params = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;
};

function normalizePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return null;

  return Math.round(number * 100) / 100;
}

async function findCurrentContract(
  prisma: PrismaClient,
  protocolId: number
) {
  return prisma.contract.findFirst({
    where: {
      protocolId,
      status: {
        notIn: ["CANCELADO", "SUBSTITUIDO"],
      },
    },
    include: {
      proposal: {
        select: {
          id: true,
          totalAmount: true,
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
}

function getContractBaseAmount(contract: any) {
  if (!contract) return 0;

  /*
   * A proposta é nossa fonte preferencial porque totalAmount
   * já é armazenado em centavos.
   */
  if (
    contract.proposal &&
    Number.isFinite(Number(contract.proposal.totalAmount))
  ) {
    return Math.max(
      0,
      Math.round(Number(contract.proposal.totalAmount))
    );
  }

  /*
   * Fallback temporário para contratos sem proposta.
   * O domínio monetário será padronizado na Sprint 0.
   */
  return Math.max(
    0,
    Math.round(Number(contract.contractValue || 0))
  );
}

function calculateCommission(
  baseAmount: number,
  percent: number
) {
  return Math.round(
    baseAmount * (percent / 100)
  );
}

export function registerPartnerReferralRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
}: Params) {

  // ======================================================
  // CONSULTAR INDICAÇÃO DE UM SERVIÇO
  // ======================================================

  app.get(
    "/protocols/:protocolId/partner-referral",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const protocolId = Number(req.params.protocolId);

        if (!protocolId) {
          return res.status(400).json({
            message: "Protocolo inválido.",
          });
        }

        const protocol = await prisma.protocol.findUnique({
          where: {
            id: protocolId,
          },
          select: {
            id: true,
            protocolNumber: true,
          },
        });

        if (!protocol) {
          return res.status(404).json({
            message: "Protocolo não encontrado.",
          });
        }

        let referral =
          await prisma.partnerCommission.findFirst({
            where: {
              protocolId,
              status: {
                not: "CANCELADA",
              },
            },
            include: {
              partner: true,
              contract: {
                select: {
                  id: true,
                  contractNumber: true,
                  status: true,
                  contractValue: true,
                },
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
          });

        if (!referral) {
          return res.json({
            hasPartner: false,
            referral: null,
          });
        }

        /*
         * Se a indicação foi cadastrada antes do contrato,
         * sincronizamos automaticamente quando o contrato existir.
         */
        const currentContract =
          await findCurrentContract(
            prisma,
            protocolId
          );

        if (currentContract) {
          const baseAmount =
            getContractBaseAmount(currentContract);

          const commissionAmount =
            calculateCommission(
              baseAmount,
              referral.percent
            );

          if (
            referral.contractId !== currentContract.id ||
            referral.baseAmount !== baseAmount ||
            referral.commissionAmount !== commissionAmount
          ) {
            referral =
              await prisma.partnerCommission.update({
                where: {
                  id: referral.id,
                },
                data: {
                  contractId: currentContract.id,
                  baseAmount,
                  commissionAmount,
                },
                include: {
                  partner: true,
                  contract: {
                    select: {
                      id: true,
                      contractNumber: true,
                      status: true,
                      contractValue: true,
                    },
                  },
                },
              });
          }
        }

        return res.json({
          hasPartner: true,
          referral,
        });
      } catch (error) {
        console.error(
          "Erro ao consultar indicação:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao consultar indicação do parceiro.",
        });
      }
    }
  );

  // ======================================================
  // CADASTRAR / ALTERAR INDICAÇÃO
  // ======================================================

  app.put(
    "/protocols/:protocolId/partner-referral",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const protocolId =
          Number(req.params.protocolId);

        const partnerId =
          Number(req.body?.partnerId);

        if (!protocolId || !partnerId) {
          return res.status(400).json({
            message:
              "Protocolo e parceiro são obrigatórios.",
          });
        }

        const [protocol, partner] =
          await Promise.all([
            prisma.protocol.findUnique({
              where: {
                id: protocolId,
              },
              select: {
                id: true,
                protocolNumber: true,
              },
            }),

            prisma.partner.findUnique({
              where: {
                id: partnerId,
              },
            }),
          ]);

        if (!protocol) {
          return res.status(404).json({
            message: "Protocolo não encontrado.",
          });
        }

        if (!partner) {
          return res.status(404).json({
            message: "Parceiro não encontrado.",
          });
        }

        if (!partner.active) {
          return res.status(400).json({
            message:
              "O parceiro selecionado está inativo.",
          });
        }

        const requestedPercent =
          req.body?.percent === undefined ||
          req.body?.percent === null ||
          req.body?.percent === ""
            ? partner.defaultPercent
            : req.body.percent;

        const percent =
          normalizePercent(requestedPercent);

        if (
          percent === null ||
          percent < 0 ||
          percent > 100
        ) {
          return res.status(400).json({
            message:
              "O percentual deve estar entre 0 e 100.",
          });
        }

        const contract =
          await findCurrentContract(
            prisma,
            protocolId
          );

        const baseAmount =
          getContractBaseAmount(contract);

        const commissionAmount =
          calculateCommission(
            baseAmount,
            percent
          );

        const existing =
          await prisma.partnerCommission.findFirst({
            where: {
              protocolId,
              status: {
                not: "CANCELADA",
              },
            },
            orderBy: {
              updatedAt: "desc",
            },
          });

        const referral =
          await prisma.$transaction(
            async (tx) => {

              const saved = existing
                ? await tx.partnerCommission.update({
                    where: {
                      id: existing.id,
                    },
                    data: {
                      partnerId,
                      percent,
                      contractId:
                        contract?.id || null,
                      baseAmount,
                      commissionAmount,
                      status: "PREVISTA",
                    },
                    include: {
                      partner: true,
                      contract: true,
                    },
                  })
                : await tx.partnerCommission.create({
                    data: {
                      partnerId,
                      protocolId,
                      contractId:
                        contract?.id || null,
                      percent,
                      baseAmount,
                      commissionAmount,
                      status: "PREVISTA",
                    },
                    include: {
                      partner: true,
                      contract: true,
                    },
                  });

              await tx.auditLog.create({
                data: {
                  userId: req.user?.id || null,
                  userName:
                    req.user?.name || null,
                  userEmail:
                    req.user?.email || null,
                  userRole:
                    req.user?.role || null,

                  action: existing
                    ? "UPDATE_PARTNER_REFERRAL"
                    : "CREATE_PARTNER_REFERRAL",

                  entity:
                    "PartnerCommission",

                  entityId:
                    String(saved.id),

                  description:
                    `Indicação do protocolo ` +
                    `${protocol.protocolNumber}: ` +
                    `${partner.name} (${percent}%).`,

                  ipAddress: req.ip,

                  metadata:
                    JSON.stringify({
                      protocolId,
                      partnerId,
                      percent,
                      contractId:
                        contract?.id || null,
                      baseAmount,
                      commissionAmount,
                    }),
                },
              });

              return saved;
            }
          );

        return res.json({
          message:
            existing
              ? "Indicação atualizada com sucesso."
              : "Parceiro vinculado ao serviço com sucesso.",

          referral,
        });
      } catch (error) {
        console.error(
          "Erro ao salvar indicação:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao salvar indicação do parceiro.",
        });
      }
    }
  );

  // ======================================================
  // REMOVER INDICAÇÃO
  // ======================================================

  app.delete(
    "/protocols/:protocolId/partner-referral",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const protocolId =
          Number(req.params.protocolId);

        if (!protocolId) {
          return res.status(400).json({
            message: "Protocolo inválido.",
          });
        }

        const referral =
          await prisma.partnerCommission.findFirst({
            where: {
              protocolId,
              status: {
                not: "CANCELADA",
              },
            },
            include: {
              partner: true,
            },
            orderBy: {
              updatedAt: "desc",
            },
          });

        if (!referral) {
          return res.status(404).json({
            message:
              "Este serviço não possui parceiro vinculado.",
          });
        }

        if (referral.status === "PAGA") {
          return res.status(400).json({
            message:
              "Não é possível remover uma comissão já paga.",
          });
        }

        await prisma.$transaction(
          async (tx) => {
            /*
             * Enquanto a comissão ainda não foi paga,
             * removemos o vínculo e preservamos a ação
             * no AuditLog.
             *
             * Isso também permite selecionar novamente
             * o mesmo parceiro/contrato sem conflito
             * com a restrição única existente no schema.
             */
            await tx.partnerCommission.delete({
              where: {
                id: referral.id,
              },
            });

            await tx.auditLog.create({
              data: {
                userId: req.user?.id || null,
                userName:
                  req.user?.name || null,
                userEmail:
                  req.user?.email || null,
                userRole:
                  req.user?.role || null,

                action:
                  "REMOVE_PARTNER_REFERRAL",

                entity:
                  "PartnerCommission",

                entityId:
                  String(referral.id),

                description:
                  `Indicação removida do protocolo ${protocolId}. ` +
                  `Parceiro anterior: ${referral.partner.name}.`,

                ipAddress: req.ip,
              },
            });
          }
        );

        return res.json({
          message:
            "Indicação removida com sucesso.",
        });
      } catch (error) {
        console.error(
          "Erro ao remover indicação:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao remover indicação do parceiro.",
        });
      }
    }
  );
}
