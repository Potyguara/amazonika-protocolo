import axios from "axios";

/*
 * ======================================================
 * WHATSAPP (OpenWA, auto-hospedado)
 * ======================================================
 *
 * O SIS só fala com o OpenWA pela rede interna da VPS.
 * Configuração no backend/.env:
 *   WHATSAPP_ENABLED=true
 *   OPENWA_URL=http://127.0.0.1:2785      (padrão)
 *   OPENWA_API_KEY=...                    (chave gerada pelo OpenWA)
 *   OPENWA_SESSION=sis                    (nome da sessão conectada)
 *
 * Sem configuração, nada é enviado e o motivo fica registrado.
 */

export type WhatsAppSendResult = {
  ok: boolean;
  messageId?: string | null;
  skipped?: boolean;
  error?: string;
};

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

export function whatsappConfig() {
  return {
    enabled: String(env("WHATSAPP_ENABLED") || "false").toLowerCase() === "true",
    baseUrl: (env("OPENWA_URL") || "http://127.0.0.1:2785").replace(/\/+$/, ""),
    apiKey: env("OPENWA_API_KEY"),
    session: env("OPENWA_SESSION") || "sis",
  };
}

/**
 * Normaliza para dígitos com DDI. Números brasileiros sem DDI
 * (10 ou 11 dígitos) ganham o 55.
 */
export function normalizeWhatsAppPhone(raw?: string | null) {
  const digits = String(raw || "").replace(/\D/g, "");

  if (!digits) return null;
  if (digits.length === 10 || digits.length === 11) return `55${digits}`;
  if (digits.length >= 12 && digits.length <= 15) return digits;

  return null;
}

export function maskWhatsAppPhone(phone?: string | null) {
  const digits = String(phone || "");
  if (digits.length < 6) return digits;
  return `${digits.slice(0, 4)}•••••${digits.slice(-4)}`;
}

/**
 * O WhatsApp registrou celulares brasileiros de DDD 31 em diante sem o
 * nono dígito (ex.: 5596988036439 vira 559688036439). Para esses DDDs o
 * chatId vai sem o 9. WHATSAPP_BR_NINTH_DIGIT=keep desliga o ajuste.
 */
export function whatsappChatId(normalized: string) {
  const keep = String(env("WHATSAPP_BR_NINTH_DIGIT") || "auto").toLowerCase() === "keep";

  if (!keep && /^55\d{2}9\d{8}$/.test(normalized)) {
    const ddd = Number(normalized.slice(2, 4));
    if (ddd >= 31) return `${normalized.slice(0, 4)}${normalized.slice(5)}@c.us`;
  }

  return `${normalized}@c.us`;
}

export async function sendWhatsAppText(
  phone: string,
  text: string
): Promise<WhatsAppSendResult> {
  const config = whatsappConfig();

  if (!config.enabled) {
    return { ok: false, skipped: true, error: "WhatsApp desativado (WHATSAPP_ENABLED)." };
  }

  if (!config.apiKey) {
    return { ok: false, skipped: true, error: "OPENWA_API_KEY não configurada." };
  }

  const normalized = normalizeWhatsAppPhone(phone);

  if (!normalized) {
    return { ok: false, error: "Número de WhatsApp inválido." };
  }

  try {
    const response = await withSessionId(false, async (sessionId) => {
      if (!sessionId) {
        throw new Error(`Sessão "${config.session}" não existe no OpenWA. Conecte o WhatsApp em Demandas > WhatsApp.`);
      }

      return axios.post(
        `${config.baseUrl}/api/sessions/${encodeURIComponent(sessionId)}/messages/send-text`,
        { chatId: whatsappChatId(normalized), text },
        {
          headers: { "X-API-Key": config.apiKey },
          timeout: 20000,
        }
      );
    });

    const data = response.data || {};
    const messageId =
      data.messageId || data.id || data?.data?.messageId || data?.data?.id || null;

    return { ok: true, messageId: messageId ? String(messageId) : null };
  } catch (error: any) {
    const detail =
      error?.response?.data?.message ||
      error?.response?.data?.error ||
      error?.message ||
      String(error);

    return {
      ok: false,
      error: `OpenWA: ${Array.isArray(detail) ? detail.join("; ") : detail}`.slice(0, 500),
    };
  }
}

/*
 * O OpenWA identifica a sessão pelo id (UUID), não pelo nome.
 * O SIS guarda só o nome (OPENWA_SESSION) e descobre o id.
 */
let cachedSessionId: { name: string; id: string } | null = null;

function openwa() {
  const config = whatsappConfig();
  return {
    config,
    http: axios.create({
      baseURL: `${config.baseUrl}/api`,
      headers: { "X-API-Key": config.apiKey || "" },
      timeout: 15000,
    }),
  };
}

function unwrap(data: any) {
  return data && typeof data === "object" && "data" in data && !Array.isArray(data) ? data.data : data;
}

function openwaError(error: any) {
  const detail = error?.response?.data?.message || error?.response?.data?.error || error?.message || String(error);
  return Array.isArray(detail) ? detail.join("; ") : String(detail);
}

