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
    const response = await axios.post(
      `${config.baseUrl}/api/sessions/${encodeURIComponent(config.session)}/messages/send-text`,
      { chatId: whatsappChatId(normalized), text },
      {
        headers: { "X-API-Key": config.apiKey },
        timeout: 20000,
      }
    );

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

/** Estado da sessão no OpenWA, para a tela de configuração. */
export async function whatsappSessionStatus() {
  const config = whatsappConfig();

  if (!config.enabled || !config.apiKey) {
    return {
      configured: false,
      enabled: config.enabled,
      session: config.session,
      status: null as string | null,
      error: !config.enabled ? "WhatsApp desativado." : "OPENWA_API_KEY não configurada.",
    };
  }

  try {
    const response = await axios.get(
      `${config.baseUrl}/api/sessions/${encodeURIComponent(config.session)}`,
      { headers: { "X-API-Key": config.apiKey }, timeout: 10000 }
    );
    const data = response.data?.data || response.data || {};

    return {
      configured: true,
      enabled: true,
      session: config.session,
      status: String(data.status || data.state || "desconhecido"),
      error: null as string | null,
    };
  } catch (error: any) {
    return {
      configured: true,
      enabled: true,
      session: config.session,
      status: null as string | null,
      error:
        error?.response?.status === 404
          ? `Sessão "${config.session}" não existe no OpenWA.`
          : `OpenWA inacessível: ${error?.message || error}`,
    };
  }
}
