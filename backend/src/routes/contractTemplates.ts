import { Router } from "express";
import type { PrismaClient } from "@prisma/client";

type ContractTemplateRoutesDeps = {
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: string[]) => any;
};

function normalizeTemplateCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function validPositiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function createContractTemplateRouter({
  prisma,
  authMiddleware,
  requireRoles,
}: ContractTemplateRoutesDeps) {
  const router = Router();

  // ============================================================
  // MODELOS
  // ============================================================

  router.get(
    "/contract-templates",
    authMiddleware,
    requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const includeInactive =
          String(req.query?.includeInactive || "") === "true";

        const templates = await prisma.contractTemplate.findMany({
          where: includeInactive ? undefined : { active: true },
          orderBy: [{ active: "desc" }, { name: "asc" }],
          include: {
            versions: {
              orderBy: {
                versionNumber: "desc",
              },
              include: {
                _count: {
                  select: {
                    clauses: true,
                    contracts: true,
                  },
                },
              },
            },
            _count: {
              select: {
                defaultForServices: true,
              },
            },
          },
        });

        return res.json(templates);
      } catch (error) {
        console.error("Erro ao listar modelos contratuais:", error);

        return res.status(500).json({
          message: "Erro ao listar modelos contratuais.",
        });
      }
    }
  );

  router.get(
    "/contract-templates/:id",
    authMiddleware,
    requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID do modelo contratual inválido.",
          });
        }

        const template = await prisma.contractTemplate.findUnique({
          where: { id },
          include: {
            versions: {
              orderBy: {
                versionNumber: "desc",
              },
              include: {
                clauses: {
                  orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
                },
                _count: {
                  select: {
                    contracts: true,
                  },
                },
              },
            },
            defaultForServices: {
              orderBy: {
                name: "asc",
              },
              select: {
                id: true,
                code: true,
                name: true,
                acronym: true,
                active: true,
              },
            },
          },
        });

        if (!template) {
          return res.status(404).json({
            message: "Modelo contratual não encontrado.",
          });
        }

        return res.json(template);
      } catch (error) {
        console.error("Erro ao buscar modelo contratual:", error);

        return res.status(500).json({
          message: "Erro ao buscar modelo contratual.",
        });
      }
    }
  );

  router.post(
    "/contract-templates",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const name = String(req.body?.name || "").trim();

        const code = normalizeTemplateCode(
          req.body?.code || req.body?.name
        );

        if (!name) {
          return res.status(400).json({
            message: "Nome do modelo contratual é obrigatório.",
          });
        }

        if (!code) {
          return res.status(400).json({
            message: "Código do modelo contratual é obrigatório.",
          });
        }

        const existing = await prisma.contractTemplate.findUnique({
          where: { code },
        });

        if (existing) {
          return res.status(409).json({
            message: `Já existe um modelo contratual com o código ${code}.`,
          });
        }

        const template = await prisma.contractTemplate.create({
          data: {
            code,
            name,
            description: normalizeText(req.body?.description),
            active:
              req.body?.active === undefined
                ? true
                : Boolean(req.body.active),

            createdById: req.user?.id || null,
            updatedById: req.user?.id || null,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: "CREATE_CONTRACT_TEMPLATE",
            entity: "ContractTemplate",
            entityId: String(template.id),

            description:
              `Modelo contratual ${template.code} criado.`,

            ipAddress: req.ip,
          },
        });

        return res.status(201).json(template);
      } catch (error) {
        console.error("Erro ao criar modelo contratual:", error);

        return res.status(500).json({
          message: "Erro ao criar modelo contratual.",
        });
      }
    }
  );

  router.put(
    "/contract-templates/:id",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID do modelo contratual inválido.",
          });
        }

        const current = await prisma.contractTemplate.findUnique({
          where: { id },
        });

        if (!current) {
          return res.status(404).json({
            message: "Modelo contratual não encontrado.",
          });
        }

        const name =
          req.body?.name === undefined
            ? undefined
            : String(req.body.name).trim();

        if (name !== undefined && !name) {
          return res.status(400).json({
            message: "Nome do modelo contratual não pode ficar vazio.",
          });
        }

        const updated = await prisma.contractTemplate.update({
          where: { id },
          data: {
            name,
            description:
              req.body?.description === undefined
                ? undefined
                : normalizeText(req.body.description),

            active:
              req.body?.active === undefined
                ? undefined
                : Boolean(req.body.active),

            updatedById: req.user?.id || null,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: "UPDATE_CONTRACT_TEMPLATE",
            entity: "ContractTemplate",
            entityId: String(updated.id),

            description:
              `Modelo contratual ${updated.code} atualizado.`,

            ipAddress: req.ip,

            metadata: JSON.stringify({
              before: current,
              after: updated,
            }),
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error("Erro ao atualizar modelo contratual:", error);

        return res.status(500).json({
          message: "Erro ao atualizar modelo contratual.",
        });
      }
    }
  );

  // ============================================================
  // VERSÕES
  // ============================================================

  router.post(
    "/contract-templates/:id/versions",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const templateId = validPositiveId(req.params.id);

        if (!templateId) {
          return res.status(400).json({
            message: "ID do modelo contratual inválido.",
          });
        }

        const template = await prisma.contractTemplate.findUnique({
          where: { id: templateId },
        });

        if (!template) {
          return res.status(404).json({
            message: "Modelo contratual não encontrado.",
          });
        }

        const lastVersion =
          await prisma.contractTemplateVersion.findFirst({
            where: { templateId },
            orderBy: {
              versionNumber: "desc",
            },
          });

        const version =
          await prisma.contractTemplateVersion.create({
            data: {
              templateId,
              versionNumber:
                (lastVersion?.versionNumber || 0) + 1,

              status: "RASCUNHO",

              label: normalizeText(req.body?.label),
              notes: normalizeText(req.body?.notes),

              createdById: req.user?.id || null,
            },
            include: {
              clauses: true,
            },
          });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: "CREATE_CONTRACT_TEMPLATE_VERSION",
            entity: "ContractTemplateVersion",
            entityId: String(version.id),

            description:
              `Versão ${version.versionNumber} criada para o modelo ${template.code}.`,

            ipAddress: req.ip,
          },
        });

        return res.status(201).json(version);
      } catch (error) {
        console.error(
          "Erro ao criar versão de modelo contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao criar versão de modelo contratual.",
        });
      }
    }
  );

  router.get(
    "/contract-template-versions/:id",
    authMiddleware,
    requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da versão inválido.",
          });
        }

        const version =
          await prisma.contractTemplateVersion.findUnique({
            where: { id },
            include: {
              template: true,
              clauses: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              },
              _count: {
                select: {
                  contracts: true,
                },
              },
            },
          });

        if (!version) {
          return res.status(404).json({
            message: "Versão do modelo não encontrada.",
          });
        }

        return res.json(version);
      } catch (error) {
        console.error(
          "Erro ao buscar versão de modelo contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao buscar versão de modelo contratual.",
        });
      }
    }
  );

  router.put(
    "/contract-template-versions/:id",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da versão inválido.",
          });
        }

        const current =
          await prisma.contractTemplateVersion.findUnique({
            where: { id },
          });

        if (!current) {
          return res.status(404).json({
            message: "Versão do modelo não encontrada.",
          });
        }

        if (current.status !== "RASCUNHO") {
          return res.status(409).json({
            code: "CONTRACT_TEMPLATE_VERSION_IMMUTABLE",
            message:
              "Somente versões em RASCUNHO podem ser alteradas.",
          });
        }

        const updated =
          await prisma.contractTemplateVersion.update({
            where: { id },
            data: {
              label:
                req.body?.label === undefined
                  ? undefined
                  : normalizeText(req.body.label),

              notes:
                req.body?.notes === undefined
                  ? undefined
                  : normalizeText(req.body.notes),
            },
          });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: "UPDATE_CONTRACT_TEMPLATE_VERSION",
            entity: "ContractTemplateVersion",
            entityId: String(updated.id),

            description:
              `Versão ${updated.versionNumber} do modelo contratual atualizada.`,

            ipAddress: req.ip,
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao atualizar versão de modelo contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao atualizar versão de modelo contratual.",
        });
      }
    }
  );

  // ============================================================
  // CLÁUSULAS DO MODELO
  // ============================================================

  router.post(
    "/contract-template-versions/:id/clauses",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const templateVersionId =
          validPositiveId(req.params.id);

        if (!templateVersionId) {
          return res.status(400).json({
            message: "ID da versão inválido.",
          });
        }

        const version =
          await prisma.contractTemplateVersion.findUnique({
            where: { id: templateVersionId },
          });

        if (!version) {
          return res.status(404).json({
            message: "Versão do modelo não encontrada.",
          });
        }

        if (version.status !== "RASCUNHO") {
          return res.status(409).json({
            code: "CONTRACT_TEMPLATE_VERSION_IMMUTABLE",
            message:
              "Não é possível adicionar cláusulas a uma versão publicada.",
          });
        }

        const title = String(req.body?.title || "").trim();
        const body = String(req.body?.body || "").trim();

        if (!title || !body) {
          return res.status(400).json({
            message:
              "Título e conteúdo da cláusula são obrigatórios.",
          });
        }

        const lastClause =
          await prisma.contractTemplateClause.findFirst({
            where: { templateVersionId },
            orderBy: {
              sortOrder: "desc",
            },
          });

        const clause =
          await prisma.contractTemplateClause.create({
            data: {
              templateVersionId,

              clauseKey: normalizeText(req.body?.clauseKey),

              title,
              body,

              sortOrder:
                req.body?.sortOrder !== undefined
                  ? Number(req.body.sortOrder)
                  : (lastClause?.sortOrder || 0) + 10,

              required: Boolean(req.body?.required),
              editable:
                req.body?.editable === undefined
                  ? true
                  : Boolean(req.body.editable),

              deletable:
                req.body?.deletable === undefined
                  ? true
                  : Boolean(req.body.deletable),
            },
          });

        return res.status(201).json(clause);
      } catch (error) {
        console.error(
          "Erro ao adicionar cláusula ao modelo:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao adicionar cláusula ao modelo.",
        });
      }
    }
  );

  router.put(
    "/contract-template-clauses/:id",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da cláusula inválido.",
          });
        }

        const current =
          await prisma.contractTemplateClause.findUnique({
            where: { id },
            include: {
              templateVersion: true,
            },
          });

        if (!current) {
          return res.status(404).json({
            message: "Cláusula não encontrada.",
          });
        }

        if (
          current.templateVersion.status !== "RASCUNHO"
        ) {
          return res.status(409).json({
            code: "CONTRACT_TEMPLATE_VERSION_IMMUTABLE",
            message:
              "Cláusulas de versões publicadas são imutáveis.",
          });
        }

        const title =
          req.body?.title === undefined
            ? undefined
            : String(req.body.title).trim();

        const body =
          req.body?.body === undefined
            ? undefined
            : String(req.body.body).trim();

        if (title !== undefined && !title) {
          return res.status(400).json({
            message:
              "Título da cláusula não pode ficar vazio.",
          });
        }

        if (body !== undefined && !body) {
          return res.status(400).json({
            message:
              "Conteúdo da cláusula não pode ficar vazio.",
          });
        }

        const clause =
          await prisma.contractTemplateClause.update({
            where: { id },
            data: {
              clauseKey:
                req.body?.clauseKey === undefined
                  ? undefined
                  : normalizeText(req.body.clauseKey),

              title,
              body,

              sortOrder:
                req.body?.sortOrder === undefined
                  ? undefined
                  : Number(req.body.sortOrder),

              required:
                req.body?.required === undefined
                  ? undefined
                  : Boolean(req.body.required),

              editable:
                req.body?.editable === undefined
                  ? undefined
                  : Boolean(req.body.editable),

              deletable:
                req.body?.deletable === undefined
                  ? undefined
                  : Boolean(req.body.deletable),
            },
          });

        return res.json(clause);
      } catch (error) {
        console.error(
          "Erro ao atualizar cláusula contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao atualizar cláusula contratual.",
        });
      }
    }
  );

  router.delete(
    "/contract-template-clauses/:id",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da cláusula inválido.",
          });
        }

        const clause =
          await prisma.contractTemplateClause.findUnique({
            where: { id },
            include: {
              templateVersion: true,
            },
          });

        if (!clause) {
          return res.status(404).json({
            message: "Cláusula não encontrada.",
          });
        }

        if (
          clause.templateVersion.status !== "RASCUNHO"
        ) {
          return res.status(409).json({
            code: "CONTRACT_TEMPLATE_VERSION_IMMUTABLE",
            message:
              "Não é possível excluir cláusula de uma versão publicada.",
          });
        }

        await prisma.contractTemplateClause.delete({
          where: { id },
        });

        return res.status(204).send();
      } catch (error) {
        console.error(
          "Erro ao excluir cláusula contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao excluir cláusula contratual.",
        });
      }
    }
  );

  // ============================================================
  // PUBLICAÇÃO
  // ============================================================

  router.post(
    "/contract-template-versions/:id/publish",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da versão inválido.",
          });
        }

        const version =
          await prisma.contractTemplateVersion.findUnique({
            where: { id },
            include: {
              template: true,
              clauses: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              },
            },
          });

        if (!version) {
          return res.status(404).json({
            message: "Versão do modelo não encontrada.",
          });
        }

        if (version.status !== "RASCUNHO") {
          return res.status(409).json({
            message:
              "Somente versões em RASCUNHO podem ser publicadas.",
          });
        }

        if (version.clauses.length === 0) {
          return res.status(400).json({
            message:
              "O modelo precisa possuir ao menos uma cláusula antes da publicação.",
          });
        }

        const now = new Date();

        const published = await prisma.$transaction(
          async (tx) => {
            await tx.contractTemplateVersion.updateMany({
              where: {
                templateId: version.templateId,
                status: "ATIVA",
                id: {
                  not: version.id,
                },
              },
              data: {
                status: "SUPERADA",
              },
            });

            const updated =
              await tx.contractTemplateVersion.update({
                where: { id: version.id },
                data: {
                  status: "ATIVA",
                  publishedAt: now,
                  approvedById: req.user?.id || null,
                },
                include: {
                  template: true,
                  clauses: {
                    orderBy: [
                      { sortOrder: "asc" },
                      { id: "asc" },
                    ],
                  },
                },
              });

            await tx.auditLog.create({
              data: {
                userId: req.user?.id || null,
                userName: req.user?.name || null,
                userEmail: req.user?.email || null,
                userRole: req.user?.role || null,

                action: "PUBLISH_CONTRACT_TEMPLATE_VERSION",
                entity: "ContractTemplateVersion",
                entityId: String(updated.id),

                description:
                  `Versão ${updated.versionNumber} do modelo ${version.template.code} publicada.`,

                ipAddress: req.ip,
              },
            });

            return updated;
          }
        );

        return res.json(published);
      } catch (error) {
        console.error(
          "Erro ao publicar versão de modelo contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao publicar versão de modelo contratual.",
        });
      }
    }
  );

  // ============================================================
  // DUPLICAÇÃO DE VERSÃO PUBLICADA
  // ============================================================

  router.post(
    "/contract-template-versions/:id/duplicate",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const sourceId = validPositiveId(req.params.id);

        if (!sourceId) {
          return res.status(400).json({
            message: "ID da versão inválido.",
          });
        }

        const source =
          await prisma.contractTemplateVersion.findUnique({
            where: { id: sourceId },
            include: {
              template: true,
              clauses: {
                orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
              },
            },
          });

        if (!source) {
          return res.status(404).json({
            message: "Versão do modelo não encontrada.",
          });
        }

        const latest =
          await prisma.contractTemplateVersion.findFirst({
            where: {
              templateId: source.templateId,
            },
            orderBy: {
              versionNumber: "desc",
            },
          });

        const duplicated = await prisma.$transaction(
          async (tx) => {
            const version =
              await tx.contractTemplateVersion.create({
                data: {
                  templateId: source.templateId,

                  versionNumber:
                    (latest?.versionNumber || 0) + 1,

                  status: "RASCUNHO",

                  label:
                    normalizeText(req.body?.label) ||
                    `Nova versão baseada na versão ${source.versionNumber}`,

                  notes:
                    normalizeText(req.body?.notes),

                  createdById: req.user?.id || null,
                },
              });

            if (source.clauses.length > 0) {
              await tx.contractTemplateClause.createMany({
                data: source.clauses.map((clause) => ({
                  templateVersionId: version.id,

                  clauseKey: clause.clauseKey,
                  title: clause.title,
                  body: clause.body,

                  sortOrder: clause.sortOrder,

                  required: clause.required,
                  editable: clause.editable,
                  deletable: clause.deletable,
                })),
              });
            }

            await tx.auditLog.create({
              data: {
                userId: req.user?.id || null,
                userName: req.user?.name || null,
                userEmail: req.user?.email || null,
                userRole: req.user?.role || null,

                action: "DUPLICATE_CONTRACT_TEMPLATE_VERSION",
                entity: "ContractTemplateVersion",
                entityId: String(version.id),

                description:
                  `Nova versão ${version.versionNumber} criada a partir da versão ${source.versionNumber} do modelo ${source.template.code}.`,

                ipAddress: req.ip,
              },
            });

            return tx.contractTemplateVersion.findUnique({
              where: {
                id: version.id,
              },
              include: {
                template: true,
                clauses: {
                  orderBy: [
                    { sortOrder: "asc" },
                    { id: "asc" },
                  ],
                },
              },
            });
          }
        );

        return res.status(201).json(duplicated);
      } catch (error) {
        console.error(
          "Erro ao duplicar versão contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao duplicar versão contratual.",
        });
      }
    }
  );

  return router;
}
