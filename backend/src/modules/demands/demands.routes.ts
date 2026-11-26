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
  sendWhatsAppImage,
  whatsappConfig,
  whatsappConnect,
  whatsappLogout,
  whatsappQrCode,
  whatsappSessionStatus,
} from "../../services/whatsappService";
import { CardIcon, CardListItem, CardSpec, CardTone, tryRenderCardPng } from "../../services/whatsappCard";

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
 *   - quando o prazo passa, repetindo todo dia nos horários
 *     configurados (padrão 9h e 15h) até concluir;
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

/* ------------------------------------------------------
 * Card (imagem) de cada alerta
 * ---------------------------------------------------- */

const PRIORITY_TONE: Record<DemandPriority, CardTone> = {
  BAIXA: "blue",
  NORMAL: "green",
  ALTA: "amber",
  URGENTE: "red",
};

const TYPE_ICON: Record<DemandType, CardIcon> = {
  TRABALHO: "clipboard",
  VIAGEM: "pin",
  PAGAMENTO: "money",
  LEMBRETE: "bell",
  OUTRO: "clipboard",
};

function priorityRow(priority: DemandPriority) {
  return {
    label: "Prioridade",
    value: PRIORITY_LABEL[priority],
    icon: "flag" as CardIcon,
    badge: PRIORITY_TONE[priority],
  };
}

function untilText(dueAt: Date, now: Date) {
  const minutes = Math.max(0, Math.round((dueAt.getTime() - now.getTime()) / 60000));
  if (minutes < 60) return `em ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `em ${hours} h`;
  return `em ${Math.round(hours / 24)} dias`;
}

function demandCard(
  kind: "ASSIGNED" | "DUE_SOON" | "OVERDUE",
  demand: DemandWithPeople,
  now = new Date()
): CardSpec {
  const base = {
    boxTitle: demand.title,
    boxSubtitle: demand.description || TYPE_LABEL[demand.type],
    boxIcon: TYPE_ICON[demand.type],
    link: appUrl(),
  };

  if (kind === "ASSIGNED") {
    return {
      ...base,
      pill: demand.type === "OUTRO" ? "Nova demanda" : TYPE_LABEL[demand.type],
      pillIcon: "bell",
      tone: "green",
      titleLead: "Nova demanda",
      titleAccent: "para você",
      rows: [
        demand.dueAt ? { label: "Prazo", value: formatDateTime(demand.dueAt), icon: "calendar" as CardIcon } : null,
        priorityRow(demand.priority),
        demand.createdBy?.name
          ? { label: "Atribuída por", value: demand.createdBy.name, icon: "user" as CardIcon }
          : null,
      ].filter(Boolean) as CardSpec["rows"],
    };
  }

  if (kind === "DUE_SOON") {
    return {
      ...base,
      pill: "Lembrete",
      pillIcon: "clock",
      tone: "amber",
      titleLead: "O prazo está",
      titleAccent: "chegando",
      rows: [
        { label: "Prazo", value: formatDateTime(demand.dueAt!), icon: "calendar" },
        { label: "Vence", value: untilText(demand.dueAt!, now), icon: "clock", tone: "amber" },
        priorityRow(demand.priority),
      ],
    };
  }

  return {
    ...base,
    pill: "Atrasada",
    pillIcon: "alert",
    tone: "red",
    titleLead: "Prazo",
    titleAccent: "vencido",
    footnote: `Este aviso se repete${overdueRepeatHoursText()} até a demanda ser concluída no SIS.`,
    rows: [
      { label: "Prazo era", value: formatDateTime(demand.dueAt!), icon: "calendar", tone: "red" },
      { label: "Atrasada", value: overdueText(demand.dueAt!, now), icon: "clock", tone: "red" },
      { label: "Situação", value: STATUS_LABEL[demand.status], icon: "clipboard" },
      priorityRow(demand.priority),
    ],
  };
}

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
    /** Card em imagem; o texto vira legenda curta e reserva. */
    card?: CardSpec | null;
    caption?: string;
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
    }).catch((error: any) => {
      if (error?.code !== "P2002") throw error;
    });
    return { status: "SKIPPED" as const };
  }

  // Reserva a chave ANTES de enviar: se dois ciclos do cron rodarem
  // juntos, o segundo esbarra no índice único e não manda de novo.
  let reservation: { id: number };
  try {
    reservation = await record("SENDING", {});
  } catch (error: any) {
    if (error?.code === "P2002") return { status: "DUPLICATE" as const };
    throw error;
  }

  const png = params.card ? tryRenderCardPng(params.card) : null;
  const result = await sendWhatsAppImage(phone, png, params.caption || params.text, params.text);

  if (result.ok) {
    await prisma.demandNotification.update({
      where: { id: reservation.id },
      data: { status: "SENT", messageId: result.messageId || null },
    });
    return { status: "SENT" as const };
  }

  if (result.skipped) {
    // WhatsApp desligado: registra para não acumular alertas velhos.
    await prisma.demandNotification.update({
      where: { id: reservation.id },
      data: { status: "SKIPPED", errorText: result.error || null },
    });
    return { status: "SKIPPED" as const, error: result.error };
  }

  // Falhou: libera a chave para nova tentativa e guarda a falha à parte.
  await prisma.demandNotification.update({
    where: { id: reservation.id },
    data: {
      status: "FAILED",
      errorText: result.error || null,
      dedupeKey: `${params.dedupeKey}#FAIL${failures + 1}`,
    },
  });

  return { status: "FAILED" as const, error: result.error };
}

