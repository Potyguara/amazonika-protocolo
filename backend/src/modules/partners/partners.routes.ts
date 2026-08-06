import { Express } from "express";
import { PrismaClient } from "@prisma/client";

type RegisterPartnerRoutesParams = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;
};

function normalizePercent(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round(number * 100) / 100;
}

export function registerPartnerRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
}: RegisterPartnerRoutesParams) {

  // ------------------------------------------------------
  // LISTAGEM
  // ------------------------------------------------------

  app.get(
    "/partners",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const includeInactive =
          String(req.query.includeInactive || "") === "true";

        const partners = await prisma.partner.findMany({
          where: includeInactive
            ? undefined
            : {
                active: true,
              },
          orderBy: {
            name: "asc",
          },
        });

        return res.json(partners);
      } catch (error) {
        console.error("Erro ao listar parceiros:", error);

        return res.status(500).json({
          message: "Erro ao listar parceiros.",
        });
      }
    }
  );

  // ------------------------------------------------------
  // CADASTRO
  // ------------------------------------------------------

  app.post(
    "/partners",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const name = String(req.body?.name || "").trim();

        const defaultPercent = normalizePercent(
          req.body?.defaultPercent
        );

        if (!name) {
          return res.status(400).json({
            message: "Nome do parceiro é obrigatório.",
          });
        }

        if (
          defaultPercent === null ||
          defaultPercent < 0 ||
          defaultPercent > 100
        ) {
          return res.status(400).json({
            message:
              "Percentual padrão deve estar entre 0 e 100.",
          });
        }

        const partner = await prisma.partner.create({
          data: {
            name,
            cpfCnpj:
              String(req.body?.cpfCnpj || "").trim() || null,

            phone:
              String(req.body?.phone || "").trim() || null,

            whatsapp:
              String(req.body?.whatsapp || "").trim() || null,

            email:
              String(req.body?.email || "").trim() || null,

            pixKey:
              String(req.body?.pixKey || "").trim() || null,

            defaultPercent,

            active:
              req.body?.active !== false,

            notes:
              String(req.body?.notes || "").trim() || null,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: "CREATE_PARTNER",
            entity: "Partner",
            entityId: String(partner.id),

            description:
              `Parceiro ${partner.name} cadastrado.`,

            ipAddress: req.ip,
          },
        });

        return res.status(201).json(partner);

      } catch (error) {
        console.error(
          "Erro ao cadastrar parceiro:",
          error
        );

        return res.status(500).json({
          message: "Erro ao cadastrar parceiro.",
        });
      }
    }
  );

  // ------------------------------------------------------
  // ALTERAÇÃO
  // ------------------------------------------------------

  app.patch(
    "/partners/:id",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID do parceiro inválido.",
          });
        }

        const existing =
          await prisma.partner.findUnique({
            where: { id },
          });

        if (!existing) {
          return res.status(404).json({
            message: "Parceiro não encontrado.",
          });
        }

        const name =
          String(req.body?.name || "").trim();

        const defaultPercent =
          normalizePercent(
            req.body?.defaultPercent
          );

        if (!name) {
          return res.status(400).json({
            message: "Nome do parceiro é obrigatório.",
          });
        }

        if (
          defaultPercent === null ||
          defaultPercent < 0 ||
          defaultPercent > 100
        ) {
          return res.status(400).json({
            message:
              "Percentual padrão deve estar entre 0 e 100.",
          });
        }

        const partner =
          await prisma.partner.update({
            where: { id },

            data: {
              name,

              cpfCnpj:
                String(req.body?.cpfCnpj || "").trim() ||
                null,

              phone:
                String(req.body?.phone || "").trim() ||
                null,

              whatsapp:
                String(req.body?.whatsapp || "").trim() ||
                null,

              email:
                String(req.body?.email || "").trim() ||
                null,

              pixKey:
                String(req.body?.pixKey || "").trim() ||
                null,

              defaultPercent,

              active:
                req.body?.active !== undefined
                  ? Boolean(req.body.active)
                  : existing.active,

              notes:
                String(req.body?.notes || "").trim() ||
                null,
            },
          });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: "UPDATE_PARTNER",
            entity: "Partner",
            entityId: String(partner.id),

            description:
              `Parceiro ${partner.name} atualizado.`,

            ipAddress: req.ip,
          },
        });

        return res.json(partner);

      } catch (error) {
        console.error(
          "Erro ao atualizar parceiro:",
          error
        );

        return res.status(500).json({
          message: "Erro ao atualizar parceiro.",
        });
      }
    }
  );

  // ------------------------------------------------------
  // ATIVAR / INATIVAR
  // ------------------------------------------------------

  app.patch(
    "/partners/:id/toggle-active",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);

        const partner =
          await prisma.partner.findUnique({
            where: { id },
          });

        if (!partner) {
          return res.status(404).json({
            message: "Parceiro não encontrado.",
          });
        }

        const updated =
          await prisma.partner.update({
            where: { id },

            data: {
              active: !partner.active,
            },
          });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: updated.active
              ? "ACTIVATE_PARTNER"
              : "DEACTIVATE_PARTNER",

            entity: "Partner",
            entityId: String(updated.id),

            description:
              `Parceiro ${updated.name} ${
                updated.active
                  ? "ativado"
                  : "inativado"
              }.`,

            ipAddress: req.ip,
          },
        });

        return res.json(updated);

      } catch (error) {
        console.error(
          "Erro ao alterar parceiro:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao alterar situação do parceiro.",
        });
      }
    }
  );

  // ------------------------------------------------------
  // RANKING
  // ------------------------------------------------------

  app.get(
    "/partners/ranking",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const period =
          String(req.query.period || "all");

        const now = new Date();

        let dateFrom: Date | undefined;

        if (period === "month") {
          dateFrom = new Date(
            now.getFullYear(),
            now.getMonth(),
            1
          );
        }

        if (period === "last3months") {
          dateFrom = new Date(
            now.getFullYear(),
            now.getMonth() - 2,
            1
          );
        }

        if (period === "year") {
          dateFrom = new Date(
            now.getFullYear(),
            0,
            1
          );
        }

        const partners =
          await prisma.partner.findMany({
            include: {
              commissions: {
                where: {
                  status: {
                    not: "CANCELADA",
                  },

                  contractId: {
                    not: null,
                  },

                  ...(dateFrom
                    ? {
                        createdAt: {
                          gte: dateFrom,
                        },
                      }
                    : {}),
                },

                include: {
                  contract: {
                    select: {
                      id: true,
                      contractNumber: true,
                      status: true,
                      contractValue: true,
                    },
                  },
                },
              },
            },
          });

        const ranking = partners
          .map((partner) => {

            const valid =
              partner.commissions.filter(
                (commission) =>
                  commission.contract &&
                  commission.contract.status !==
                    "CANCELADO" &&
                  commission.contract.status !==
                    "SUBSTITUIDO"
              );

            const servicesCount =
              valid.length;

            const contractsAmount =
              valid.reduce(
                (sum, commission) =>
                  sum +
                  Number(
                    commission.baseAmount || 0
                  ),
                0
              );

            const commissionAmount =
              valid.reduce(
                (sum, commission) =>
                  sum +
                  Number(
                    commission.commissionAmount || 0
                  ),
                0
              );

            const paidCommissionAmount =
              valid
                .filter(
                  (commission) =>
                    commission.status === "PAGA"
                )
                .reduce(
                  (sum, commission) =>
                    sum +
                    Number(
                      commission.commissionAmount || 0
                    ),
                  0
                );

            return {
              id: partner.id,
              name: partner.name,
              cpfCnpj: partner.cpfCnpj,
              phone: partner.phone,
              whatsapp: partner.whatsapp,
              email: partner.email,
              pixKey: partner.pixKey,
              defaultPercent:
                partner.defaultPercent,
              active: partner.active,
              notes: partner.notes,

              metrics: {
                servicesCount,
                contractsAmount,
                commissionAmount,
                paidCommissionAmount,

                pendingCommissionAmount:
                  commissionAmount -
                  paidCommissionAmount,
              },
            };
          })

          .sort(
            (a, b) =>
              b.metrics.contractsAmount -
              a.metrics.contractsAmount
          )

          .map((partner, index) => ({
            ...partner,
            ranking: index + 1,
          }));

        return res.json({
          period,

          totals: {
            partners: ranking.length,

            servicesCount:
              ranking.reduce(
                (sum, item) =>
                  sum +
                  item.metrics.servicesCount,
                0
              ),

            contractsAmount:
              ranking.reduce(
                (sum, item) =>
                  sum +
                  item.metrics.contractsAmount,
                0
              ),

            commissionAmount:
              ranking.reduce(
                (sum, item) =>
                  sum +
                  item.metrics.commissionAmount,
                0
              ),
          },

          ranking,
        });

      } catch (error) {
        console.error(
          "Erro ao gerar ranking:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao calcular ranking dos parceiros.",
        });
      }
    }
  );
}
