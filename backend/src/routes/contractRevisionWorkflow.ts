import { PrismaClient } from "@prisma/client";
import { Router } from "express";

import {
  createContractRevisionDocumentHash,
} from "../lib/contract-revision-hash";

type Dependencies = {
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: string[]) => any;
};

const WORKFLOW_ROLES = [
  "GERENTE",
  "PROGRAMADOR",
];

function asPositiveInt(value: unknown) {
  const n = Number(value);

  return Number.isInteger(n) && n > 0
    ? n
    : null;
}

function normalizeNullableText(
  value: unknown
) {
  if (value === null) {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const text = value.trim();

  return text || null;
}


export function createContractRevisionWorkflowRouter({
  prisma,
  authMiddleware,
  requireRoles,
}: Dependencies) {
  const router = Router();

  // ======================================================
  // CRIAR NOVA REVISÃO
  //
  // Copia a revisão mais recente.
  // Só permitimos nova minuta se não houver outra revisão
  // RASCUNHO ou EM_REVISAO para o mesmo contrato.
  //
  // A revisão APROVADA anterior permanece vigente até
  // a aprovação da nova revisão.
  // ======================================================

  router.post(
    "/contracts/:id/revisions",
    authMiddleware,
    requireRoles(WORKFLOW_ROLES),
    async (req: any, res) => {
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

            include: {
              revisions: {
                orderBy: {
                  revisionNumber:
                    "desc",
                },

                include: {
                  clauses: {
                    orderBy: [
                      {
                        sortOrder:
                          "asc",
                      },
                      {
                        id: "asc",
                      },
                    ],
                  },
                },
              },
            },
          });

        if (!contract) {
          return res.status(404).json({
            message:
              "Contrato não encontrado.",
          });
        }

        if (
          contract.status !== "GERADO"
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_WORKFLOW_LOCKED",

            message:
              "Novas revisões só podem ser criadas enquanto o contrato estiver no estado GERADO.",
          });
        }

        const editableRevision =
          contract.revisions.find(
            (revision) =>
              revision.status ===
                "RASCUNHO" ||
              revision.status ===
                "EM_REVISAO"
          );

        if (editableRevision) {
          return res.status(409).json({
            code:
              "CONTRACT_EDITABLE_REVISION_EXISTS",

            message:
              "Este contrato já possui uma revisão em edição.",

            revisionId:
              editableRevision.id,

            revisionNumber:
              editableRevision.revisionNumber,

            status:
              editableRevision.status,
          });
        }

        const sourceRevisionId =
          req.body
            ?.sourceRevisionId ===
          undefined
            ? null
            : asPositiveInt(
                req.body
                  .sourceRevisionId
              );

        if (
          req.body
            ?.sourceRevisionId !==
            undefined &&
          !sourceRevisionId
        ) {
          return res.status(400).json({
            message:
              "ID da revisão de origem inválido.",
          });
        }

        const sourceRevision =
          sourceRevisionId
            ? contract.revisions.find(
                (revision) =>
                  revision.id ===
                  sourceRevisionId
              )
            : contract.revisions[0];

        if (!sourceRevision) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_SOURCE_NOT_FOUND",

            message:
              "O contrato ainda não possui revisão estruturada para ser duplicada.",
          });
        }

        if (
          sourceRevision.status !==
            "APROVADA" &&
          sourceRevision.status !==
            "SUPERADA"
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_SOURCE_INVALID",

            message:
              "A nova revisão deve ser criada a partir de uma revisão aprovada ou superada.",
          });
        }

        const latestRevisionNumber =
          contract.revisions.reduce(
            (max, revision) =>
              Math.max(
                max,
                revision.revisionNumber
              ),
            0
          );

        const nextRevisionNumber =
          latestRevisionNumber + 1;

        const requestedTitle =
          normalizeNullableText(
            req.body?.title
          );

        const requestedReason =
          normalizeNullableText(
            req.body
              ?.changeReason
          );

        const revision =
          await prisma.contractRevision.create({
            data: {
              contractId,

              revisionNumber:
                nextRevisionNumber,

              status:
                "RASCUNHO",

              title:
                requestedTitle ===
                undefined
                  ? sourceRevision.title
                  : requestedTitle,

              changeReason:
                requestedReason ===
                undefined
                  ? `Nova revisão criada a partir da revisão ${sourceRevision.revisionNumber}.`
                  : requestedReason,

              createdById:
                req.user?.id ||
                null,

              clauses: {
                create:
                  sourceRevision.clauses.map(
                    (clause) => ({
                      templateClauseId:
                        clause.templateClauseId,

                      libraryClauseId:
                        clause.libraryClauseId,

                      clauseKey:
                        clause.clauseKey,

                      title:
                        clause.title,

                      body:
                        clause.body,

                      sortOrder:
                        clause.sortOrder,

                      source:
                        clause.source,

                      required:
                        clause.required,
                    })
                  ),
              },
            },

            include: {
              clauses: {
                orderBy: [
                  {
                    sortOrder:
                      "asc",
                  },
                  {
                    id: "asc",
                  },
                ],
              },
            },
          });

        await prisma.auditLog.create({
          data: {
            userId:
              req.user?.id ||
              null,

            userName:
              req.user?.name ||
              null,

            userEmail:
              req.user?.email ||
              null,

            userRole:
              req.user?.role ||
              null,

            action:
              "CREATE_CONTRACT_REVISION",

            entity:
              "ContractRevision",

            entityId:
              String(
                revision.id
              ),

            description:
              `Revisão ${revision.revisionNumber} criada para o contrato ${contract.contractNumber}.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                contractId,
                sourceRevisionId:
                  sourceRevision.id,
                sourceRevisionNumber:
                  sourceRevision.revisionNumber,
                revisionId:
                  revision.id,
                revisionNumber:
                  revision.revisionNumber,
              }),
          },
        });

        return res
          .status(201)
          .json(revision);
      } catch (error) {
        console.error(
          "Erro ao criar nova revisão contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao criar nova revisão contratual.",
        });
      }
    }
  );

  // ======================================================
  // ENVIAR RASCUNHO PARA REVISÃO
  // ======================================================

  router.post(
    "/contract-revisions/:id/start-review",
    authMiddleware,
    requireRoles(WORKFLOW_ROLES),
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
              contract: true,
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
          revision.contract.status !==
          "GERADO"
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_WORKFLOW_LOCKED",

            message:
              "A revisão não pode avançar porque o contrato não está mais no estado GERADO.",
          });
        }

        if (
          revision.status !==
          "RASCUNHO"
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_INVALID_TRANSITION",

            message:
              "Somente uma revisão RASCUNHO pode ser enviada para revisão.",
          });
        }

        if (
          revision.clauses.length ===
          0
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_EMPTY",

            message:
              "Uma revisão sem cláusulas não pode ser enviada para revisão.",
          });
        }

        const updated =
          await prisma.contractRevision.update({
            where: {
              id: revisionId,
            },

            data: {
              status:
                "EM_REVISAO",
            },

            include: {
              clauses: {
                orderBy: [
                  {
                    sortOrder:
                      "asc",
                  },
                  {
                    id: "asc",
                  },
                ],
              },
            },
          });

        await prisma.auditLog.create({
          data: {
            userId:
              req.user?.id ||
              null,

            userName:
              req.user?.name ||
              null,

            userEmail:
              req.user?.email ||
              null,

            userRole:
              req.user?.role ||
              null,

            action:
              "START_CONTRACT_REVISION_REVIEW",

            entity:
              "ContractRevision",

            entityId:
              String(
                revisionId
              ),

            description:
              `Revisão ${revision.revisionNumber} do contrato ${revision.contract.contractNumber} enviada para revisão.`,

            ipAddress:
              req.ip,
          },
        });

        return res.json(updated);
      } catch (error) {
        console.error(
          "Erro ao iniciar revisão contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao iniciar revisão contratual.",
        });
      }
    }
  );

  // ======================================================
  // APROVAR REVISÃO
  //
  // - exige EM_REVISAO;
  // - calcula hash do conteúdo;
  // - torna APROVADA anterior SUPERADA;
  // - aprova a atual no mesmo transaction.
  // ======================================================

  router.post(
    "/contract-revisions/:id/approve",
    authMiddleware,
    requireRoles(WORKFLOW_ROLES),
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
              contract: true,

              clauses: {
                orderBy: [
                  {
                    sortOrder:
                      "asc",
                  },
                  {
                    id: "asc",
                  },
                ],
              },
            },
          });

        if (!revision) {
          return res.status(404).json({
            message:
              "Revisão contratual não encontrada.",
          });
        }

        if (
          revision.contract.status !==
          "GERADO"
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_WORKFLOW_LOCKED",

            message:
              "A revisão não pode ser aprovada porque o contrato não está mais no estado GERADO.",
          });
        }

        if (
          revision.status !==
          "EM_REVISAO"
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_INVALID_TRANSITION",

            message:
              "Somente uma revisão EM_REVISAO pode ser aprovada.",
          });
        }

        if (
          revision.clauses.length ===
          0
        ) {
          return res.status(409).json({
            code:
              "CONTRACT_REVISION_EMPTY",

            message:
              "Uma revisão sem cláusulas não pode ser aprovada.",
          });
        }

        const documentHash =
          createContractRevisionDocumentHash({
            contractId:
              revision.contractId,

            revisionNumber:
              revision.revisionNumber,

            title:
              revision.title,

            clauses:
              revision.clauses.map(
                (clause) => ({
                  clauseKey:
                    clause.clauseKey,

                  title:
                    clause.title,

                  body:
                    clause.body,

                  sortOrder:
                    clause.sortOrder,

                  source:
                    clause.source,

                  required:
                    clause.required,
                })
              ),
          });

        const approvedAt =
          new Date();

        const approved =
          await prisma.$transaction(
            async (tx) => {
              await tx.contractRevision.updateMany({
                where: {
                  contractId:
                    revision.contractId,

                  status:
                    "APROVADA",

                  id: {
                    not:
                      revision.id,
                  },
                },

                data: {
                  status:
                    "SUPERADA",
                },
              });

              return tx.contractRevision.update({
                where: {
                  id:
                    revision.id,
                },

                data: {
                  status:
                    "APROVADA",

                  approvedById:
                    req.user?.id ||
                    null,

                  approvedAt,

                  documentHash,
                },

                include: {
                  clauses: {
                    orderBy: [
                      {
                        sortOrder:
                          "asc",
                      },
                      {
                        id: "asc",
                      },
                    ],
                  },
                },
              });
            }
          );

        await prisma.auditLog.create({
          data: {
            userId:
              req.user?.id ||
              null,

            userName:
              req.user?.name ||
              null,

            userEmail:
              req.user?.email ||
              null,

            userRole:
              req.user?.role ||
              null,

            action:
              "APPROVE_CONTRACT_REVISION",

            entity:
              "ContractRevision",

            entityId:
              String(
                revision.id
              ),

            description:
              `Revisão ${revision.revisionNumber} do contrato ${revision.contract.contractNumber} aprovada.`,

            ipAddress:
              req.ip,

            metadata:
              JSON.stringify({
                contractId:
                  revision.contractId,

                revisionId:
                  revision.id,

                revisionNumber:
                  revision.revisionNumber,

                documentHash,
              }),
          },
        });

        return res.json(approved);
      } catch (error) {
        console.error(
          "Erro ao aprovar revisão contratual:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao aprovar revisão contratual.",
        });
      }
    }
  );

  return router;
}
