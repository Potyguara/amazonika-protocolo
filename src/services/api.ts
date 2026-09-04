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

async function requestBlob(
  path: string,
  options: RequestInit = {}
) {
  const token = getToken();

  const response = await fetch(
    `${API_URL}${path}`,
    {
      ...options,
      headers: {
        "ngrok-skip-browser-warning": "true",
        ...(token
          ? {
              Authorization:
                `Bearer ${token}`,
            }
          : {}),
        ...(options.headers || {}),
      },
    }
  );

  if (!response.ok) {
    let message =
      "Erro ao carregar arquivo.";

    try {
      const contentType =
        response.headers.get(
          "content-type"
        ) || "";

      if (
        contentType.includes(
          "application/json"
        )
      ) {
        const data =
          await response.json();

        message =
          data.message ||
          data.error ||
          message;
      } else {
        const text =
          await response.text();

        message =
          text || message;
      }
    } catch {
      // mantém mensagem padrão
    }

    throw new Error(message);
  }

  const blob =
    await response.blob();

  return {
    blob,
    contentType:
      response.headers.get(
        "content-type"
      ),
    contentDisposition:
      response.headers.get(
        "content-disposition"
      ),
  };
}

export const api = {
login(email: string, password: string) {
  return request("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
},

  forgotPassword(email: string) {
    return request("/auth/forgot-password", {
      method: "POST",
      body: JSON.stringify({
        email,
      }),
    });
  },

  validatePasswordResetToken(
    token: string
  ) {
    const query =
      new URLSearchParams({
        token,
      });

    return request(
      `/auth/reset-password/validate?${query.toString()}`
    );
  },

  resetPassword(
    token: string,
    password: string
  ) {
    return request(
      "/auth/reset-password",
      {
        method: "POST",
        body: JSON.stringify({
          token,
          password,
        }),
      }
    );
  },

  me() {
    return request("/auth/me");
  },

  dashboard() {
    return request("/dashboard");
  },

  // ================================
  // PROPOSTAS AVULSAS
  // ================================

  standaloneProposalSummary() {
    return request("/standalone-proposals/summary");
  },

  standaloneProposals(params?: {
    search?: string;
    status?: string;
  }) {
    const query = new URLSearchParams();

    if (params?.search) {
      query.set("search", params.search);
    }

    if (params?.status) {
      query.set("status", params.status);
    }

    const suffix = query.toString();

    return request(
      `/standalone-proposals${suffix ? `?${suffix}` : ""}`
    );
  },

  standaloneProposal(id: number) {
    return request(`/standalone-proposals/${id}`);
  },

  createStandaloneProposal(data: Record<string, unknown>) {
    return request("/standalone-proposals", {
      method: "POST",
      body: JSON.stringify(data),
    });
  },

  updateStandaloneProposal(
    id: number,
    data: Record<string, unknown>
  ) {
    return request(`/standalone-proposals/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    });
  },

  generateStandaloneProposalPdf(id: number) {
    return request(`/standalone-proposals/${id}/generate-pdf`, {
      method: "POST",
    });
  },

  sendStandaloneProposalEmail(
    id: number,
    data?: {
      email?: string;
    }
  ) {
    return request(
      `/standalone-proposals/${id}/send-email`,
      {
        method: "POST",
        body: JSON.stringify(data || {}),
      }
    );
  },

  approveStandaloneProposalVerbally(
    id: number,
    data: {
      approvedBy: string;
      note?: string | null;
    }
  ) {
    return request(
      `/standalone-proposals/${id}/approve-verbal`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  cancelStandaloneProposal(
    id: number,
    data?: {
      reason?: string | null;
    }
  ) {
    return request(
      `/standalone-proposals/${id}/cancel`,
      {
        method: "POST",
        body: JSON.stringify(data || {}),
      }
    );
  },

  duplicateStandaloneProposal(id: number) {
    return request(
      `/standalone-proposals/${id}/duplicate`,
      {
        method: "POST",
      }
    );
  },

  standaloneProposalPdfBlob(id: number) {
    return requestBlob(
      `/standalone-proposals/${id}/pdf`
    );
  },

  addStandaloneProposalAttachment(
    proposalId: number,
    data: {
      title: string;
      description?: string | null;
    }
  ) {
    return request(
      `/standalone-proposals/${proposalId}/attachments`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  uploadStandaloneProposalAttachment(
    proposalId: number,
    data: {
      title: string;
      description?: string | null;
      file: File;
    }
  ) {
    const formData = new FormData();

    formData.append("title", data.title);

    if (data.description) {
      formData.append(
        "description",
        data.description
      );
    }

    formData.append(
      "file",
      data.file
    );

    return request(
      `/standalone-proposals/${proposalId}/attachments/file`,
      {
        method: "POST",
        body: formData,
      }
    );
  },

  deleteStandaloneProposalAttachment(
    proposalId: number,
    attachmentId: number
  ) {
    return request(
      `/standalone-proposals/${proposalId}/attachments/${attachmentId}`,
      {
        method: "DELETE",
      }
    );
  },

  addStandaloneProposalCatalogItem(
    proposalId: number,
    data: {
      catalogServiceId: number;
      quantity?: number;
      unitAmount?: number;

      // Texto curto exibido na tabela comercial.
      summaryDescription?: string | null;

      // Descrição comercial detalhada.
      commercialDescription?: string | null;

      // Campo legado, mantido para compatibilidade.
      description?: string | null;

      // Conteúdo técnico detalhado.
      technicalDescription?: string | null;

      // Fundamentação legal/normativa.
      legalText?: string | null;
    }
  ) {
    return request(
      `/standalone-proposals/${proposalId}/items/catalog`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  addStandaloneProposalManualItem(
    proposalId: number,
    data: {
      serviceName: string;

      // Texto curto exibido na tabela comercial.
      summaryDescription?: string | null;

      // Descrição comercial detalhada.
      commercialDescription?: string | null;

      // Campo legado, mantido para compatibilidade.
      description?: string | null;

      // Conteúdo técnico detalhado.
      technicalDescription?: string | null;

      // Fundamentação legal/normativa.
      legalText?: string | null;

      quantity?: number;
      unitLabel?: string | null;
      unitAmount: number;
    }
  ) {
    return request(
      `/standalone-proposals/${proposalId}/items/manual`,
      {
        method: "POST",
        body: JSON.stringify(data),
      }
    );
  },

  updateStandaloneProposalItem(
    proposalId: number,
    itemId: number,
    data: {
      serviceName?: string;

      summaryDescription?: string | null;
      commercialDescription?: string | null;

      // Campo legado.
      description?: string | null;

      technicalDescription?: string | null;
      legalText?: string | null;

      quantity?: number;
      unitLabel?: string | null;
      unitAmount?: number;
      sortOrder?: number;
    }
  ) {
    return request(
      `/standalone-proposals/${proposalId}/items/${itemId}`,
      {
        method: "PUT",
        body: JSON.stringify(data),
      }
    );
  },

  deleteStandaloneProposalItem(
    proposalId: number,
    itemId: number
  ) {
    return request(
      `/standalone-proposals/${proposalId}/items/${itemId}`,
      {
        method: "DELETE",
      }
    );
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
    | "COMISSAO_PARCEIRO"
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
    | "COMISSAO_PARCEIRO"
    | "IMPOSTO"
    | "TAXA"
    | "OUTRO";

  status?:
    | "PENDENTE"
    | "PAGO"
    | "CANCELADO";

  categoryId?: number | null;
  protocolId?: number | null;
  clientId?: number | null;

  description: string;

  /*
   * Valor TOTAL do serviço.
   */
  amount: number;

  /*
   * Mantidos para lançamento simples.
   */
  dueDate?: string | null;
  paidAt?: string | null;
  competenceMonth?: string;

  clientName?: string | null;
  notes?: string | null;

  /*
   * ================================================
   * FINANCEIRO V2
   * ================================================
   */

  entryAmount?: number;

  entryStatus?:
    | "PENDENTE"
    | "PAGO"
    | "CANCELADO";

  entryDueDate?: string | null;
  entryPaidAt?: string | null;

  entryAutoChargeEnabled?: boolean;

  installments?: Array<{
    /*
     * Valor individual.
     * As parcelas NÃO precisam ser iguais.
     */
    amount: number;

    /*
     * Vencimento individual.
     */
    dueDate: string;

    /*
     * Preparação Pix/webhook.
     */
    autoChargeEnabled?: boolean;
  }>;

  /*
   * Campos antigos temporariamente aceitos
   * durante a transição da interface.
   */
  installmentQty?: number;

  installmentSchedule?: Array<{
    dueDate: string;
  }>;

  autoChargeEnabled?: boolean;
}) {
  return request(
    "/finance/transactions",
    {
      method: "POST",
      body: JSON.stringify(data),
    }
  );
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
    clientId?: number | null;
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


// ================================
// PARCEIROS
// ================================

partners(includeInactive = false) {
  const query = includeInactive
    ? "?includeInactive=true"
    : "";

  return request(`/partners${query}`);
},


partnerReferral(protocolId: number) {
  return request(
    `/protocols/${protocolId}/partner-referral`
  );
},

savePartnerReferral(
  protocolId: number,
  data: {
    partnerId: number;
    percent?: number;
  }
) {
  return request(
    `/protocols/${protocolId}/partner-referral`,
    {
      method: "PUT",
      body: JSON.stringify(data),
    }
  );
},

removePartnerReferral(protocolId: number) {
  return request(
    `/protocols/${protocolId}/partner-referral`,
    {
      method: "DELETE",
    }
  );
},


partnerCommissions(status?: string) {
  const query = status
    ? `?status=${encodeURIComponent(status)}`
    : "";

  return request(
    `/partner-commissions${query}`
  );
},

payPartnerCommission(
  id: number,
  data?: {
    paidAt?: string;
    notes?: string;
  }
) {
  return request(
    `/partner-commissions/${id}/pay`,
    {
      method: "POST",
      body: JSON.stringify(data || {}),
    }
  );
},

partnerRanking(
  period: "all" | "month" | "last3months" | "year" | string = "all"
) {
  return request(
    `/partners/ranking?period=${encodeURIComponent(period)}`
  );
},

createPartner(data: {
  name: string;
  cpfCnpj?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  pixKey?: string | null;
  defaultPercent: number;
  active?: boolean;
  notes?: string | null;
}) {
  return request("/partners", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updatePartner(
  id: number,
  data: {
    name: string;
    cpfCnpj?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    email?: string | null;
    pixKey?: string | null;
    defaultPercent: number;
    active?: boolean;
    notes?: string | null;
  }
) {
  return request(`/partners/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  });
},

togglePartnerActive(id: number) {
  return request(`/partners/${id}/toggle-active`, {
    method: "PATCH",
  });
},



// ==========================================
// CATÁLOGO TÉCNICO-COMERCIAL
// ==========================================

// ==========================================
// CRONOGRAMA DE CAMPO
// ==========================================

fieldScheduleSummary() {
  return request("/field-schedules/summary");
},

fieldScheduleManagers() {
  return request("/field-schedules/managers");
},

fieldSchedules(params?: {
  search?: string;
  status?: string;
  type?: string;
  from?: string;
  to?: string;
}) {
  const query = new URLSearchParams();

  if (params?.search) {
    query.set("search", params.search);
  }

  if (params?.status) {
    query.set("status", params.status);
  }

  if (params?.type) {
    query.set("type", params.type);
  }

  if (params?.from) {
    query.set("from", params.from);
  }

  if (params?.to) {
    query.set("to", params.to);
  }

  const suffix = query.toString();

  return request(
    `/field-schedules${suffix ? `?${suffix}` : ""}`
  );
},

fieldSchedule(id: number) {
  return request(`/field-schedules/${id}`);
},

createFieldSchedule(
  data: Record<string, unknown>
) {
  return request("/field-schedules", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateFieldSchedule(
  id: number,
  data: Record<string, unknown>
) {
  return request(`/field-schedules/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

updateFieldScheduleStatus(
  id: number,
  status: string
) {
  return request(
    `/field-schedules/${id}/status`,
    {
      method: "PATCH",
      body: JSON.stringify({
        status,
      }),
    }
  );
},

deleteFieldSchedule(
  id: number
) {
  return request(
    `/field-schedules/${id}`,
    {
      method: "DELETE",
    }
  );
},

processFieldScheduleNotifications(
  limit = 50
) {
  return request(
    "/field-schedules/process-notifications",
    {
      method: "POST",
      body: JSON.stringify({
        limit,
      }),
    }
  );
},

retryFieldScheduleNotification(
  notificationId: number
) {
  return request(
    `/field-schedules/notifications/${notificationId}/retry`,
    {
      method: "POST",
    }
  );
},


// ==========================================
// CATÁLOGO TÉCNICO-COMERCIAL
// ==========================================

catalogSummary() {
  return request("/catalog/summary");
},

catalogCategories(includeInactive = true) {
  const query = includeInactive
    ? "?includeInactive=true"
    : "";

  return request(`/catalog/categories${query}`);
},

createCatalogCategory(data: {
  name: string;
  code?: string;
  description?: string | null;
  sortOrder?: number;
  active?: boolean;
}) {
  return request("/catalog/categories", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateCatalogCategory(
  id: number,
  data: {
    name?: string;
    code?: string;
    description?: string | null;
    sortOrder?: number;
    active?: boolean;
  }
) {
  return request(`/catalog/categories/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

catalogServices(params?: {
  includeInactive?: boolean;
  categoryId?: number;
  search?: string;
}) {
  const query = new URLSearchParams();

  if (params?.includeInactive) {
    query.set("includeInactive", "true");
  }

  if (params?.categoryId) {
    query.set(
      "categoryId",
      String(params.categoryId)
    );
  }

  if (params?.search) {
    query.set("search", params.search);
  }

  const suffix = query.toString();

  return request(
    `/catalog/services${suffix ? `?${suffix}` : ""}`
  );
},

catalogServiceById(id: number) {
  return request(`/catalog/services/${id}`);
},

createCatalogService(data: {
  categoryId: number;
  code?: string;
  name: string;
  acronym?: string | null;
  shortDescription?: string | null;
  proposalDescription?: string | null;
  technicalDescription?: string | null;
  legalText?: string | null;
  pricingMode:
    | "FIXO"
    | "POR_HECTARE"
    | "POR_KM"
    | "POR_UNIDADE"
    | "POR_MODULO_FISCAL"
    | "POR_DIARIA"
    | "POR_HORA"
    | "POR_FAIXA"
    | "SOB_CONSULTA";
  baseAmount?: number;
  minimumAmount?: number | null;
  unitLabel?: string | null;
  defaultExecutionDays?: number | null;
  allowManualPrice?: boolean;
  sortOrder?: number;
  active?: boolean;
}) {
  return request("/catalog/services", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateCatalogService(
  id: number,
  data: {
    categoryId?: number;
    code?: string;
    name?: string;
    acronym?: string | null;
    shortDescription?: string | null;
    proposalDescription?: string | null;
    technicalDescription?: string | null;
    legalText?: string | null;
    pricingMode?:
      | "FIXO"
      | "POR_HECTARE"
      | "POR_KM"
      | "POR_UNIDADE"
      | "POR_MODULO_FISCAL"
      | "POR_DIARIA"
      | "POR_HORA"
      | "POR_FAIXA"
      | "SOB_CONSULTA";
    baseAmount?: number;
    minimumAmount?: number | null;
    unitLabel?: string | null;
    defaultExecutionDays?: number | null;
    allowManualPrice?: boolean;
    sortOrder?: number;
    active?: boolean;
  }
) {
  return request(`/catalog/services/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

updateCatalogPricingTiers(
  id: number,
  tiers: Array<{
    minQuantity?: number | null;
    maxQuantity?: number | null;
    unitAmount: number;
    minimumAmount?: number | null;
    sortOrder?: number;
    active?: boolean;
  }>
) {
  return request(
    `/catalog/services/${id}/pricing-tiers`,
    {
      method: "PUT",
      body: JSON.stringify({ tiers }),
    }
  );
},

catalogPackages(includeInactive = true) {
  const query = includeInactive
    ? "?includeInactive=true"
    : "";

  return request(`/catalog/packages${query}`);
},

createCatalogPackage(data: {
  name: string;
  code?: string;
  description?: string | null;
  proposalDescription?: string | null;
  active?: boolean;
}) {
  return request("/catalog/packages", {
    method: "POST",
    body: JSON.stringify(data),
  });
},

updateCatalogPackage(
  id: number,
  data: {
    name?: string;
    code?: string;
    description?: string | null;
    proposalDescription?: string | null;
    active?: boolean;
  }
) {
  return request(`/catalog/packages/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
},

updateCatalogPackageItems(
  id: number,
  items: Array<{
    serviceId: number;
    quantity?: number;
    required?: boolean;
    sortOrder?: number;
  }>
) {
  return request(`/catalog/packages/${id}/items`, {
    method: "PUT",
    body: JSON.stringify({ items }),
  });
},

};