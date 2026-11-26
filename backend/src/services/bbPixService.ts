import { assertMoneyCents, centsToBbValue } from "../lib/money";
import axios, { AxiosInstance } from "axios";
import fs from "fs";
import https from "https";

type BbTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope?: string;
};

type CreateBbPixChargeInput = {
  txid: string;
  amountInCents: number;
  debtorName: string;
  debtorCpfCnpj?: string | null;
  description: string;
  expirationSeconds?: number;
};

type CreateBbPixDueChargeInput = {
  txid: string;
  amountInCents: number;
  debtorName: string;
  debtorCpfCnpj?: string | null;
  description: string;
  dueDate: Date | string;
};

function requiredEnv(name: string) {
  const value = process.env[name];

  if (!value || !String(value).trim()) {
    throw new Error(`Variável de ambiente obrigatória não configurada: ${name}`);
  }

  return String(value).trim();
}

function validateBbEnvironment() {
  const env = requiredEnv("BB_ENV").toLowerCase();
  const oauthUrl = requiredEnv("BB_OAUTH_URL");
  const pixApiUrl = requiredEnv("BB_PIX_API_URL");

  let oauthHost: string;
  let pixApiHost: string;

  try {
    oauthHost = new URL(oauthUrl).hostname.toLowerCase();
  } catch {
    throw new Error(
      `BB_OAUTH_URL inválida para o ambiente Banco do Brasil: ${oauthUrl}`
    );
  }

  try {
    pixApiHost = new URL(pixApiUrl).hostname.toLowerCase();
  } catch {
    throw new Error(
      `BB_PIX_API_URL inválida para o ambiente Banco do Brasil: ${pixApiUrl}`
    );
  }

  if (env === "sandbox") {
    if (oauthHost !== "oauth.hm.bb.com.br") {
      throw new Error(
        `Configuração BB inconsistente: BB_ENV=sandbox exige oauth.hm.bb.com.br, recebido ${oauthHost}.`
      );
    }

    if (pixApiHost !== "api.hm.bb.com.br") {
      throw new Error(
        `Configuração BB inconsistente: BB_ENV=sandbox exige api.hm.bb.com.br, recebido ${pixApiHost}.`
      );
    }

    return;
  }

  if (env === "production") {
    if (oauthHost !== "oauth.bb.com.br") {
      throw new Error(
        `Configuração BB inconsistente: BB_ENV=production exige oauth.bb.com.br, recebido ${oauthHost}.`
      );
    }

    if (pixApiHost !== "api-pix.bb.com.br" && pixApiHost !== "api.bb.com.br") {
      throw new Error(
        `Configuração BB inconsistente: BB_ENV=production exige api-pix.bb.com.br, recebido ${pixApiHost}.`
      );
    }

    return;
  }

  throw new Error(
    `BB_ENV inválido: ${env}. Valores permitidos: sandbox ou production.`
  );
}

/*
 * ======================================================
 * CONEXÃO COM O BB (mTLS em produção)
 * ======================================================
 *
 * Em produção o BB exige certificado do cliente (mTLS) na API Pix.
 * Configure UM dos formatos no backend/.env:
 *   BB_CERT_PFX_PATH=/root/bb-certs/amazonika.pfx
 *   BB_CERT_PFX_PASSPHRASE=...
 * ou
 *   BB_CERT_PATH=/root/bb-certs/cert.pem
 *   BB_CERT_KEY_PATH=/root/bb-certs/key.pem
 *   BB_CERT_KEY_PASSPHRASE=... (se a chave tiver senha)
 *
 * O cabeçalho da chave de aplicação é gw-dev-app-key no sandbox e
 * gw-app-key em produção (BB_APP_KEY_HEADER sobrescreve).
 */
let cachedBbAgent: https.Agent | null | undefined;

function optionalEnv(name: string) {
  const value = process.env[name];
  return value && String(value).trim() ? String(value).trim() : null;
}

function isBbProduction() {
  return String(process.env.BB_ENV || "").trim().toLowerCase() === "production";
}

function bbHttpsAgent(): https.Agent | null {
  if (cachedBbAgent !== undefined) return cachedBbAgent;

  const pfxPath = optionalEnv("BB_CERT_PFX_PATH");
  const certPath = optionalEnv("BB_CERT_PATH");
  const keyPath = optionalEnv("BB_CERT_KEY_PATH");

  if (pfxPath) {
    cachedBbAgent = new https.Agent({
      pfx: fs.readFileSync(pfxPath),
      passphrase: optionalEnv("BB_CERT_PFX_PASSPHRASE") || undefined,
      keepAlive: true,
    });
  } else if (certPath && keyPath) {
    cachedBbAgent = new https.Agent({
      cert: fs.readFileSync(certPath),
      key: fs.readFileSync(keyPath),
      passphrase: optionalEnv("BB_CERT_KEY_PASSPHRASE") || undefined,
      keepAlive: true,
    });
  } else {
    cachedBbAgent = null;
  }

  return cachedBbAgent;
}

