import { Express } from "express";
import { PrismaClient } from "@prisma/client";

type RegisterCatalogRoutesParams = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;
};

const ADMIN_ROLES = ["GERENTE", "PROGRAMADOR"];

const PRICING_MODES = [
  "FIXO",
  "POR_HECTARE",
  "POR_KM",
  "POR_UNIDADE",
  "POR_MODULO_FISCAL",
  "POR_DIARIA",
  "POR_HORA",
  "POR_FAIXA",
  "SOB_CONSULTA",
] as const;

function textOrNull(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function normalizeCode(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[ÁÀÃÂÄ]/g, "A")
    .replace(/[ÉÈÊË]/g, "E")
    .replace(/[ÍÌÎÏ]/g, "I")
    .replace(/[ÓÒÕÔÖ]/g, "O")
    .replace(/[ÚÙÛÜ]/g, "U")
    .replace(/Ç/g, "C")
    .replace(/[^A-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function integerOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round(number);
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return number;
}

function booleanValue(value: unknown, fallback = true) {
  if (typeof value === "boolean") {
    return value;
  }

  if (value === "false" || value === "0" || value === 0) {
    return false;
  }

  if (value === "true" || value === "1" || value === 1) {
    return true;
  }

  return fallback;
}

function pricingModeIsValid(value: unknown) {
  return PRICING_MODES.includes(
    String(value ?? "") as (typeof PRICING_MODES)[number]
  );
}

export function registerCatalogRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
}: RegisterCatalogRoutesParams) {
  // ======================================================
  // RESUMO DO CATÁLOGO
  // ======================================================

  app.get(
    "/catalog/summary",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (_req, res) => {
      try {
        const [
          categories,
          activeCategories,
          services,
          activeServices,
          packages,
          activePackages,
        ] = await Promise.all([
          prisma.serviceCategory.count(),
          prisma.serviceCategory.count({
            where: { active: true },
          }),
          prisma.catalogService.count(),
          prisma.catalogService.count({
            where: { active: true },
          }),
          prisma.servicePackage.count(),
          prisma.servicePackage.count({
            where: { active: true },
          }),
        ]);

        return res.json({
          categories,
          activeCategories,
          services,
          activeServices,
          packages,
          activePackages,
        });
      } catch (error) {
        console.error("Erro ao carregar resumo do catálogo:", error);

        return res.status(500).json({
          message: "Erro ao carregar resumo do catálogo.",
        });
      }
    }
  );

  // ======================================================
  // CATEGORIAS
  // ======================================================

  app.get(
    "/catalog/categories",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const includeInactive =
          String(req.query.includeInactive || "") === "true";

        const categories = await prisma.serviceCategory.findMany({
          where: includeInactive
            ? undefined
            : {
                active: true,
              },

          include: {
            _count: {
              select: {
                services: true,
              },
            },
          },

          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              name: "asc",
            },
          ],
        });

        return res.json(categories);
      } catch (error) {
        console.error("Erro ao listar categorias:", error);

        return res.status(500).json({
          message: "Erro ao listar categorias.",
        });
      }
    }
  );

  app.post(
    "/catalog/categories",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const name = String(req.body?.name || "").trim();

        const code = normalizeCode(
          req.body?.code || name
        );

        if (!name) {
          return res.status(400).json({
            message: "Informe o nome da categoria.",
          });
        }

        if (!code) {
          return res.status(400).json({
            message: "Informe um código válido para a categoria.",
          });
        }

        const existing =
          await prisma.serviceCategory.findUnique({
            where: {
              code,
            },
          });

        if (existing) {
          return res.status(409).json({
            message:
              "Já existe uma categoria com este código.",
          });
        }

        const category =
          await prisma.serviceCategory.create({
            data: {
              name,
              code,
              description: textOrNull(
                req.body?.description
              ),
              sortOrder:
                integerOrNull(req.body?.sortOrder) ?? 0,
              active: booleanValue(
                req.body?.active,
                true
              ),
            },
          });

        return res.status(201).json(category);
      } catch (error) {
        console.error("Erro ao cadastrar categoria:", error);

        return res.status(500).json({
          message: "Erro ao cadastrar categoria.",
        });
      }
    }
  );

  app.put(
    "/catalog/categories/:id",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({
            message: "ID da categoria inválido.",
          });
        }

        const existing =
          await prisma.serviceCategory.findUnique({
            where: { id },
          });

        if (!existing) {
          return res.status(404).json({
            message: "Categoria não encontrada.",
          });
        }

        const name = String(
          req.body?.name ?? existing.name
        ).trim();

        const code = normalizeCode(
          req.body?.code ?? existing.code
        );

        if (!name || !code) {
          return res.status(400).json({
            message:
              "Nome e código da categoria são obrigatórios.",
          });
        }

        const duplicated =
          await prisma.serviceCategory.findFirst({
            where: {
              code,
              NOT: {
                id,
              },
            },
          });

        if (duplicated) {
          return res.status(409).json({
            message:
              "Já existe outra categoria com este código.",
          });
        }

        const category =
          await prisma.serviceCategory.update({
            where: { id },

            data: {
              name,
              code,
              description:
                req.body?.description !== undefined
                  ? textOrNull(req.body.description)
                  : existing.description,

              sortOrder:
                req.body?.sortOrder !== undefined
                  ? integerOrNull(
                      req.body.sortOrder
                    ) ?? 0
                  : existing.sortOrder,

              active:
                req.body?.active !== undefined
                  ? booleanValue(
                      req.body.active,
                      existing.active
                    )
                  : existing.active,
            },
          });

        return res.json(category);
      } catch (error) {
        console.error("Erro ao atualizar categoria:", error);

        return res.status(500).json({
          message: "Erro ao atualizar categoria.",
        });
      }
    }
  );

  // ======================================================
  // SERVIÇOS
  // ======================================================

  app.get(
    "/catalog/services",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const includeInactive =
          String(req.query.includeInactive || "") === "true";

        const categoryId = Number(
          req.query.categoryId || 0
        );

        const search = String(
          req.query.search || ""
        ).trim();

        const services =
          await prisma.catalogService.findMany({
            where: {
              ...(includeInactive
                ? {}
                : {
                    active: true,
                  }),

              ...(Number.isInteger(categoryId) &&
              categoryId > 0
                ? {
                    categoryId,
                  }
                : {}),

              ...(search
                ? {
                    OR: [
                      {
                        name: {
                          contains: search,
                        },
                      },
                      {
                        code: {
                          contains:
                            search.toUpperCase(),
                        },
                      },
                      {
                        acronym: {
                          contains:
                            search.toUpperCase(),
                        },
                      },
                    ],
                  }
                : {}),
            },

            include: {
              category: true,

              pricingTiers: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },

            orderBy: [
              {
                category: {
                  sortOrder: "asc",
                },
              },
              {
                sortOrder: "asc",
              },
              {
                name: "asc",
              },
            ],
          });

        return res.json(services);
      } catch (error) {
        console.error("Erro ao listar serviços:", error);

        return res.status(500).json({
          message: "Erro ao listar serviços.",
        });
      }
    }
  );

  app.get(
    "/catalog/services/:id",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({
            message: "ID do serviço inválido.",
          });
        }

        const service =
          await prisma.catalogService.findUnique({
            where: { id },

            include: {
              category: true,

              pricingTiers: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          });

        if (!service) {
          return res.status(404).json({
            message: "Serviço não encontrado.",
          });
        }

        return res.json(service);
      } catch (error) {
        console.error("Erro ao carregar serviço:", error);

        return res.status(500).json({
          message: "Erro ao carregar serviço.",
        });
      }
    }
  );

  app.post(
    "/catalog/services",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const categoryId = Number(
          req.body?.categoryId
        );

        const name = String(
          req.body?.name || ""
        ).trim();

        const code = normalizeCode(
          req.body?.code || name
        );

        const pricingMode = String(
          req.body?.pricingMode || ""
        );

        if (
          !Number.isInteger(categoryId) ||
          categoryId <= 0
        ) {
          return res.status(400).json({
            message:
              "Selecione uma categoria válida.",
          });
        }

        if (!name) {
          return res.status(400).json({
            message: "Informe o nome do serviço.",
          });
        }

        if (!code) {
          return res.status(400).json({
            message:
              "Informe um código válido para o serviço.",
          });
        }

        if (!pricingModeIsValid(pricingMode)) {
          return res.status(400).json({
            message:
              "Informe uma modalidade de precificação válida.",
          });
        }

        const category =
          await prisma.serviceCategory.findUnique({
            where: {
              id: categoryId,
            },
          });

        if (!category) {
          return res.status(404).json({
            message: "Categoria não encontrada.",
          });
        }

        const duplicated =
          await prisma.catalogService.findUnique({
            where: {
              code,
            },
          });

        if (duplicated) {
          return res.status(409).json({
            message:
              "Já existe um serviço com este código.",
          });
        }

        const service =
          await prisma.catalogService.create({
            data: {
              categoryId,
              code,
              name,

              acronym: textOrNull(
                req.body?.acronym
              ),

              shortDescription: textOrNull(
                req.body?.shortDescription
              ),

              proposalDescription: textOrNull(
                req.body?.proposalDescription
              ),

              technicalDescription: textOrNull(
                req.body?.technicalDescription
              ),

              legalText: textOrNull(
                req.body?.legalText
              ),

              pricingMode: pricingMode as any,

              baseAmount:
                integerOrNull(
                  req.body?.baseAmount
                ) ?? 0,

              minimumAmount:
                integerOrNull(
                  req.body?.minimumAmount
                ),

              unitLabel: textOrNull(
                req.body?.unitLabel
              ),

              defaultExecutionDays:
                integerOrNull(
                  req.body?.defaultExecutionDays
                ),

              allowManualPrice:
                booleanValue(
                  req.body?.allowManualPrice,
                  true
                ),

              sortOrder:
                integerOrNull(
                  req.body?.sortOrder
                ) ?? 0,

              active:
                booleanValue(
                  req.body?.active,
                  true
                ),
            },

            include: {
              category: true,
              pricingTiers: true,
            },
          });

        return res.status(201).json(service);
      } catch (error) {
        console.error("Erro ao cadastrar serviço:", error);

        return res.status(500).json({
          message: "Erro ao cadastrar serviço.",
        });
      }
    }
  );

  app.put(
    "/catalog/services/:id",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({
            message: "ID do serviço inválido.",
          });
        }

        const existing =
          await prisma.catalogService.findUnique({
            where: { id },
          });

        if (!existing) {
          return res.status(404).json({
            message: "Serviço não encontrado.",
          });
        }

        const categoryId =
          req.body?.categoryId !== undefined
            ? Number(req.body.categoryId)
            : existing.categoryId;

        if (
          !Number.isInteger(categoryId) ||
          categoryId <= 0
        ) {
          return res.status(400).json({
            message:
              "Selecione uma categoria válida.",
          });
        }

        const category =
          await prisma.serviceCategory.findUnique({
            where: {
              id: categoryId,
            },
          });

        if (!category) {
          return res.status(404).json({
            message: "Categoria não encontrada.",
          });
        }

        const name = String(
          req.body?.name ?? existing.name
        ).trim();

        const code = normalizeCode(
          req.body?.code ?? existing.code
        );

        const pricingMode = String(
          req.body?.pricingMode ??
            existing.pricingMode
        );

        if (!name || !code) {
          return res.status(400).json({
            message:
              "Nome e código do serviço são obrigatórios.",
          });
        }

        if (!pricingModeIsValid(pricingMode)) {
          return res.status(400).json({
            message:
              "Modalidade de precificação inválida.",
          });
        }

        const duplicated =
          await prisma.catalogService.findFirst({
            where: {
              code,
              NOT: {
                id,
              },
            },
          });

        if (duplicated) {
          return res.status(409).json({
            message:
              "Já existe outro serviço com este código.",
          });
        }

        const service =
          await prisma.catalogService.update({
            where: { id },

            data: {
              categoryId,
              name,
              code,

              acronym:
                req.body?.acronym !== undefined
                  ? textOrNull(req.body.acronym)
                  : existing.acronym,

              shortDescription:
                req.body?.shortDescription !==
                undefined
                  ? textOrNull(
                      req.body.shortDescription
                    )
                  : existing.shortDescription,

              proposalDescription:
                req.body?.proposalDescription !==
                undefined
                  ? textOrNull(
                      req.body.proposalDescription
                    )
                  : existing.proposalDescription,

              technicalDescription:
                req.body?.technicalDescription !==
                undefined
                  ? textOrNull(
                      req.body.technicalDescription
                    )
                  : existing.technicalDescription,

              legalText:
                req.body?.legalText !== undefined
                  ? textOrNull(
                      req.body.legalText
                    )
                  : existing.legalText,

              pricingMode:
                pricingMode as any,

              baseAmount:
                req.body?.baseAmount !== undefined
                  ? integerOrNull(
                      req.body.baseAmount
                    ) ?? 0
                  : existing.baseAmount,

              minimumAmount:
                req.body?.minimumAmount !==
                undefined
                  ? integerOrNull(
                      req.body.minimumAmount
                    )
                  : existing.minimumAmount,

              unitLabel:
                req.body?.unitLabel !== undefined
                  ? textOrNull(
                      req.body.unitLabel
                    )
                  : existing.unitLabel,

              defaultExecutionDays:
                req.body?.defaultExecutionDays !==
                undefined
                  ? integerOrNull(
                      req.body
                        .defaultExecutionDays
                    )
                  : existing.defaultExecutionDays,

              allowManualPrice:
                req.body?.allowManualPrice !==
                undefined
                  ? booleanValue(
                      req.body.allowManualPrice,
                      existing.allowManualPrice
                    )
                  : existing.allowManualPrice,

              sortOrder:
                req.body?.sortOrder !== undefined
                  ? integerOrNull(
                      req.body.sortOrder
                    ) ?? 0
                  : existing.sortOrder,

              active:
                req.body?.active !== undefined
                  ? booleanValue(
                      req.body.active,
                      existing.active
                    )
                  : existing.active,
            },

            include: {
              category: true,

              pricingTiers: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          });

        return res.json(service);
      } catch (error) {
        console.error("Erro ao atualizar serviço:", error);

        return res.status(500).json({
          message: "Erro ao atualizar serviço.",
        });
      }
    }
  );

  // ======================================================
  // FAIXAS DE PREÇO
  // ======================================================

  app.put(
    "/catalog/services/:id/pricing-tiers",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const serviceId = Number(req.params.id);

        if (
          !Number.isInteger(serviceId) ||
          serviceId <= 0
        ) {
          return res.status(400).json({
            message: "ID do serviço inválido.",
          });
        }

        const service =
          await prisma.catalogService.findUnique({
            where: {
              id: serviceId,
            },
          });

        if (!service) {
          return res.status(404).json({
            message: "Serviço não encontrado.",
          });
        }

        const tiers = Array.isArray(
          req.body?.tiers
        )
          ? req.body.tiers
          : [];

        const normalized = tiers.map(
          (tier: any, index: number) => {
            const unitAmount =
              integerOrNull(tier?.unitAmount);

            if (
              unitAmount === null ||
              unitAmount < 0
            ) {
              throw new Error(
                `Valor inválido na faixa ${
                  index + 1
                }.`
              );
            }

            return {
              serviceId,

              minQuantity:
                numberOrNull(
                  tier?.minQuantity
                ),

              maxQuantity:
                numberOrNull(
                  tier?.maxQuantity
                ),

              unitAmount,

              minimumAmount:
                integerOrNull(
                  tier?.minimumAmount
                ),

              sortOrder:
                integerOrNull(
                  tier?.sortOrder
                ) ?? index,

              active:
                booleanValue(
                  tier?.active,
                  true
                ),
            };
          }
        );

        await prisma.$transaction(async (tx) => {
          await tx.catalogServicePricingTier.deleteMany({
            where: {
              serviceId,
            },
          });

          for (const tier of normalized) {
            await tx.catalogServicePricingTier.create({
              data: tier,
            });
          }
        });

        const updated =
          await prisma.catalogService.findUnique({
            where: {
              id: serviceId,
            },

            include: {
              category: true,

              pricingTiers: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          });

        return res.json(updated);
      } catch (error: any) {
        console.error(
          "Erro ao atualizar faixas:",
          error
        );

        return res.status(400).json({
          message:
            error?.message ||
            "Erro ao atualizar faixas de preço.",
        });
      }
    }
  );

  // ======================================================
  // PACOTES
  // ======================================================

  app.get(
    "/catalog/packages",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const includeInactive =
          String(req.query.includeInactive || "") ===
          "true";

        const packages =
          await prisma.servicePackage.findMany({
            where: includeInactive
              ? undefined
              : {
                  active: true,
                },

            include: {
              items: {
                include: {
                  service: {
                    include: {
                      category: true,
                    },
                  },
                },

                orderBy: {
                  sortOrder: "asc",
                },
              },
            },

            orderBy: {
              name: "asc",
            },
          });

        return res.json(packages);
      } catch (error) {
        console.error("Erro ao listar pacotes:", error);

        return res.status(500).json({
          message: "Erro ao listar pacotes.",
        });
      }
    }
  );

  app.post(
    "/catalog/packages",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const name = String(
          req.body?.name || ""
        ).trim();

        const code = normalizeCode(
          req.body?.code || name
        );

        if (!name || !code) {
          return res.status(400).json({
            message:
              "Nome e código do pacote são obrigatórios.",
          });
        }

        const duplicated =
          await prisma.servicePackage.findUnique({
            where: {
              code,
            },
          });

        if (duplicated) {
          return res.status(409).json({
            message:
              "Já existe um pacote com este código.",
          });
        }

        const servicePackage =
          await prisma.servicePackage.create({
            data: {
              name,
              code,

              description: textOrNull(
                req.body?.description
              ),

              proposalDescription: textOrNull(
                req.body?.proposalDescription
              ),

              active: booleanValue(
                req.body?.active,
                true
              ),
            },
          });

        return res
          .status(201)
          .json(servicePackage);
      } catch (error) {
        console.error("Erro ao cadastrar pacote:", error);

        return res.status(500).json({
          message: "Erro ao cadastrar pacote.",
        });
      }
    }
  );

  app.put(
    "/catalog/packages/:id",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
          return res.status(400).json({
            message: "ID do pacote inválido.",
          });
        }

        const existing =
          await prisma.servicePackage.findUnique({
            where: { id },
          });

        if (!existing) {
          return res.status(404).json({
            message: "Pacote não encontrado.",
          });
        }

        const name = String(
          req.body?.name ?? existing.name
        ).trim();

        const code = normalizeCode(
          req.body?.code ?? existing.code
        );

        const duplicated =
          await prisma.servicePackage.findFirst({
            where: {
              code,
              NOT: {
                id,
              },
            },
          });

        if (duplicated) {
          return res.status(409).json({
            message:
              "Já existe outro pacote com este código.",
          });
        }

        const servicePackage =
          await prisma.servicePackage.update({
            where: { id },

            data: {
              name,
              code,

              description:
                req.body?.description !== undefined
                  ? textOrNull(req.body.description)
                  : existing.description,

              proposalDescription:
                req.body?.proposalDescription !==
                undefined
                  ? textOrNull(
                      req.body.proposalDescription
                    )
                  : existing.proposalDescription,

              active:
                req.body?.active !== undefined
                  ? booleanValue(
                      req.body.active,
                      existing.active
                    )
                  : existing.active,
            },
          });

        return res.json(servicePackage);
      } catch (error) {
        console.error("Erro ao atualizar pacote:", error);

        return res.status(500).json({
          message: "Erro ao atualizar pacote.",
        });
      }
    }
  );

  app.put(
    "/catalog/packages/:id/items",
    authMiddleware,
    requireRoles(ADMIN_ROLES),
    async (req, res) => {
      try {
        const packageId = Number(req.params.id);

        if (
          !Number.isInteger(packageId) ||
          packageId <= 0
        ) {
          return res.status(400).json({
            message: "ID do pacote inválido.",
          });
        }

        const servicePackage =
          await prisma.servicePackage.findUnique({
            where: {
              id: packageId,
            },
          });

        if (!servicePackage) {
          return res.status(404).json({
            message: "Pacote não encontrado.",
          });
        }

        const items = Array.isArray(
          req.body?.items
        )
          ? req.body.items
          : [];

        const normalized = items.map(
          (item: any, index: number) => {
            const serviceId = Number(
              item?.serviceId
            );

            if (
              !Number.isInteger(serviceId) ||
              serviceId <= 0
            ) {
              throw new Error(
                `Serviço inválido no item ${
                  index + 1
                }.`
              );
            }

            return {
              packageId,
              serviceId,

              quantity:
                numberOrNull(
                  item?.quantity
                ) ?? 1,

              required:
                booleanValue(
                  item?.required,
                  true
                ),

              sortOrder:
                integerOrNull(
                  item?.sortOrder
                ) ?? index,
            };
          }
        );

        const uniqueIds = new Set<number>(
          normalized.map(
            (item: any) => Number(item.serviceId)
          )
        );

        if (
          uniqueIds.size !== normalized.length
        ) {
          return res.status(400).json({
            message:
              "Um serviço não pode aparecer duas vezes no mesmo pacote.",
          });
        }

        if (normalized.length > 0) {
          const existingServices =
            await prisma.catalogService.count({
              where: {
                id: {
                  in: Array.from(uniqueIds),
                },
              },
            });

          if (
            existingServices !== uniqueIds.size
          ) {
            return res.status(400).json({
              message:
                "Um ou mais serviços informados não existem.",
            });
          }
        }

        await prisma.$transaction(async (tx) => {
          await tx.servicePackageItem.deleteMany({
            where: {
              packageId,
            },
          });

          for (const item of normalized) {
            await tx.servicePackageItem.create({
              data: item,
            });
          }
        });

        const updated =
          await prisma.servicePackage.findUnique({
            where: {
              id: packageId,
            },

            include: {
              items: {
                include: {
                  service: {
                    include: {
                      category: true,
                    },
                  },
                },

                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          });

        return res.json(updated);
      } catch (error: any) {
        console.error(
          "Erro ao atualizar itens do pacote:",
          error
        );

        return res.status(400).json({
          message:
            error?.message ||
            "Erro ao atualizar itens do pacote.",
        });
      }
    }
  );
}
