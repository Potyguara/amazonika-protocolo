import crypto from "crypto";
import fs from "fs";
import { Express } from "express";
import { PrismaClient } from "@prisma/client";
import { generateStandaloneProposalPdf } from "./standalone-proposal-pdf.service";

type RegisterStandaloneProposalRoutesParams = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;
  upload: any;
};

const COMMERCIAL_ROLES = ["GERENTE", "PROGRAMADOR"];

const PAYMENT_MODES = new Set([
  "A_VISTA",
  "ENTRADA_PARCELAS",
  "PARCELADO",
  "PERSONALIZADO",
]);

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function intOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function numberOr(value: unknown, fallback = 0) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return parsed;
}

function dateOrNull(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function generatePublicToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function generateStandaloneProposalNumber(
  prisma: PrismaClient
) {
  const year = new Date().getFullYear();

  const prefix = `PAV-${year}-`;

  const last =
    await prisma.standaloneProposal.findFirst({
      where: {
        proposalNumber: {
          startsWith: prefix,
        },
      },

      orderBy: {
        proposalNumber: "desc",
      },

      select: {
        proposalNumber: true,
      },
    });

  let next = 1;

  if (last?.proposalNumber) {
    const sequence = Number(
      last.proposalNumber.replace(prefix, "")
    );

    if (Number.isFinite(sequence)) {
      next = sequence + 1;
    }
  }

  return `${prefix}${String(next).padStart(6, "0")}`;
}

async function createEvent(
  prisma: PrismaClient,
  params: {
    proposalId: number;
    eventType: string;
    title: string;
    description?: string | null;
    recipient?: string | null;
    user?: any;
    req?: any;
    metadata?: any;
  }
) {
  return prisma.standaloneProposalEvent.create({
    data: {
      proposalId: params.proposalId,

      eventType: params.eventType,
      title: params.title,

      description:
        params.description || null,

      actorUserId:
        params.user?.id || null,

      actorName:
        params.user?.name || null,

      actorEmail:
        params.user?.email || null,

      recipient:
        params.recipient || null,

      ipAddress:
        params.req?.ip ||
        params.req?.headers?.["x-forwarded-for"]?.toString() ||
        null,

      userAgent:
        params.req?.headers?.["user-agent"] || null,

      metadata:
        params.metadata
          ? JSON.stringify(params.metadata)
          : null,
    },
  });
}

async function calculateProposalTotals(
  prisma: PrismaClient,
  proposalId: number
) {
  const proposal =
    await prisma.standaloneProposal.findUnique({
      where: {
        id: proposalId,
      },

      include: {
        items: true,
      },
    });

  if (!proposal) {
    throw new Error("Proposta não encontrada.");
  }

  const subtotalAmount =
    proposal.items.reduce(
      (sum, item) =>
        sum + Number(item.totalAmount || 0),
      0
    );

  const discountAmount =
    Number(proposal.discountAmount || 0);

  const additionAmount =
    Number(proposal.additionAmount || 0);

  const totalAmount = Math.max(
    0,
    subtotalAmount -
      discountAmount +
      additionAmount
  );

  return prisma.standaloneProposal.update({
    where: {
      id: proposalId,
    },

    data: {
      subtotalAmount,
      totalAmount,
    },
  });
}

const proposalInclude = {
  client: true,

  createdBy: {
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
    },
  },

  items: {
    orderBy: {
      sortOrder: "asc" as const,
    },

    include: {
      catalogService: {
        include: {
          category: true,
        },
      },
    },
  },

  attachments: {
    orderBy: {
      sortOrder: "asc" as const,
    },
  },

  signatures: {
    orderBy: {
      createdAt: "desc" as const,
    },
  },

  events: {
    orderBy: {
      createdAt: "desc" as const,
    },

    take: 200,
  },
};

