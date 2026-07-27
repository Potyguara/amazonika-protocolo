const API_URL = import.meta.env.VITE_API_URL || "http://localhost:3333";

export type LoginResponse = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: "CLIENTE" | "ATENDENTE" | "GERENTE" | "PROGRAMADOR";
    lastLoginAt?: string | null;
  };
};
export function getToken() {
  return localStorage.getItem("amazonika_token");
}

export function setAuth(
  token: string,
  role: string,
  user?: {
    id: number;
    name: string;
    email: string;
    lastLoginAt?: string | null;
  }
) {
  localStorage.setItem("amazonika_token", token);
  localStorage.setItem("amazonika_role", role);

  if (user) {
    localStorage.setItem("amazonika_user", JSON.stringify(user));
    localStorage.setItem("amazonika_login_at", new Date().toISOString());
  }
}

export function clearAuth() {
  localStorage.removeItem("amazonika_token");
  localStorage.removeItem("amazonika_role");
  localStorage.removeItem("amazonika_user");
  localStorage.removeItem("amazonika_login_at");
}

async function request<T = unknown>(path: string, options: RequestInit = {}) {
  const token = getToken();

  const isFormData = options.body instanceof FormData;

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";

  if (!response.ok) {
    let message = "Erro na comunicação com o servidor.";

    try {
      if (contentType.includes("application/json")) {
        const data = await response.json();
        message = data.message || data.error || message;
      } else {
        const text = await response.text();
        message = text || message;
      }
    } catch {
      // mantém a mensagem padrão
    }

    console.error("Erro API:", {
      path,
      status: response.status,
      statusText: response.statusText,
      message,
    });

    throw new Error(message);
  }

  if (response.status === 204) {
    return null as T;
  }

  if (!contentType.includes("application/json")) {
    return null as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
login(email: string, password: string) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
},

  me() {
    return request("/auth/me");
  },

  dashboard() {
    return request("/dashboard");
  },

  serviceTypes() {
    return request("/service-types");
  },

  clients() {
    return request("/clients");
  },

  protocols() {
    return request("/protocols");
  },

  appointments() {
    return request("/appointments");
  },

  // ================================
// FINANCEIRO PREMIUM
// ================================

financeSummary(month?: string) {
  const query = month ? `?month=${encodeURIComponent(month)}` : "";

  return request(`/finance/summary${query}`);
},

financeCategories() {
  return request("/finance/categories");
},

createFinanceCategory(data: {
  name: string;
  type: "RECEITA" | "DESPESA";
  color?: string;
  active?: boolean;
}) {
  return request("/finance/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

financeTransactions(params?: {
  month?: string;
  type?: "ENTRADA" | "SAIDA";
  status?: "PENDENTE" | "PAGO" | "CANCELADO";
  source?:
    | "CONTRATO"
    | "SERVICO_AVULSO"
    | "CUSTO_FIXO"
    | "SALARIO"
    | "IMPOSTO"
    | "TAXA"
    | "OUTRO";
  categoryId?: number | string;
  search?: string;
}) {
  const searchParams = new URLSearchParams();

  if (params?.month) searchParams.set("month", params.month);
  if (params?.type) searchParams.set("type", params.type);
  if (params?.status) searchParams.set("status", params.status);
  if (params?.source) searchParams.set("source", params.source);
  if (params?.categoryId) searchParams.set("categoryId", String(params.categoryId));
  if (params?.search) searchParams.set("search", params.search);

  const query = searchParams.toString();

  return request(`/finance/transactions${query ? `?${query}` : ""}`);
},

createFinanceTransaction(data: {
  type: "ENTRADA" | "SAIDA";
  source:
    | "CONTRATO"
    | "SERVICO_AVULSO"
    | "CUSTO_FIXO"
    | "SALARIO"
    | "IMPOSTO"
    | "TAXA"
    | "OUTRO";
  status?: "PENDENTE" | "PAGO" | "CANCELADO";
  categoryId?: number | null;
  protocolId?: number | null;
  description: string;
  amount: number;
  dueDate?: string | null;
  paidAt?: string | null;
  competenceMonth?: string;
  clientName?: string | null;
  notes?: string | null;
}) {
  return request("/finance/transactions", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateFinanceTransaction(
  id: number,
  data: {
    type?: "ENTRADA" | "SAIDA";
    source?:
      | "CONTRATO"
      | "SERVICO_AVULSO"
      | "CUSTO_FIXO"
      | "SALARIO"
      | "IMPOSTO"
      | "TAXA"
      | "OUTRO";
    status?: "PENDENTE" | "PAGO" | "CANCELADO";
    categoryId?: number | null;
    protocolId?: number | null;
    description?: string;
    amount?: number;
    dueDate?: string | null;
    paidAt?: string | null;
    competenceMonth?: string;
    clientName?: string | null;
    notes?: string | null;
  }
) {
  return request(`/finance/transactions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

payFinanceTransaction(id: number) {
  return request(`/finance/transactions/${id}/pay`, {
    method: "PATCH",
  });
},

cancelFinanceTransaction(id: number) {
  return request(`/finance/transactions/${id}`, {
    method: "DELETE",
  });
},

financeFixedCosts() {
  return request("/finance/fixed-costs");
},

createFinanceFixedCost(data: {
  description: string;
  amount: number;
  categoryId?: number | null;
  dueDay: number;
  active?: boolean;
  notes?: string | null;
}) {
  return request("/finance/fixed-costs", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateFinanceFixedCost(
  id: number,
  data: {
    description?: string;
    amount?: number;
    categoryId?: number | null;
    dueDay?: number;
    active?: boolean;
    notes?: string | null;
  }
) {
  return request(`/finance/fixed-costs/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

deleteFinanceFixedCost(id: number) {
  return request(`/finance/fixed-costs/${id}`, {
    method: "DELETE",
  });
},

financeSalaries() {
  return request("/finance/salaries");
},

createFinanceSalary(data: {
  employeeName: string;
  roleDescription?: string | null;
  amount: number;
  categoryId?: number | null;
  dueDay: number;
  active?: boolean;
  notes?: string | null;
}) {
  return request("/finance/salaries", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateFinanceSalary(
  id: number,
  data: {
    employeeName?: string;
    roleDescription?: string | null;
    amount?: number;
    categoryId?: number | null;
    dueDay?: number;
    active?: boolean;
    notes?: string | null;
  }
) {
  return request(`/finance/salaries/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

deleteFinanceSalary(id: number) {
  return request(`/finance/salaries/${id}`, {
    method: "DELETE",
  });
},


deleteUser(id: number) {
  return request(`/users/${id}`, {
    method: "DELETE",
  });
},

searchClients(search: string) {
  return request(`/clients/search?q=${encodeURIComponent(search)}`);
},

deleteFinancialTransaction(id: number) {
  return request(`/finance/transactions/${id}`, {
    method: "DELETE",
  });
},

deleteFixedCost(id: number) {
  return request(`/finance/fixed-costs/${id}`, {
    method: "DELETE",
  });
},

deleteEmployeeSalary(id: number) {
  return request(`/finance/salaries/${id}`, {
    method: "DELETE",
  });
},

deleteFinanceCategory(id: number) {
  return request(`/finance/categories/${id}`, {
    method: "DELETE",
  });
},





  publicRequest(data: {
    name: string;
    phone?: string;
    email?: string;
    serviceTypeId?: number;
    message?: string;
  }) {
    return request("/public-requests", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },
  managers() {
  return request("/users/managers");
},

appointmentAvailability(managerUserId: number, date: string) {
  return request(
    `/appointments/availability?managerUserId=${managerUserId}&date=${date}`
  );
},

createAppointment(data: {
  protocolId: number;
  clientId: number;
  managerUserId: number;
  scheduledAt: string;
  durationMinutes: number;
  meetingType?: string;
  location?: string;
  meetingLink?: string;
  notes?: string;
}) {
  return request("/appointments", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

createClient(data: {
  name: string;
  personType?: string;
  cpfCnpj?: string;
  phone?: string;
  whatsapp?: string;
  email?: string;
  address?: string;
  city?: string;
  state?: string;
  notes?: string;
}) {
  return request("/clients", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

createProtocol(data: {
  clientId: number;
  serviceTypeId: number;
  description?: string;
  priority?: string;
  estimatedValue?: number;
  deadlineDate?: string;
}) {
  return request("/protocols", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

uploadProtocolDocument(protocolId: number, file: File, documentType: string) {
  const token = getToken();
  const formData = new FormData();

  formData.append("file", file);
  formData.append("documentType", documentType);

  return fetch(`${API_URL}/protocols/${protocolId}/documents`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  }).then(async (response) => {
    const data = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(data?.message || "Erro ao enviar documento.");
    }

    return data;
  });
},

users() {
  return request("/users");
},

createUser(data: {
  name: string;
  email: string;
  password: string;
  role: string;
  active: boolean;
}) {
  return request("/users", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateUser(
  id: number,
  data: {
    name: string;
    email: string;
    password?: string;
    role: string;
    active: boolean;
  }
) {
  return request(`/users/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
},

toggleUserActive(id: number) {
  return request(`/users/${id}/toggle-active`, {
    method: "PATCH",
  });
},

auditLogs() {
  return request("/audit-logs");
},

updateProtocol(
  id: number,
  data: {
    serviceTypeId?: number;
    description?: string;
    priority?: string;
    estimatedValue?: number;
    finalValue?: number;
    deadlineDate?: string;
    status?: string;
    responsibleUserId?: number;
  }
) {
  return request(`/protocols/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
},

deleteProtocol(id: number, reason?: string) {
  return request(`/protocols/${id}`, {
    method: "DELETE",
    body: JSON.stringify({ reason }),
  });
},

resendAppointmentEmail(protocolId: number) {
  return request(`/protocols/${protocolId}/resend-email`, {
    method: "POST",
  });
},
protocolById(id: number) {
  return request(`/protocols/${id}`);
},

fileUrl(path: string) {
  return `${API_URL}${path}`;
},
updateClient(
  id: number,
  data: {
    name: string;
    personType?: string;
    cpfCnpj?: string;
    phone?: string;
    whatsapp?: string;
    email?: string;
    address?: string;
    city?: string;
    state?: string;
    notes?: string;
  }
) {
  return request(`/clients/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
},

updateAppointment(
  id: number,
  data: {
    managerUserId?: number;
    scheduledAt?: string;
    durationMinutes?: number;
    timezone?: string;
    meetingType?: string;
    location?: string;
    meetingLink?: string;
    notes?: string;
    status?: string;
  }
) {
  return request(`/appointments/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
},

deleteAppointment(id: number) {
  return request(`/appointments/${id}`, {
    method: "DELETE",
  });
},

smtpSettings() {
  return request("/settings/smtp");
},

updateSmtpSettings(data: {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass?: string;
  smtpFrom: string;
  smtpSecure: boolean;
  companyAlertEmail: string;
}) {
  return request("/settings/smtp", {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

testSmtp(data: { testEmail: string }) {
  return request("/settings/smtp/test", {
    method: "POST",
    body: JSON.stringify(data),
  });
},
companySettings() {
  return request("/settings/company");
},

updateCompanySettings(data: any) {
  return request("/settings/company", {
    method: "PUT",
    body: JSON.stringify(data),
  });
},


managementSummary(month: string) {
  return request(`/finance/summary?month=${encodeURIComponent(month)}`);
},

managementProLaboreSummary(month: string) {
  return request(
    `/management/pro-labore-summary?month=${encodeURIComponent(month)}`
  );
},

managementCashSetting(month: string) {
  return request(
    `/management/cash-setting?month=${encodeURIComponent(month)}`
  );
},

updateManagementCashSetting(data: {
  competenceMonth: string;
  cashPercent: number;
  notes?: string | null;
}) {
  return request("/management/cash-setting", {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

proLaboreAdvances(month: string) {
  return request(
    `/management/pro-labore-advances?month=${encodeURIComponent(month)}`
  );
},

managementProLaboreAdvances(month: string) {
  return request(
    `/management/pro-labore-advances?month=${encodeURIComponent(month)}`
  );
},

createProLaboreAdvance(data: {
  managerUserId: number;
  competenceMonth: string;
  amount: number;
  paidAt?: string;
  description?: string;
  notes?: string;
}) {
  return request("/management/pro-labore-advances", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateProLaboreAdvance(
  id: number,
  data: {
    managerUserId: number;
    competenceMonth: string;
    amount: number;
    paidAt?: string;
    description?: string;
    notes?: string;
  }
) {
  return request(`/management/pro-labore-advances/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

deleteProLaboreAdvance(id: number) {
  return request(`/management/pro-labore-advances/${id}`, {
    method: "DELETE",
  });
},

proposals(protocolId?: number) {
  const query = protocolId ? `?protocolId=${protocolId}` : "";
  return request(`/proposals${query}`);
},

proposalById(id: number) {
  return request(`/proposals/${id}`);
},

createProposal(data: {
  protocolId: number;
  title: string;
  description?: string | null;
  technicalScope?: string | null;
  paymentMode: string;
  entryAmount?: number;
  installmentQty?: number | null;
  executionDays?: number | null;
  validUntil?: string | null;
  clientMessage?: string | null;
  internalNotes?: string | null;
  items: Array<{
    serviceName: string;
    description?: string | null;
    quantity: number;
    unitAmount: number;
  }>;
}) {
  return request("/proposals", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateProposal(
  id: number,
  data: {
    title: string;
    description?: string | null;
    technicalScope?: string | null;
    paymentMode: string;
    entryAmount?: number;
    installmentQty?: number | null;
    executionDays?: number | null;
    validUntil?: string | null;
    clientMessage?: string | null;
    internalNotes?: string | null;
    items: Array<{
      serviceName: string;
      description?: string | null;
      quantity: number;
      unitAmount: number;
    }>;
  }
) {
  return request(`/proposals/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

sendProposal(id: number) {
  return request(`/proposals/${id}/send`, {
    method: "POST",
  });
},

publicProposal(token: string) {
  return request(`/public/proposals/${token}`);
},

acceptPublicProposal(token: string) {
  return request(`/public/proposals/${token}/accept`, {
    method: "POST",
  });
},

requestPublicProposalAdjustment(token: string, message: string) {
  return request(`/public/proposals/${token}/request-adjustment`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
},

refusePublicProposal(token: string, message: string) {
  return request(`/public/proposals/${token}/refuse`, {
    method: "POST",
    body: JSON.stringify({ message }),
  });
},

proposalHistory(protocolId: number) {
  return request(`/protocols/${protocolId}/proposal-history`);
},

sendProposalEmail(id: number) {
  return request(`/proposals/${id}/send-email`, {
    method: "POST",
  });
},

generateContractFromProposal(proposalId: number) {
  return request(`/proposals/${proposalId}/generate-contract`, {
    method: "POST",
  });
},

contracts(protocolId?: number) {
  const query = protocolId ? `?protocolId=${encodeURIComponent(protocolId)}` : "";
  return request(`/contracts${query}`);
},

contractById(id: number) {
  return request(`/contracts/${id}`);
},

sendContract(id: number) {
  return request(`/contracts/${id}/send`, {
    method: "POST",
  });
},

publicContract(token: string) {
  return request(`/public/contracts/${token}`);
},

signPublicContract(
  token: string,
  data: {
    signerName: string;
    signerCpfCnpj: string;
    signerEmail: string;
  }
) {
  return request(`/public/contracts/${token}/sign`, {
    method: "POST",
    body: JSON.stringify(data),
  });
},
generateEntryCharge(contractId: number, data?: {
  dueDate?: string;
  description?: string;
  notes?: string;
}) {
  return request(`/contracts/${contractId}/generate-entry-charge`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
},

billingCharges(protocolId?: number) {
  const query = protocolId ? `?protocolId=${encodeURIComponent(protocolId)}` : "";
  return request(`/billing-charges${query}`);
},

billingChargeById(id: number) {
  return request(`/billing-charges/${id}`);
},

selectBillingFiscalMode(
  id: number,
  data: {
    fiscalMode: "NOTA_FISCAL_ANTES" | "RECIBO_POSTERIOR";
    notes?: string;
  }
) {
  return request(`/billing-charges/${id}/select-fiscal-mode`, {
    method: "POST",
    body: JSON.stringify(data),
  });
},

uploadBillingFiscalDocument(
  billingChargeId: number,
  file: File,
  data: {
    type: "NOTA_FISCAL" | "RECIBO" | "COMPROVANTE" | "OUTRO";
    moment: "PRE_COBRANCA" | "POS_PAGAMENTO";
    number?: string;
    issuedAt?: string;
    amount?: number;
    notes?: string;
  }
) {
  const token = getToken();
  const formData = new FormData();

  formData.append("file", file);
  formData.append("type", data.type);
  formData.append("moment", data.moment);

  if (data.number) formData.append("number", data.number);
  if (data.issuedAt) formData.append("issuedAt", data.issuedAt);
  if (data.amount !== undefined) formData.append("amount", String(data.amount));
  if (data.notes) formData.append("notes", data.notes);

  return fetch(`${API_URL}/billing-charges/${billingChargeId}/fiscal-documents`, {
    method: "POST",
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  }).then(async (response) => {
    const result = await response.json().catch(() => null);

    if (!response.ok) {
      throw new Error(result?.message || "Erro ao enviar documento fiscal.");
    }

    return result;
  });
},

emitBillingCharge(id: number) {
  return request(`/billing-charges/${id}/emit`, {
    method: "POST",
  });
},

sendBillingCharge(id: number) {
  return request(`/billing-charges/${id}/send`, {
    method: "POST",
  });
},

markBillingChargePaid(
  id: number,
  data?: {
    paidAt?: string;
    paidAmount?: number;
    notes?: string;
  }
) {
  return request(`/billing-charges/${id}/mark-paid`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
},

publicBillingCharge(id: number) {
  return request(`/public/billing-charges/${id}`);
},

issueBbPixPayment(paymentId: number) {
  return request(`/payments/${paymentId}/issue-bb-pix`, {
    method: "POST",
  });
},

bbPixPaymentStatus(paymentId: number) {
  return request(`/payments/${paymentId}/bb-pix-status`);
},

reissueBillingPix(id: number) {
  return request(`/billing-charges/${id}/reissue-pix`, {
    method: "POST",
  });
},

generateInstallmentCharges(
  contractId: number,
  data?: {
    firstDueDate?: string;
    intervalDays?: number;
    fiscalMode?: "NOTA_FISCAL_ANTES" | "RECIBO_POSTERIOR";
    notes?: string;
  }
) {
  return request(`/contracts/${contractId}/generate-installment-charges`, {
    method: "POST",
    body: JSON.stringify(data || {}),
  });
},

};