/** Cliente HTTP para o BB: usa o certificado (mTLS) quando configurado. */
function bbHttp(): AxiosInstance {
  const agent = bbHttpsAgent();

  if (!agent && isBbProduction()) {
    throw new Error(
      "BB_ENV=production exige certificado mTLS: configure BB_CERT_PFX_PATH (e BB_CERT_PFX_PASSPHRASE) ou BB_CERT_PATH + BB_CERT_KEY_PATH no backend/.env."
    );
  }

  return axios.create(agent ? { httpsAgent: agent } : {});
}

function bbAppKeyHeader() {
  return (
    optionalEnv("BB_APP_KEY_HEADER") ||
    (isBbProduction() ? "gw-app-key" : "gw-dev-app-key")
  );
}

/** Diagnóstico sem segredos: o que está configurado e se o token sai. */
export async function checkBbPixConnection() {
  const result: Record<string, unknown> = {
    env: process.env.BB_ENV || null,
    oauthUrl: process.env.BB_OAUTH_URL || null,
    pixApiUrl: process.env.BB_PIX_API_URL || null,
    clientId: Boolean(optionalEnv("BB_CLIENT_ID")),
    clientSecret: Boolean(optionalEnv("BB_CLIENT_SECRET")),
    appKey: Boolean(optionalEnv("BB_APP_KEY")),
    appKeyHeader: bbAppKeyHeader(),
    pixKey: Boolean(optionalEnv("BB_PIX_KEY")),
    certificate: optionalEnv("BB_CERT_PFX_PATH")
      ? "pfx"
      : optionalEnv("BB_CERT_PATH") && optionalEnv("BB_CERT_KEY_PATH")
      ? "pem"
      : null,
  };

  try {
    bbHttpsAgent();
    result.certificateLoaded = Boolean(cachedBbAgent);
  } catch (error: any) {
    result.certificateLoaded = false;
    result.certificateError = error?.message || String(error);
    return result;
  }

  try {
    const token = await getBbAccessToken();
    result.oauth = token ? "ok" : "sem token";
  } catch (error: any) {
    result.oauth = "erro";
    result.oauthStatus = error?.response?.status || null;
    result.oauthError = error?.response?.data || error?.message || String(error);
    return result;
  }

  try {
    const appKey = requiredEnv("BB_APP_KEY");
    const pixApiUrl = requiredEnv("BB_PIX_API_URL").replace(/\/$/, "");
    const token = await getBbAccessToken();
    const now = new Date();
    const inicio = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
    const response = await bbHttp().get(`${pixApiUrl}/cob`, {
      params: { inicio, fim: now.toISOString(), [bbAppKeyHeader()]: appKey },
      headers: { Authorization: `Bearer ${token}` },
    });
    result.pixApi = "ok";
    result.pixApiStatus = response.status;
  } catch (error: any) {
    result.pixApi = "erro";
    result.pixApiStatus = error?.response?.status || null;
    result.pixApiError = error?.response?.data || error?.message || String(error);
  }

  return result;
}

function normalizeDocument(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

export function moneyToBbValue(amountInCents: number) {
  return centsToBbValue(assertMoneyCents(amountInCents));
}

function sanitizeTxid(value: string) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 35);
}