function pause(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function notifyAssignment(prisma: PrismaClient, demand: DemandWithPeople, actorId?: number | null) {
  if (!demand.assigneeId || demand.assigneeId === actorId) return;
  if (!(await loadDemandSettings(prisma)).assignEnabled) return;

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
    card: demandCard("ASSIGNED", demand),
    caption: `*Nova demanda para você:* ${demand.title}\n${appUrl()}`,
  });
}

/* ------------------------------------------------------
 * Configurações dos avisos (tela do programador)
 * ---------------------------------------------------- */

export type DemandAlertSettings = {
  assignEnabled: boolean;
  dueSoonEnabled: boolean;
  overdueEnabled: boolean;
  overdueRepeatHours: number[];
  digestEnabled: boolean;
  digestHour: number;
};

const SETTINGS_GROUP = "DEMANDS";
const SETTING_KEYS: Record<keyof DemandAlertSettings, string> = {
  assignEnabled: "DEMANDS_ASSIGN_ENABLED",
  dueSoonEnabled: "DEMANDS_DUE_SOON_ENABLED",
  overdueEnabled: "DEMANDS_OVERDUE_ENABLED",
  overdueRepeatHours: "DEMANDS_OVERDUE_REPEAT_HOURS",
  digestEnabled: "DEMANDS_DIGEST_ENABLED",
  digestHour: "DEMANDS_DIGEST_HOUR",
};

function parseHours(raw: string) {
  return [
    ...new Set(
      raw
        .split(/[,;\s]+/)
        .filter(Boolean)
        .map(Number)
        .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23)
    ),
  ].sort((a, b) => a - b);
}

function defaultSettings(): DemandAlertSettings {
  const digestHour = Number(process.env.DEMANDS_DIGEST_HOUR ?? 7);
  return {
    assignEnabled: true,
    dueSoonEnabled: true,
    overdueEnabled: true,
    overdueRepeatHours: parseHours(String(process.env.DEMANDS_OVERDUE_REPEAT_HOURS ?? "9,15")),
    digestEnabled: true,
    digestHour: Number.isInteger(digestHour) && digestHour >= 0 && digestHour <= 23 ? digestHour : 7,
  };
}

// Valor em memória, atualizado a cada ciclo do cron e ao salvar na tela.
let demandSettings: DemandAlertSettings = defaultSettings();

