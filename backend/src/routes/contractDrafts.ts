import { PrismaClient } from "@prisma/client";
import { Router } from "express";

type Dependencies = {
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: string[]) => any;
};

const READ_ROLES = [
  "ATENDENTE",
  "GERENTE",
  "PROGRAMADOR",
];

const EDIT_ROLES = [
  "GERENTE",
  "PROGRAMADOR",
];

const EDITABLE_REVISION_STATUSES = new Set([
  "RASCUNHO",
  "EM_REVISAO",
]);

function asPositiveInt(value: unknown) {
  const n = Number(value);

  return Number.isInteger(n) && n > 0
    ? n
    : null;
}

function normalizeNullableText(value: unknown) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();

  return text || null;
}

function normalizeRequiredText(
  value: unknown
) {
  if (typeof value !== "string") {
    return null;
  }

  const text = value.trim();

  return text || null;
}

function revisionIsEditable(
  status: string
) {
  return EDITABLE_REVISION_STATUSES.has(
    status
  );
}

export function createContractDraftRouter({
  prisma,
  authMiddleware,
  requireRoles,
}: Dependencies) {
  const router = Router();

  // ======================================================
  // LISTAR REVISÕES DO CONTRATO
  // ======================================================

  router.get(
    "/contracts/:id/revisions",
    authMiddleware,
    requireRoles(READ_ROLES),
    async (req, res) => {
      try {
        const contractId =
          asPositiveInt(req.params.id);

        if (!contractId) {
          return res.status(400).json({
            message:
              "ID do contrato inválido.",
          });
        }

        const contract =
          await prisma.contract.findUnique({
            where: {
              id: contractId,
            },
            select: {
              id: true,
              contractNumber: true,
            },
          });

        if (!contract) {
          return res.status(404).json({
            message:
              "Contrato não encontrado.",
          });
        }

        const revisions =
          await prisma.contractRevision.findMany({
            where: {
              contractId,
            },

            orderBy: {
              revisionNumber: "desc",
            },

            include: {
              clauses: {
                orderBy: [
                  {
                    sortOrder: "asc",
                  },
                  {
                    id: "asc",
                  },
                ],
              },
            },
          });

        return res.json({
          contract,
          revisions,
        });
      } catch (error) {
        console.error(
          "Erro ao listar revisões contratuais:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao listar revisões contratuais.",
        });
      }
    }
  );

  // ======================================================
  // DETALHE DA REVISÃO
  // ======================================================

  router.get(
    "/contract-revisions/:id",
    authMiddleware,
    requireRoles(READ_ROLES),
    async (req, res) => {
      try {
        const revisionId =
          asPositiveInt(req.params.id);

        if (!revisionId) {
          return res.status(400).json({
            message:
              "ID da revisão inválido.",
          });
        }

        const revision =
          await prisma.contractRevision.findUnique({
            where: {
              id: revisionId,
            },

            include: {
              contract: {
                select: {
                  id: true,
                  contractNumber: true,
                  status: true,
                  templateVersionId: true,
                },
              },

              clauses: {
                orderBy: [
                  {
                    sortOrder: "asc",
                  },
                  {
                    id: "asc",
                  },
                ],

                include: {
                  templateClause: true,
                  libraryClause: true,
                },
              },
            },
          });

        if (!revision) {
          return res.status(404).json({
            message:
              "Revisão contratual não encontrada.",
          });
        }

        return res.json(revision);
      } catch (error) {
        console.error(
          "Erro ao consultar revisão contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao consultar revisão contratual.",
        });
      }
    }
  );

  // ======================================================
  // EDITAR METADADOS DA REVISÃO
  // ======================================================

  router.put(
    "/contract-revisions/:id",
    authMiddleware,
    requireRoles(EDIT_ROLES),
    async (req: any, res) => {
      try {
        const revisionId =
          asPositiveInt(req.params.id);

        if (!revisionId) {
          return res.status(400).json({
            message:
              "ID da revisão inválido.",
          });
        }

        const revision =
          await prisma.contractRevision.findUnique({
            where: {
              id: revisionId,
            },
          });

        if (!revision) {
          return res.status(404).json({
            message:
              "Revisão contratual não encontrada.",
          });
        }

        if (
          !revisionIsEditable(
            revision.status
          )
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_IMMUTABLE",

            message:
              "Esta revisão contratual não pode mais ser alterada.",
          });
        }

        const title =
          normalizeNullableText(
            req.body?.title
          );

        const changeReason =
          normalizeNullableText(
            req.body?.changeReason
          );

        const data: Record<
          string,
          unknown
        > = {};

        if (title !== undefined) {
          data.title = title;
        }

        if (
          changeReason !== undefined
        ) {
          data.changeReason =
            changeReason;
        }

        const updated =
          await prisma.contractRevision.update({
            where: {
              id: revisionId,
            },
            data,
          });

        await prisma.auditLog.create({
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
              "UPDATE_CONTRACT_REVISION",

            entity:
              "ContractRevision",

            entityId:
              String(revisionId),

            description:
              `Revisão ${revision.revisionNumber} do contrato ${revision.contractId} atualizada.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                before: {
                  title:
                    revision.title,
                  changeReason:
                    revision.changeReason,
                },

                after: {
                  title:
                    updated.title,
                  changeReason:
                    updated.changeReason,
                },
              }),
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao editar revisão contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao editar revisão contratual.",
        });
      }
    }
  );

  // ======================================================
  // ADICIONAR CLÁUSULA PERSONALIZADA
  // ======================================================

  router.post(
    "/contract-revisions/:id/clauses",
    authMiddleware,
    requireRoles(EDIT_ROLES),
    async (req: any, res) => {
      try {
        const revisionId =
          asPositiveInt(req.params.id);

        if (!revisionId) {
          return res.status(400).json({
            message:
              "ID da revisão inválido.",
          });
        }

        const revision =
          await prisma.contractRevision.findUnique({
            where: {
              id: revisionId,
            },
          });

        if (!revision) {
          return res.status(404).json({
            message:
              "Revisão contratual não encontrada.",
          });
        }

        if (
          !revisionIsEditable(
            revision.status
          )
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_IMMUTABLE",

            message:
              "Esta revisão contratual não pode mais ser alterada.",
          });
        }

        const title =
          normalizeRequiredText(
            req.body?.title
          );

        const body =
          normalizeRequiredText(
            req.body?.body
          );

        if (!title || !body) {
          return res.status(400).json({
            message:
              "Título e conteúdo da cláusula são obrigatórios.",
          });
        }

        const lastClause =
          await prisma.contractClause.findFirst({
            where: {
              revisionId,
            },

            orderBy: [
              {
                sortOrder: "desc",
              },
              {
                id: "desc",
              },
            ],
          });

        const clause =
          await prisma.contractClause.create({
            data: {
              revisionId,

              clauseKey:
                normalizeNullableText(
                  req.body?.clauseKey
                ),

              title,
              body,

              sortOrder:
                Number.isInteger(
                  Number(
                    req.body?.sortOrder
                  )
                )
                  ? Number(
                      req.body.sortOrder
                    )
                  : (
                      lastClause?.sortOrder ??
                      0
                    ) + 10,

              source:
                "PERSONALIZADA",

              required:
                Boolean(
                  req.body?.required
                ),
            },
          });

        await prisma.auditLog.create({
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
              "CREATE_CONTRACT_CLAUSE",

            entity:
              "ContractClause",

            entityId:
              String(clause.id),

            description:
              `Cláusula personalizada adicionada à revisão ${revision.revisionNumber}.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                contractId:
                  revision.contractId,
                revisionId,
                clauseId:
                  clause.id,
              }),
          },
        });

        return res
          .status(201)
          .json(clause);
      } catch (error) {
        console.error(
          "Erro ao adicionar cláusula contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao adicionar cláusula contratual.",
        });
      }
    }
  );

  // ======================================================
  // IMPORTAR CLÁUSULA DA BIBLIOTECA
  // ======================================================

  router.post(
    "/contract-revisions/:id/clauses/from-library",
    authMiddleware,
    requireRoles(EDIT_ROLES),
    async (req: any, res) => {
      try {
        const revisionId =
          asPositiveInt(req.params.id);

        const libraryClauseId =
          asPositiveInt(
            req.body?.libraryClauseId
          );

        if (
          !revisionId ||
          !libraryClauseId
        ) {
          return res.status(400).json({
            message:
              "Revisão e cláusula da biblioteca são obrigatórias.",
          });
        }

        const revision =
          await prisma.contractRevision.findUnique({
            where: {
              id: revisionId,
            },
          });

        if (!revision) {
          return res.status(404).json({
            message:
              "Revisão contratual não encontrada.",
          });
        }

        if (
          !revisionIsEditable(
            revision.status
          )
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_IMMUTABLE",

            message:
              "Esta revisão contratual não pode mais ser alterada.",
          });
        }

        const libraryClause =
          await prisma.clauseLibrary.findUnique({
            where: {
              id: libraryClauseId,
            },
          });

        if (!libraryClause) {
          return res.status(404).json({
            message:
              "Cláusula da biblioteca não encontrada.",
          });
        }

        if (!libraryClause.active) {
          return res.status(409).json({
            code:
              "CLAUSE_LIBRARY_INACTIVE",

            message:
              "A cláusula selecionada está inativa na biblioteca.",
          });
        }

        const lastClause =
          await prisma.contractClause.findFirst({
            where: {
              revisionId,
            },

            orderBy: [
              {
                sortOrder: "desc",
              },
              {
                id: "desc",
              },
            ],
          });

        const clause =
          await prisma.contractClause.create({
            data: {
              revisionId,

              libraryClauseId:
                libraryClause.id,

              clauseKey:
                libraryClause.code,

              title:
                libraryClause.title,

              body:
                libraryClause.body,

              sortOrder:
                Number.isInteger(
                  Number(
                    req.body?.sortOrder
                  )
                )
                  ? Number(
                      req.body.sortOrder
                    )
                  : (
                      lastClause?.sortOrder ??
                      0
                    ) + 10,

              source:
                "BIBLIOTECA",

              required:
                Boolean(
                  req.body?.required
                ),
            },
          });

        await prisma.auditLog.create({
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
              "IMPORT_CONTRACT_CLAUSE_FROM_LIBRARY",

            entity:
              "ContractClause",

            entityId:
              String(clause.id),

            description:
              `Cláusula ${libraryClause.code} importada da biblioteca para a revisão ${revision.revisionNumber}.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                contractId:
                  revision.contractId,
                revisionId,
                libraryClauseId,
                clauseId:
                  clause.id,
              }),
          },
        });

        return res
          .status(201)
          .json(clause);
      } catch (error) {
        console.error(
          "Erro ao importar cláusula da biblioteca:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao importar cláusula da biblioteca.",
        });
      }
    }
  );

  // ======================================================
  // EDITAR CLÁUSULA
  // ======================================================

  router.put(
    "/contract-clauses/:id",
    authMiddleware,
    requireRoles(EDIT_ROLES),
    async (req: any, res) => {
      try {
        const clauseId =
          asPositiveInt(req.params.id);

        if (!clauseId) {
          return res.status(400).json({
            message:
              "ID da cláusula inválido.",
          });
        }

        const clause =
          await prisma.contractClause.findUnique({
            where: {
              id: clauseId,
            },

            include: {
              revision: true,
            },
          });

        if (!clause) {
          return res.status(404).json({
            message:
              "Cláusula contratual não encontrada.",
          });
        }

        if (
          !revisionIsEditable(
            clause.revision.status
          )
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_IMMUTABLE",

            message:
              "A revisão desta cláusula não pode mais ser alterada.",
          });
        }

        const data: Record<
          string,
          unknown
        > = {};

        if (
          req.body?.title !== undefined
        ) {
          const title =
            normalizeRequiredText(
              req.body.title
            );

          if (!title) {
            return res.status(400).json({
              message:
                "O título da cláusula não pode ficar vazio.",
            });
          }

          data.title = title;
        }

        if (
          req.body?.body !== undefined
        ) {
          const body =
            normalizeRequiredText(
              req.body.body
            );

          if (!body) {
            return res.status(400).json({
              message:
                "O conteúdo da cláusula não pode ficar vazio.",
            });
          }

          data.body = body;
        }

        if (
          req.body?.clauseKey !==
          undefined
        ) {
          data.clauseKey =
            normalizeNullableText(
              req.body.clauseKey
            );
        }

        if (
          req.body?.required !==
          undefined
        ) {
          data.required =
            Boolean(
              req.body.required
            );
        }

        const updated =
          await prisma.contractClause.update({
            where: {
              id: clauseId,
            },
            data,
          });

        await prisma.auditLog.create({
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
              "UPDATE_CONTRACT_CLAUSE",

            entity:
              "ContractClause",

            entityId:
              String(clauseId),

            description:
              `Cláusula ${clauseId} da revisão ${clause.revision.revisionNumber} atualizada.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                before: {
                  clauseKey:
                    clause.clauseKey,
                  title:
                    clause.title,
                  body:
                    clause.body,
                  required:
                    clause.required,
                },

                after: {
                  clauseKey:
                    updated.clauseKey,
                  title:
                    updated.title,
                  body:
                    updated.body,
                  required:
                    updated.required,
                },
              }),
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao editar cláusula contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao editar cláusula contratual.",
        });
      }
    }
  );

  // ======================================================
  // EXCLUIR CLÁUSULA DA MINUTA
  //
  // "required" é metadado do modelo/origem.
  // GERENTE/PROGRAMADOR pode removê-la da minuta,
  // preservando o requisito de edição livre solicitado.
  // ======================================================

  router.delete(
    "/contract-clauses/:id",
    authMiddleware,
    requireRoles(EDIT_ROLES),
    async (req: any, res) => {
      try {
        const clauseId =
          asPositiveInt(req.params.id);

        if (!clauseId) {
          return res.status(400).json({
            message:
              "ID da cláusula inválido.",
          });
        }

        const clause =
          await prisma.contractClause.findUnique({
            where: {
              id: clauseId,
            },

            include: {
              revision: true,
            },
          });

        if (!clause) {
          return res.status(404).json({
            message:
              "Cláusula contratual não encontrada.",
          });
        }

        if (
          !revisionIsEditable(
            clause.revision.status
          )
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_IMMUTABLE",

            message:
              "A revisão desta cláusula não pode mais ser alterada.",
          });
        }

        await prisma.contractClause.delete({
          where: {
            id: clauseId,
          },
        });

        await prisma.auditLog.create({
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
              "DELETE_CONTRACT_CLAUSE",

            entity:
              "ContractClause",

            entityId:
              String(clauseId),

            description:
              `Cláusula ${clauseId} removida da revisão ${clause.revision.revisionNumber}.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                contractId:
                  clause.revision.contractId,
                revisionId:
                  clause.revisionId,
                clauseKey:
                  clause.clauseKey,
                source:
                  clause.source,
                required:
                  clause.required,
              }),
          },
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

  // ======================================================
  // REORDENAR CLÁUSULAS
  // ======================================================

  router.put(
    "/contract-revisions/:id/clauses/reorder",
    authMiddleware,
    requireRoles(EDIT_ROLES),
    async (req: any, res) => {
      try {
        const revisionId =
          asPositiveInt(req.params.id);

        if (!revisionId) {
          return res.status(400).json({
            message:
              "ID da revisão inválido.",
          });
        }

        const revision =
          await prisma.contractRevision.findUnique({
            where: {
              id: revisionId,
            },

            include: {
              clauses: true,
            },
          });

        if (!revision) {
          return res.status(404).json({
            message:
              "Revisão contratual não encontrada.",
          });
        }

        if (
          !revisionIsEditable(
            revision.status
          )
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_IMMUTABLE",

            message:
              "Esta revisão contratual não pode mais ser alterada.",
          });
        }

        if (
          !Array.isArray(
            req.body?.clauseIds
          )
        ) {
          return res.status(400).json({
            message:
              "Informe clauseIds na ordem desejada.",
          });
        }

        const clauseIds =
          req.body.clauseIds.map(
            (value: unknown) =>
              asPositiveInt(value)
          );

        if (
          clauseIds.some(
            (id: number | null) =>
              id === null
          )
        ) {
          return res.status(400).json({
            message:
              "A lista de cláusulas contém IDs inválidos.",
          });
        }

        const normalizedIds =
          clauseIds as number[];

        const uniqueIds =
          new Set(normalizedIds);

        if (
          uniqueIds.size !==
          normalizedIds.length
        ) {
          return res.status(400).json({
            message:
              "A lista de cláusulas contém IDs duplicados.",
          });
        }

        const currentIds =
          revision.clauses
            .map((clause) => clause.id)
            .sort(
              (a, b) => a - b
            );

        const requestedIds =
          [...normalizedIds].sort(
            (a, b) => a - b
          );

        if (
          currentIds.length !==
            requestedIds.length ||
          currentIds.some(
            (id, index) =>
              id !==
              requestedIds[index]
          )
        ) {
          return res.status(400).json({
            code:
              "CONTRACT_CLAUSE_REORDER_SET_MISMATCH",

            message:
              "A ordenação deve conter exatamente todas as cláusulas da revisão.",
          });
        }

        await prisma.$transaction(
          normalizedIds.map(
            (clauseId, index) =>
              prisma.contractClause.update({
                where: {
                  id: clauseId,
                },

                data: {
                  sortOrder:
                    (index + 1) * 10,
                },
              })
          )
        );

        const clauses =
          await prisma.contractClause.findMany({
            where: {
              revisionId,
            },

            orderBy: [
              {
                sortOrder: "asc",
              },
              {
                id: "asc",
              },
            ],
          });

        await prisma.auditLog.create({
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
              "REORDER_CONTRACT_CLAUSES",

            entity:
              "ContractRevision",

            entityId:
              String(revisionId),

            description:
              `Cláusulas da revisão ${revision.revisionNumber} reordenadas.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                contractId:
                  revision.contractId,
                revisionId,
                clauseIds:
                  normalizedIds,
              }),
          },
        });

        return res.json({
          revisionId,
          clauses,
        });
      } catch (error) {
        console.error(
          "Erro ao reordenar cláusulas contratuais:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao reordenar cláusulas contratuais.",
        });
      }
    }
  );

  return router;
}
