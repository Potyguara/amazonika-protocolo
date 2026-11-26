import { Express } from "express";
import {
  DemandPriority,
  DemandStatus,
  DemandType,
  Prisma,
  PrismaClient,
} from "@prisma/client";
import {
  maskWhatsAppPhone,
  normalizeWhatsAppPhone,
  sendWhatsAppText,
  whatsappConfig,
  whatsappConnect,
  whatsappLogout,
  whatsappQrCode,
  whatsappSessionStatus,
} from "../../services/whatsappService";

/*
 * ======================================================
 * DEMANDAS
 * ======================================================
 *
 * Agenda interna dos gestores e da secretária: o que fazer,
 * quem faz, em que ordem e até quando. Os alertas saem só
 * por WhatsApp (OpenWA):
 *   - ao atribuir a demanda a alguém;
 *   - antes do prazo (remindBeforeMinutes);
 *   - quando o prazo passa;
 *   - resumo diário às DEMANDS_DIGEST_HOUR (padrão 7h) com a
 *     fila da pessoa, viagens do Cronograma de Campo dos
 *     próximos dias e, para gerente e secretária, os
 *     lançamentos do Financeiro que vencem hoje ou venceram.
 *
 * O processamento roda no mesmo cron do financeiro.
 */

type RegisterDemandRoutesParams = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;
};

const STAFF_ROLES = ["GERENTE", "PROGRAMADOR", "SECRETARIA"] as const;
const MANAGER_ROLES = ["GERENTE", "PROGRAMADOR"];

const TYPES = new Set<string>(Object.values(DemandType));
const STATUSES = new Set<string>(Object.values(DemandStatus));
const PRIORITIES = new Set<string>(Object.values(DemandPriority));
const OPEN_STATUSES: DemandStatus[] = ["A_FAZER", "EM_ANDAMENTO"];

// Macapá e Belém: UTC-3 o ano todo.
const TZ = "America/Belem";
const TZ_OFFSET = "-03:00";

const TYPE_LABEL: Record<DemandType, string> = {
  TRABALHO: "Trabalho",
  VIAGEM: "Viagem",
  PAGAMENTO: "Pagamento",
  LEMBRETE: "Lembrete",
  OUTRO: "Outro",
};

const PRIORITY_LABEL: Record<DemandPriority, string> = {
  BAIXA: "baixa",
  NORMAL: "normal",
  ALTA: "alta",
  URGENTE: "URGENTE",
};

const STATUS_LABEL: Record<DemandStatus, string> = {
  A_FAZER: "A fazer",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const demandInclude = {
  assignee: { select: { id: true, name: true, role: true } },
  createdBy: { select: { id: true, name: true } },
} satisfies Prisma.DemandInclude;

type DemandWithPeople = Prisma.DemandGetPayload<{ include: typeof demandInclude }>;

function cleanText(value: unknown, max: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, max) : null;
}

/** Aceita "2026-11-27T10:00" (hora local de Macapá) ou ISO completo. */
function parseDueAt(value: unknown): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;

  const text = String(value).trim();
  const hasZone = /([zZ]|[+-]\d{2}:?\d{2})$/.test(text);
  const withTime = /^\d{4}-\d{2}-\d{2}$/.test(text) ? `${text}T09:00` : text;
  const date = new Date(hasZone ? withTime : `${withTime}${TZ_OFFSET}`);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Prazo inválido.");
  }

  return date;
}

function formatDateTime(date: Date) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: TZ,
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatDay(date: Date, timeZone = TZ) {
  return new Intl.DateTimeFormat("pt-BR", { timeZone, dateStyle: "short" }).format(date);
}

function localDayKey(date: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(date);
}

function localHour(date: Date) {
  return Number(
    new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "2-digit", hourCycle: "h23" }).format(date)
  );
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function appUrl() {
  const base = String(process.env.APP_PUBLIC_URL || process.env.FRONTEND_URL || "https://sis.amazonikaengenharia.com.br")
    .trim()
    .replace(/\/+$/, "");
  return `${base}/app/demandas`;
}

function demandLine(demand: DemandWithPeople | Prisma.DemandGetPayload<{}>) {
  const due = demand.dueAt ? ` (prazo ${formatDateTime(demand.dueAt)})` : "";
  const priority =
    demand.priority === "ALTA" || demand.priority === "URGENTE"
      ? ` [${PRIORITY_LABEL[demand.priority]}]`
      : "";
  return `• ${demand.title}${priority}${due}`;
}