export async function loadDemandSettings(prisma: PrismaClient) {
  const rows = await prisma.systemSetting.findMany({ where: { group: SETTINGS_GROUP } });
  const byKey = new Map(rows.map((row) => [row.key, row.value ?? ""]));
  const base = defaultSettings();
  const bool = (key: string, fallback: boolean) =>
    byKey.has(key) ? byKey.get(key) === "true" : fallback;

  const hour = byKey.has(SETTING_KEYS.digestHour) ? Number(byKey.get(SETTING_KEYS.digestHour)) : base.digestHour;

  demandSettings = {
    assignEnabled: bool(SETTING_KEYS.assignEnabled, base.assignEnabled),
    dueSoonEnabled: bool(SETTING_KEYS.dueSoonEnabled, base.dueSoonEnabled),
    overdueEnabled: bool(SETTING_KEYS.overdueEnabled, base.overdueEnabled),
    overdueRepeatHours: byKey.has(SETTING_KEYS.overdueRepeatHours)
      ? parseHours(byKey.get(SETTING_KEYS.overdueRepeatHours) || "")
      : base.overdueRepeatHours,
    digestEnabled: bool(SETTING_KEYS.digestEnabled, base.digestEnabled),
    digestHour: Number.isInteger(hour) && hour >= 0 && hour <= 23 ? hour : base.digestHour,
  };
  return demandSettings;
}

async function saveDemandSettings(prisma: PrismaClient, body: any) {
  const current = await loadDemandSettings(prisma);
  const next: DemandAlertSettings = { ...current };

  for (const key of ["assignEnabled", "dueSoonEnabled", "overdueEnabled", "digestEnabled"] as const) {
    if (body?.[key] !== undefined) next[key] = Boolean(body[key]);
  }
  if (body?.digestHour !== undefined) {
    const hour = Number(body.digestHour);
    if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new Error("Horário da agenda inválido (0 a 23).");
    next.digestHour = hour;
  }
  if (body?.overdueRepeatHours !== undefined) {
    const raw = Array.isArray(body.overdueRepeatHours) ? body.overdueRepeatHours.join(",") : String(body.overdueRepeatHours);
    next.overdueRepeatHours = parseHours(raw);
    if (next.overdueRepeatHours.length > 6) throw new Error("Use no máximo 6 horários de repetição.");
  }

  const value = (key: keyof DemandAlertSettings) =>
    key === "overdueRepeatHours" ? next.overdueRepeatHours.join(",") : String(next[key]);

  await prisma.$transaction(
    (Object.keys(SETTING_KEYS) as (keyof DemandAlertSettings)[]).map((key) =>
      prisma.systemSetting.upsert({
        where: { key: SETTING_KEYS[key] },
        create: { key: SETTING_KEYS[key], value: value(key), group: SETTINGS_GROUP },
        update: { value: value(key), group: SETTINGS_GROUP },
      })
    )
  );

  return loadDemandSettings(prisma);
}

/* ------------------------------------------------------
 * Processamento periódico (chamado pelo cron)
 * ---------------------------------------------------- */

function overdueRepeatHours() {
  return demandSettings.overdueRepeatHours;
}

function overdueRepeatHoursText() {
  const hours = overdueRepeatHours().map((hour) => `${hour}h`);
  if (!hours.length) return "";
  return ` todo dia às ${hours.length > 1 ? `${hours.slice(0, -1).join(", ")} e ${hours[hours.length - 1]}` : hours[0]}`;
}

/** Último horário de repetição do aviso de atraso já alcançado hoje. */
function overdueRepeatSlot(now: Date) {
  const hours = overdueRepeatHours();
  const current = localHour(now);
  // Só dentro de 2h depois do horário, para não "compensar" fora de hora.
  const passed = hours.filter((hour) => hour <= current && current - hour < 2);
  return passed.length ? passed[passed.length - 1] : null;
}