export async function getBbAccessToken() {
  validateBbEnvironment();

  const clientId = requiredEnv("BB_CLIENT_ID");
  const clientSecret = requiredEnv("BB_CLIENT_SECRET");
  const oauthUrl = requiredEnv("BB_OAUTH_URL");

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    "base64"
  );

  const params = new URLSearchParams();

  params.append("grant_type", "client_credentials");

  params.append(
    "scope",
    "pix.read pix.write cob.read cob.write cobv.read cobv.write"
  );

  const response = await bbHttp().post<BbTokenResponse>(oauthUrl, params, {
    headers: {
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
  });

  if (!response.data?.access_token) {
    throw new Error("Banco do Brasil não retornou access_token.");
  }

  return response.data.access_token;
}
export async function createBbPixCharge(input: CreateBbPixChargeInput) {
  const accessToken = await getBbAccessToken();

  const appKey = requiredEnv("BB_APP_KEY");
  const pixApiUrl = requiredEnv("BB_PIX_API_URL");
  const pixKey = requiredEnv("BB_PIX_KEY");

  const txid = sanitizeTxid(input.txid);

  if (!txid) {
    throw new Error("TXID inválido para emissão Pix BB.");
  }

  if (!input.amountInCents || input.amountInCents <= 0) {
    throw new Error("Valor da cobrança Pix deve ser maior que zero.");
  }

  const document = normalizeDocument(input.debtorCpfCnpj);

  const payload: any = {
calendario: {
  expiracao: input.expirationSeconds || 86400,
},
    valor: {
      original: moneyToBbValue(input.amountInCents),
    },
    chave: pixKey,
    solicitacaoPagador: (input.description || "Cobrança PIX AMAZONIKA").slice(0, 140),
  };

const shouldSendDebtor = String(process.env.BB_SEND_DEBTOR || "false") === "true";

  if (shouldSendDebtor && document.length === 11) {
    payload.devedor = {
      cpf: document,
      nome: input.debtorName.slice(0, 200),
    };
  }

  if (shouldSendDebtor && document.length === 14) {
    payload.devedor = {
      cnpj: document,
      nome: input.debtorName.slice(0, 200),
    };
  }
const url = `${pixApiUrl.replace(/\/$/, "")}/cob/${encodeURIComponent(
  txid
)}`;

console.log("BB PIX REQUEST:", {
  url,
  txid,
  amountInCents: input.amountInCents,
  valorOriginal: moneyToBbValue(input.amountInCents),
  debtorName: input.debtorName,
  debtorCpfCnpj: input.debtorCpfCnpj,
  document,
  pixKey,
  payload,
});

try {
  const response = await bbHttp().put(url, payload, {
    params: {
      [bbAppKeyHeader()]: appKey,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
} catch (error: any) {
  console.error("ERRO DETALHADO BB PIX /cob:", {
    message: error?.message,
    status: error?.response?.status,
    data: error?.response?.data,
    url,
    params: {
      [bbAppKeyHeader()]: appKey ? "***APP_KEY_PRESENTE***" : null,
    },
    payload,
  });

  throw error;
}
}

export async function getBbPixCharge(txid: string) {
  const accessToken = await getBbAccessToken();

  const appKey = requiredEnv("BB_APP_KEY");
  const pixApiUrl = requiredEnv("BB_PIX_API_URL");

  const sanitizedTxid = sanitizeTxid(txid);

  const url = `${pixApiUrl.replace(/\/$/, "")}/cob/${encodeURIComponent(
    sanitizedTxid
  )}`;

  const response = await bbHttp().get(url, {
    params: {
      [bbAppKeyHeader()]: appKey,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  return response.data;
}

export async function createBbPixDueCharge(input: CreateBbPixDueChargeInput) {
  const accessToken = await getBbAccessToken();

  const appKey = requiredEnv("BB_APP_KEY");
  const pixApiUrl = requiredEnv("BB_PIX_API_URL");
  const pixKey = requiredEnv("BB_PIX_KEY");

  const txid = sanitizeTxid(input.txid);

  if (!txid) {
    throw new Error("TXID inválido para emissão Pix BB com vencimento.");
  }

  if (!input.amountInCents || input.amountInCents <= 0) {
    throw new Error("Valor da cobrança Pix com vencimento deve ser maior que zero.");
  }

  const dueDate = new Date(input.dueDate);

  if (Number.isNaN(dueDate.getTime())) {
    throw new Error("Data de vencimento inválida para cobrança Pix com vencimento.");
  }

  const vencimento = dueDate.toISOString().slice(0, 10);

  const document = normalizeDocument(input.debtorCpfCnpj);

  const payload: any = {
    calendario: {
      dataDeVencimento: vencimento,
      validadeAposVencimento: 30,
    },
    valor: {
      original: moneyToBbValue(input.amountInCents),
    },
    chave: pixKey,
    solicitacaoPagador: (input.description || "Cobrança PIX AMAZONIKA").slice(
      0,
      140
    ),
  };

  const shouldSendDebtor =
    String(
      process.env.BB_SEND_DEBTOR ||
        "false"
    ).toLowerCase() === "true";

  if (
    shouldSendDebtor &&
    document.length === 11
  ) {
    payload.devedor = {
      cpf: document,
      nome:
        input.debtorName.slice(
          0,
          200
        ),
    };
  }

  if (
    shouldSendDebtor &&
    document.length === 14
  ) {
    payload.devedor = {
      cnpj: document,
      nome:
        input.debtorName.slice(
          0,
          200
        ),
    };
  }

  const url = `${pixApiUrl.replace(/\/$/, "")}/cobv/${encodeURIComponent(
    txid
  )}`;

try {
  const response = await bbHttp().put(url, payload, {
    params: {
      [bbAppKeyHeader()]: appKey,
    },
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });

  return response.data;
} catch (error: any) {
  console.error("ERRO DETALHADO BB PIX /cobv:", {
    message: error?.message,
    status: error?.response?.status,
    data: error?.response?.data,
    url,
    params: {
      [bbAppKeyHeader()]: appKey ? "***APP_KEY_PRESENTE***" : null,
    },
    payload,
  });

  throw error;
}
}

export async function getBbPixDueCharge(txid: string) {
  const accessToken = await getBbAccessToken();

  const appKey = requiredEnv("BB_APP_KEY");
  const pixApiUrl = requiredEnv("BB_PIX_API_URL");

  const sanitizedTxid = sanitizeTxid(txid);

  if (!sanitizedTxid) {
    throw new Error(
      "TXID inválido para consulta Pix BB com vencimento."
    );
  }

  const url = `${pixApiUrl.replace(/\/$/, "")}/cobv/${encodeURIComponent(
    sanitizedTxid
  )}`;

  try {
    const response = await bbHttp().get(url, {
      params: {
        [bbAppKeyHeader()]: appKey,
      },
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    return response.data;
  } catch (error: any) {
    console.error("ERRO DETALHADO BB PIX GET /cobv:", {
      message: error?.message,
      status: error?.response?.status,
      data: error?.response?.data,
      txid: sanitizedTxid,
      url,
    });

    throw error;
  }
}



export async function updateBbPixDueChargeDueDate(input: {
  txid: string;
  dueDate: Date | string;
}) {
  const accessToken =
    await getBbAccessToken();

  const appKey =
    requiredEnv("BB_APP_KEY");

  const pixApiUrl =
    requiredEnv("BB_PIX_API_URL");

  const sanitizedTxid =
    sanitizeTxid(input.txid);

  if (!sanitizedTxid) {
    throw new Error(
      "TXID inválido para alteração da cobrança Pix com vencimento."
    );
  }

  const dueDate =
    new Date(input.dueDate);

  if (
    Number.isNaN(
      dueDate.getTime()
    )
  ) {
    throw new Error(
      "Novo vencimento inválido para alteração da cobrança Pix."
    );
  }

  const dataDeVencimento =
    dueDate
      .toISOString()
      .slice(0, 10);

  const url =
    `${pixApiUrl.replace(/\/$/, "")}/cobv/${encodeURIComponent(
      sanitizedTxid
    )}`;

  /*
   * Alteramos SOMENTE o calendário.
   *
   * Valor, pagador e demais dados continuam
   * pertencendo à cobrança original.
   *
   * O TXID também permanece o mesmo.
   */
  const payload = {
    calendario: {
      dataDeVencimento,
      validadeAposVencimento: 30,
    },
  };

  try {
    const response =
      await bbHttp().patch(
        url,
        payload,
        {
          params: {
            [bbAppKeyHeader()]:
              appKey,
          },

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },
        }
      );

    return response.data;
  } catch (error: any) {
    console.error(
      "ERRO DETALHADO BB PIX PATCH /cobv:",
      {
        message:
          error?.message,

        status:
          error?.response?.status,

        data:
          error?.response?.data,

        txid:
          sanitizedTxid,

        dataDeVencimento,

        url,
      }
    );

    throw error;
  }
}

export async function removeBbPixDueCharge(
  txid: string
) {
  const accessToken =
    await getBbAccessToken();

  const appKey =
    requiredEnv("BB_APP_KEY");

  const pixApiUrl =
    requiredEnv("BB_PIX_API_URL");

  const sanitizedTxid =
    sanitizeTxid(txid);

  if (!sanitizedTxid) {
    throw new Error(
      "TXID inválido para remoção da cobrança Pix com vencimento."
    );
  }

  const url =
    `${pixApiUrl.replace(/\/$/, "")}/cobv/${encodeURIComponent(
      sanitizedTxid
    )}`;

  /*
   * Para remover uma CobV ATIVA, o padrão Pix determina
   * que o PATCH contenha somente o novo status.
   *
   * Não alterar calendário, valor, devedor ou demais campos
   * simultaneamente à remoção.
   */
  const payload = {
    status:
      "REMOVIDA_PELO_USUARIO_RECEBEDOR",
  };

  try {
    const response =
      await bbHttp().patch(
        url,
        payload,
        {
          params: {
            [bbAppKeyHeader()]:
              appKey,
          },

          headers: {
            Authorization:
              `Bearer ${accessToken}`,

            "Content-Type":
              "application/json",
          },
        }
      );

    return response.data;
  } catch (error: any) {
    console.error(
      "ERRO DETALHADO BB PIX REMOÇÃO /cobv:",
      {
        message:
          error?.message,

        status:
          error?.response?.status,

        data:
          error?.response?.data,

        txid:
          sanitizedTxid,

        url,
      }
    );

    throw error;
  }
}