function serializeDemand(demand: DemandWithPeople) {
  return {
    ...demand,
    overdue:
      Boolean(demand.dueAt) &&
      OPEN_STATUSES.includes(demand.status) &&
      demand.dueAt!.getTime() < Date.now(),
  };
}

/* ------------------------------------------------------
 * Envio com registro (DemandNotification)
 * ---------------------------------------------------- */

const MAX_FAILURES_PER_KEY = 3;

async function notifyUser(
  prisma: PrismaClient,
  params: {
    userId: number;
    kind: string;
    dedupeKey: string;
    text: string;
    demandId?: number | null;
  }
) {
  const already = await prisma.demandNotification.findUnique({
    where: { dedupeKey: params.dedupeKey },
  });

  if (already) return { status: "DUPLICATE" as const };

  const failures = await prisma.demandNotification.count({
    where: { dedupeKey: { startsWith: `${params.dedupeKey}#FAIL` } },
  });

  if (failures >= MAX_FAILURES_PER_KEY) return { status: "GAVE_UP" as const };

  const user = await prisma.user.findUnique({
    where: { id: params.userId },
    select: { id: true, active: true, whatsappPhone: true, whatsappAlertsEnabled: true },
  });

  const phone = normalizeWhatsAppPhone(user?.whatsappPhone);

  const record = (status: string, extra: { errorText?: string; messageId?: string | null; key?: string }) =>
    prisma.demandNotification.create({
      data: {
        demandId: params.demandId ?? null,
        userId: params.userId,
        kind: params.kind,
        dedupeKey: extra.key || params.dedupeKey,
        phone: phone || "",
        status,
        errorText: extra.errorText || null,
        messageId: extra.messageId || null,
      },
    });

  if (!user || !user.active || !user.whatsappAlertsEnabled || !phone) {
    await record("SKIPPED", {
      errorText: !phone ? "Usuário sem WhatsApp cadastrado." : "Alertas desativados para o usuário.",
    });
    return { status: "SKIPPED" as const };
  }

  const result = await sendWhatsAppText(phone, params.text);

  if (result.ok) {
    await record("SENT", { messageId: result.messageId });
    return { status: "SENT" as const };
  }

  if (result.skipped) {
    // WhatsApp desligado: registra para não acumular alertas velhos.
    await record("SKIPPED", { errorText: result.error });
    return { status: "SKIPPED" as const, error: result.error };
  }

  await record("FAILED", {
    errorText: result.error,
    key: `${params.dedupeKey}#FAIL${failures + 1}`,
  });

  return { status: "FAILED" as const, error: result.error };
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notifyAssignment(prisma: PrismaClient, demand: DemandWithPeople, actorId?: number | null) {
  if (!demand.assigneeId || demand.assigneeId === actorId) return;

  const lines = [
    `*Nova demanda para você* (${TYPE_LABEL[demand.type]})`,
    "",
    `*${demand.title}*`,
    demand.description ? demand.description.slice(0, 600) : null,
    demand.dueAt ? `Prazo: ${formatDateTime(demand.dueAt)}` : null,
    `Prioridade: ${PRIORITY_LABEL[demand.priority]}`,
    demand.createdBy?.name ? `Atribuída por: ${demand.createdBy.name}` : null,
    "",
    appUrl(),
  ].filter((line) => line !== null);

  await notifyUser(prisma, {
    userId: demand.assigneeId,
    kind: "ASSIGNED",
    dedupeKey: `ASSIGNED:${demand.id}:${demand.assigneeId}:${demand.updatedAt.getTime()}`,
    demandId: demand.id,
    text: lines.join("\n"),
  });
}

/* ------------------------------------------------------
 * Processamento periódico (chamado pelo cron)
 * ---------------------------------------------------- */

export async function processDemandAlerts(prisma: PrismaClient, now = new Date()) {
  const summary = { dueSoon: 0, overdue: 0, digests: 0, failed: 0, skipped: 0 };
  const config = whatsappConfig();

  if (!config.enabled) {
    return { ...summary, executed: false, reason: "WhatsApp desativado." };
  }

  const count = (status: string) => {
    if (status === "FAILED") summary.failed += 1;
    if (status === "SKIPPED") summary.skipped += 1;
  };

  const open = await prisma.demand.findMany({
    where: {
      status: { in: OPEN_STATUSES },
      assigneeId: { not: null },
      dueAt: { not: null },
    },
    include: demandInclude,
  });

  for (const demand of open) {
    const dueAt = demand.dueAt!;
    const dueKey = dueAt.toISOString();

    if (dueAt.getTime() <= now.getTime()) {
      // Só avisa atraso de prazos que venceram nas últimas 48h;
      // os mais antigos aparecem no resumo diário.
      if (now.getTime() - dueAt.getTime() > 48 * 3600 * 1000) continue;

      const result = await notifyUser(prisma, {
        userId: demand.assigneeId!,
        kind: "OVERDUE",
        dedupeKey: `OVERDUE:${demand.id}:${dueKey}`,
        demandId: demand.id,
        text: [
          "*Demanda com prazo vencido*",
          "",
          `*${demand.title}*`,
          `Prazo era: ${formatDateTime(dueAt)}`,
          `Situação: ${STATUS_LABEL[demand.status]}`,
          "",
          appUrl(),
        ].join("\n"),
      });

      if (result.status === "SENT") summary.overdue += 1;
      count(result.status);
      if (result.status === "SENT") await pause(1500);
      continue;
    }

    if (demand.remindBeforeMinutes > 0) {
      const remindAt = dueAt.getTime() - demand.remindBeforeMinutes * 60 * 1000;

      if (now.getTime() >= remindAt) {
        const result = await notifyUser(prisma, {
          userId: demand.assigneeId!,
          kind: "DUE_SOON",
          dedupeKey: `DUE_SOON:${demand.id}:${dueKey}`,
          demandId: demand.id,
          text: [
            "*Lembrete de demanda*",
            "",
            `*${demand.title}*`,
            demand.description ? demand.description.slice(0, 400) : null,
            `Prazo: ${formatDateTime(dueAt)}`,
            "",
            appUrl(),
          ]
            .filter((line) => line !== null)
            .join("\n"),
        });

        if (result.status === "SENT") summary.dueSoon += 1;
        count(result.status);
        if (result.status === "SENT") await pause(1500);
      }
    }
  }

  const digestHour = Number(process.env.DEMANDS_DIGEST_HOUR || 7);

  if (localHour(now) >= digestHour) {
    const dayKey = localDayKey(now);
    const users = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: [...STAFF_ROLES] },
        whatsappAlertsEnabled: true,
        whatsappPhone: { not: null },
      },
      select: { id: true, name: true, role: true },
    });

    for (const user of users) {
      const dedupeKey = `DIGEST:${user.id}:${dayKey}`;
      const exists = await prisma.demandNotification.findUnique({ where: { dedupeKey } });
      if (exists) continue;

      const text = await buildDailyDigest(prisma, user, now);
      if (!text) continue;

      const result = await notifyUser(prisma, {
        userId: user.id,
        kind: "DAILY_DIGEST",
        dedupeKey,
        text,
      });

      if (result.status === "SENT") summary.digests += 1;
      count(result.status);
      if (result.status === "SENT") await pause(1500);
    }
  }

  return { ...summary, executed: true };
}

