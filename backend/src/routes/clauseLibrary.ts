import { Router } from "express";
import type { PrismaClient } from "@prisma/client";

type ClauseLibraryRoutesDeps = {
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: string[]) => any;
};

function normalizeClauseCode(value: unknown) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function normalizeNullableText(value: unknown) {
  const text = String(value ?? "").trim();
  return text || null;
}

function validPositiveId(value: unknown) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function createClauseLibraryRouter({
  prisma,
  authMiddleware,
  requireRoles,
}: ClauseLibraryRoutesDeps) {
  const router = Router();

  // ============================================================
  // LISTAR
  // ============================================================

  router.get(
    "/clause-library",
    authMiddleware,
    requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const includeInactive =
          String(req.query?.includeInactive || "") === "true";

        const clauses = await prisma.clauseLibrary.findMany({
          where: includeInactive ? undefined : { active: true },
          orderBy: [
            { category: "asc" },
            { title: "asc" },
          ],
          include: {
            _count: {
              select: {
                contractClauses: true,
              },
            },
          },
        });

        return res.json(clauses);
      } catch (error) {
        console.error(
          "Erro ao listar biblioteca de cláusulas:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao listar biblioteca de cláusulas.",
        });
      }
    }
  );

  // ============================================================
  // BUSCAR UMA CLÁUSULA
  // ============================================================

  router.get(
    "/clause-library/:id",
    authMiddleware,
    requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
    async (req, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da cláusula inválido.",
          });
        }

        const clause = await prisma.clauseLibrary.findUnique({
          where: { id },
          include: {
            _count: {
              select: {
                contractClauses: true,
              },
            },
          },
        });

        if (!clause) {
          return res.status(404).json({
            message:
              "Cláusula da biblioteca não encontrada.",
          });
        }

        return res.json(clause);
      } catch (error) {
        console.error(
          "Erro ao buscar cláusula da biblioteca:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao buscar cláusula da biblioteca.",
        });
      }
    }
  );

  // ============================================================
  // CRIAR
  // ============================================================

  router.post(
    "/clause-library",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const title = String(req.body?.title || "").trim();
        const body = String(req.body?.body || "").trim();

        const code = normalizeClauseCode(
          req.body?.code || req.body?.title
        );

        if (!title) {
          return res.status(400).json({
            message:
              "Título da cláusula é obrigatório.",
          });
        }

        if (!body) {
          return res.status(400).json({
            message:
              "Conteúdo da cláusula é obrigatório.",
          });
        }

        if (!code) {
          return res.status(400).json({
            message:
              "Código da cláusula é obrigatório.",
          });
        }

        const existing =
          await prisma.clauseLibrary.findUnique({
            where: { code },
          });

        if (existing) {
          return res.status(409).json({
            code: "CLAUSE_LIBRARY_CODE_EXISTS",
            message:
              `Já existe uma cláusula com o código ${code}.`,
          });
        }

        const clause = await prisma.clauseLibrary.create({
          data: {
            code,
            category:
              normalizeNullableText(req.body?.category),
            title,
            body,
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

            action: "CREATE_CLAUSE_LIBRARY",
            entity: "ClauseLibrary",
            entityId: String(clause.id),

            description:
              `Cláusula reutilizável ${clause.code} criada.`,

            ipAddress: req.ip,
          },
        });

        return res.status(201).json(clause);
      } catch (error) {
        console.error(
          "Erro ao criar cláusula da biblioteca:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao criar cláusula da biblioteca.",
        });
      }
    }
  );

  // ============================================================
  // EDITAR
  // ============================================================

  router.put(
    "/clause-library/:id",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da cláusula inválido.",
          });
        }

        const current =
          await prisma.clauseLibrary.findUnique({
            where: { id },
          });

        if (!current) {
          return res.status(404).json({
            message:
              "Cláusula da biblioteca não encontrada.",
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

        let code: string | undefined;

        if (req.body?.code !== undefined) {
          code = normalizeClauseCode(req.body.code);

          if (!code) {
            return res.status(400).json({
              message:
                "Código da cláusula não pode ficar vazio.",
            });
          }

          const duplicate =
            await prisma.clauseLibrary.findFirst({
              where: {
                code,
                id: {
                  not: id,
                },
              },
            });

          if (duplicate) {
            return res.status(409).json({
              code: "CLAUSE_LIBRARY_CODE_EXISTS",
              message:
                `Já existe uma cláusula com o código ${code}.`,
            });
          }
        }

        const updated =
          await prisma.clauseLibrary.update({
            where: { id },
            data: {
              code,

              category:
                req.body?.category === undefined
                  ? undefined
                  : normalizeNullableText(
                      req.body.category
                    ),

              title,
              body,

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

            action: "UPDATE_CLAUSE_LIBRARY",
            entity: "ClauseLibrary",
            entityId: String(updated.id),

            description:
              `Cláusula reutilizável ${updated.code} atualizada.`,

            ipAddress: req.ip,

            metadata: JSON.stringify({
              before: current,
              after: updated,
            }),
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao atualizar cláusula da biblioteca:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao atualizar cláusula da biblioteca.",
        });
      }
    }
  );

  // ============================================================
  // INATIVAR
  // ============================================================

  router.delete(
    "/clause-library/:id",
    authMiddleware,
    requireRoles(["GERENTE", "PROGRAMADOR"]),
    async (req: any, res) => {
      try {
        const id = validPositiveId(req.params.id);

        if (!id) {
          return res.status(400).json({
            message: "ID da cláusula inválido.",
          });
        }

        const current =
          await prisma.clauseLibrary.findUnique({
            where: { id },
          });

        if (!current) {
          return res.status(404).json({
            message:
              "Cláusula da biblioteca não encontrada.",
          });
        }

        if (!current.active) {
          return res.status(204).send();
        }

        await prisma.clauseLibrary.update({
          where: { id },
          data: {
            active: false,
            updatedById: req.user?.id || null,
          },
        });

        await prisma.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,

            action: "DISABLE_CLAUSE_LIBRARY",
            entity: "ClauseLibrary",
            entityId: String(id),

            description:
              `Cláusula reutilizável ${current.code} inativada.`,

            ipAddress: req.ip,
          },
        });

        return res.status(204).send();
      } catch (error) {
        console.error(
          "Erro ao inativar cláusula da biblioteca:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao inativar cláusula da biblioteca.",
        });
      }
    }
  );

  return router;
}