function overdueText(dueAt: Date, now: Date) {
  const minutes = Math.max(0, Math.round((now.getTime() - dueAt.getTime()) / 60000));
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} dias`;
}

let demandAlertsRunning = false;

export async function processDemandAlerts(prisma: PrismaClient, now = new Date()) {
  if (demandAlertsRunning) {
    return { dueSoon: 0, overdue: 0, digests: 0, failed: 0, skipped: 0, executed: false, reason: "Ciclo anterior ainda em andamento." };
  }
  demandAlertsRunning = true;
  try {
    return await runDemandAlerts(prisma, now);
  } finally {
    demandAlertsRunning = false;
  }
}

async function runDemandAlerts(prisma: PrismaClient, now: Date) {
  const summary = { dueSoon: 0, overdue: 0, digests: 0, failed: 0, skipped: 0 };
  const config = whatsappConfig();

  if (!config.enabled) {
    return { ...summary, executed: false, reason: "WhatsApp desativado." };
  }

  const settings = await loadDemandSettings(prisma);

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
      if (!settings.overdueEnabled) continue;
      // Primeiro aviso assim que o prazo vence; depois repete todo dia
      // nos horários configurados na tela (padrão 9h e 15h)
      // até a demanda ser concluída ou cancelada.
      const firstKey = `OVERDUE:${demand.id}:${dueKey}`;
      const first = await prisma.demandNotification.findUnique({ where: { dedupeKey: firstKey } });
      let dedupeKey = firstKey;

      if (first) {
        const slot = overdueRepeatSlot(now);
        if (slot === null) continue;
        // Não repete se o último aviso de atraso saiu há menos de 3h.
        const recent = await prisma.demandNotification.findFirst({
          where: {
            demandId: demand.id,
            kind: "OVERDUE",
            status: "SENT",
            createdAt: { gte: new Date(now.getTime() - 3 * 3600 * 1000) },
          },
        });
        if (recent) continue;
        dedupeKey = `OVERDUE:${demand.id}:${dueKey}:${localDayKey(now)}:${slot}`;
      }

      const result = await notifyUser(prisma, {
        userId: demand.assigneeId!,
        kind: "OVERDUE",
        dedupeKey,
        demandId: demand.id,
        text: [
          "*Demanda com prazo vencido*",
          "",
          `*${demand.title}*`,
          `Prazo era: ${formatDateTime(dueAt)} (atrasada ${overdueText(dueAt, now)})`,
          `Situação: ${STATUS_LABEL[demand.status]}`,
          `Este aviso se repete${overdueRepeatHoursText()} até a demanda ser concluída.`,
          "",
          appUrl(),
        ].join("\n"),
        card: demandCard("OVERDUE", demand, now),
        caption: `*Prazo vencido (${overdueText(dueAt, now)}):* ${demand.title}\nConclua no SIS para parar os avisos: ${appUrl()}`,
      });

      if (result.status === "SENT") summary.overdue += 1;
      count(result.status);
      if (result.status === "SENT") await pause(1500);
      continue;
    }

    if (settings.dueSoonEnabled && demand.remindBeforeMinutes > 0) {
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
          card: demandCard("DUE_SOON", demand, now),
          caption: `*Lembrete:* ${demand.title} (prazo ${formatDateTime(dueAt)})\n${appUrl()}`,
        });

        if (result.status === "SENT") summary.dueSoon += 1;
        count(result.status);
        if (result.status === "SENT") await pause(1500);
      }
    }
  }

  const digestHour = settings.digestHour;

  if (settings.digestEnabled && localHour(now) >= digestHour) {
    const dayKey = localDayKey(now);
    const users = await prisma.user.findMany({
      where: {
        active: true,
        role: { in: [...STAFF_ROLES] },
        whatsappAlertsEnabled: true,
        whatsappPhone: { not: null },
      },
      select: { id: true, name: true, role: true, whatsappPhone: true },
    });

    // Contas diferentes com o mesmo WhatsApp (ex.: gerente e programador)
    // recebem UMA agenda só, juntando o conteúdo das duas.
    const roleOrder: Record<string, number> = { GERENTE: 0, SECRETARIA: 1, PROGRAMADOR: 2 };
    const byPhone = new Map<string, typeof users>();
    for (const user of [...users].sort((a, b) => (roleOrder[a.role] ?? 9) - (roleOrder[b.role] ?? 9) || a.id - b.id)) {
      const phone = normalizeWhatsAppPhone(user.whatsappPhone);
      if (!phone) continue;
      byPhone.set(phone, [...(byPhone.get(phone) || []), user]);
    }

    for (const group of byPhone.values()) {
      const keys = group.map((user) => `DIGEST:${user.id}:${dayKey}`);
      const exists = await prisma.demandNotification.findFirst({ where: { dedupeKey: { in: keys } } });
      if (exists) continue;

      const digests = (await Promise.all(group.map((user) => buildDailyDigest(prisma, user, now)))).filter(
        (item): item is NonNullable<typeof item> => Boolean(item)
      );
      if (!digests.length) continue;

      const digest = mergeDigests(digests);
      const primary = group[0];

      const result = await notifyUser(prisma, {
        userId: primary.id,
        kind: "DAILY_DIGEST",
        dedupeKey: keys[0],
        text: digest.text,
        card: digest.card,
        caption: digest.caption,
      });

      if (result.status === "SENT") {
        for (const [index, user] of group.entries()) {
          if (index === 0) continue;
          await prisma.demandNotification
            .create({
              data: {
                userId: user.id,
                kind: "DAILY_DIGEST",
                dedupeKey: keys[index],
                phone: normalizeWhatsAppPhone(user.whatsappPhone) || "",
                status: "SKIPPED",
                errorText: `Mesmo WhatsApp de ${primary.name}: agenda enviada junto.`,
              },
            })
            .catch(() => null);
        }
      }

      if (result.status === "SENT") summary.digests += 1;
      count(result.status);
      if (result.status === "SENT") await pause(1500);
    }
  }

  return { ...summary, executed: true };
}

type DailyDigest = { text: string; card: CardSpec; caption: string };

/** Junta agendas de contas que dividem o mesmo WhatsApp, sem repetir itens. */
function mergeDigests(digests: DailyDigest[]): DailyDigest {
  if (digests.length === 1) return digests[0];

  const [first] = digests;
  const seen = new Set<string>();
  const list: CardListItem[] = [];
  for (const digest of digests) {
    for (const item of digest.card.list || []) {
      const key = `${item.text}|${item.meta || ""}`;
      if (seen.has(key)) continue;
      seen.add(key);
      list.push(item);
    }
  }

  const bodies = digests.map((digest) => digest.text.split("\n").slice(2, -2).join("\n").trim()).filter(Boolean);
  const uniqueBodies = [...new Set(bodies)];
  const textLines = first.text.split("\n");
  const text = [textLines[0], "", uniqueBodies.join("\n\n"), "", textLines[textLines.length - 1]].join("\n");
  const caption = first.caption.replace(/\(\d+ (itens|item)\)/, `(${list.length} ${list.length === 1 ? "item" : "itens"})`);

  const overdue = list.filter((item) => item.tone === "red").length;
  const rows = [...(first.card.rows || [])];
  if (rows[1]) {
    rows[1] = overdue
      ? { label: "Atrasadas", value: String(overdue), icon: "alert", tone: "red" }
      : { label: "Itens na agenda", value: String(list.length), icon: "clock" };
  }

  return { text, caption, card: { ...first.card, rows, list } };
}

async function buildDailyDigest(
  prisma: PrismaClient,
  user: { id: number; name: string; role: string },
  now: Date
): Promise<DailyDigest | null> {
  const sections: string[] = [];
  const items: CardListItem[] = [];
  const endOfToday = new Date(`${localDayKey(now)}T23:59:59${TZ_OFFSET}`);

  const demands = await prisma.demand.findMany({
    where: { assigneeId: user.id, status: { in: OPEN_STATUSES } },
    orderBy: [{ sortOrder: "asc" }, { dueAt: "asc" }, { id: "asc" }],
    take: 40,
  });

  const overdue = demands.filter((d) => d.dueAt && d.dueAt < now);
  const today = demands.filter((d) => d.dueAt && d.dueAt >= now && d.dueAt <= endOfToday);
  const rest = demands.filter((d) => !overdue.includes(d) && !today.includes(d));

  const demandMeta = (d: (typeof demands)[number], prefix: string) =>
    [prefix, d.dueAt ? formatDateTime(d.dueAt) : null, d.priority === "URGENTE" || d.priority === "ALTA" ? PRIORITY_LABEL[d.priority] : null]
      .filter(Boolean)
      .join(" · ");
  overdue.forEach((d) => items.push({ text: d.title, meta: demandMeta(d, "Atrasada"), tone: "red" }));
  today.forEach((d) => items.push({ text: d.title, meta: demandMeta(d, "Hoje"), tone: "amber" }));
  rest.forEach((d) => items.push({ text: d.title, meta: demandMeta(d, "Na fila"), tone: "green" }));

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

  trips.forEach((trip) => {
    const where = [trip.municipality, trip.state].filter(Boolean).join("/");
    items.push({
      text: trip.title,
      meta: [`Campo ${formatDay(trip.startDate, "UTC")}`, trip.departureTime ? `saída ${trip.departureTime}` : null, where || null]
        .filter(Boolean)
        .join(" · "),
      tone: "blue",
    });
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

    const payMeta = (t: (typeof due)[number]) =>
      [brl(t.amountCents ?? 0), t.dueDate! < startOfToday ? `venceu ${formatDay(t.dueDate!, "UTC")}` : "vence hoje", t.client?.name || null]
        .filter(Boolean)
        .join(" · ");
    pay.forEach((t) => items.push({ text: `Pagar: ${t.description}`, meta: payMeta(t), tone: "amber" }));
    receive.forEach((t) => items.push({ text: `Receber: ${t.description}`, meta: payMeta(t), tone: "violet" }));

    if (pay.length) sections.push(`*Contas a pagar (${pay.length})*\n${pay.slice(0, 8).map(line).join("\n")}`);
    if (receive.length) sections.push(`*A receber vencendo/vencido (${receive.length})*\n${receive.slice(0, 8).map(line).join("\n")}`);
  }

  if (!sections.length) return null;

  const firstName = user.name.split(" ")[0];
  const weekday = new Intl.DateTimeFormat("pt-BR", { timeZone: TZ, weekday: "long" }).format(now);

  const text = [
    `Bom dia, ${firstName}! Sua agenda de ${formatDay(now)}:`,
    "",
    sections.join("\n\n"),
    "",
    appUrl(),
  ].join("\n");

  const card: CardSpec = {
    pill: "Agenda do dia",
    pillIcon: "calendar",
    tone: "green",
    titleLead: "Bom dia,",
    titleAccent: `${firstName}!`,
    rows: [
      { label: weekday.charAt(0).toUpperCase() + weekday.slice(1), value: formatDay(now), icon: "calendar" },
      overdue.length
        ? { label: "Atrasadas", value: String(overdue.length), icon: "alert", tone: "red" }
        : { label: "Para hoje", value: String(today.length), icon: "clock" },
    ],
    listTitle: "Sua agenda",
    list: items,
    listMax: 8,
    link: appUrl(),
  };

  return {
    text,
    card,
    caption: `*Bom dia, ${firstName}!* Sua agenda de ${formatDay(now)} (${items.length} ${items.length === 1 ? "item" : "itens"}).\n${appUrl()}`,
  };
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

  /** Configurações dos avisos: todos os gestores veem; só o programador altera. */
  app.get("/demands/settings", ...managers, async (_req: any, res: any) => {
    return res.json(await loadDemandSettings(prisma));
  });

  app.put("/demands/settings", authMiddleware, requireRoles(["PROGRAMADOR"]), async (req: any, res: any) => {
    try {
      const settings = await saveDemandSettings(prisma, req.body || {});
      return res.json({ ...settings, message: "Configurações dos avisos salvas." });
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || "Configuração inválida." });
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
      caption: `Teste do SIS Amazonika (${formatDateTime(new Date())})`,
      card: {
        pill: "Teste",
        pillIcon: "check",
        tone: "green",
        titleLead: "WhatsApp",
        titleAccent: "conectado",
        boxTitle: "Os alertas do SIS chegarão por aqui",
        boxSubtitle: "Novas demandas, lembretes de prazo, atrasos e a agenda do dia.",
        boxIcon: "check",
        rows: [{ label: "Enviado em", value: formatDateTime(new Date()), icon: "clock" }],
        link: appUrl(),
      },
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