async function buildDailyDigest(
  prisma: PrismaClient,
  user: { id: number; name: string; role: string },
  now: Date
) {
  const sections: string[] = [];
  const endOfToday = new Date(`${localDayKey(now)}T23:59:59${TZ_OFFSET}`);

  const demands = await prisma.demand.findMany({
    where: { assigneeId: user.id, status: { in: OPEN_STATUSES } },
    orderBy: [{ sortOrder: "asc" }, { dueAt: "asc" }, { id: "asc" }],
    take: 40,
  });

  const overdue = demands.filter((d) => d.dueAt && d.dueAt < now);
  const today = demands.filter((d) => d.dueAt && d.dueAt >= now && d.dueAt <= endOfToday);
  const rest = demands.filter((d) => !overdue.includes(d) && !today.includes(d));

  if (overdue.length) sections.push(`*Atrasadas (${overdue.length})*\n${overdue.slice(0, 10).map(demandLine).join("\n")}`);
  if (today.length) sections.push(`*Para hoje (${today.length})*\n${today.slice(0, 10).map(demandLine).join("\n")}`);
  if (rest.length) sections.push(`*Na fila (${rest.length})*\n${rest.slice(0, 10).map(demandLine).join("\n")}`);

  // Viagens / campo dos próximos 3 dias em que a pessoa está escalada.
  const tripsUntil = new Date(endOfToday.getTime() + 3 * 24 * 3600 * 1000);
  const startOfToday = new Date(`${localDayKey(now)}T00:00:00${TZ_OFFSET}`);
  const trips = await prisma.fieldSchedule.findMany({
    where: {
      status: { notIn: ["CANCELADO", "CONCLUIDO", "ADIADO"] },
      managers: { some: { userId: user.id } },
      OR: [
        { startDate: { gte: startOfToday, lte: tripsUntil } },
        { startDate: { lte: startOfToday }, endDate: { gte: startOfToday } },
      ],
    },
    orderBy: { startDate: "asc" },
    take: 10,
  });

  if (trips.length) {
    sections.push(
      `*Campo / viagens*\n${trips
        .map((trip) => {
          // startDate é data civil gravada em UTC.
          const when = formatDay(trip.startDate, "UTC");
          const where = [trip.municipality, trip.state].filter(Boolean).join("/");
          const hour = trip.departureTime ? ` saída ${trip.departureTime}` : "";
          return `• ${when}${hour}: ${trip.title}${where ? ` (${where})` : ""}`;
        })
        .join("\n")}`
    );
  }

  // Lembretes de pagamento: gerente e secretária.
  if (user.role === "GERENTE" || user.role === "SECRETARIA") {
    const due = await prisma.financialTransaction.findMany({
      where: {
        status: "PENDENTE",
        dueDate: { not: null, lte: endOfToday },
        ...(user.role === "SECRETARIA" ? { source: { not: "SALARIO" } } : {}),
      },
      include: { client: { select: { name: true } } },
      orderBy: { dueDate: "asc" },
      take: 30,
    });

    const pay = due.filter((t) => t.type === "SAIDA");
    const receive = due.filter((t) => t.type !== "SAIDA");
    const line = (t: (typeof due)[number]) => {
      const cents = t.amountCents ?? 0;
      const late = t.dueDate! < startOfToday ? ` — venceu ${formatDay(t.dueDate!, "UTC")}` : " — hoje";
      const who = t.client?.name ? ` (${t.client.name})` : "";
      return `• ${t.description}${who}: ${brl(cents)}${late}`;
    };

    if (pay.length) sections.push(`*Contas a pagar (${pay.length})*\n${pay.slice(0, 8).map(line).join("\n")}`);
    if (receive.length) sections.push(`*A receber vencendo/vencido (${receive.length})*\n${receive.slice(0, 8).map(line).join("\n")}`);
  }

  if (!sections.length) return null;

  const firstName = user.name.split(" ")[0];

  return [
    `Bom dia, ${firstName}! Sua agenda de ${formatDay(now)}:`,
    "",
    sections.join("\n\n"),
    "",
    appUrl(),
  ].join("\n");
}

