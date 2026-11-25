import { Express, NextFunction, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import { assertPrismaIntCents } from "../../lib/money";

/*
 * ======================================================
 * PERFIL SECRETÁRIA
 * ======================================================
 *
 * A secretária lança receitas e despesas da empresa, mas
 * não pode ver quanto a empresa lucra (resumos, cards,
 * pró-labore, salários, custos fixos, despesas dos gestores).
 *
 * Regras:
 * - Receitas só a partir de propostas ACEITAS (ou já
 *   convertidas em contrato) de clientes cadastrados, usando
 *   as etapas do cronograma financeiro aprovado.
 * - A lista mostra apenas os lançamentos feitos por ela,
 *   sem totais.
 * - Tudo é bloqueado no servidor: um token de secretária só
 *   alcança as rotas abaixo (ver restrictSecretaryAccess).
 */

export const SECRETARY_ROLE = "SECRETARIA";

class SecretaryRuleError extends Error {}

const APPROVED_PROPOSAL_STATUSES = ["ACEITA", "CONVERTIDA_EM_CONTRATO"] as const;

/*
 * Rotas que um token de secretária pode chamar. Qualquer
 * outra devolve 403, inclusive rotas antigas que só exigem
 * login (ex.: /payments, /protocols/:id).
 */
const SECRETARY_ALLOWED_PREFIXES = ["/secretary/", "/auth/", "/public/"];
const SECRETARY_ALLOWED_EXACT = ["/", "/health", "/company-settings", "/secretary"];

export function isSecretaryAllowedPath(path: string) {
  const normalized = path.split("?")[0].replace(/\/+$/, "") || "/";

  if (SECRETARY_ALLOWED_EXACT.includes(normalized)) return true;

  return SECRETARY_ALLOWED_PREFIXES.some((prefix) =>
    `${normalized}/`.startsWith(prefix)
  );
}

export function restrictSecretaryAccess(getJwtSecret: () => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) return next();

    const [, token] = authHeader.split(" ");

    if (!token) return next();

    let decoded: any = null;

    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      // Token inválido: as rotas tratam (401) normalmente.
      return next();
    }

    if (decoded?.role !== SECRETARY_ROLE) return next();

    if (isSecretaryAllowedPath(req.path)) return next();

    return res.status(403).json({
      message: "Acesso não autorizado para o perfil Secretária.",
    });
  };
}

type RegisterSecretaryRoutesParams = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;
};

function competenceFromDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function parseDate(value: unknown): Date | null {
  if (!value) return null;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
}

function legacyReais(cents: number) {
  // Espelho legado em reais inteiros (mesma regra do restante do financeiro).
  return Math.round(cents / 100);
}

function scheduleLabel(item: { type: string; installmentNumber: number; totalInstallments: number | null }) {
  if (item.type === "ENTRADA") return "Entrada";
  return item.totalInstallments
    ? `Parcela ${item.installmentNumber}/${item.totalInstallments}`
    : `Parcela ${item.installmentNumber}`;
}

function entryView(item: any) {
  return {
    id: item.id,
    type: item.type,
    status: item.status,
    description: item.description,
    amountCents: item.amountCents ?? item.amount * 100,
    dueDate: item.dueDate,
    paidAt: item.paidAt,
    competenceMonth: item.competenceMonth,
    installmentNumber: item.installmentNumber,
    totalInstallments: item.totalInstallments,
    notes: item.notes,
    createdAt: item.createdAt,
    client: item.client ? { id: item.client.id, name: item.client.name } : null,
    clientName: item.clientName,
    proposal: item.proposal
      ? { id: item.proposal.id, proposalNumber: item.proposal.proposalNumber, title: item.proposal.title }
      : null,
    category: item.category ? { id: item.category.id, name: item.category.name } : null,
    linkedToBillingCharge: Boolean(item.billingCharge),
  };
}

/*
 * Situação de cada etapa do cronograma de uma proposta:
 * - LANCADA: já existe lançamento financeiro ligado a ela;
 * - COBRANCA: já existe cobrança (Pix/boleto) do contrato para ela,
 *   que gera o próprio lançamento ao ser paga;
 * - DISPONIVEL: pode ser lançada.
 */