async function resolveSessionId(create: boolean): Promise<string | null> {
  const { config, http } = openwa();

  if (cachedSessionId?.name === config.session) return cachedSessionId.id;

  const response = await http.get("/sessions", { params: { name: config.session } });
  const list = unwrap(response.data);
  const found = (Array.isArray(list) ? list : []).find((item: any) => item?.name === config.session);

  if (found?.id) {
    cachedSessionId = { name: config.session, id: String(found.id) };
    return cachedSessionId.id;
  }

  if (!create) return null;

  const created = unwrap((await http.post("/sessions", { name: config.session })).data);
  if (!created?.id) throw new Error("O OpenWA não devolveu o id da sessão criada.");

  cachedSessionId = { name: config.session, id: String(created.id) };
  return cachedSessionId.id;
}

function isNotFound(error: any) {
  return error?.response?.status === 404;
}

/** Roda fn com o id da sessão; se o OpenWA não achar (id velho), redescobre e tenta de novo. */
async function withSessionId<T>(create: boolean, fn: (id: string | null) => Promise<T>): Promise<T> {
  try {
    return await fn(await resolveSessionId(create));
  } catch (error: any) {
    if (!isNotFound(error) || !cachedSessionId) throw error;
    cachedSessionId = null;
    return fn(await resolveSessionId(create));
  }
}

function requireConfigured() {
  const config = whatsappConfig();
  if (!config.enabled) throw new Error("WhatsApp desativado (WHATSAPP_ENABLED=false no servidor).");
  if (!config.apiKey) throw new Error("OPENWA_API_KEY não configurada no servidor.");
  return config;
}

/** Cria a sessão se faltar e inicia o motor (gera o QR Code). */
export async function whatsappConnect() {
  requireConfigured();
  const { http } = openwa();

  try {
    return await withSessionId(true, async (id) => {
      const session = unwrap((await http.get(`/sessions/${id}`)).data);

      if (session?.status !== "ready") {
        try {
          await http.post(`/sessions/${id}/start`);
        } catch (error: any) {
          // 400 = já iniciada: segue para o QR.
          if (error?.response?.status !== 400) throw error;
        }
      }

      const fresh = unwrap((await http.get(`/sessions/${id}`)).data);
      return { status: String(fresh?.status || "desconhecido"), phone: (fresh?.phone as string) || null };
    });
  } catch (error: any) {
    throw new Error(`OpenWA: ${openwaError(error)}`);
  }
}

/** QR Code atual (data URL) ou o motivo de não haver um. */
export async function whatsappQrCode() {
  requireConfigured();
  const { http } = openwa();

  return withSessionId(false, async (id) => {
    if (!id) return { qrCode: null, status: "sem_sessao", message: "Clique em Conectar WhatsApp." };

    const session = unwrap((await http.get(`/sessions/${id}`)).data);

    if (session?.status === "ready") {
      return { qrCode: null, status: "ready", phone: session.phone || null, message: "WhatsApp conectado." };
    }

    try {
      const data = unwrap((await http.get(`/sessions/${id}/qr`)).data);
      const raw = String(data?.qrCode || "");
      return { qrCode: raw || null, status: String(data?.status || session?.status), message: null };
    } catch (error: any) {
      if (isNotFound(error)) throw error;
      return { qrCode: null, status: String(session?.status || "desconhecido"), message: openwaError(error) };
    }
  });
}

/** Desliga o número atual (para trocar de chip). */
export async function whatsappLogout() {
  requireConfigured();
  const { http } = openwa();
  try {
    return await withSessionId(false, async (id) => {
      if (!id) return { status: "sem_sessao" };
      const data = unwrap((await http.post(`/sessions/${id}/logout`)).data);
      return { status: String(data?.status || "disconnected") };
    });
  } catch (error: any) {
    throw new Error(`OpenWA: ${openwaError(error)}`);
  }
}

/** Estado da sessão no OpenWA, para a tela de configuração. */
export async function whatsappSessionStatus() {
  const config = whatsappConfig();

  if (!config.enabled || !config.apiKey) {
    return {
      configured: false,
      enabled: config.enabled,
      session: config.session,
      status: null as string | null,
      phone: null as string | null,
      error: !config.enabled ? "WhatsApp desativado." : "OPENWA_API_KEY não configurada.",
    };
  }

  try {
    const { http } = openwa();
    const data = await withSessionId(false, async (id) =>
      id ? unwrap((await http.get(`/sessions/${id}`)).data) || {} : null
    );

    if (!data) {
      return {
        configured: true,
        enabled: true,
        session: config.session,
        status: "sem_sessao",
        phone: null as string | null,
        error: null as string | null,
      };
    }

    return {
      configured: true,
      enabled: true,
      session: config.session,
      status: String(data.status || "desconhecido"),
      phone: (data.phone as string) || null,
      error: (data.lastError as string) || null,
    };
  } catch (error: any) {
    return {
      configured: true,
      enabled: true,
      session: config.session,
      status: null as string | null,
      phone: null as string | null,
      error: `OpenWA inacessível: ${openwaError(error)}`,
    };
  }
}