/* ------------------------------------------------------
 * Rotas
 * ---------------------------------------------------- */

export function registerDemandRoutes({ app, prisma, authMiddleware, requireRoles }: RegisterDemandRoutesParams) {
  const staff = [authMiddleware, requireRoles([...STAFF_ROLES])];
  const managers = [authMiddleware, requireRoles(MANAGER_ROLES)];

  app.get("/demands/people", ...staff, async (req: any, res: any) => {
    const canSeePhones = MANAGER_ROLES.includes(req.user?.role);
    const users = await prisma.user.findMany({
      where: { active: true, role: { in: [...STAFF_ROLES] } },
      select: { id: true, name: true, role: true, whatsappPhone: true, whatsappAlertsEnabled: true },
      orderBy: { name: "asc" },
    });

    return res.json(
      users.map((user) => ({
        id: user.id,
        name: user.name,
        role: user.role,
        hasWhatsapp: Boolean(normalizeWhatsAppPhone(user.whatsappPhone)),
        whatsappMasked: maskWhatsAppPhone(normalizeWhatsAppPhone(user.whatsappPhone)),
        whatsappPhone: canSeePhones ? user.whatsappPhone || "" : undefined,
        whatsappAlertsEnabled: user.whatsappAlertsEnabled,
      }))
    );
  });

  app.get("/demands", ...staff, async (req: any, res: any) => {
    const where: Prisma.DemandWhereInput = {};
    const assignee = String(req.query.assigneeId || "");
    const status = String(req.query.status || "");
    const type = String(req.query.type || "");

    if (assignee === "me") where.assigneeId = req.user.id;
    else if (assignee === "none") where.assigneeId = null;
    else if (/^\d+$/.test(assignee)) where.assigneeId = Number(assignee);

    if (status === "OPEN") where.status = { in: OPEN_STATUSES };
    else if (STATUSES.has(status)) where.status = status as DemandStatus;

    if (TYPES.has(type)) where.type = type as DemandType;

    const demands = await prisma.demand.findMany({
      where,
      include: demandInclude,
      orderBy: [{ sortOrder: "asc" }, { dueAt: "asc" }, { id: "desc" }],
      take: 500,
    });

    return res.json(demands.map(serializeDemand));
  });

  function readDemandBody(body: any, partial: boolean) {
    const data: Prisma.DemandUncheckedUpdateInput = {};

    if (!partial || body.title !== undefined) {
      const title = cleanText(body.title, 200);
      if (!title) throw new Error("Informe o título da demanda.");
      data.title = title;
    }

    if (body.description !== undefined) data.description = cleanText(body.description, 4000);

    if (body.type !== undefined) {
      if (!TYPES.has(String(body.type))) throw new Error("Tipo de demanda inválido.");
      data.type = body.type;
    }

    if (body.priority !== undefined) {
      if (!PRIORITIES.has(String(body.priority))) throw new Error("Prioridade inválida.");
      data.priority = body.priority;
    }

    const dueAt = parseDueAt(body.dueAt);
    if (dueAt !== undefined) data.dueAt = dueAt;

    if (body.remindBeforeMinutes !== undefined) {
      const minutes = Number(body.remindBeforeMinutes);
      if (!Number.isInteger(minutes) || minutes < 0 || minutes > 60 * 24 * 30) {
        throw new Error("Antecedência do lembrete inválida.");
      }
      data.remindBeforeMinutes = minutes;
    }

    if (body.assigneeId !== undefined) {
      data.assigneeId = body.assigneeId === null || body.assigneeId === "" ? null : Number(body.assigneeId);
    }

    if (body.protocolId !== undefined) data.protocolId = body.protocolId ? Number(body.protocolId) : null;
    if (body.clientId !== undefined) data.clientId = body.clientId ? Number(body.clientId) : null;

    return data;
  }

  async function assertAssignee(assigneeId: unknown) {
    if (assigneeId === undefined || assigneeId === null) return;
    const user = await prisma.user.findFirst({
      where: { id: Number(assigneeId), active: true, role: { in: [...STAFF_ROLES] } },
    });
    if (!user) throw new Error("Responsável inválido.");
  }

  app.post("/demands", ...staff, async (req: any, res: any) => {
    try {
      const data = readDemandBody(req.body || {}, false) as Prisma.DemandUncheckedCreateInput;
      await assertAssignee(data.assigneeId);

      const last = await prisma.demand.aggregate({
        where: { assigneeId: data.assigneeId ?? null, status: { in: OPEN_STATUSES } },
        _max: { sortOrder: true },
      });

      const demand = await prisma.demand.create({
        data: {
          ...data,
          createdById: req.user.id,
          sortOrder: (last._max.sortOrder ?? 0) + 10,
        },
        include: demandInclude,
      });

      notifyAssignment(prisma, demand, req.user.id).catch((error) =>
        console.error("Falha ao avisar demanda no WhatsApp:", error?.message || error)
      );

      return res.status(201).json(serializeDemand(demand));
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Não foi possível criar a demanda." });
    }
  });

  app.patch("/demands/:id", ...staff, async (req: any, res: any) => {
    const id = Number(req.params.id);
    const current = await prisma.demand.findUnique({ where: { id } });

    if (!current) return res.status(404).json({ message: "Demanda não encontrada." });

    try {
      const body = req.body || {};
      const data = readDemandBody(body, true);

      if (body.status !== undefined) {
        if (!STATUSES.has(String(body.status))) throw new Error("Situação inválida.");
        data.status = body.status;
        if (body.status === "EM_ANDAMENTO" && !current.startedAt) data.startedAt = new Date();
        if (body.status === "CONCLUIDA") data.completedAt = new Date();
        if (OPEN_STATUSES.includes(body.status)) data.completedAt = null;
      }

      if (data.assigneeId !== undefined) await assertAssignee(data.assigneeId);

      const demand = await prisma.demand.update({ where: { id }, data, include: demandInclude });

      if (data.assigneeId !== undefined && demand.assigneeId !== current.assigneeId) {
        notifyAssignment(prisma, demand, req.user.id).catch((error) =>
          console.error("Falha ao avisar demanda no WhatsApp:", error?.message || error)
        );
      }

      return res.json(serializeDemand(demand));
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Não foi possível atualizar a demanda." });
    }
  });

  /** Nova ordem da fila: { ids: [3, 1, 2] } (primeiro = executar antes). */
  app.post("/demands/reorder", ...staff, async (req: any, res: any) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number).filter(Number.isInteger) : [];

    if (!ids.length || ids.length > 500) {
      return res.status(400).json({ message: "Lista de demandas inválida." });
    }

    await prisma.$transaction(
      ids.map((id: number, index: number) =>
        prisma.demand.update({ where: { id }, data: { sortOrder: (index + 1) * 10 } })
      )
    );

    return res.json({ ok: true });
  });

  app.delete("/demands/:id", ...managers, async (req: any, res: any) => {
    const id = Number(req.params.id);

    try {
      await prisma.demand.delete({ where: { id } });
      return res.json({ ok: true });
    } catch {
      return res.status(404).json({ message: "Demanda não encontrada." });
    }
  });

  /* ---------- WhatsApp: cadastro do número e teste ---------- */

  app.get("/me/whatsapp", ...staff, async (req: any, res: any) => {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { whatsappPhone: true, whatsappAlertsEnabled: true },
    });

    return res.json({
      whatsappPhone: user?.whatsappPhone || "",
      whatsappAlertsEnabled: user?.whatsappAlertsEnabled ?? true,
    });
  });

  async function saveWhatsapp(userId: number, body: any) {
    const raw = String(body?.whatsappPhone ?? "").trim();
    const phone = raw ? normalizeWhatsAppPhone(raw) : null;

    if (raw && !phone) throw new Error("Número inválido. Use DDD + número, ex.: 96 99123-4567.");

    return prisma.user.update({
      where: { id: userId },
      data: {
        whatsappPhone: phone,
        ...(body?.whatsappAlertsEnabled !== undefined
          ? { whatsappAlertsEnabled: Boolean(body.whatsappAlertsEnabled) }
          : {}),
      },
      select: { id: true, whatsappPhone: true, whatsappAlertsEnabled: true },
    });
  }

  app.put("/me/whatsapp", ...staff, async (req: any, res: any) => {
    try {
      return res.json(await saveWhatsapp(req.user.id, req.body));
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Não foi possível salvar." });
    }
  });

  app.put("/demands/people/:id/whatsapp", ...managers, async (req: any, res: any) => {
    const id = Number(req.params.id);
    const target = await prisma.user.findFirst({ where: { id, role: { in: [...STAFF_ROLES] } } });

    if (!target) return res.status(404).json({ message: "Usuário não encontrado." });

    try {
      return res.json(await saveWhatsapp(id, req.body));
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Não foi possível salvar." });
    }
  });

  app.get("/whatsapp/status", ...managers, async (_req: any, res: any) => {
    const status = await whatsappSessionStatus();
    const last = await prisma.demandNotification.findMany({
      orderBy: { id: "desc" },
      take: 15,
      select: { id: true, kind: true, status: true, errorText: true, createdAt: true, userId: true },
    });

    return res.json({ ...status, recent: last });
  });

  /** Conectar o número: cria/inicia a sessão no OpenWA. */
  app.post("/whatsapp/connect", ...managers, async (_req: any, res: any) => {
    try {
      return res.json(await whatsappConnect());
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Não foi possível conectar." });
    }
  });

  app.get("/whatsapp/qr", ...managers, async (_req: any, res: any) => {
    try {
      return res.json(await whatsappQrCode());
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Não foi possível obter o QR Code." });
    }
  });

  app.post("/whatsapp/logout", ...managers, async (_req: any, res: any) => {
    try {
      return res.json(await whatsappLogout());
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Não foi possível desconectar." });
    }
  });

  /** Envia uma mensagem de teste para o WhatsApp do próprio usuário. */
  app.post("/whatsapp/test", ...staff, async (req: any, res: any) => {
    const result = await notifyUser(prisma, {
      userId: req.user.id,
      kind: "TEST",
      dedupeKey: `TEST:${req.user.id}:${Date.now()}`,
      text: `Teste do SIS Amazonika: os alertas de Demandas chegarão por aqui. (${formatDateTime(new Date())})`,
    });

    if (result.status === "SENT") return res.json({ message: "Mensagem de teste enviada." });

    return res.status(400).json({
      message:
        (result as any).error ||
        (result.status === "SKIPPED"
          ? "Cadastre seu WhatsApp e ative os alertas antes do teste."
          : "Não foi possível enviar o teste."),
    });
  });
}