async function loadProposalScheduleState(prisma: PrismaClient, proposalIds: number[]) {
  if (proposalIds.length === 0) {
    return { transactions: [] as any[], charges: [] as any[] };
  }

  const [transactions, charges] = await Promise.all([
    prisma.financialTransaction.findMany({
      where: {
        proposalId: { in: proposalIds },
        status: { not: "CANCELADO" },
        type: { in: ["ENTRADA", "PARCELA"] },
      },
      select: {
        id: true,
        proposalId: true,
        installmentNumber: true,
        status: true,
        type: true,
      },
    }),
    prisma.billingCharge.findMany({
      where: {
        contract: { proposalId: { in: proposalIds } },
        status: { not: "CANCELADA" },
        chargeType: { in: ["ENTRADA", "PARCELA"] },
      },
      select: {
        id: true,
        status: true,
        chargeType: true,
        installmentNumber: true,
        contract: { select: { proposalId: true } },
      },
    }),
  ]);

  return { transactions, charges };
}

function scheduleItemState(
  proposalId: number,
  item: { type: string; installmentNumber: number },
  state: { transactions: any[]; charges: any[] }
) {
  const transaction = state.transactions.find(
    (row) =>
      row.proposalId === proposalId &&
      row.installmentNumber === item.installmentNumber &&
      (item.type === "ENTRADA" ? row.type === "ENTRADA" : row.type === "PARCELA")
  );

  if (transaction) {
    return { state: "LANCADA", transactionStatus: transaction.status };
  }

  const charge = state.charges.find(
    (row) =>
      row.contract?.proposalId === proposalId &&
      row.chargeType === item.type &&
      Number(row.installmentNumber ?? 0) === item.installmentNumber
  );

  if (charge) {
    return { state: "COBRANCA", chargeStatus: charge.status };
  }

  return { state: "DISPONIVEL" };
}