export function registerStandaloneProposalRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
  upload,
}: RegisterStandaloneProposalRoutesParams) {

  // =====================================================
  // RESUMO
  // =====================================================

  app.get(
    "/standalone-proposals/summary",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (_req, res) => {
      try {
        const [
          total,
          drafts,
          sent,
          waitingSignature,
          approved,
          linked,
        ] = await Promise.all([
          prisma.standaloneProposal.count(),

          prisma.standaloneProposal.count({
            where: {
              status: "RASCUNHO",
            },
          }),

          prisma.standaloneProposal.count({
            where: {
              status: "ENVIADA",
            },
          }),

          prisma.standaloneProposal.count({
            where: {
              status: "AGUARDANDO_ASSINATURA",
            },
          }),

          prisma.standaloneProposal.count({
            where: {
              status: {
                in: [
                  "APROVADA_VERBALMENTE",
                  "ASSINADA_ELETRONICAMENTE",
                  "PDF_ASSINADO_ANEXADO",
                ],
              },
            },
          }),

          prisma.standaloneProposal.count({
            where: {
              status: "VINCULADA_PROTOCOLO",
            },
          }),
        ]);

        return res.json({
          total,
          drafts,
          sent,
          waitingSignature,
          approved,
          linked,
        });
      } catch (error) {
        console.error(
          "Erro ao carregar resumo das propostas avulsas:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao carregar resumo das propostas avulsas.",
        });
      }
    }
  );

  // =====================================================
  // LISTAGEM
  // =====================================================

  app.get(
    "/standalone-proposals",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req, res) => {
      try {
        const search = String(
          req.query.search || ""
        ).trim();

        const status = String(
          req.query.status || ""
        ).trim();

        const proposals =
          await prisma.standaloneProposal.findMany({
            where: {
              ...(status
                ? {
                    status: status as any,
                  }
                : {}),

              ...(search
                ? {
                    OR: [
                      {
                        proposalNumber: {
                          contains:
                            search.toUpperCase(),
                        },
                      },
                      {
                        clientName: {
                          contains: search,
                        },
                      },
                      {
                        title: {
                          contains: search,
                        },
                      },
                    ],
                  }
                : {}),
            },

            include: {
              client: true,

              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },

              _count: {
                select: {
                  items: true,
                  attachments: true,
                  signatures: true,
                },
              },
            },

            orderBy: {
              createdAt: "desc",
            },
          });

        return res.json(proposals);
      } catch (error) {
        console.error(
          "Erro ao listar propostas avulsas:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao listar propostas avulsas.",
        });
      }
    }
  );

  // =====================================================
  // DETALHE
  // =====================================================

  app.get(
    "/standalone-proposals/:id",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({
            message: "ID da proposta inválido.",
          });
        }

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id,
            },

            include: proposalInclude,
          });

        if (!proposal) {
          return res.status(404).json({
            message: "Proposta não encontrada.",
          });
        }

        return res.json(proposal);
      } catch (error) {
        console.error(
          "Erro ao carregar proposta avulsa:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao carregar proposta avulsa.",
        });
      }
    }
  );

  // =====================================================
  // CRIAÇÃO
  // =====================================================

  app.post(
    "/standalone-proposals",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const clientId =
          intOrNull(req.body?.clientId);

        let client: any = null;

        if (clientId) {
          client =
            await prisma.client.findUnique({
              where: {
                id: clientId,
              },
            });

          if (!client) {
            return res.status(404).json({
              message:
                "Cliente selecionado não foi encontrado.",
            });
          }
        }

        const clientName = String(
          req.body?.clientName ||
          client?.name ||
          ""
        ).trim();

        if (!clientName) {
          return res.status(400).json({
            message:
              "Informe ou selecione o cliente.",
          });
        }

        const title = String(
          req.body?.title || ""
        ).trim();

        if (!title) {
          return res.status(400).json({
            message:
              "Informe o título/objeto resumido da proposta.",
          });
        }

        const proposalNumber =
          await generateStandaloneProposalNumber(
            prisma
          );

        const publicToken =
          generatePublicToken();

        const proposal =
          await prisma.standaloneProposal.create({
            data: {
              proposalNumber,
              publicToken,

              clientId,

              clientName,

              clientCpfCnpj:
                textOrNull(
                  req.body?.clientCpfCnpj
                ) ||
                client?.cpfCnpj ||
                null,

              clientEmail:
                textOrNull(
                  req.body?.clientEmail
                ) ||
                client?.email ||
                null,

              clientPhone:
                textOrNull(
                  req.body?.clientPhone
                ) ||
                client?.phone ||
                null,

              clientWhatsapp:
                textOrNull(
                  req.body?.clientWhatsapp
                ) ||
                client?.whatsapp ||
                null,

              clientAddress:
                textOrNull(
                  req.body?.clientAddress
                ) ||
                client?.address ||
                null,

              clientCity:
                textOrNull(
                  req.body?.clientCity
                ) ||
                client?.city ||
                null,

              clientState:
                textOrNull(
                  req.body?.clientState
                ) ||
                client?.state ||
                null,

              createdById:
                req.user?.id || null,

              title,

              objectText:
                textOrNull(
                  req.body?.objectText
                ),

              introText:
                textOrNull(
                  req.body?.introText
                ),

              scopeText:
                textOrNull(
                  req.body?.scopeText
                ),

              paymentMode:
                req.body?.paymentMode ||
                "ENTRADA_PARCELAS",

              discountAmount:
                numberOr(
                  req.body?.discountAmount
                ),

              additionAmount:
                numberOr(
                  req.body?.additionAmount
                ),

              entryAmount:
                numberOr(
                  req.body?.entryAmount
                ),

              installmentQty:
                intOrNull(
                  req.body?.installmentQty
                ),

              installmentAmount:
                intOrNull(
                  req.body?.installmentAmount
                ),

              paymentText:
                textOrNull(
                  req.body?.paymentText
                ),

              executionDays:
                intOrNull(
                  req.body?.executionDays
                ),

              executionText:
                textOrNull(
                  req.body?.executionText
                ),

              validUntil:
                dateOrNull(
                  req.body?.validUntil
                ),

              notes:
                textOrNull(
                  req.body?.notes
                ),

              internalNotes:
                textOrNull(
                  req.body?.internalNotes
                ),
            },

            include: proposalInclude,
          });

        await createEvent(prisma, {
          proposalId: proposal.id,

          eventType:
            "PROPOSTA_CRIADA",

          title:
            "Proposta avulsa criada",

          description:
            `${proposal.proposalNumber} criada em modo rascunho.`,

          user: req.user,
          req,
        });

        return res
          .status(201)
          .json(proposal);
      } catch (error) {
        console.error(
          "Erro ao criar proposta avulsa:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao criar proposta avulsa.",
        });
      }
    }
  );

  // =====================================================
  // EDIÇÃO DOS DADOS GERAIS
  // =====================================================

  app.put(
    "/standalone-proposals/:id",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);

        const existing =
          await prisma.standaloneProposal.findUnique({
            where: {
              id,
            },
          });

        if (!existing) {
          return res.status(404).json({
            message:
              "Proposta avulsa não encontrada.",
          });
        }

        if (
          existing.status ===
            "VINCULADA_PROTOCOLO" ||
          existing.status ===
            "CANCELADA"
        ) {
          return res.status(409).json({
            message:
              "Esta proposta não pode mais ser editada.",
          });
        }

        const requestedPaymentMode =
          req.body?.paymentMode !== undefined
            ? String(req.body.paymentMode)
            : existing.paymentMode;

        if (!PAYMENT_MODES.has(requestedPaymentMode)) {
          return res.status(400).json({
            message:
              "Modalidade de pagamento inválida.",
          });
        }

        const discountAmount =
          req.body?.discountAmount !== undefined
            ? Math.max(
                0,
                Math.round(
                  numberOr(
                    req.body.discountAmount
                  )
                )
              )
            : existing.discountAmount;

        const additionAmount =
          req.body?.additionAmount !== undefined
            ? Math.max(
                0,
                Math.round(
                  numberOr(
                    req.body.additionAmount
                  )
                )
              )
            : existing.additionAmount;

        const commercialTotal =
          Math.max(
            0,
            existing.subtotalAmount -
              discountAmount +
              additionAmount
          );

        let entryAmount =
          req.body?.entryAmount !== undefined
            ? Math.max(
                0,
                Math.round(
                  numberOr(
                    req.body.entryAmount
                  )
                )
              )
            : existing.entryAmount;

        let installmentQty =
          req.body?.installmentQty !== undefined
            ? intOrNull(
                req.body.installmentQty
              )
            : existing.installmentQty;

        let installmentAmount:
          number | null =
            existing.installmentAmount;

        if (
          requestedPaymentMode ===
          "A_VISTA"
        ) {
          entryAmount =
            commercialTotal;

          installmentQty = null;
          installmentAmount = null;
        }

        if (
          requestedPaymentMode ===
          "PARCELADO"
        ) {
          entryAmount = 0;

          if (
            !installmentQty ||
            installmentQty < 1
          ) {
            return res.status(400).json({
              message:
                "Informe a quantidade de parcelas.",
            });
          }

          installmentAmount =
            Math.round(
              commercialTotal /
                installmentQty
            );
        }

        if (
          requestedPaymentMode ===
          "ENTRADA_PARCELAS"
        ) {
          if (
            entryAmount < 0 ||
            entryAmount >
              commercialTotal
          ) {
            return res.status(400).json({
              message:
                "O valor da entrada é inválido.",
            });
          }

          if (
            !installmentQty ||
            installmentQty < 1
          ) {
            return res.status(400).json({
              message:
                "Informe a quantidade de parcelas.",
            });
          }

          const remaining =
            Math.max(
              0,
              commercialTotal -
                entryAmount
            );

          installmentAmount =
            Math.round(
              remaining /
                installmentQty
            );
        }

        if (
          requestedPaymentMode ===
          "PERSONALIZADO"
        ) {
          installmentAmount =
            req.body
              ?.installmentAmount !==
            undefined
              ? intOrNull(
                  req.body
                    .installmentAmount
                )
              : existing.installmentAmount;
        }

        const proposal =
          await prisma.standaloneProposal.update({
            where: {
              id,
            },

            data: {
              clientName:
                req.body?.clientName !==
                undefined
                  ? String(
                      req.body.clientName
                    ).trim()
                  : existing.clientName,

              clientCpfCnpj:
                req.body?.clientCpfCnpj !==
                undefined
                  ? textOrNull(
                      req.body.clientCpfCnpj
                    )
                  : existing.clientCpfCnpj,

              clientEmail:
                req.body?.clientEmail !==
                undefined
                  ? textOrNull(
                      req.body.clientEmail
                    )
                  : existing.clientEmail,

              clientPhone:
                req.body?.clientPhone !==
                undefined
                  ? textOrNull(
                      req.body.clientPhone
                    )
                  : existing.clientPhone,

              clientWhatsapp:
                req.body?.clientWhatsapp !==
                undefined
                  ? textOrNull(
                      req.body.clientWhatsapp
                    )
                  : existing.clientWhatsapp,

              clientAddress:
                req.body?.clientAddress !==
                undefined
                  ? textOrNull(
                      req.body.clientAddress
                    )
                  : existing.clientAddress,

              clientCity:
                req.body?.clientCity !==
                undefined
                  ? textOrNull(
                      req.body.clientCity
                    )
                  : existing.clientCity,

              clientState:
                req.body?.clientState !==
                undefined
                  ? textOrNull(
                      req.body.clientState
                    )
                  : existing.clientState,

              title:
                req.body?.title !==
                undefined
                  ? String(
                      req.body.title
                    ).trim()
                  : existing.title,

              objectText:
                req.body?.objectText !==
                undefined
                  ? textOrNull(
                      req.body.objectText
                    )
                  : existing.objectText,

              introText:
                req.body?.introText !==
                undefined
                  ? textOrNull(
                      req.body.introText
                    )
                  : existing.introText,

              scopeText:
                req.body?.scopeText !==
                undefined
                  ? textOrNull(
                      req.body.scopeText
                    )
                  : existing.scopeText,

              paymentMode:
                requestedPaymentMode as any,

              discountAmount,

              additionAmount,

              entryAmount,

              installmentQty,

              installmentAmount,

              paymentText:
                req.body?.paymentText !==
                undefined
                  ? textOrNull(
                      req.body.paymentText
                    )
                  : existing.paymentText,

              executionDays:
                req.body?.executionDays !==
                undefined
                  ? intOrNull(
                      req.body.executionDays
                    )
                  : existing.executionDays,

              executionText:
                req.body?.executionText !==
                undefined
                  ? textOrNull(
                      req.body.executionText
                    )
                  : existing.executionText,

              validUntil:
                req.body?.validUntil !==
                undefined
                  ? dateOrNull(
                      req.body.validUntil
                    )
                  : existing.validUntil,

              notes:
                req.body?.notes !==
                undefined
                  ? textOrNull(
                      req.body.notes
                    )
                  : existing.notes,

              internalNotes:
                req.body?.internalNotes !==
                undefined
                  ? textOrNull(
                      req.body.internalNotes
                    )
                  : existing.internalNotes,
            },
          });

        await calculateProposalTotals(
          prisma,
          id
        );

        await createEvent(prisma, {
          proposalId: id,
          eventType:
            "PROPOSTA_ATUALIZADA",
          title:
            "Dados da proposta atualizados",
          user: req.user,
          req,
        });

        const refreshed =
          await prisma.standaloneProposal.findUnique({
            where: {
              id,
            },

            include: proposalInclude,
          });

        return res.json(refreshed);
      } catch (error) {
        console.error(
          "Erro ao atualizar proposta avulsa:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao atualizar proposta avulsa.",
        });
      }
    }
  );

  // =====================================================
  // ADICIONAR ITEM DO CATÁLOGO
  // =====================================================

  app.post(
    "/standalone-proposals/:id/items/catalog",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const proposalId =
          Number(req.params.id);

        const catalogServiceId =
          Number(
            req.body?.catalogServiceId
          );

        const quantity =
          numberOr(
            req.body?.quantity,
            1
          );

        if (
          !Number.isInteger(
            catalogServiceId
          ) ||
          catalogServiceId <= 0
        ) {
          return res.status(400).json({
            message:
              "Selecione um serviço do catálogo.",
          });
        }

        if (quantity <= 0) {
          return res.status(400).json({
            message:
              "A quantidade deve ser maior que zero.",
          });
        }

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id: proposalId,
            },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        const service =
          await prisma.catalogService.findUnique({
            where: {
              id: catalogServiceId,
            },

            include: {
              category: true,

              pricingTiers: {
                where: {
                  active: true,
                },

                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          });

        if (!service) {
          return res.status(404).json({
            message:
              "Serviço do catálogo não encontrado.",
          });
        }

        let unitAmount =
          Number(
            req.body?.unitAmount ??
            service.baseAmount ??
            0
          );

        let manualPrice =
          req.body?.unitAmount !==
          undefined;

        if (
          service.pricingMode ===
          "POR_FAIXA"
        ) {
          const tier =
            service.pricingTiers.find(
              (item) => {
                const min =
                  item.minQuantity ??
                  Number.NEGATIVE_INFINITY;

                const max =
                  item.maxQuantity ??
                  Number.POSITIVE_INFINITY;

                return (
                  quantity >= min &&
                  quantity <= max
                );
              }
            );

          if (!tier) {
            return res.status(400).json({
              message:
                "Nenhuma faixa de preço atende à quantidade informada.",
            });
          }

          unitAmount =
            tier.unitAmount;
          manualPrice = false;
        }

        if (
          service.pricingMode ===
            "SOB_CONSULTA" &&
          !req.body?.unitAmount
        ) {
          return res.status(400).json({
            message:
              "Este serviço está marcado como sob consulta. Informe o valor negociado.",
          });
        }

        let totalAmount =
          Math.round(
            quantity * unitAmount
          );

        if (
          service.minimumAmount &&
          totalAmount <
            service.minimumAmount
        ) {
          totalAmount =
            service.minimumAmount;
        }

        const last =
          await prisma.standaloneProposalItem.findFirst({
            where: {
              proposalId,
            },

            orderBy: {
              sortOrder: "desc",
            },
          });

        const item =
          await prisma.standaloneProposalItem.create({
            data: {
              proposalId,

              catalogServiceId:
                service.id,

              catalogServiceCode:
                service.code,

              categoryName:
                service.category.name,

              serviceName:
                service.name,

              acronym:
                service.acronym,

              description:
                textOrNull(
                  req.body?.description
                ) ||
                service.proposalDescription ||
                service.shortDescription ||
                null,

              technicalDescription:
                service.technicalDescription,

              legalText:
                service.legalText,

              pricingMode:
                service.pricingMode,

              quantity,

              unitLabel:
                service.unitLabel,

              catalogUnitAmount:
                service.baseAmount,

              unitAmount,

              totalAmount,

              manualPrice,

              sortOrder:
                (last?.sortOrder ?? -1) + 1,
            },
          });

        await calculateProposalTotals(
          prisma,
          proposalId
        );

        await createEvent(prisma, {
          proposalId,

          eventType:
            "ITEM_ADICIONADO",

          title:
            "Serviço adicionado à proposta",

          description:
            service.name,

          user: req.user,
          req,

          metadata: {
            catalogServiceId:
              service.id,
            quantity,
            unitAmount,
            totalAmount,
          },
        });

        return res
          .status(201)
          .json(item);
      } catch (error) {
        console.error(
          "Erro ao adicionar item:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao adicionar serviço à proposta.",
        });
      }
    }
  );

  // =====================================================
  // ADICIONAR ITEM MANUAL
  // =====================================================

  app.post(
    "/standalone-proposals/:id/items/manual",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const proposalId =
          Number(req.params.id);

        const serviceName =
          String(
            req.body?.serviceName ||
            ""
          ).trim();

        const quantity =
          numberOr(
            req.body?.quantity,
            1
          );

        const unitAmount =
          numberOr(
            req.body?.unitAmount
          );

        if (!serviceName) {
          return res.status(400).json({
            message:
              "Informe a descrição do item.",
          });
        }

        if (
          quantity <= 0 ||
          unitAmount < 0
        ) {
          return res.status(400).json({
            message:
              "Quantidade ou valor inválido.",
          });
        }

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id: proposalId,
            },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        const totalAmount =
          Math.round(
            quantity * unitAmount
          );

        const last =
          await prisma.standaloneProposalItem.findFirst({
            where: {
              proposalId,
            },

            orderBy: {
              sortOrder: "desc",
            },
          });

        const item =
          await prisma.standaloneProposalItem.create({
            data: {
              proposalId,

              serviceName,

              description:
                textOrNull(
                  req.body?.description
                ),

              quantity,

              unitLabel:
                textOrNull(
                  req.body?.unitLabel
                ),

              unitAmount,
              totalAmount,

              manualPrice: true,

              sortOrder:
                (last?.sortOrder ?? -1) + 1,
            },
          });

        await calculateProposalTotals(
          prisma,
          proposalId
        );

        await createEvent(prisma, {
          proposalId,
          eventType:
            "ITEM_MANUAL_ADICIONADO",
          title:
            "Item manual adicionado",
          description:
            serviceName,
          user: req.user,
          req,
        });

        return res
          .status(201)
          .json(item);
      } catch (error) {
        console.error(
          "Erro ao adicionar item manual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao adicionar item manual.",
        });
      }
    }
  );

  // =====================================================
  // EDITAR ITEM
  // =====================================================

  app.put(
    "/standalone-proposals/:id/items/:itemId",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const proposalId =
          Number(req.params.id);

        const itemId =
          Number(req.params.itemId);

        const item =
          await prisma.standaloneProposalItem.findFirst({
            where: {
              id: itemId,
              proposalId,
            },
          });

        if (!item) {
          return res.status(404).json({
            message:
              "Item da proposta não encontrado.",
          });
        }

        const quantity =
          req.body?.quantity !==
          undefined
            ? numberOr(
                req.body.quantity,
                item.quantity
              )
            : item.quantity;

        const unitAmount =
          req.body?.unitAmount !==
          undefined
            ? numberOr(
                req.body.unitAmount,
                item.unitAmount
              )
            : item.unitAmount;

        const totalAmount =
          Math.round(
            quantity * unitAmount
          );

        const updated =
          await prisma.standaloneProposalItem.update({
            where: {
              id: itemId,
            },

            data: {
              serviceName:
                req.body?.serviceName !==
                undefined
                  ? String(
                      req.body.serviceName
                    ).trim()
                  : item.serviceName,

              description:
                req.body?.description !==
                undefined
                  ? textOrNull(
                      req.body.description
                    )
                  : item.description,

              quantity,

              unitLabel:
                req.body?.unitLabel !==
                undefined
                  ? textOrNull(
                      req.body.unitLabel
                    )
                  : item.unitLabel,

              unitAmount,

              totalAmount,

              manualPrice:
                req.body?.unitAmount !==
                undefined
                  ? true
                  : item.manualPrice,

              sortOrder:
                req.body?.sortOrder !==
                undefined
                  ? Number(
                      req.body.sortOrder
                    )
                  : item.sortOrder,
            },
          });

        await calculateProposalTotals(
          prisma,
          proposalId
        );

        await createEvent(prisma, {
          proposalId,
          eventType:
            "ITEM_ATUALIZADO",
          title:
            "Item da proposta atualizado",
          description:
            updated.serviceName,
          user: req.user,
          req,
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao atualizar item:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao atualizar item da proposta.",
        });
      }
    }
  );

  // =====================================================
  // REMOVER ITEM
  // =====================================================

  app.delete(
    "/standalone-proposals/:id/items/:itemId",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const proposalId =
          Number(req.params.id);

        const itemId =
          Number(req.params.itemId);

        const item =
          await prisma.standaloneProposalItem.findFirst({
            where: {
              id: itemId,
              proposalId,
            },
          });

        if (!item) {
          return res.status(404).json({
            message:
              "Item não encontrado.",
          });
        }

        await prisma.standaloneProposalItem.delete({
          where: {
            id: itemId,
          },
        });

        await calculateProposalTotals(
          prisma,
          proposalId
        );

        await createEvent(prisma, {
          proposalId,
          eventType:
            "ITEM_REMOVIDO",
          title:
            "Item removido da proposta",
          description:
            item.serviceName,
          user: req.user,
          req,
        });

        return res.json({
          message:
            "Item removido com sucesso.",
        });
      } catch (error) {
        console.error(
          "Erro ao remover item:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao remover item.",
        });
      }
    }
  );

  // =====================================================
  // ANEXOS APENAS LISTADOS
  // =====================================================

  app.post(
    "/standalone-proposals/:id/attachments",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const proposalId =
          Number(req.params.id);

        const title =
          String(
            req.body?.title || ""
          ).trim();

        if (!title) {
          return res.status(400).json({
            message:
              "Informe o título do anexo.",
          });
        }

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id: proposalId,
            },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        const last =
          await prisma.standaloneProposalAttachment.findFirst({
            where: {
              proposalId,
            },

            orderBy: {
              sortOrder: "desc",
            },
          });

        const attachment =
          await prisma.standaloneProposalAttachment.create({
            data: {
              proposalId,

              type: "LISTADO",

              title,

              description:
                textOrNull(
                  req.body?.description
                ),

              sortOrder:
                (last?.sortOrder ?? -1) + 1,
            },
          });

        await createEvent(prisma, {
          proposalId,
          eventType:
            "ANEXO_LISTADO",
          title:
            "Anexo incluído na relação",
          description:
            title,
          user: req.user,
          req,
        });

        return res
          .status(201)
          .json(attachment);
      } catch (error) {
        console.error(
          "Erro ao adicionar anexo:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao adicionar anexo.",
        });
      }
    }
  );

  app.post(
    "/standalone-proposals/:id/attachments/file",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    upload.single("file"),
    async (req: any, res) => {
      try {
        const proposalId = Number(req.params.id);

        const title = String(
          req.body?.title || ""
        ).trim();

        if (
          !Number.isInteger(proposalId) ||
          proposalId <= 0
        ) {
          return res.status(400).json({
            message: "ID da proposta inválido.",
          });
        }

        if (!title) {
          return res.status(400).json({
            message: "Informe o título do anexo.",
          });
        }

        if (!req.file) {
          return res.status(400).json({
            message: "Selecione um arquivo.",
          });
        }

        const allowedMimeTypes = new Set([
          "application/pdf",
          "image/png",
          "image/jpeg",
          "image/webp",
        ]);

        if (!allowedMimeTypes.has(req.file.mimetype)) {
          if (
            req.file.path &&
            fs.existsSync(req.file.path)
          ) {
            fs.unlinkSync(req.file.path);
          }

          return res.status(400).json({
            message:
              "Formato não permitido. Utilize PDF, PNG, JPG, JPEG ou WEBP.",
          });
        }

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id: proposalId,
            },
          });

        if (!proposal) {
          if (
            req.file.path &&
            fs.existsSync(req.file.path)
          ) {
            fs.unlinkSync(req.file.path);
          }

          return res.status(404).json({
            message: "Proposta não encontrada.",
          });
        }

        const last =
          await prisma.standaloneProposalAttachment.findFirst({
            where: {
              proposalId,
            },

            orderBy: {
              sortOrder: "desc",
            },
          });

        const attachment =
          await prisma.standaloneProposalAttachment.create({
            data: {
              proposalId,

              type: "ARQUIVO",

              title,

              description:
                textOrNull(
                  req.body?.description
                ),

              fileName:
                req.file.originalname,

              filePath:
                `/uploads/documents/${req.file.filename}`,

              mimeType:
                req.file.mimetype,

              size:
                req.file.size,

              sortOrder:
                (last?.sortOrder ?? -1) + 1,
            },
          });

        await createEvent(prisma, {
          proposalId,

          eventType:
            "ANEXO_ARQUIVO",

          title:
            "Arquivo anexado à proposta",

          description:
            title,

          user: req.user,
          req,

          metadata: {
            attachmentId:
              attachment.id,
            fileName:
              req.file.originalname,
            mimeType:
              req.file.mimetype,
            size:
              req.file.size,
          },
        });

        return res
          .status(201)
          .json(attachment);
      } catch (error) {
        console.error(
          "Erro ao anexar arquivo à proposta:",
          error
        );

        if (
          req.file?.path &&
          fs.existsSync(req.file.path)
        ) {
          try {
            fs.unlinkSync(req.file.path);
          } catch {}
        }

        return res.status(500).json({
          message:
            "Erro ao anexar arquivo à proposta.",
        });
      }
    }
  );

  app.delete(
    "/standalone-proposals/:id/attachments/:attachmentId",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const proposalId =
          Number(req.params.id);

        const attachmentId =
          Number(
            req.params.attachmentId
          );

        const attachment =
          await prisma.standaloneProposalAttachment.findFirst({
            where: {
              id: attachmentId,
              proposalId,
            },
          });

        if (!attachment) {
          return res.status(404).json({
            message:
              "Anexo não encontrado.",
          });
        }

        if (
          attachment.type === "ARQUIVO" &&
          attachment.filePath
        ) {
          const relativePath =
            attachment.filePath.replace(/^\/+/, "");

          const physicalPath =
            require("path").resolve(
              process.cwd(),
              relativePath
            );

          if (fs.existsSync(physicalPath)) {
            try {
              fs.unlinkSync(physicalPath);
            } catch (fileError) {
              console.error(
                "Erro ao remover arquivo físico do anexo:",
                fileError
              );
            }
          }
        }

        await prisma.standaloneProposalAttachment.delete({
          where: {
            id: attachmentId,
          },
        });

        await createEvent(prisma, {
          proposalId,
          eventType:
            "ANEXO_REMOVIDO",
          title:
            "Anexo removido da relação",
          description:
            attachment.title,
          user: req.user,
          req,
        });

        return res.json({
          message:
            "Anexo removido com sucesso.",
        });
      } catch (error) {
        console.error(
          "Erro ao remover anexo:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao remover anexo.",
        });
      }
    }
  );



  // =====================================================
  // APROVAÇÃO VERBAL
  // =====================================================

  app.post(
    "/standalone-proposals/:id/approve-verbal",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({
            message:
              "ID da proposta inválido.",
          });
        }

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: { id },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        if (
          proposal.status ===
            "VINCULADA_PROTOCOLO" ||
          proposal.status ===
            "CANCELADA"
        ) {
          return res.status(409).json({
            message:
              "Esta proposta não pode ser aprovada.",
          });
        }

        if (
          proposal.status ===
          "APROVADA_VERBALMENTE"
        ) {
          return res.status(409).json({
            message:
              "Esta proposta já foi aprovada verbalmente.",
          });
        }

        const approvedBy =
          String(
            req.body?.approvedBy || ""
          ).trim();

        if (!approvedBy) {
          return res.status(400).json({
            message:
              "Informe quem aprovou a proposta.",
          });
        }

        const updated =
          await prisma.standaloneProposal.update({
            where: { id },

            data: {
              status:
                "APROVADA_VERBALMENTE",

              approvalMode:
                "VERBAL",

              verbalApprovedAt:
                new Date(),

              verbalApprovedBy:
                approvedBy,

              verbalApprovalNote:
                textOrNull(
                  req.body?.note
                ),
            },

            include: proposalInclude,
          });

        await createEvent(prisma, {
          proposalId: id,

          eventType:
            "APROVACAO_VERBAL",

          title:
            "Proposta aprovada verbalmente",

          description:
            req.body?.note
              ? String(req.body.note)
              : `Aprovação informada por ${approvedBy}.`,

          user:
            req.user,

          req,

          metadata: {
            approvedBy,
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao aprovar proposta verbalmente:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao registrar aprovação verbal.",
        });
      }
    }
  );

  // =====================================================
  // CANCELAR PROPOSTA
  // =====================================================

  app.post(
    "/standalone-proposals/:id/cancel",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({
            message:
              "ID da proposta inválido.",
          });
        }

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: { id },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        if (
          proposal.status ===
          "VINCULADA_PROTOCOLO"
        ) {
          return res.status(409).json({
            message:
              "Proposta vinculada a protocolo não pode ser cancelada.",
          });
        }

        if (
          proposal.status ===
          "CANCELADA"
        ) {
          return res.status(409).json({
            message:
              "Esta proposta já está cancelada.",
          });
        }

        const reason =
          textOrNull(
            req.body?.reason
          );

        const updated =
          await prisma.standaloneProposal.update({
            where: { id },

            data: {
              status:
                "CANCELADA",
            },

            include: proposalInclude,
          });

        await createEvent(prisma, {
          proposalId: id,

          eventType:
            "PROPOSTA_CANCELADA",

          title:
            "Proposta cancelada",

          description:
            reason ||
            "Proposta cancelada pelo usuário.",

          user:
            req.user,

          req,
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao cancelar proposta:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao cancelar proposta.",
        });
      }
    }
  );

  // =====================================================
  // DUPLICAR PROPOSTA
  // =====================================================

  app.post(
    "/standalone-proposals/:id/duplicate",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id =
          Number(req.params.id);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return res.status(400).json({
            message:
              "ID da proposta inválido.",
          });
        }

        const source =
          await prisma.standaloneProposal.findUnique({
            where: { id },

            include: {
              items: {
                orderBy: {
                  sortOrder: "asc",
                },
              },

              attachments: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          });

        if (!source) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        const proposalNumber =
          await generateStandaloneProposalNumber(
            prisma
          );

        const publicToken =
          generatePublicToken();

        const duplicated =
          await prisma.$transaction(
            async (tx) => {
              const proposal =
                await tx.standaloneProposal.create({
                  data: {
                    proposalNumber,
                    publicToken,

                    clientId:
                      source.clientId,

                    clientName:
                      source.clientName,

                    clientCpfCnpj:
                      source.clientCpfCnpj,

                    clientEmail:
                      source.clientEmail,

                    clientPhone:
                      source.clientPhone,

                    clientWhatsapp:
                      source.clientWhatsapp,

                    clientAddress:
                      source.clientAddress,

                    clientCity:
                      source.clientCity,

                    clientState:
                      source.clientState,

                    createdById:
                      req.user?.id || null,

                    status:
                      "RASCUNHO",

                    approvalMode:
                      "NENHUM",

                    title:
                      source.title,

                    objectText:
                      source.objectText,

                    introText:
                      source.introText,

                    scopeText:
                      source.scopeText,

                    subtotalAmount:
                      source.subtotalAmount,

                    discountAmount:
                      source.discountAmount,

                    additionAmount:
                      source.additionAmount,

                    totalAmount:
                      source.totalAmount,

                    paymentMode:
                      source.paymentMode,

                    entryAmount:
                      source.entryAmount,

                    installmentQty:
                      source.installmentQty,

                    installmentAmount:
                      source.installmentAmount,

                    paymentText:
                      source.paymentText,

                    executionDays:
                      source.executionDays,

                    executionText:
                      source.executionText,

                    validUntil:
                      source.validUntil,

                    notes:
                      source.notes,

                    internalNotes:
                      null,
                  },
                });

              for (
                const item
                of source.items
              ) {
                await tx.standaloneProposalItem.create({
                  data: {
                    proposalId:
                      proposal.id,

                    catalogServiceId:
                      item.catalogServiceId,

                    catalogServiceCode:
                      item.catalogServiceCode,

                    categoryName:
                      item.categoryName,

                    serviceName:
                      item.serviceName,

                    acronym:
                      item.acronym,

                    description:
                      item.description,

                    technicalDescription:
                      item.technicalDescription,

                    legalText:
                      item.legalText,

                    pricingMode:
                      item.pricingMode,

                    quantity:
                      item.quantity,

                    unitLabel:
                      item.unitLabel,

                    catalogUnitAmount:
                      item.catalogUnitAmount,

                    unitAmount:
                      item.unitAmount,

                    totalAmount:
                      item.totalAmount,

                    manualPrice:
                      item.manualPrice,

                    sortOrder:
                      item.sortOrder,
                  },
                });
              }

              for (
                const attachment
                of source.attachments
              ) {
                await tx.standaloneProposalAttachment.create({
                  data: {
                    proposalId:
                      proposal.id,

                    type:
                      attachment.type,

                    title:
                      attachment.title,

                    description:
                      attachment.description,

                    fileName:
                      attachment.fileName,

                    filePath:
                      attachment.filePath,

                    mimeType:
                      attachment.mimeType,

                    size:
                      attachment.size,

                    sortOrder:
                      attachment.sortOrder,
                  },
                });
              }

              return proposal;
            }
          );

        await createEvent(prisma, {
          proposalId:
            duplicated.id,

          eventType:
            "PROPOSTA_DUPLICADA",

          title:
            "Proposta criada por duplicação",

          description:
            `Origem: ${source.proposalNumber}`,

          user:
            req.user,

          req,

          metadata: {
            sourceProposalId:
              source.id,

            sourceProposalNumber:
              source.proposalNumber,
          },
        });

        const refreshed =
          await prisma.standaloneProposal.findUnique({
            where: {
              id:
                duplicated.id,
            },

            include:
              proposalInclude,
          });

        return res
          .status(201)
          .json(refreshed);
      } catch (error) {
        console.error(
          "Erro ao duplicar proposta:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao duplicar proposta.",
        });
      }
    }
  );

  // =====================================================
  // GERAR PDF OFICIAL
  // =====================================================

  app.post(
    "/standalone-proposals/:id/generate-pdf",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id =
          Number(req.params.id);

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return res.status(400).json({
            message:
              "ID da proposta inválido.",
          });
        }

        const result =
          await generateStandaloneProposalPdf(
            prisma,
            id
          );

        await createEvent(
          prisma,
          {
            proposalId: id,

            eventType:
              "PDF_GERADO",

            title:
              "PDF oficial da proposta gerado",

            description:
              result.fileName,

            user:
              req.user,

            req,

            metadata: {
              fileName:
                result.fileName,

              sha256:
                result.hash,
            },
          }
        );

        return res.json({
          message:
            "PDF gerado com sucesso.",

          proposal:
            result.proposal,

          fileName:
            result.fileName,

          sha256:
            result.hash,

          downloadUrl:
            `/standalone-proposals/${id}/pdf`,
        });
      } catch (
        error: any
      ) {
        console.error(
          "Erro ao gerar PDF da proposta:",
          error
        );

        return res
          .status(400)
          .json({
            message:
              error?.message ||
              "Erro ao gerar PDF.",
          });
      }
    }
  );

  // =====================================================
  // DOWNLOAD DO PDF OFICIAL
  // =====================================================

  app.get(
    "/standalone-proposals/:id/pdf",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req, res) => {
      try {
        const id =
          Number(req.params.id);

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id,
            },

            select: {
              id: true,

              proposalNumber:
                true,

              generatedPdfPath:
                true,

              generatedPdfName:
                true,
            },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        if (
          !proposal.generatedPdfPath
        ) {
          return res.status(404).json({
            message:
              "Esta proposta ainda não possui PDF gerado.",
          });
        }

        if (
          !fs.existsSync(
            proposal.generatedPdfPath
          )
        ) {
          return res.status(404).json({
            message:
              "O arquivo PDF não foi encontrado no servidor.",
          });
        }

        return res.download(
          proposal.generatedPdfPath,

          proposal.generatedPdfName ||
            `${proposal.proposalNumber}.pdf`
        );
      } catch (error) {
        console.error(
          "Erro ao baixar PDF da proposta:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao baixar PDF da proposta.",
        });
      }
    }
  );

  // =====================================================
  // APROVAÇÃO VERBAL
  // =====================================================

  app.post(
    "/standalone-proposals/:id/verbal-approval",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id =
          Number(req.params.id);

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id,
            },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        const approvedBy =
          String(
            req.body?.approvedBy ||
            proposal.clientName
          ).trim();

        const now = new Date();

        const updated =
          await prisma.standaloneProposal.update({
            where: {
              id,
            },

            data: {
              status:
                "APROVADA_VERBALMENTE",

              approvalMode:
                "VERBAL",

              verbalApprovedAt:
                now,

              verbalApprovedBy:
                approvedBy,

              verbalApprovalNote:
                textOrNull(
                  req.body?.note
                ),
            },

            include: proposalInclude,
          });

        await createEvent(prisma, {
          proposalId: id,

          eventType:
            "APROVACAO_VERBAL",

          title:
            "Aprovação verbal registrada",

          description:
            `Aprovação verbal informada por ${approvedBy}.`,

          user: req.user,
          req,

          metadata: {
            approvedAt:
              now.toISOString(),
            note:
              req.body?.note || null,
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao registrar aprovação verbal:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao registrar aprovação verbal.",
        });
      }
    }
  );

  // =====================================================
  // MARCAR COMO ENVIADA
  // =====================================================

  app.post(
    "/standalone-proposals/:id/mark-sent",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id =
          Number(req.params.id);

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id,
            },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        const now = new Date();

        const updated =
          await prisma.standaloneProposal.update({
            where: {
              id,
            },

            data: {
              status: "ENVIADA",
              sentAt: now,
            },
          });

        await createEvent(prisma, {
          proposalId: id,

          eventType:
            "PROPOSTA_ENVIADA",

          title:
            "Proposta marcada como enviada",

          recipient:
            textOrNull(
              req.body?.recipient
            ) ||
            proposal.clientEmail ||
            proposal.clientWhatsapp ||
            null,

          description:
            textOrNull(
              req.body?.channel
            )
              ? `Canal: ${req.body.channel}`
              : null,

          user: req.user,
          req,
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao marcar proposta como enviada:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao atualizar envio da proposta.",
        });
      }
    }
  );

  // =====================================================
  // CANCELAR
  // =====================================================

  app.post(
    "/standalone-proposals/:id/cancel",
    authMiddleware,
    requireRoles(COMMERCIAL_ROLES),
    async (req: any, res) => {
      try {
        const id =
          Number(req.params.id);

        const proposal =
          await prisma.standaloneProposal.findUnique({
            where: {
              id,
            },
          });

        if (!proposal) {
          return res.status(404).json({
            message:
              "Proposta não encontrada.",
          });
        }

        const updated =
          await prisma.standaloneProposal.update({
            where: {
              id,
            },

            data: {
              status:
                "CANCELADA",
            },
          });

        await createEvent(prisma, {
          proposalId: id,

          eventType:
            "PROPOSTA_CANCELADA",

          title:
            "Proposta cancelada",

          description:
            textOrNull(
              req.body?.reason
            ),

          user: req.user,
          req,
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao cancelar proposta:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao cancelar proposta.",
        });
      }
    }
  );
}
