import axios from "axios";

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

function normalizeDocument(value?: string | null) {
  return String(value || "").replace(/\D/g, "");
}

function moneyToBbValue(amountInCents: number) {
  return (Number(amountInCents || 0) / 100).toFixed(2);
}

function sanitizeTxid(value: string) {
  return String(value || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 35);
}

export async function getBbAccessToken() {
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

  const response = await axios.post<BbTokenResponse>(oauthUrl, params, {
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
  const response = await axios.put(url, payload, {
    params: {
      "gw-dev-app-key": appKey,
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
      "gw-dev-app-key": appKey ? "***APP_KEY_PRESENTE***" : null,
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

  const response = await axios.get(url, {
    params: {
      "gw-dev-app-key": appKey,
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

  if (document.length === 11) {
    payload.devedor = {
      cpf: document,
      nome: input.debtorName.slice(0, 200),
    };
  }

  if (document.length === 14) {
    payload.devedor = {
      cnpj: document,
      nome: input.debtorName.slice(0, 200),
    };
  }

  const url = `${pixApiUrl.replace(/\/$/, "")}/cobv/${encodeURIComponent(
    txid
  )}`;

try {
  const response = await axios.put(url, payload, {
    params: {
      "gw-dev-app-key": appKey,
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
      "gw-dev-app-key": appKey ? "***APP_KEY_PRESENTE***" : null,
    },
    payload,
  });

  throw error;
}
}