export function registerSecretaryRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
}: RegisterSecretaryRoutesParams) {
  // Gestores também podem usar a tela de lançamentos.
  const canLaunch = requireRoles([SECRETARY_ROLE, "GERENTE", "PROGRAMADOR"]);

  /*
   * Busca de clientes cadastrados.
   */
  app.get("/secretary/clients", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const q = String(req.query.q || "").trim();

      if (q.length < 2) return res.json([]);

      const digits = q.replace(/\D/g, "");

      const clients = await prisma.client.findMany({
        where: {
          OR: [
            { name: { contains: q } },
            ...(digits.length >= 3 ? [{ cpfCnpj: { contains: digits } }] : []),
            { cpfCnpj: { contains: q } },
          ],
        },
        select: { id: true, name: true, cpfCnpj: true, city: true, state: true },
        orderBy: { name: "asc" },
        take: 20,
      });

      return res.json(clients);
    } catch (error) {
      console.error("Erro ao buscar clientes (secretaria):", error);
      return res.status(500).json({ message: "Erro ao buscar clientes." });
    }
  });

  /*
   * Categorias ativas (só nome e tipo).
   */
  app.get("/secretary/categories", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const type = req.query.type === "RECEITA" || req.query.type === "DESPESA" ? req.query.type : undefined;

      const categories = await prisma.financialCategory.findMany({
        where: { active: true, ...(type ? { type } : {}) },
        select: { id: true, name: true, type: true },
        orderBy: { name: "asc" },
      });

      return res.json(categories);
    } catch (error) {
      console.error("Erro ao carregar categorias (secretaria):", error);
      return res.status(500).json({ message: "Erro ao carregar categorias." });
    }
  });

  /*
   * Propostas do cliente com plano financeiro aprovado.
   */
  app.get("/secretary/clients/:id/proposals", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const clientId = Number(req.params.id);

      if (!Number.isInteger(clientId) || clientId <= 0) {
        return res.status(400).json({ message: "Cliente inválido." });
      }

      const proposals = await prisma.proposal.findMany({
        where: {
          clientId,
          status: { in: [...APPROVED_PROPOSAL_STATUSES] },
          paymentSchedule: { some: {} },
        },
        select: {
          id: true,
          proposalNumber: true,
          title: true,
          status: true,
          acceptedAt: true,
          totalAmount: true,
          totalAmountCents: true,
          protocol: { select: { id: true, protocolNumber: true } },
          paymentSchedule: {
            orderBy: [{ installmentNumber: "asc" }],
            select: {
              id: true,
              type: true,
              installmentNumber: true,
              totalInstallments: true,
              amountCents: true,
              dueDate: true,
            },
          },
        },
        orderBy: { createdAt: "desc" },
      });

      const state = await loadProposalScheduleState(
        prisma,
        proposals.map((proposal) => proposal.id)
      );

      return res.json(
        proposals.map((proposal) => ({
          id: proposal.id,
          proposalNumber: proposal.proposalNumber,
          title: proposal.title,
          status: proposal.status,
          acceptedAt: proposal.acceptedAt,
          totalAmountCents: proposal.totalAmountCents ?? proposal.totalAmount * 100,
          protocol: proposal.protocol,
          schedule: proposal.paymentSchedule.map((item) => ({
            ...item,
            label: scheduleLabel(item),
            ...scheduleItemState(proposal.id, item, state),
          })),
        }))
      );
    } catch (error) {
      console.error("Erro ao carregar propostas (secretaria):", error);
      return res.status(500).json({ message: "Erro ao carregar propostas do cliente." });
    }
  });

  /*
   * Lança etapas do cronograma aprovado de uma proposta.
   * Valor e vencimento vêm do cronograma, nunca da tela.
   */
  app.post("/secretary/entries/proposal", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const proposalId = Number(req.body?.proposalId);
      const scheduleItemIds: number[] = Array.isArray(req.body?.scheduleItemIds)
        ? req.body.scheduleItemIds.map((value: any) => Number(value))
        : [];
      const status = req.body?.status === "PAGO" ? "PAGO" : "PENDENTE";
      const paidAt = status === "PAGO" ? parseDate(req.body?.paidAt) || new Date() : null;
      const notes = String(req.body?.notes || "").trim() || null;
      const categoryId = req.body?.categoryId ? Number(req.body.categoryId) : null;

      if (!Number.isInteger(proposalId) || proposalId <= 0) {
        return res.status(400).json({ message: "Selecione a proposta." });
      }

      if (scheduleItemIds.length === 0 || scheduleItemIds.some((id) => !Number.isInteger(id))) {
        return res.status(400).json({ message: "Selecione ao menos uma etapa do cronograma." });
      }

      if (status === "PAGO" && scheduleItemIds.length > 1) {
        return res.status(400).json({
          message: "Para registrar pagamento, lance uma etapa por vez.",
        });
      }

      const proposal = await prisma.proposal.findUnique({
        where: { id: proposalId },
        include: {
          client: { select: { id: true, name: true } },
          protocol: { select: { id: true, protocolNumber: true, serviceTypeId: true } },
          paymentSchedule: true,
        },
      });

      if (!proposal) {
        return res.status(404).json({ message: "Proposta não encontrada." });
      }

      if (!(APPROVED_PROPOSAL_STATUSES as readonly string[]).includes(proposal.status)) {
        return res.status(400).json({
          message: "Só é possível lançar propostas aceitas pelo cliente.",
        });
      }

      const selected = proposal.paymentSchedule.filter((item) => scheduleItemIds.includes(item.id));

      if (selected.length !== new Set(scheduleItemIds).size) {
        return res.status(400).json({
          message: "Etapa do cronograma não pertence a esta proposta.",
        });
      }

      let category = null as null | { id: number };

      if (categoryId) {
        category = await prisma.financialCategory.findFirst({
          where: { id: categoryId, type: "RECEITA", active: true },
          select: { id: true },
        });

        if (!category) {
          return res.status(400).json({ message: "Categoria de receita inválida." });
        }
      } else {
        category = await prisma.financialCategory.upsert({
          where: { name_type: { name: "Contratos", type: "RECEITA" } },
          update: {},
          create: { name: "Contratos", type: "RECEITA", active: true, color: "#0f766e" },
          select: { id: true },
        });
      }

      const totalInstallments =
        proposal.paymentSchedule.filter((item) => item.type === "PARCELA").length || null;

      const created = await prisma.$transaction(async (tx) => {
        // Revalida dentro da transação para não duplicar em cliques simultâneos.
        const state = {
          transactions: await tx.financialTransaction.findMany({
            where: {
              proposalId,
              status: { not: "CANCELADO" },
              type: { in: ["ENTRADA", "PARCELA"] },
            },
            select: { id: true, proposalId: true, installmentNumber: true, status: true, type: true },
          }),
          charges: await tx.billingCharge.findMany({
            where: {
              contract: { proposalId },
              status: { not: "CANCELADA" },
              chargeType: { in: ["ENTRADA", "PARCELA"] },
            },
            select: {
              id: true,
              status: true,
              chargeType: true,
              installmentNumber: true,
              contract: { select: { proposalId: true } },
            },
          }),
        };

        const rows = [];

        for (const item of selected.sort((a, b) => a.installmentNumber - b.installmentNumber)) {
          const current = scheduleItemState(proposalId, item, state);

          if (current.state === "LANCADA") {
            throw new SecretaryRuleError(`${scheduleLabel(item)} já foi lançada.`);
          }

          if (current.state === "COBRANCA") {
            throw new SecretaryRuleError(
              `${scheduleLabel(item)} já tem cobrança emitida; o pagamento entra no financeiro pela cobrança.`
            );
          }

          const amountCents = assertPrismaIntCents(item.amountCents);

          rows.push(
            await tx.financialTransaction.create({
              data: {
                type: item.type === "ENTRADA" ? "ENTRADA" : "PARCELA",
                source: "CONTRATO",
                status,
                categoryId: category!.id,
                protocolId: proposal.protocolId,
                clientId: proposal.clientId,
                proposalId: proposal.id,
                catalogServiceId: null,
                description: `${scheduleLabel(item)} - Proposta ${proposal.proposalNumber}`,
                amount: legacyReais(amountCents),
                amountCents,
                dueDate: item.dueDate,
                paidAt,
                competenceMonth: competenceFromDate(item.dueDate),
                clientName: proposal.client.name,
                notes,
                installmentGroupId: `PROP-${proposal.id}`,
                installmentNumber: item.installmentNumber,
                totalInstallments: item.type === "ENTRADA" ? 1 : totalInstallments,
                createdById: req.user?.id || null,
                ...(status === "PAGO" ? { paymentConfirmedAt: paidAt } : {}),
              },
              include: {
                client: true,
                proposal: true,
                category: true,
                billingCharge: { select: { id: true } },
              },
            })
          );
        }

        await tx.auditLog.create({
          data: {
            userId: req.user?.id || null,
            userName: req.user?.name || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,
            action: "SECRETARY_PROPOSAL_ENTRY_CREATED",
            entity: "FinancialTransaction",
            entityId: rows.map((row) => row.id).join(","),
            description: `Lançamento de ${rows.length} etapa(s) da proposta ${proposal.proposalNumber}.`,
            ipAddress: req.ip || null,
            metadata: JSON.stringify({ proposalId, scheduleItemIds, status }),
          },
        });

        return rows;
      });

      return res.status(201).json(created.map(entryView));
    } catch (error) {
      if (error instanceof SecretaryRuleError) {
        return res.status(409).json({ message: error.message });
      }

      console.error("Erro ao lançar proposta (secretaria):", error);
      return res.status(500).json({ message: "Erro ao registrar o lançamento." });
    }
  });

  /*
   * Despesa da empresa (sem ligação com pró-labore/salários).
   */
  app.post("/secretary/entries/expense", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const categoryId = Number(req.body?.categoryId);
      const description = String(req.body?.description || "").trim();
      const dueDate = parseDate(req.body?.dueDate);
      const status = req.body?.status === "PAGO" ? "PAGO" : "PENDENTE";
      const paidAt = status === "PAGO" ? parseDate(req.body?.paidAt) || new Date() : null;
      const notes = String(req.body?.notes || "").trim() || null;
      const clientId = req.body?.clientId ? Number(req.body.clientId) : null;
      const proposalId = req.body?.proposalId ? Number(req.body.proposalId) : null;

      let amountCents: number;

      try {
        amountCents = assertPrismaIntCents(Number(req.body?.amountCents));
      } catch {
        return res.status(400).json({ message: "Valor inválido." });
      }

      if (amountCents <= 0) {
        return res.status(400).json({ message: "Informe um valor maior que zero." });
      }

      if (!description) {
        return res.status(400).json({ message: "Informe a descrição da despesa." });
      }

      if (!dueDate) {
        return res.status(400).json({ message: "Informe o vencimento." });
      }

      const category = await prisma.financialCategory.findFirst({
        where: { id: categoryId, type: "DESPESA", active: true },
        select: { id: true },
      });

      if (!category) {
        return res.status(400).json({ message: "Selecione uma categoria de despesa." });
      }

      let client: { id: number; name: string } | null = null;

      if (clientId) {
        client = await prisma.client.findUnique({
          where: { id: clientId },
          select: { id: true, name: true },
        });

        if (!client) return res.status(404).json({ message: "Cliente não encontrado." });
      }

      let proposal: { id: number; clientId: number; protocolId: number } | null = null;

      if (proposalId) {
        proposal = await prisma.proposal.findUnique({
          where: { id: proposalId },
          select: { id: true, clientId: true, protocolId: true },
        });

        if (!proposal || (client && proposal.clientId !== client.id)) {
          return res.status(400).json({ message: "Proposta inválida para este cliente." });
        }
      }

      const created = await prisma.financialTransaction.create({
        data: {
          type: "SAIDA",
          source: "OUTRO",
          status,
          categoryId: category.id,
          clientId: client?.id || null,
          clientName: client?.name || null,
          proposalId: proposal?.id || null,
          protocolId: proposal?.protocolId || null,
          description,
          amount: legacyReais(amountCents),
          amountCents,
          dueDate,
          paidAt,
          competenceMonth: competenceFromDate(dueDate),
          notes,
          createdById: req.user?.id || null,
        },
        include: {
          client: true,
          proposal: true,
          category: true,
          billingCharge: { select: { id: true } },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "SECRETARY_EXPENSE_CREATED",
          entity: "FinancialTransaction",
          entityId: String(created.id),
          description: `Despesa lançada: ${description}.`,
          ipAddress: req.ip || null,
        },
      });

      return res.status(201).json(entryView(created));
    } catch (error) {
      console.error("Erro ao lançar despesa (secretaria):", error);
      return res.status(500).json({ message: "Erro ao registrar a despesa." });
    }
  });

  /*
   * Lançamentos feitos pelo próprio usuário. Sem totais.
   */
  app.get("/secretary/entries", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const entries = await prisma.financialTransaction.findMany({
        where: { createdById: req.user.id },
        include: {
          client: true,
          proposal: true,
          category: true,
          billingCharge: { select: { id: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      });

      return res.json(entries.map(entryView));
    } catch (error) {
      console.error("Erro ao listar lançamentos (secretaria):", error);
      return res.status(500).json({ message: "Erro ao carregar seus lançamentos." });
    }
  });

  async function findOwnEditableEntry(req: any) {
    const id = Number(req.params.id);

    if (!Number.isInteger(id) || id <= 0) return null;

    return prisma.financialTransaction.findFirst({
      where: { id, createdById: req.user.id },
      include: { billingCharge: { select: { id: true } } },
    });
  }

  /*
   * Registrar pagamento de um lançamento próprio pendente.
   */
  app.patch("/secretary/entries/:id/pay", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const entry = await findOwnEditableEntry(req);

      if (!entry) return res.status(404).json({ message: "Lançamento não encontrado." });

      if (entry.status !== "PENDENTE") {
        return res.status(400).json({ message: "Só lançamentos pendentes podem ser marcados como pagos." });
      }

      if (entry.billingCharge) {
        return res.status(400).json({
          message: "Este lançamento está ligado a uma cobrança; o pagamento é confirmado pela cobrança.",
        });
      }

      const paidAt = parseDate(req.body?.paidAt) || new Date();

      const updated = await prisma.financialTransaction.update({
        where: { id: entry.id },
        data: { status: "PAGO", paidAt, paymentConfirmedAt: paidAt },
        include: { client: true, proposal: true, category: true, billingCharge: { select: { id: true } } },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "SECRETARY_ENTRY_PAID",
          entity: "FinancialTransaction",
          entityId: String(entry.id),
          description: `Pagamento registrado: ${entry.description}.`,
          ipAddress: req.ip || null,
        },
      });

      return res.json(entryView(updated));
    } catch (error) {
      console.error("Erro ao registrar pagamento (secretaria):", error);
      return res.status(500).json({ message: "Erro ao registrar o pagamento." });
    }
  });

  /*
   * Cancelar um lançamento próprio ainda pendente (erro de digitação).
   * Lançamentos pagos só os gestores corrigem.
   */
  app.patch("/secretary/entries/:id/cancel", authMiddleware, canLaunch, async (req: any, res) => {
    try {
      const entry = await findOwnEditableEntry(req);

      if (!entry) return res.status(404).json({ message: "Lançamento não encontrado." });

      if (entry.status !== "PENDENTE" || entry.billingCharge) {
        return res.status(400).json({
          message: "Só lançamentos pendentes e sem cobrança podem ser cancelados. Peça ajuda a um gestor.",
        });
      }

      const updated = await prisma.financialTransaction.update({
        where: { id: entry.id },
        data: { status: "CANCELADO" },
        include: { client: true, proposal: true, category: true, billingCharge: { select: { id: true } } },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "SECRETARY_ENTRY_CANCELLED",
          entity: "FinancialTransaction",
          entityId: String(entry.id),
          description: `Lançamento cancelado: ${entry.description}.`,
          ipAddress: req.ip || null,
        },
      });

      return res.json(entryView(updated));
    } catch (error) {
      console.error("Erro ao cancelar lançamento (secretaria):", error);
      return res.status(500).json({ message: "Erro ao cancelar o lançamento." });
    }
  });
}

