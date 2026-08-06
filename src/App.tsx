import "./App.css";
import PartnersFinanceTab from "./components/finance/PartnersFinanceTab";
import { api, setAuth, clearAuth } from "./services/api";
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock,
  FileText,
  LayoutDashboard,
  Lock,
  LogOut,
  MapPin,
  Menu,
  MessageCircle,
  Settings,
  WalletCards,
  X,
  Eye,
  EyeOff,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  Link,
  NavLink,
  Navigate,
  Outlet,
  Route,
  Routes,
  useNavigate,
  useParams,
} from "react-router-dom";
import { QRCodeCanvas } from "qrcode.react";


function PublicBillingChargePage() {
  const { id } = useParams();

  const [charge, setCharge] = useState<BackendBillingCharge | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copySuccess, setCopySuccess] = useState("");

  async function loadCharge() {
    try {
      setLoading(true);
      setError("");
      setCopySuccess("");

      if (!id) {
        throw new Error("ID da cobrança não informado.");
      }

      const data = (await api.publicBillingCharge(
        Number(id)
      )) as BackendBillingCharge;

      setCharge(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar cobrança."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCharge();
  }, [id]);

  async function copyPixCode() {
    try {
      if (!charge?.pixCopyPaste) {
        throw new Error("Código Pix ainda não disponível.");
      }

      await navigator.clipboard.writeText(charge.pixCopyPaste);
      setCopySuccess("Código Pix copiado com sucesso.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Não foi possível copiar o Pix."
      );
    }
  }

  if (loading) {
    return (
      <main className="public-billing-page">
        <section className="public-billing-shell">
          <div className="panel">Carregando cobrança...</div>
        </section>
      </main>
    );
  }

  if (error && !charge) {
    return (
      <main className="public-billing-page">
        <section className="public-billing-shell">
          <div className="panel error-panel">{error}</div>

          <Link to="/" className="hero-btn primary">
            Voltar ao site
          </Link>
        </section>
      </main>
    );
  }

  if (!charge) return null;

  const isPaid = charge.status === "PAGA";
  const hasPix = Boolean(charge.pixCopyPaste);

  return (
    <main className="public-billing-page">
      <section className="public-billing-shell">
        <header className="public-billing-header">
          <div className="public-proposal-logo-box">
            <img
              src="/brand/logo-amazonika.png"
              alt="AMAZONIKA Engenharia & Meio Ambiente"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div>
            <span className="eyebrow">Cobrança da entrada</span>

            <h1>Pagamento para início dos serviços</h1>

            <p>
              Protocolo{" "}
              <strong>{charge.protocol?.protocolNumber || "-"}</strong> ·{" "}
              {charge.protocol?.serviceType?.name || "-"}
            </p>
          </div>

          <span className={`badge billing-${billingStatusClass(charge.status)}`}>
            {billingStatusLabel(charge.status)}
          </span>
        </header>

        <section className="public-billing-grid">
          <article className="panel public-billing-main">
            <h2>{charge.description}</h2>

            <div className="billing-public-kpis">
              <div>
                <span>Valor</span>
                <strong>{money(charge.amount)}</strong>
              </div>

              <div>
                <span>Vencimento</span>
                <strong>{formatDate(charge.dueDate)}</strong>
              </div>

              <div>
                <span>Contrato</span>
                <strong>{charge.contract?.contractNumber || "-"}</strong>
              </div>
            </div>

            {copySuccess && (
              <div className="panel success-panel">{copySuccess}</div>
            )}

            {error && <div className="panel error-panel">{error}</div>}

            {isPaid ? (
              <div className="success-panel">
                Pagamento confirmado. A equipe técnica já foi liberada para
                mobilização e execução dos serviços.
              </div>
            ) : (
              <>
                {hasPix ? (
                  <section className="pix-public-payment-box">
                    <div className="pix-public-qrcode-card">
                      <span className="eyebrow">PIX BANCO DO BRASIL</span>

                      <QRCodeCanvas
                        value={charge.pixCopyPaste || ""}
                        size={260}
                        level="M"
                        includeMargin
                      />

                      <p>
                        Escaneie o QR Code com o aplicativo do seu banco para
                        pagar a entrada.
                      </p>
                    </div>

                    <div className="pix-public-copy-card">
                      <h3>Pix copia e cola</h3>

                      <p>
                        Também é possível copiar o código abaixo e colar no
                        aplicativo do banco.
                      </p>

                      <textarea
                        readOnly
                        value={charge.pixCopyPaste || ""}
                        rows={7}
                      />

                      <button
                        className="button primary"
                        type="button"
                        onClick={copyPixCode}
                      >
                        Copiar código Pix
                      </button>

                      <small>
                        Após o pagamento, a confirmação será realizada pela
                        equipe da AMAZONIKA ou automaticamente quando a
                        integração bancária estiver em produção.
                      </small>
                    </div>
                  </section>
                ) : (
                  <div className="public-payment-box">
                    <h3>Pix ainda não disponível</h3>

                    <p>
                      A cobrança foi registrada, mas o código Pix ainda não foi
                      emitido. Aguarde o envio da cobrança pela equipe da
                      AMAZONIKA.
                    </p>
                  </div>
                )}

                {charge.linhaDigitavel && (
                  <div className="public-payment-box">
                    <h3>Linha digitável do boleto</h3>
                    <p>{charge.linhaDigitavel}</p>
                  </div>
                )}
              </>
            )}

            {(charge.fiscalDocuments || []).length > 0 && (
              <div className="public-fiscal-documents">
                <h3>Documentos fiscais</h3>

                {(charge.fiscalDocuments || []).map((document) => (
                  <div key={document.id} className="billing-document-row">
                    <div>
                      <strong>{fiscalDocumentTypeLabel(document.type)}</strong>

                      <small>
                        {document.number ? `Nº ${document.number} · ` : ""}
                        {formatDateTime(document.createdAt)}
                      </small>
                    </div>

                    <a
                      className="mini-button"
                      href={api.fileUrl(document.filePath)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Abrir
                    </a>
                  </div>
                ))}
              </div>
            )}
          </article>

          <aside className="panel public-billing-side">
            <h2>Orientações</h2>

            <p>
              Após a confirmação do pagamento, a AMAZONIKA libera a mobilização
              da equipe técnica e inicia a contagem do prazo previsto no
              contrato.
            </p>

            <p>
              Em caso de dúvidas, entre em contato com a equipe responsável pelo
              atendimento do seu protocolo.
            </p>

            <div className="billing-guidance-box">
              <strong>Pagamento via Pix</strong>
              <span>
                Use o QR Code ou o código Pix copia e cola disponível nesta
                página.
              </span>
            </div>

            <Link to="/" className="hero-btn primary full">
              Voltar ao site
            </Link>
          </aside>
        </section>
      </section>
    </main>
  );
}

type BackendProposalItem = {
  id: number;
  proposalId: number;
  serviceName: string;
  description?: string | null;
  quantity: number;
  unitAmount: number;
  totalAmount: number;
  sortOrder: number;
};

type BackendProposal = {
  id: number;
  proposalNumber: string;
  protocolId: number;
  clientId: number;
  createdById?: number | null;

  status:
    | "RASCUNHO"
    | "ENVIADA"
    | "ACEITA"
    | "RECUSADA"
    | "AJUSTE_SOLICITADO"
    | "EXPIRADA"
    | "CONVERTIDA_EM_CONTRATO"
    | "CANCELADA";

  title: string;
  description?: string | null;
  technicalScope?: string | null;

  paymentMode:
    | "A_VISTA"
    | "ENTRADA_PARCELAS"
    | "PARCELADO"
    | "PERSONALIZADO";

  totalAmount: number;
  entryAmount: number;
  installmentQty?: number | null;
  installmentAmount?: number | null;

  executionDays?: number | null;
  validUntil?: string | null;

  sentAt?: string | null;
  acceptedAt?: string | null;
  refusedAt?: string | null;
  adjustmentRequestedAt?: string | null;

  clientMessage?: string | null;
  internalNotes?: string | null;
  publicToken: string;

  createdAt: string;
  updatedAt?: string;

  client?: {
    id: number;
    name: string;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    cpfCnpj?: string | null;
  };

  protocol?: {
    id: number;
    protocolNumber: string;
    status?: string;
    serviceType?: {
      id: number;
      name: string;
    };
  };

  createdBy?: {
    id: number;
    name: string;
    email: string;
  };

  items: BackendProposalItem[];
};

type ProposalFormItem = {
  serviceName: string;
  description: string;
  quantity: string;
  unitAmount: string;
};

type BackendProposalHistory = {
  id: number;
  protocolId: number;
  proposalId?: number | null;
  eventType: string;
  title: string;
  description?: string | null;
  recipient?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  metadata?: string | null;
  createdById?: number | null;
  createdAt: string;
};

type Role = "CLIENTE" | "ATENDENTE" | "GERENTE" | "PROGRAMADOR";

type ProtocolStatus =
  | "NOVO"
  | "AGENDADO"
  | "REUNIAO_REALIZADA"
  | "PROPOSTA_ENVIADA"
  | "ACORDO_FECHADO"
  | "CONTRATO_ENVIADO"
  | "AGUARDANDO_ASSINATURA"
  | "CONTRATO_ASSINADO"
  | "EM_EXECUCAO"
  | "AGUARDANDO_DOCUMENTOS"
  | "AGUARDANDO_ORGAO_PUBLICO"
  | "FINALIZADO"
  | "CANCELADO";

type Protocol = {
  id: number;
  number: string;
  client: string;
  service: string;
  status: ProtocolStatus;
  date: string;
  appointment: string;
  value: number;
  deadline: string;
};


type BackendUser = {
  id: number;
  name: string;
  email: string;
  role: Role;
  active: boolean;
  lastLoginAt?: string | null;
  lastLoginIp?: string | null;
  createdAt: string;
  updatedAt?: string;
};

type BackendAuditLog = {
  id: number;
  userId?: number | null;
  userName?: string | null;
  userEmail?: string | null;
  userRole?: string | null;
  action: string;
  entity?: string | null;
  entityId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  createdAt: string;
};

type BackendProtocol = {
  id: number;
  protocolNumber: string;
  status: ProtocolStatus;
  description?: string | null;
  priority?: string | null;
  estimatedValue?: number | null;
  finalValue?: number | null;
  deadlineDate?: string | null;
  createdAt: string;
  updatedAt?: string;

  client: {
    id: number;
    name: string;
    personType?: string | null;
    cpfCnpj?: string | null;
    email?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    notes?: string | null;
  };

  serviceType: {
    id: number;
    name: string;
  };

  appointments: BackendAppointment[];

  documents?: {
    id: number;
    documentType: string;
    fileName: string;
    filePath: string;
    mimeType?: string | null;
    size?: number | null;
    notes?: string | null;
    createdAt: string;
  }[];

  payments: BackendPayment[];

contracts?: BackendContract[];
};

type BackendAppointment = {
  id: number;
  scheduledAt: string;
  scheduledEndAt?: string | null;
  meetingType?: string | null;
  location?: string | null;
  meetingLink?: string | null;
  status: string;
  notes?: string | null;
  managerUserId?: number | null;

  manager?: {
    id: number;
    name: string;
    email: string;
  } | null;

  client: {
    id: number;
    name: string;
  };

  protocol: {
    id: number;
    protocolNumber: string;
    serviceType?: {
      id: number;
      name: string;
    };
  };
};

type BackendPayment = {
  id: number;
  description: string;
  amount: number;
  dueDate: string;
  paidDate?: string | null;
  status: "PAGO" | "PENDENTE" | "ATRASADO" | "CANCELADO";
  paymentMethod?: string | null;
  client: {
    id: number;
    name: string;
  };
  protocol: {
    id: number;
    protocolNumber: string;
  };
};

type BackendServiceType = {
  id: number;
  name: string;
  description?: string | null;
  active: boolean;
};

type BackendManager = {
  id: number;
  name: string;
  email: string;
  role: Role;
};

type AvailabilitySlot = {
  time: string;
  available: boolean;
  appointment: null | {
    id: number;
    protocolNumber: string;
    clientName: string;
    serviceName: string;
    scheduledAt: string;
    scheduledEndAt: string;
  };
};

type AvailabilityResponse = {
  managerUserId: number;
  date: string;
  slots: AvailabilitySlot[];
};

type SmtpSettingsResponse = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPassConfigured: boolean;
  smtpFrom: string;
  smtpSecure: boolean;
  companyAlertEmail: string;
};

type LoginResponse = {
  token: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: Role;
    active?: boolean;
    lastLoginAt?: string | null;
  };
};

type BackendCompanySettings = {
  companyName: string;
  companyLegalName: string;
  companyCnpj: string;
  companyEmail: string;
  companyPhone: string;
  companyWhatsapp: string;
  companyWebsite: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyZipCode: string;
  companyFooterText: string;
};


type BackendManagementSummary = {
  month: string;
  cashPercent: number;
  managersCount: number;

  faturamentoMensal: number;
  custosFixos: number;
  salariosFuncionarios: number;
  saidasProjetadas: number;
  adiantamentosTotais: number;

  liquidoAntesCaixa: number;
  caixaEmpresa: number;
  liquidoDistribuivel: number;
  proLaboreIndividual: number;

  currentManager?: {
    id: number;
    name: string;
    email: string;
    proLabore: number;
    advances: number;
    saldoReceber: number;
  } | null;

  managers: Array<{
    id: number;
    name: string;
    email: string;
    proLabore: number;
    advances: number;
    saldoReceber: number;
  }>;

  advances: Array<{
    id: number;
    managerUserId: number;
    managerName: string;
    managerEmail: string;
    amount: number;
    paidAt: string;
    description?: string | null;
    notes?: string | null;
  }>;

cashExtract: Array<{
  label: string;
  type: string;
  amount?: number;
  value?: number;
  description?: string | null;
}>;
};

type BackendContract = {
  id: number;
  protocolId: number;
  clientId: number;
  proposalId?: number | null;
  createdById?: number | null;

  contractNumber: string;
  publicToken: string;

  templateType?: string | null;
  status:
    | "GERADO"
    | "ENVIADO"
    | "AGUARDANDO_ASSINATURA"
    | "ASSINADO"
    | "CANCELADO"
    | "SUBSTITUIDO";

  contractValue?: number | null;
  entryAmount?: number | null;
  paymentMode?: string | null;

  title?: string | null;
  objectText?: string | null;
  obligationsText?: string | null;
  paymentText?: string | null;
  deadlineText?: string | null;
  legalText?: string | null;

  htmlSnapshot?: string | null;
  generatedPdfPath?: string | null;
  signedPdfPath?: string | null;

  sentToClientAt?: string | null;
  signedAt?: string | null;

  signerName?: string | null;
  signerCpfCnpj?: string | null;
  signerEmail?: string | null;
  signerIp?: string | null;
  signerUserAgent?: string | null;

  startDate?: string | null;
  deadlineDate?: string | null;
  notes?: string | null;

  createdAt: string;
  updatedAt?: string;

  publicUrl?: string;

  client?: {
    id: number;
    name: string;
    email?: string | null;
    cpfCnpj?: string | null;
    phone?: string | null;
    whatsapp?: string | null;
  };

  protocol?: {
    id: number;
    protocolNumber: string;
    status?: string;
    serviceType?: {
      id: number;
      name: string;
    };
  };

  proposal?: BackendProposal | null;

  createdBy?: {
    id: number;
    name: string;
    email: string;
  } | null;

  payments?: BackendPayment[];
};



type BackendFiscalDocument = {
  id: number;
  protocolId: number;
  clientId: number;
  contractId?: number | null;
  billingChargeId?: number | null;
  createdById?: number | null;

  type: "NOTA_FISCAL" | "RECIBO" | "COMPROVANTE" | "OUTRO";
  moment: "PRE_COBRANCA" | "POS_PAGAMENTO";
  status: "ANEXADO" | "CANCELADO";

  number?: string | null;
  issuedAt?: string | null;
  amount?: number | null;

  fileName: string;
  filePath: string;
  mimeType?: string | null;
  size?: number | null;

  notes?: string | null;

  createdAt: string;
  updatedAt?: string;
};

type BackendBillingCharge = {
  id: number;

  protocolId: number;
  clientId: number;
  contractId?: number | null;
  createdById?: number | null;

  provider: "BANCO_DO_BRASIL" | "MANUAL";

  status:
    | "RASCUNHO"
    | "AGUARDANDO_DOCUMENTO_FISCAL"
    | "PRONTA_PARA_EMISSAO"
    | "EMITIDA"
    | "ENVIADA"
    | "PAGA"
    | "VENCIDA"
    | "CANCELADA"
    | "ERRO";

  chargeType?: "ENTRADA" | "PARCELA" | "AVULSA";

  fiscalMode: "NOTA_FISCAL_ANTES" | "RECIBO_POSTERIOR";

  description: string;
  amount: number;
  dueDate: string;

  installmentNumber?: number | null;
  totalInstallments?: number | null;

  externalId?: string | null;
  nossoNumero?: string | null;
  txid?: string | null;
  pixKey?: string | null;
  pixCopyPaste?: string | null;
  pixQrCode?: string | null;
  boletoUrl?: string | null;
  linhaDigitavel?: string | null;
  barcode?: string | null;

  paidAt?: string | null;
  paidAmount?: number | null;

  sentToClientAt?: string | null;

  errorMessage?: string | null;
  notes?: string | null;

  createdAt: string;
  updatedAt?: string;

  client?: {
    id: number;
    name: string;
    email?: string | null;
    cpfCnpj?: string | null;
  };

  protocol?: {
    id: number;
    protocolNumber: string;
    serviceType?: {
      id: number;
      name: string;
    };
  };

  contract?: BackendContract | null;

  fiscalDocuments?: BackendFiscalDocument[];
};


const roleLabels: Record<Role, string> = {
  CLIENTE: "Cliente",
  ATENDENTE: "Atendente",
  GERENTE: "Gerente",
  PROGRAMADOR: "Programador",
};


const services = [
  {
    title: "Consultoria e Licenciamento Ambiental",
    description:
      "Assessoria técnica para licenciamento, regularização, estudos ambientais e atendimento a condicionantes.",
    image: "/services/licenciamento.png",
  },
  {
    title: "CAR - Cadastro Ambiental Rural",
    description:
      "Elaboração, retificação, análise e suporte documental para Cadastro Ambiental Rural.",
    image: "/services/car.png",
  },
  {
    title: "Perícias Judiciais",
    description:
      "Laudos, pareceres, diagnósticos e suporte técnico para demandas judiciais e extrajudiciais.",
    image: "/services/pericia.png",
  },
  {
    title: "Avaliações de Imóveis Rurais e Urbanos",
    description:
      "Avaliações técnicas com metodologia adequada para fins patrimoniais, judiciais e negociais.",
    image: "/services/avaliacoes.png",
  },
  {
    title: "Regularização Fundiária",
    description:
      "Apoio técnico e documental para regularização de imóveis e consolidação fundiária.",
    image: "/services/fundiaria.png",
  },
  {
    title: "Topografia e Georreferenciamento",
    description:
      "Levantamentos topográficos, georreferenciamento e produtos cartográficos com precisão técnica.",
    image: "/services/topografia.png",
  },
  {
    title: "Aerolevantamento com Drones",
    description:
      "Mapeamento aéreo, inspeções, ortomosaicos e apoio técnico com uso de drones.",
    image: "/services/drones.png",
  },
  {
    title: "Projetos Agropecuários",
    description:
      "Projetos produtivos e planejamento técnico para atividades agropecuárias.",
    image: "/services/agro.png",
  },
  {
    title: "Financiamento Rural / PRONAF",
    description:
      "Estruturação documental e técnica para acesso a linhas de crédito e financiamento rural.",
    image: "/services/financiamento.png",
  },
  {
    title: "Inventário e Manejo Florestal",
    description:
      "Inventário, planejamento e suporte técnico para uso e manejo dos recursos florestais.",
    image: "/services/florestal.png",
  },
  {
    title: "Segurança no Trabalho",
    description:
      "Orientação e documentos técnicos voltados à segurança ocupacional e conformidade.",
    image: "/services/seguranca.png",
  },
  {
  title: "Gestão de Processos - SIS AMAZONIKA",
  description:
    "Acompanhamento técnico de processos ambientais em sistema próprio, fundiários, documentais e administrativos junto a órgãos públicos e privados.",
  image: "/services/consultoria.png",
},
];


const whatsappUrl =
  "https://wa.me/5596988036439?text=Ol%C3%A1%2C%20vim%20pelo%20site%20da%20AMAZONIKA%20e%20gostaria%20de%20falar%20com%20um%20consultor%20online.";

const protocols: Protocol[] = [
  {
    id: 1,
    number: "AMZ-2026-000001",
    client: "Fazenda Santa Clara",
    service: "Topografia e Georreferenciamento",
    status: "EM_EXECUCAO",
    date: "2026-05-10",
    appointment: "2026-05-20 09:00",
    value: 24000,
    deadline: "2026-06-30",
  },
  {
    id: 2,
    number: "AMZ-2026-000002",
    client: "João Ferreira",
    service: "CAR - Cadastro Ambiental Rural",
    status: "AGENDADO",
    date: "2026-05-12",
    appointment: "2026-05-22 15:30",
    value: 3500,
    deadline: "2026-06-10",
  },
  {
    id: 3,
    number: "AMZ-2026-000003",
    client: "Agro Norte LTDA",
    service: "Licenciamento Ambiental",
    status: "CONTRATO_ENVIADO",
    date: "2026-05-14",
    appointment: "2026-05-21 10:00",
    value: 12000,
    deadline: "2026-07-15",
  },
  {
    id: 4,
    number: "AMZ-2026-000004",
    client: "Maria dos Santos",
    service: "Avaliações de Imóveis",
    status: "FINALIZADO",
    date: "2026-04-18",
    appointment: "2026-04-25 08:30",
    value: 5000,
    deadline: "2026-05-05",
  },
];

function billingStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    RASCUNHO: "Rascunho",
    AGUARDANDO_DOCUMENTO_FISCAL: "Aguardando documento fiscal",
    PRONTA_PARA_EMISSAO: "Pronta para emissão",
    EMITIDA: "Emitida",
    ENVIADA: "Enviada",
    PAGA: "Paga",
    VENCIDA: "Vencida",
    CANCELADA: "Cancelada",
    ERRO: "Erro",
  };

  return map[String(status || "")] || String(status || "-");
}

function billingStatusClass(status?: string | null) {
  return String(status || "rascunho").toLowerCase();
}

function fiscalModeLabel(mode?: string | null) {
  const map: Record<string, string> = {
    NOTA_FISCAL_ANTES: "Nota Fiscal antes da cobrança",
    RECIBO_POSTERIOR: "Recibo posterior ao pagamento",
  };

  return map[String(mode || "")] || String(mode || "-");
}

function fiscalDocumentTypeLabel(type?: string | null) {
  const map: Record<string, string> = {
    NOTA_FISCAL: "Nota Fiscal",
    RECIBO: "Recibo",
    COMPROVANTE: "Comprovante",
    OUTRO: "Outro",
  };

  return map[String(type || "")] || String(type || "-");
}

function contractStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    GERADO: "Gerado",
    ENVIADO: "Enviado",
    AGUARDANDO_ASSINATURA: "Aguardando assinatura",
    ASSINADO: "Assinado",
    CANCELADO: "Cancelado",
    SUBSTITUIDO: "Substituído",
  };

  return map[String(status || "")] || String(status || "-");
}

function contractStatusClass(status?: string | null) {
  return String(status || "gerado").toLowerCase();
}

function proposalStatusLabel(status?: string | null) {
  const map: Record<string, string> = {
    RASCUNHO: "Rascunho",
    ENVIADA: "Enviada",
    ACEITA: "Aceita",
    RECUSADA: "Recusada",
    AJUSTE_SOLICITADO: "Ajuste solicitado",
    EXPIRADA: "Expirada",
    CONVERTIDA_EM_CONTRATO: "Convertida em contrato",
    CANCELADA: "Cancelada",
  };

  if (!status) return "-";
  return map[status] || status;
}

function proposalStatusClass(status?: string | null) {
  return String(status || "rascunho").toLowerCase();
}

function paymentModeLabel(mode?: string | null) {
  const map: Record<string, string> = {
    A_VISTA: "À vista",
    ENTRADA_PARCELAS: "Entrada + parcelas",
    PARCELADO: "Parcelado",
    PERSONALIZADO: "Personalizado",
  };

  return map[String(mode || "")] || String(mode || "-");
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
  }).format(new Date(value));
}

function formatDateTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Belem",
  }).format(new Date(value));
}


function formatTime(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Belem",
  }).format(new Date(value));
}
function money(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(0);
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

function currentRole(): Role | null {
  return localStorage.getItem("amazonika_role") as Role | null;
}

function currentUser() {
  const raw = localStorage.getItem("amazonika_user");

  if (!raw) return null;

  try {
    return JSON.parse(raw) as {
      id: number;
      name: string;
      email: string;
      lastLoginAt?: string | null;
    };
  } catch {
    return null;
  }
}

function currentLoginAt() {
  return localStorage.getItem("amazonika_login_at");
}

function statusLabel(status: ProtocolStatus) {
  const map: Record<ProtocolStatus, string> = {
    NOVO: "Novo",
    AGENDADO: "Agendado",
    REUNIAO_REALIZADA: "Reunião realizada",
    PROPOSTA_ENVIADA: "Proposta enviada",
    ACORDO_FECHADO: "Acordo fechado",
    CONTRATO_ENVIADO: "Contrato enviado",
    AGUARDANDO_ASSINATURA: "Aguardando assinatura",
    CONTRATO_ASSINADO: "Contrato assinado",
    EM_EXECUCAO: "Em execução",
    AGUARDANDO_DOCUMENTOS: "Aguardando documentos",
    AGUARDANDO_ORGAO_PUBLICO: "Aguardando órgão público",
    FINALIZADO: "Finalizado",
    CANCELADO: "Cancelado",
  };

  return map[status];
}

function PublicHeader() {
  const [open, setOpen] = useState(false);

  const links = [
    { label: "Home", to: "/" },
    { label: "Serviços", to: "/#servicos" },
    { label: "Sobre nós", to: "/#quem-somos" },
    { label: "Localização", to: "/#localizacao" },
    { label: "Contato", to: "/#contato" },
  ];

  return (
    <header className="amazonika-header">
      <Link className="amazonika-brand" to="/">
        <img
          src="/brand/logo-amazonika.png"
          alt="AMAZONIKA Engenharia & Meio Ambiente"
          onError={(event) => {
            event.currentTarget.style.display = "none";
          }}
        />
        <div>
          <strong>AMAZONIKA</strong>
          <span>Soluções Ambientais</span>
        </div>
      </Link>

      <button className="mobile-menu-button" onClick={() => setOpen(true)}>
        <Menu size={24} />
      </button>

      <nav className="amazonika-nav">
        {links.map((item) => (
          <a href={item.to} key={item.label}>
            {item.label}
          </a>
        ))}

        <a href={whatsappUrl} target="_blank" rel="noreferrer" className="header-contact-button">
          Contato
        </a>
      </nav>

      {open && (
        <div className="mobile-panel">
          <div className="mobile-panel-header">
            <strong>Menu</strong>
            <button onClick={() => setOpen(false)}>
              <X size={22} />
            </button>
          </div>

          {links.map((item) => (
            <a href={item.to} key={item.label} onClick={() => setOpen(false)}>
              {item.label}
            </a>
          ))}

          <a
            href={whatsappUrl}
            target="_blank"
            rel="noreferrer"
            className="header-contact-button"
            onClick={() => setOpen(false)}
          >
            Contato
          </a>
        </div>
      )}
    </header>
  );
}

function PublicHome() {
  return (
    <main className="amazonika-site">
      <PublicHeader />

      <a className="whatsapp-float" href={whatsappUrl} target="_blank" rel="noreferrer">
        <MessageCircle size={22} />
        <span>Consultor online</span>
      </a>

      <section className="amazonika-hero">
        <div className="amazonika-hero-overlay" />

        <div className="amazonika-hero-content">
          <span className="hero-kicker">AMAZONIKA Engenharia & Meio Ambiente</span>

          <h1>
            Soluções Ambientais, Fundiárias e Geoespaciais com Organização e Confiança.
          </h1>

          <p>
            Atuamos com licenciamento ambiental, CAR, regularização fundiária,
            topografia, georreferenciamento, aerolevantamento com drones,
            perícias, avaliações, projetos agropecuários, financiamento rural,
            inventário e manejo florestal.
          </p>

          <div className="amazonika-hero-actions">
            <a href="#servicos" className="hero-btn primary">
              Conferir serviços
            </a>

            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="hero-btn whatsapp">
              Falar com consultor
            </a>

            <Link to="/login" className="hero-btn secondary">
              Acompanhar meu serviço
            </Link>
          </div>
        </div>
      </section>

      <section className="amazonika-about" id="quem-somos">
        <div className="section-title">
          <span>Quem somos</span>
          <h2>Atendimento técnico com foco ambiental, rural e territorial.</h2>
        </div>

        <div className="about-grid-new">
          <div className="about-text-new">
            <p>
              A AMAZONIKA Engenharia & Meio Ambiente oferece soluções técnicas
              para produtores rurais, empresas, empreendedores e demandas
              judiciais, com atuação em meio ambiente, georreferenciamento,
              topografia, regularização fundiária e gestão documental.
            </p>

            <p>
              Nosso objetivo é unir experiência técnica, organização e tecnologia
              para conduzir cada serviço com maior segurança, clareza e
              acompanhamento.
            </p>
          </div>

          <div className="about-address-card">
            <h3>Localização</h3>
            <p>
              <strong>Endereço:</strong><br />
              Av. Almirante Barroso, 620-B, Centro,<br />
              CEP: 68901-336, Macapá/AP
            </p>

            <a
              href="https://www.google.com/maps/search/?api=1&query=Av.+Almirante+Barroso,+620-B,+Centro,+Macap%C3%A1,+AP"
              target="_blank"
              rel="noreferrer"
              className="hero-btn primary"
            >
              Ver no mapa
            </a>
          </div>
        </div>
      </section>

      <section className="amazonika-services-section" id="servicos">
        <div className="section-title">
          <span>Nossos serviços</span>
          <h2>Áreas em que a AMAZONIKA atua</h2>
        </div>

        <div className="services-photo-grid">
          {services.map((service) => (
            <article className="service-photo-card" key={service.title}>
              <img src={service.image} alt={service.title} />
              <div className="service-photo-content">
                <h3>{service.title}</h3>
                <p>{service.description}</p>

                <a
                  href={whatsappUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="service-link"
                >
                  Solicitar atendimento
                </a>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="amazonika-location" id="localizacao">
        <div className="location-info-new">
          <span>Localização</span>
          <h2>Atendimento presencial e online</h2>

          <p>
            A AMAZONIKA atende em Macapá/AP e também realiza orientação e
            acompanhamento digital dos serviços.
          </p>

          <ul>
            <li>Av. Almirante Barroso, 620-B, Centro</li>
            <li>CEP: 68901-336</li>
            <li>Macapá/AP</li>
            <li>WhatsApp: +55 (96) 98803-6439</li>
          </ul>

          <a href={whatsappUrl} target="_blank" rel="noreferrer" className="hero-btn whatsapp">
            Consultor online
          </a>
        </div>

        <iframe
          title="Mapa AMAZONIKA"
          className="map-frame-new"
          src="https://www.google.com/maps?q=Av.%20Almirante%20Barroso,%20620-B,%20Centro,%20Macap%C3%A1,%20AP&output=embed"
          loading="lazy"
        />
      </section>

      <section className="amazonika-contact" id="contato">
        <div className="section-title">
          <span>Contato</span>
          <h2>Fale com a nossa equipe</h2>
        </div>

        <div className="contact-grid-new">
          <form className="contact-form-new">
            <input placeholder="Nome completo" />
            <input placeholder="Telefone / WhatsApp" />
            <input placeholder="E-mail" />

            <select>
              <option>Selecione o serviço desejado</option>
              {services.map((service) => (
                <option key={service.title}>{service.title}</option>
              ))}
            </select>

            <textarea placeholder="Descreva sua demanda" rows={5} />

            <button type="button" className="hero-btn primary full">
              Enviar solicitação
            </button>
          </form>

          <div className="contact-side-card">
            <h3>Atendimento rápido</h3>
            <p>
              Se preferir, fale diretamente com o consultor online pelo WhatsApp.
            </p>

            <a href={whatsappUrl} target="_blank" rel="noreferrer" className="hero-btn whatsapp">
              Falar no WhatsApp
            </a>
          </div>
        </div>
      </section>

<footer className="amazonika-footer-premium">
  <div className="footer-premium-grid">
    <div className="footer-premium-brand">
      <img
        src="/brand/logo-amazonika.png"
        alt="AMAZONIKA Engenharia & Meio Ambiente"
        onError={(event) => {
          event.currentTarget.style.display = "none";
        }}
      />

      <h3>AMAZONIKA</h3>
      <span>Engenharia & Meio Ambiente</span>

      <p>
        Soluções técnicas em licenciamento ambiental, georreferenciamento,
        regularização fundiária, perícias, avaliações, projetos rurais,
        aerolevantamento, CAR, inventário florestal e gestão de serviços
        ambientais.
      </p>

      <a
        href={whatsappUrl}
        target="_blank"
        rel="noreferrer"
        className="footer-premium-whatsapp"
      >
        <MessageCircle size={18} />
        Fale conosco pelo WhatsApp
      </a>
    </div>

    <div className="footer-premium-column">
      <h4>Institucional</h4>
      <a href="/">Home</a>
      <a href="/#quem-somos">Quem somos</a>
      <a href="/#servicos">Serviços</a>
      <a href="/#localizacao">Localização</a>
      <a href="/#contato">Contato</a>
      <Link to="/login">Acompanhar serviço</Link>
    </div>

    <div className="footer-premium-column footer-premium-services">
      <h4>Nossos serviços</h4>
      <a href="/#servicos">Consultoria e Licenciamento Ambiental</a>
      <a href="/#servicos">CAR - Cadastro Ambiental Rural</a>
      <a href="/#servicos">Perícias Judiciais</a>
      <a href="/#servicos">Avaliações de Imóveis Rurais/Urbanos</a>
      <a href="/#servicos">Regularização Fundiária</a>
      <a href="/#servicos">Topografia e Georreferenciamento</a>
      <a href="/#servicos">Aerolevantamento com Drones</a>
      <a href="/#servicos">Projetos Agropecuários</a>
      <a href="/#servicos">Financiamento Rural / PRONAF</a>
      <a href="/#servicos">Inventário e Manejo Florestal</a>
      <a href="/#servicos">Segurança no Trabalho</a>
    </div>

    <div className="footer-premium-location">
      <h4>Onde nos encontrar</h4>

      <div className="footer-contact-item">
        <MapPin size={18} />
        <span>
          Av. Almirante Barroso, 620-B, Centro<br />
          CEP: 68901-336, Macapá/AP
        </span>
      </div>

      <div className="footer-contact-item">
        <MessageCircle size={18} />
        <span>WhatsApp: +55 (96) 98803-6439</span>
      </div>

      <div className="footer-contact-item">
        <FileText size={18} />
        <span>SIS Amazonika | Gestão de Serviços Ambientais</span>
      </div>

      <div className="footer-map-card">
        <iframe
          title="Mapa AMAZONIKA no rodapé"
          src="https://www.google.com/maps?q=Av.%20Almirante%20Barroso,%20620-B,%20Centro,%20Macap%C3%A1,%20AP&output=embed"
          loading="lazy"
        />
      </div>
    </div>
  </div>

  <div className="footer-premium-bottom">
    <span>AMAZONIKA - Copyright © 2026 - Todos os Direitos Reservados.</span>
    <span>SIS Amazonika | Gestão de Serviços Ambientais</span>
  </div>
</footer>
    </main>
  );
}



function PublicContractPage() {
  const { token } = useParams();

  const [contract, setContract] = useState<BackendContract | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [signerName, setSignerName] = useState("");
  const [signerCpfCnpj, setSignerCpfCnpj] = useState("");
  const [signerEmail, setSignerEmail] = useState("");

  async function loadContract() {
    try {
      setLoading(true);
      setError("");

      if (!token) {
        throw new Error("Token do contrato não informado.");
      }

      const data = (await api.publicContract(token)) as BackendContract;

      setContract(data);
      setSignerName(data.client?.name || "");
      setSignerCpfCnpj(data.client?.cpfCnpj || "");
      setSignerEmail(data.client?.email || "");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar contrato."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadContract();
  }, [token]);

  async function handleSignContract() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!token) {
        throw new Error("Token do contrato não informado.");
      }

      if (!signerName.trim()) {
        throw new Error("Informe o nome do assinante.");
      }

      if (!signerCpfCnpj.trim()) {
        throw new Error("Informe o CPF/CNPJ do assinante.");
      }

      if (!signerEmail.trim()) {
        throw new Error("Informe o e-mail do assinante.");
      }

      const confirmed = window.confirm(
        "Confirma a assinatura eletrônica deste contrato?"
      );

      if (!confirmed) return;

      await api.signPublicContract(token, {
        signerName: signerName.trim(),
        signerCpfCnpj: signerCpfCnpj.trim(),
        signerEmail: signerEmail.trim(),
      });

      setSuccess("Contrato assinado eletronicamente com sucesso.");
      await loadContract();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao assinar contrato."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="public-contract-page">
        <section className="public-contract-shell">
          <div className="panel">Carregando contrato...</div>
        </section>
      </main>
    );
  }

  if (error && !contract) {
    return (
      <main className="public-contract-page">
        <section className="public-contract-shell">
          <div className="panel error-panel">{error}</div>

          <Link to="/" className="hero-btn primary">
            Voltar ao site
          </Link>
        </section>
      </main>
    );
  }

  if (!contract) return null;

  const alreadySigned = contract.status === "ASSINADO";

  return (
    <main className="public-contract-page">
      <section className="public-contract-shell">
        <header className="public-contract-header">
          <div className="public-proposal-logo-box">
            <img
              src="/brand/logo-amazonika.png"
              alt="AMAZONIKA Engenharia & Meio Ambiente"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />
          </div>

          <div>
            <span className="eyebrow">Contrato eletrônico</span>
            <h1>{contract.title || "Contrato de Prestação de Serviços"}</h1>
            <p>
              Contrato nº <strong>{contract.contractNumber}</strong> vinculado ao
              protocolo{" "}
              <strong>{contract.protocol?.protocolNumber || "-"}</strong>.
            </p>
          </div>

          <span className={`badge contract-${contractStatusClass(contract.status)}`}>
            {contractStatusLabel(contract.status)}
          </span>
        </header>

        {success && <div className="panel success-panel">{success}</div>}
        {error && <div className="panel error-panel">{error}</div>}

        <section className="public-contract-grid">
          <article className="panel public-contract-document">
            <div className="contract-document-title">
              <h2>Instrumento Contratual</h2>
              <span>{contract.contractNumber}</span>
            </div>

            <div className="contract-clause">
              <h3>1. Contratante</h3>
              <p>
                <strong>{contract.client?.name || "-"}</strong>, CPF/CNPJ{" "}
                <strong>{contract.client?.cpfCnpj || "-"}</strong>, e-mail{" "}
                <strong>{contract.client?.email || "-"}</strong>.
              </p>
            </div>

            <div className="contract-clause">
              <h3>2. Objeto</h3>
              <p>{contract.objectText || "-"}</p>
            </div>

            <div className="contract-clause">
              <h3>3. Obrigações das partes</h3>
              <p>{contract.obligationsText || "-"}</p>
            </div>

            <div className="contract-clause">
              <h3>4. Condições comerciais</h3>

              <div className="contract-values-grid">
<div>
  <span>Valor total</span>
  <strong>{money(contract.contractValue || 0)}</strong>
</div>

<div>
  <span>Entrada</span>
  <strong>{money(contract.entryAmount || 0)}</strong>
</div>

                <div>
                  <span>Forma de pagamento</span>
                  <strong>{paymentModeLabel(contract.paymentMode || "-")}</strong>
                </div>
              </div>

              <p>{contract.paymentText || "-"}</p>
            </div>

            <div className="contract-clause">
              <h3>5. Prazo</h3>
              <p>{contract.deadlineText || "-"}</p>
            </div>

            <div className="contract-clause">
              <h3>6. Cláusulas gerais</h3>
              <p>{contract.legalText || "-"}</p>
            </div>

            {alreadySigned && (
              <div className="contract-signature-box signed">
                <h3>Contrato assinado eletronicamente</h3>
                <p>
                  Assinado por <strong>{contract.signerName || "-"}</strong>, CPF/CNPJ{" "}
                  <strong>{contract.signerCpfCnpj || "-"}</strong>, e-mail{" "}
                  <strong>{contract.signerEmail || "-"}</strong>.
                </p>
                <p>
                  Data da assinatura:{" "}
                  <strong>{formatDateTime(contract.signedAt)}</strong>
                </p>
              </div>
            )}
          </article>

          <aside className="panel public-contract-side">
            <h2>Assinatura eletrônica</h2>

            {alreadySigned ? (
              <>
                <div className="success-panel contract-signed-message">
                  Este contrato já foi assinado eletronicamente.
                </div>

                <Link to="/" className="hero-btn primary full">
                  Voltar ao site
                </Link>
              </>
            ) : (
              <>
                <p>
                  Confira as informações do contrato. Se estiver tudo correto,
                  preencha os dados abaixo e confirme a assinatura eletrônica.
                </p>

                <label>
                  Nome/Razão Social do assinante
                  <input
                    value={signerName}
                    onChange={(event) => setSignerName(event.target.value)}
                  />
                </label>

                <label>
                  CPF/CNPJ
                  <input
                    value={signerCpfCnpj}
                    onChange={(event) => setSignerCpfCnpj(event.target.value)}
                  />
                </label>

                <label>
                  E-mail
                  <input
                    value={signerEmail}
                    onChange={(event) => setSignerEmail(event.target.value)}
                  />
                </label>

                <div className="contract-legal-confirmation">
                  Ao clicar em assinar, declaro que li, compreendi e aceito as
                  condições do contrato eletrônico.
                </div>

                <button
                  className="hero-btn primary full"
                  type="button"
                  disabled={saving}
                  onClick={handleSignContract}
                >
                  {saving ? "Assinando..." : "Assinar contrato"}
                </button>

                <Link to="/" className="amazonika-login-back">
                  Voltar ao site
                </Link>
              </>
            )}
          </aside>
        </section>
      </section>
    </main>
  );
}

function LoginPage() {
  const [role, setRole] = useState<Role>("GERENTE");
  const [email, setEmail] = useState("gerente@amazonika.com.br");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const navigate = useNavigate();

  function updateEmailByRole(nextRole: Role) {
    setRole(nextRole);

    if (nextRole === "GERENTE") {
      setEmail("gerente@amazonika.com.br");
    }

    if (nextRole === "ATENDENTE") {
      setEmail("atendente@amazonika.com.br");
    }

    if (nextRole === "PROGRAMADOR") {
      setEmail("programador@amazonika.com.br");
    }

    if (nextRole === "CLIENTE") {
      setEmail("cliente@teste.com");
    }
  }

async function login() {
  try {
    setLoading(true);
    setError("");

    if (!email.trim()) {
      throw new Error("Informe o e-mail.");
    }

    if (!password.trim()) {
      throw new Error("Informe a senha.");
    }

    const response = (await api.login(
  email.trim().toLowerCase(),
  password
)) as LoginResponse;

    setAuth(response.token, response.user.role, {
      id: response.user.id,
      name: response.user.name,
      email: response.user.email,
      lastLoginAt: response.user.lastLoginAt,
    });

    if (response.user.role === "CLIENTE") {
      navigate("/cliente/dashboard");
      return;
    }

    navigate("/app/dashboard");
  } catch (err) {
    setError(err instanceof Error ? err.message : "Erro ao acessar o sistema.");
  } finally {
    setLoading(false);
  }
}
  return (
    <main className="amazonika-login-page">
      <div className="amazonika-login-overlay" />

      <section className="amazonika-login-shell">
        <div className="amazonika-login-info">
          <div className="amazonika-login-brand-block featured">
            <img
              src="/brand/logo-amazonika.png"
              alt="SIS Amazonika"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            <div>
              <strong>SIS Amazonika</strong>
              <span>Gestão de Serviços Ambientais</span>
            </div>
          </div>

          <h1>SIS Amazonika</h1>

          <p className="amazonika-login-subtitle">
            Gestão de Serviços Ambientais com controle, agendamento e
            acompanhamento online.
          </p>

          <p>
            Acesse o sistema para visualizar protocolos, contratos,
            agendamentos, status dos serviços e informações gerenciais.
          </p>
        </div>

        <section className="amazonika-login-card">
          <div className="amazonika-login-card-icon">
            <Lock size={24} />
          </div>

          <h2>Acessar sistema</h2>
<p>
  Informe o e-mail e a senha de um usuário cadastrado no sistema.
</p>

          {error && <div className="login-error">{error}</div>}

          <label>
            Atalho de Perfil para Testes
            <select
              value={role}
              onChange={(event) => updateEmailByRole(event.target.value as Role)}
            >
              <option value="CLIENTE">Cliente</option>
              <option value="ATENDENTE">Atendente</option>
              <option value="GERENTE">Gerente</option>
              <option value="PROGRAMADOR">Programador</option>
            </select>
          </label>

          <label>
            E-mail
            <input value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>

          <label>
            Senha
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>

<button className="hero-btn primary full" onClick={login} disabled={loading}>
  {loading ? "Entrando..." : "Entrar no sistema"}
</button>

          <Link to="/" className="amazonika-login-back">
            Voltar ao site institucional
          </Link>
        </section>
      </section>
    </main>
  );
}

function ProtectedRoute({
  allowed,
  children,
}: {
  allowed: Role[];
  children: React.ReactNode;
}) {
  const role = currentRole();

  if (!role) return <Navigate to="/login" replace />;
  if (!allowed.includes(role)) return <Navigate to="/login" replace />;

  return children;
}

function AdminLayout() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const role = currentRole();
function logout() {
  clearAuth();
  navigate("/login");
}

const nav = [
  {
    label: "Dashboard",
    to: "/app/dashboard",
    icon: LayoutDashboard,
    roles: ["ATENDENTE", "GERENTE", "PROGRAMADOR"],
  },
  {
    label: "Protocolos",
    to: "/app/protocolos",
    icon: ClipboardList,
    roles: ["ATENDENTE", "GERENTE", "PROGRAMADOR"],
  },
  {
    label: "Agendamentos",
    to: "/app/agendamentos",
    icon: CalendarDays,
    roles: ["ATENDENTE", "GERENTE", "PROGRAMADOR"],
  },
  {
    label: "Financeiro",
    to: "/app/financeiro",
    icon: BarChart3,
    roles: ["GERENTE", "PROGRAMADOR"],
  },
  {
    label: "Configurações",
    to: "/app/configuracoes",
    icon: Settings,
    roles: ["PROGRAMADOR"],
  },
  {
    label: "Pró-labore",
    to: "/app/pro-labore",
    icon: WalletCards,
    roles: ["GERENTE", "PROGRAMADOR"],
  },
];

const visibleNav = nav.filter((item) => role && item.roles.includes(role));
const user = currentUser();
const loginAt = currentLoginAt();

  return (
    <div className="admin-shell">
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sidebar-brand">
          <img
            src="/brand/logo-amazonika.png"
            alt="AMAZONIKA"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <div>
            <strong>AMAZONIKA</strong>
            <span>Gestão Interna</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          {visibleNav.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => setOpen(false)}
                className={({ isActive }) => (isActive ? "active" : "")}
              >
                <Icon size={20} />
                {item.label}
              </NavLink>
            );
          })}
        </nav>

        <button className="logout-button" onClick={logout}>
          <LogOut size={18} />
          Sair
        </button>
      </aside>

      {open && <button className="overlay" onClick={() => setOpen(false)} />}

      <div className="admin-main">
        <header className="admin-topbar">
          <button className="mobile-menu-button" onClick={() => setOpen(true)}>
            <Menu size={24} />
          </button>

<div>
  <strong>Painel administrativo</strong>
  <span>{currentRole()}</span>

  {user && (
    <small className="logged-user-info">
      Logado como {user.name} • {user.email}
      {loginAt ? ` • acesso em ${formatDateTime(loginAt)}` : ""}
    </small>
  )}
</div>

          <Link to="/" className="topbar-link">
            Site
          </Link>
        </header>

        <Outlet />
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  hint,
  icon: Icon,
}: {
  title: string;
  value: string;
  hint: string;
  icon: typeof LayoutDashboard;
}) {
  return (
    <article className="metric-card">
      <div className="metric-icon">
        <Icon size={22} />
      </div>
      <div>
        <span>{title}</span>
        <strong>{value}</strong>
        <small>{hint}</small>
      </div>
    </article>
  );
}

function ManagementMoneyCards({ month }: { month: string }) {
  const role = localStorage.getItem("amazonika_role") as Role | null;
  const isProgrammer = role === "PROGRAMADOR";

  const [data, setData] = useState<BackendManagementSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [showCash, setShowCash] = useState(false);
  const [showProLabore, setShowProLabore] = useState(false);

  const [modal, setModal] = useState<"CAIXA" | "PRO_LABORE" | null>(null);
  const [cashPercentInput, setCashPercentInput] = useState("10");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const response = (await api.managementProLaboreSummary(
        month
      )) as BackendManagementSummary;

      setData(response);
      setCashPercentInput(String(response.cashPercent ?? 10));
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar caixa e pró-labore."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [month]);

  async function handleSaveCashPercent() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const cashPercent = Number(cashPercentInput);

      if (Number.isNaN(cashPercent) || cashPercent < 0 || cashPercent > 100) {
        throw new Error("Informe um percentual entre 0 e 100.");
      }

      await api.updateManagementCashSetting({
        competenceMonth: month,
        cashPercent,
        notes: "Percentual definido na Dashboard gerencial.",
      });

      setSuccess("Percentual de caixa atualizado com sucesso.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar percentual de caixa."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="management-money-grid">
        <article className="management-money-card skeleton-card">
          Carregando caixa...
        </article>

        <article className="management-money-card skeleton-card">
          Carregando pró-labore...
        </article>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="panel error-panel">
        {error || "Não foi possível carregar caixa e pró-labore."}
      </div>
    );
  }

  const totalManagersProLabore = (data.managers || []).reduce(
    (sum, manager) => sum + Number(manager.saldoReceber || 0),
    0
  );

  const totalManagersAdvances = (data.managers || []).reduce(
    (sum, manager) => sum + Number(manager.advances || 0),
    0
  );

  const myProLabore = data.currentManager?.saldoReceber || 0;

  const managerGrossProLabore =
    data.currentManager?.proLabore || data.proLaboreIndividual || 0;

  const cardProLaboreValue = isProgrammer
    ? totalManagersProLabore
    : myProLabore;

  const cardProLaboreTitle = isProgrammer
    ? "PRÓ-LABORE DOS GESTORES"
    : "MEU PRÓ-LABORE PREVISTO";

  const cardProLaboreSubtitle = isProgrammer
    ? `Gestores ativos: ${
        data.managersCount || data.managers?.length || 0
      } · Adiantamentos: ${money(totalManagersAdvances)}`
    : `Pró-labore atual = ${money(managerGrossProLabore)}`;

  const cardProLaboreHint = isProgrammer
    ? "Clique para ver o extrato consolidado dos gestores"
    : "Clique para ver o extrato do pró-labore";

  const cashValue = showCash ? money(data.caixaEmpresa || 0) : "R$ •••••";

  const proLaboreValue = showProLabore
    ? money(cardProLaboreValue)
    : "R$ •••••";

  const proLaboreSubtitleValue = showProLabore
    ? cardProLaboreSubtitle
    : isProgrammer
    ? "Gestores ativos: ••• · Adiantamentos: R$ •••••"
    : "Pró-labore atual = R$ •••••";

  return (
    <>
      {error && <div className="panel error-panel">{error}</div>}
      {success && <div className="panel success-panel">{success}</div>}

      <div className="management-money-grid">
        <article
          className="management-money-card cash-card"
          onClick={() => setModal("CAIXA")}
        >
          <button
            type="button"
            className="management-eye-button"
            onClick={(event) => {
              event.stopPropagation();
              setShowCash((value) => !value);
            }}
            title={showCash ? "Ocultar valor" : "Mostrar valor"}
          >
            {showCash ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>

          <div className="management-card-content">
            <span>CAIXA DA EMPRESA</span>

            <strong>{cashValue}</strong>

            <p>{data.cashPercent}% do líquido mensal reservado para a empresa</p>

            <small>Clique para ver o extrato do caixa</small>
          </div>
        </article>

        <article
          className="management-money-card prolabore-card"
          onClick={() => setModal("PRO_LABORE")}
        >
          <button
            type="button"
            className="management-eye-button"
            onClick={(event) => {
              event.stopPropagation();
              setShowProLabore((value) => !value);
            }}
            title={showProLabore ? "Ocultar valor" : "Mostrar valor"}
          >
            {showProLabore ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>

          <div className="management-card-content">
            <span>{cardProLaboreTitle}</span>

            <strong>{proLaboreValue}</strong>

            <p>{proLaboreSubtitleValue}</p>

            <small>{cardProLaboreHint}</small>
          </div>
        </article>
      </div>

      {modal && (
        <div className="modal-backdrop" onClick={() => setModal(null)}>
          <div
            className="protocol-modal management-extract-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header-line">
              <div>
                <span className="eyebrow">
                  {modal === "CAIXA"
                    ? "Extrato do caixa"
                    : isProgrammer
                    ? "Extrato consolidado"
                    : "Extrato do pró-labore"}
                </span>

                <h2>
                  {modal === "CAIXA"
                    ? "Caixa da empresa"
                    : isProgrammer
                    ? "Pró-labore dos gestores"
                    : "Meu pró-labore"}
                </h2>

                <p>Mês de competência: {data.month}</p>
              </div>

              <button
                type="button"
                className="secondary-action"
                onClick={() => setModal(null)}
              >
                Fechar
              </button>
            </div>

            {modal === "CAIXA" && (
              <>
                <div className="management-extract-highlight">
                  <span>Caixa reservado</span>
                  <strong>{money(data.caixaEmpresa || 0)}</strong>

                  <p>
                    Percentual aplicado sobre o líquido mensal:{" "}
                    <b>{data.cashPercent}%</b>
                  </p>
                </div>

                {isProgrammer ? (
                  <div className="cash-percent-editor">
                    <label>
                      Percentual reservado para caixa da empresa
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={cashPercentInput}
                        onChange={(event) =>
                          setCashPercentInput(event.target.value)
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="button primary"
                      disabled={saving}
                      onClick={handleSaveCashPercent}
                    >
                      {saving ? "Salvando..." : "Salvar percentual"}
                    </button>
                  </div>
                ) : (
                  <div className="info-panel">
                    Apenas o programador pode alterar o percentual reservado ao
                    caixa da empresa.
                  </div>
                )}

                <div className="management-extract-list">
                  {(data.cashExtract || []).map((item) => (
                    <div key={`${item.type}-${item.label}`}>
                      <span>
                        <strong>{item.label}</strong>

                        <small>
                          {item.description ||
                            (item.type === "ENTRADA"
                              ? "Entrada considerada no cálculo"
                              : item.type === "SAIDA"
                              ? "Dedução considerada no cálculo"
                              : "Resultado calculado")}
                        </small>
                      </span>

                      <b>{money(item.value ?? item.amount ?? 0)}</b>
                    </div>
                  ))}
                </div>
              </>
            )}

            {modal === "PRO_LABORE" && (
              <>
                {isProgrammer ? (
                  <>
                    <div className="management-extract-highlight">
                      <span>Pró-labore consolidado dos gestores</span>
                      <strong>{money(totalManagersProLabore)}</strong>

                      <p>
                        Total previsto para gestores após desconto dos
                        adiantamentos do mês.
                      </p>
                    </div>

                    <div className="detail-list">
                      <div>
                        <span>Gestores ativos</span>
                        <strong>
                          {data.managersCount || data.managers?.length || 0}
                        </strong>
                      </div>

                      <div>
                        <span>Pró-labore bruto individual</span>
                        <strong>{money(data.proLaboreIndividual || 0)}</strong>
                      </div>

                      <div>
                        <span>Total de adiantamentos</span>
                        <strong>{money(totalManagersAdvances)}</strong>
                      </div>

                      <div>
                        <span>Saldo líquido total dos gestores</span>
                        <strong>{money(totalManagersProLabore)}</strong>
                      </div>

                      <div>
                        <span>Líquido distribuível</span>
                        <strong>{money(data.liquidoDistribuivel || 0)}</strong>
                      </div>
                    </div>

                    <h3>Extrato por gestor</h3>

                    <div className="table-wrap">
                      <table className="data-table">
                        <thead>
                          <tr>
                            <th>Gestor</th>
                            <th>E-mail</th>
                            <th>Pró-labore bruto</th>
                            <th>Adiantamentos</th>
                            <th>Saldo a receber</th>
                          </tr>
                        </thead>

                        <tbody>
                          {(data.managers || []).map((manager) => (
                            <tr key={manager.id}>
                              <td>
                                <strong>{manager.name}</strong>
                              </td>

                              <td>{manager.email}</td>

                              <td>{money(manager.proLabore || 0)}</td>

                              <td>{money(manager.advances || 0)}</td>

                              <td>
                                <strong>
                                  {money(manager.saldoReceber || 0)}
                                </strong>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>

                      {(data.managers || []).length === 0 && (
                        <p>Nenhum gestor ativo encontrado.</p>
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div className="management-extract-highlight">
                      <span>Meu pró-labore líquido previsto</span>
                      <strong>
                        {money(data.currentManager?.saldoReceber || 0)}
                      </strong>

                      <p>
                        Pró-labore individual bruto:{" "}
                        <b>
                          {money(
                            data.currentManager?.proLabore ||
                              data.proLaboreIndividual ||
                              0
                          )}
                        </b>
                      </p>
                    </div>

                    <div className="detail-list">
                      <div>
                        <span>Gestor</span>
                        <strong>{data.currentManager?.name || "-"}</strong>
                      </div>

                      <div>
                        <span>Pró-labore bruto individual</span>
                        <strong>
                          {money(
                            data.currentManager?.proLabore ||
                              data.proLaboreIndividual ||
                              0
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Adiantamentos recebidos</span>
                        <strong>
                          {money(data.currentManager?.advances || 0)}
                        </strong>
                      </div>

                      <div>
                        <span>Saldo a receber</span>
                        <strong>
                          {money(data.currentManager?.saldoReceber || 0)}
                        </strong>
                      </div>

                      <div>
                        <span>Quantidade de gestores</span>
                        <strong>
                          {data.managersCount || data.managers?.length || 0}
                        </strong>
                      </div>
                    </div>

                    <h3>Meus adiantamentos no mês</h3>

                    <div className="management-extract-list compact">
                      {(data.advances || []).filter(
                        (advance) =>
                          advance.managerUserId === data.currentManager?.id
                      ).length === 0 && (
                        <p>
                          Nenhum adiantamento registrado para este gestor no mês.
                        </p>
                      )}

                      {(data.advances || [])
                        .filter(
                          (advance) =>
                            advance.managerUserId === data.currentManager?.id
                        )
                        .map((advance) => (
                          <div key={advance.id}>
                            <span>
                              <strong>
                                {advance.description ||
                                  "Adiantamento de pró-labore"}
                              </strong>

                              <small>
                                {formatDate(advance.paidAt)} ·{" "}
                                {advance.notes || "Sem observações"}
                              </small>
                            </span>

                            <b>{money(advance.amount || 0)}</b>
                          </div>
                        ))}
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}


function AdminDashboard() {
  const navigate = useNavigate();

  const currentMonth = new Date().toISOString().slice(0, 7);

  const [dashboard, setDashboard] = useState<any>(null);
  const [financeSummary, setFinanceSummary] =
    useState<BackendFinanceSummary | null>(null);

  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const role = localStorage.getItem("amazonika_role") as Role | null;
  const canSeeFinance = role === "GERENTE" || role === "PROGRAMADOR";

  async function loadDashboard() {
    try {
      setLoading(true);
      setError("");

      const dashboardPromise = api.dashboard();

      const financePromise = canSeeFinance
        ? api.financeSummary(month)
        : Promise.resolve(null);

      const [dashboardData, financeData] = await Promise.all([
        dashboardPromise,
        financePromise,
      ]);

      setDashboard(dashboardData);
      setFinanceSummary(financeData as BackendFinanceSummary | null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard();
  }, [month]);

  const protocolsCount =
    dashboard?.protocolsCount ??
    dashboard?.protocols ??
    dashboard?.totalProtocols ??
    0;

  const appointmentsCount =
    dashboard?.appointmentsCount ??
    dashboard?.appointments ??
    dashboard?.totalAppointments ??
    0;

  const clientsCount =
    dashboard?.clientsCount ??
    dashboard?.clients ??
    dashboard?.totalClients ??
    0;

  const recentProtocols =
    dashboard?.recentProtocols ??
    dashboard?.protocolsRecentes ??
    dashboard?.latestProtocols ??
    [];

  const received =
    financeSummary?.entradasRecebidas ??
    dashboard?.received ??
    dashboard?.receivedAmount ??
    0;

  const pending =
    financeSummary?.entradasPendentes ??
    dashboard?.pending ??
    dashboard?.pendingAmount ??
    0;

  const fixedCosts = financeSummary?.custoFixoMensal ?? 0;
  const salaries = financeSummary?.salariosMensais ?? 0;
  const projectedExpenses = financeSummary?.saidasProjetadas ?? 0;
  const projectedResult = financeSummary?.resultadoPrevisto ?? 0;
  const realizedResult = financeSummary?.resultadoRealizado ?? 0;

  const maxChartValue = Math.max(
    financeSummary?.entradas || 0,
    financeSummary?.saidasProjetadas || 0,
    Math.abs(financeSummary?.resultadoPrevisto || 0),
    1
  );

  function chartWidth(value: number) {
    return `${Math.max(
      6,
      Math.round((Math.abs(value) / maxChartValue) * 100)
    )}%`;
  }

  function protocolStatusClass(status?: string) {
    return String(status || "novo").toLowerCase();
  }

  return (
    <section className="page premium-dashboard-page">
      <div className="page-heading dashboard-heading-clean">
        <div>
          <span className="eyebrow">Visão geral</span>

          <h1>
            {canSeeFinance ? "Dashboard Gerencial" : "Dashboard de Atendimento"}
          </h1>

          <p>
            Acompanhamento consolidado de protocolos, agendamentos, clientes e
            desempenho financeiro do SIS Amazonika.
          </p>
        </div>

        <div className="detail-actions">
          {canSeeFinance && (
            <input
              type="month"
              value={month}
              onChange={(event) => setMonth(event.target.value)}
            />
          )}

          <button
            className="button primary"
            type="button"
            onClick={() => navigate("/app/protocolos")}
          >
            Novo protocolo
          </button>
        </div>
      </div>

      {canSeeFinance && <ManagementMoneyCards month={month} />}

      {loading && <div className="panel">Carregando dashboard...</div>}

      {error && <div className="panel error-panel">{error}</div>}

      {!loading && !error && (
        <>
          <div className="metrics-grid five dashboard-premium-metrics">
            <MetricCard
              title="Protocolos"
              value={String(protocolsCount)}
              hint="registrados no sistema"
              icon={ClipboardList}
            />

            <MetricCard
              title="Agendamentos"
              value={String(appointmentsCount)}
              hint="reuniões cadastradas"
              icon={CalendarDays}
            />

            <MetricCard
              title="Clientes"
              value={String(clientsCount)}
              hint="clientes cadastrados"
              icon={FileText}
            />

            {canSeeFinance && (
              <>
                <MetricCard
                  title="Recebido"
                  value={money(received)}
                  hint="pagamentos confirmados"
                  icon={WalletCards}
                />

                <MetricCard
                  title="A receber"
                  value={money(pending)}
                  hint="entradas pendentes"
                  icon={Clock}
                />
              </>
            )}
          </div>

          {canSeeFinance && financeSummary && (
            <div className="premium-finance-overview">
              <article className="panel premium-finance-card main">
                <div className="panel-header">
                  <div>
                    <h2>Resumo financeiro real</h2>
                    <p>Mês de competência: {financeSummary.month}</p>
                  </div>

                  <button
                    className="mini-button"
                    type="button"
                    onClick={() => navigate("/app/financeiro")}
                  >
                    Abrir financeiro
                  </button>
                </div>

                <div className="finance-kpi-grid">
                  <div>
                    <span>Entradas previstas</span>
                    <strong>{money(financeSummary.entradas)}</strong>
                  </div>

                  <div>
                    <span>Entradas recebidas</span>
                    <strong>{money(financeSummary.entradasRecebidas)}</strong>
                  </div>

                  <div>
                    <span>Saídas projetadas</span>
                    <strong>{money(projectedExpenses)}</strong>
                  </div>

                  <div>
                    <span>Resultado previsto</span>
                    <strong
                      className={
                        projectedResult >= 0
                          ? "positive-result"
                          : "negative-result"
                      }
                    >
                      {money(projectedResult)}
                    </strong>
                  </div>
                </div>

                <div className="dashboard-chart-list">
                  <div className="dashboard-chart-row">
                    <div>
                      <strong>Receitas</strong>
                      <span>{money(financeSummary.entradas)}</span>
                    </div>

                    <div className="dashboard-chart-track">
                      <div
                        className="dashboard-chart-fill income"
                        style={{ width: chartWidth(financeSummary.entradas) }}
                      />
                    </div>
                  </div>

                  <div className="dashboard-chart-row">
                    <div>
                      <strong>Despesas projetadas</strong>
                      <span>{money(projectedExpenses)}</span>
                    </div>

                    <div className="dashboard-chart-track">
                      <div
                        className="dashboard-chart-fill expense"
                        style={{ width: chartWidth(projectedExpenses) }}
                      />
                    </div>
                  </div>

                  <div className="dashboard-chart-row">
                    <div>
                      <strong>Resultado previsto</strong>
                      <span>{money(projectedResult)}</span>
                    </div>

                    <div className="dashboard-chart-track">
                      <div
                        className={`dashboard-chart-fill ${
                          projectedResult >= 0 ? "income" : "expense"
                        }`}
                        style={{ width: chartWidth(projectedResult) }}
                      />
                    </div>
                  </div>
                </div>
              </article>

              <article className="panel premium-finance-card side">
                <div className="panel-header">
                  <h2>Composição das saídas</h2>
                </div>

                <div className="detail-list">
                  <div>
                    <span>Custos fixos mensais</span>
                    <strong>{money(fixedCosts)}</strong>
                  </div>

                  <div>
                    <span>Salários mensais</span>
                    <strong>{money(salaries)}</strong>
                  </div>

                  <div>
                    <span>Saídas lançadas</span>
                    <strong>{money(financeSummary.saidasLancadas)}</strong>
                  </div>

                  <div>
                    <span>Saídas pagas</span>
                    <strong>{money(financeSummary.saidasPagas)}</strong>
                  </div>

                  <div>
                    <span>Resultado realizado</span>
                    <strong
                      className={
                        realizedResult >= 0
                          ? "positive-result"
                          : "negative-result"
                      }
                    >
                      {money(realizedResult)}
                    </strong>
                  </div>
                </div>
              </article>
            </div>
          )}

<div className="dashboard-stack premium-dashboard-grid">
  <article className="panel">
    <div className="panel-header">
      <div>
        <h2>Protocolos recentes</h2>
        <p>Últimos atendimentos registrados no sistema.</p>
      </div>

      <button
        className="mini-button"
        type="button"
        onClick={() => navigate("/app/protocolos")}
      >
        Ver todos
      </button>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Protocolo</th>
            <th>Cliente</th>
            <th>Serviço</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          {recentProtocols.map((item: any) => (
            <tr key={item.id || item.protocolNumber}>
              <td>
                <Link
                  className="table-link"
                  to={`/app/protocolos/${item.id}`}
                >
                  {item.protocolNumber}
                </Link>
              </td>

              <td>{item.client?.name || item.clientName || "-"}</td>

              <td>{item.serviceType?.name || item.serviceName || "-"}</td>

              <td>
                <span className={`badge ${protocolStatusClass(item.status)}`}>
                  {statusLabel(item.status)}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {recentProtocols.length === 0 && (
        <p>Nenhum protocolo recente encontrado.</p>
      )}
    </div>
  </article>

  {canSeeFinance && financeSummary && (
    <article className="panel">
      <div className="panel-header">
        <div>
          <h2>Categorias do mês</h2>
          <p>Distribuição dos lançamentos financeiros por categoria.</p>
        </div>

        <span>{financeSummary.byCategory.length} item(ns)</span>
      </div>

      <div className="finance-bars compact">
        {financeSummary.byCategory.slice(0, 8).map((item) => {
          const width = Math.max(
            6,
            Math.round(
              (item.amount /
                Math.max(...financeSummary.byCategory.map((row) => row.amount), 1)) *
                100
            )
          );

          return (
            <div
              key={`${item.type}-${item.category}`}
              className="finance-bar-row"
            >
              <div className="finance-bar-info">
                <strong>{item.category}</strong>
                <span>
                  {item.type === "ENTRADA" ? "Entrada" : "Saída"} ·{" "}
                  {item.count} lançamento(s)
                </span>
              </div>

              <div className="finance-bar-track">
                <div
                  className={`finance-bar-fill ${
                    item.type === "ENTRADA" ? "income" : "expense"
                  }`}
                  style={{ width: `${width}%` }}
                />
              </div>

              <b>{money(item.amount)}</b>
            </div>
          );
        })}

        {financeSummary.byCategory.length === 0 && (
          <p>Nenhuma categoria financeira movimentada no mês.</p>
        )}
      </div>
    </article>
  )}
</div>
        </>
      )}
    </section>
  );
}

function ProLaboreAdvancesPage() {
  const currentMonth = new Date().toISOString().slice(0, 7);
  const today = new Date().toISOString().slice(0, 10);

  const [month, setMonth] = useState(currentMonth);
  const [managers, setManagers] = useState<BackendManager[]>([]);
  const [advances, setAdvances] = useState<BackendProLaboreAdvance[]>([]);
  const [summary, setSummary] = useState<BackendManagementSummary | null>(null);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingAdvance, setEditingAdvance] =
    useState<BackendProLaboreAdvance | null>(null);

  const [managerUserId, setManagerUserId] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAt, setPaidAt] = useState(today);
  const [description, setDescription] = useState("Adiantamento de pró-labore");
  const [notes, setNotes] = useState("");

  const role = localStorage.getItem("amazonika_role") as Role | null;
  const isProgrammer = role === "PROGRAMADOR";

  async function loadData(monthValue = month) {
    try {
      setLoading(true);
      setError("");

      const [managersData, advancesData, summaryData] = await Promise.all([
        api.managers() as Promise<BackendManager[]>,
        api.managementProLaboreAdvances(
          monthValue
        ) as Promise<BackendProLaboreAdvance[]>,
        api.managementProLaboreSummary(
          monthValue
        ) as Promise<BackendManagementSummary>,
      ]);

      setManagers(managersData);
      setAdvances(advancesData);
      setSummary(summaryData);

      if (!managerUserId && managersData.length > 0) {
        setManagerUserId(String(managersData[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar adiantamentos de pró-labore."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData(month);
  }, [month]);

  function resetForm() {
    setEditingAdvance(null);
    setManagerUserId(managers[0]?.id ? String(managers[0].id) : "");
    setAmount("");
    setPaidAt(today);
    setDescription("Adiantamento de pró-labore");
    setNotes("");
  }

  function startEditAdvance(advance: BackendProLaboreAdvance) {
    setEditingAdvance(advance);
    setShowForm(true);
    setManagerUserId(String(advance.managerUserId));
    setAmount(String(advance.amount || ""));
    setPaidAt(advance.paidAt ? advance.paidAt.slice(0, 10) : today);
    setDescription(advance.description || "Adiantamento de pró-labore");
    setNotes(advance.notes || "");
  }

  async function handleSaveAdvance() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!isProgrammer) {
        throw new Error("Somente o programador pode registrar ou editar adiantamentos.");
      }

      if (!managerUserId) {
        throw new Error("Selecione o gestor.");
      }

      if (!amount || Number(amount) <= 0) {
        throw new Error("Informe um valor válido.");
      }

      const payload = {
        managerUserId: Number(managerUserId),
        competenceMonth: month,
        amount: Number(amount),
        paidAt: paidAt || today,
        description: description || "Adiantamento de pró-labore",
        notes: notes || "",
      };

      if (editingAdvance) {
        await api.updateProLaboreAdvance(editingAdvance.id, payload);
        setSuccess("Adiantamento atualizado com sucesso.");
      } else {
        await api.createProLaboreAdvance(payload);
        setSuccess("Adiantamento registrado com sucesso.");
      }

      resetForm();
      setShowForm(false);

      await loadData(month);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar adiantamento de pró-labore."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteAdvance(advance: BackendProLaboreAdvance) {
    const confirmed = window.confirm(
      `Deseja realmente excluir o adiantamento de ${money(advance.amount)}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!isProgrammer) {
        throw new Error("Somente o programador pode excluir adiantamentos.");
      }

      await api.deleteProLaboreAdvance(advance.id);

      setSuccess("Adiantamento excluído com sucesso.");
      await loadData(month);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao excluir adiantamento de pró-labore."
      );
    } finally {
      setSaving(false);
    }
  }

  const totalAdvances = advances.reduce(
    (sum, advance) => sum + Number(advance.amount || 0),
    0
  );

  const managersWithSummary = summary?.managers || [];

  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Gestão dos gestores</span>
          <h1>Adiantamentos de Pró-labore</h1>
          <p>
            Controle mensal dos valores antecipados aos gestores antes do
            fechamento financeiro.
          </p>
        </div>

        <div className="detail-actions">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />

          {isProgrammer && (
            <button
              className="button primary"
              type="button"
              onClick={() => {
                if (showForm) {
                  resetForm();
                  setShowForm(false);
                  return;
                }

                resetForm();
                setShowForm(true);
              }}
            >
              {showForm ? "Fechar formulário" : "Novo adiantamento"}
            </button>
          )}
        </div>
      </div>

      {saving && (
        <div className="modal-backdrop">
          <div className="protocol-modal progress-modal">
            <h2>Processando...</h2>
            <p>Aguarde enquanto o sistema atualiza o pró-labore.</p>
          </div>
        </div>
      )}

      {success && <div className="panel success-panel">{success}</div>}
      {error && <div className="panel error-panel">{error}</div>}

      {!isProgrammer && (
        <div className="panel info-panel">
          Você está em modo de visualização. Apenas o programador pode registrar,
          editar ou excluir adiantamentos de pró-labore.
        </div>
      )}

      {loading && <div className="panel">Carregando pró-labore...</div>}

      {!loading && (
        <>
          <div className="metrics-grid four">
            <MetricCard
              title="Adiantamentos"
              value={money(totalAdvances)}
              hint="total antecipado no mês"
              icon={WalletCards}
            />

            <MetricCard
              title="Gestores ativos"
              value={String(summary?.managersCount || managers.length || 0)}
              hint="considerados na divisão"
              icon={ClipboardList}
            />

            <MetricCard
              title="Pró-labore bruto"
              value={money(summary?.proLaboreIndividual || 0)}
              hint="valor individual antes dos adiantamentos"
              icon={BarChart3}
            />

            <MetricCard
              title="Caixa da empresa"
              value={money(summary?.caixaEmpresa || 0)}
              hint={`${summary?.cashPercent ?? 10}% reservado ao caixa`}
              icon={Clock}
            />
          </div>

          {isProgrammer && showForm && (
            <article className="panel soft-panel">
              <div className="panel-header">
                <div>
                  <h2>
                    {editingAdvance
                      ? "Editar adiantamento de pró-labore"
                      : "Novo adiantamento de pró-labore"}
                  </h2>
                  <p>
                    Registre ou atualize o valor antecipado a um gestor no mês
                    de competência selecionado.
                  </p>
                </div>
              </div>

              <div className="form-row">
                <label>
                  Gestor
                  <select
                    value={managerUserId}
                    onChange={(event) => setManagerUserId(event.target.value)}
                  >
                    <option value="">Selecione</option>
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} — {manager.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Valor antecipado
                  <input
                    type="number"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    placeholder="0"
                  />
                </label>

                <label>
                  Data do pagamento
                  <input
                    type="date"
                    value={paidAt}
                    onChange={(event) => setPaidAt(event.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Descrição
                  <input
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    placeholder="Ex: Adiantamento solicitado pelo gestor"
                  />
                </label>
              </div>

              <label>
                Observações
                <textarea
                  value={notes}
                  onChange={(event) => setNotes(event.target.value)}
                  rows={3}
                  placeholder="Detalhes internos sobre o adiantamento"
                />
              </label>

              <div className="form-actions">
                <button
                  className="secondary-action"
                  type="button"
                  onClick={() => {
                    resetForm();
                    setShowForm(false);
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="button primary"
                  type="button"
                  disabled={saving}
                  onClick={handleSaveAdvance}
                >
                  {saving
                    ? "Salvando..."
                    : editingAdvance
                    ? "Atualizar adiantamento"
                    : "Registrar adiantamento"}
                </button>
              </div>
            </article>
          )}

<div className="prolabore-stack">
  <article className="panel">
    <div className="panel-header">
      <div>
        <h2>Resumo por gestor</h2>
        <p>Pró-labore previsto, adiantamentos e saldo a receber.</p>
      </div>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Gestor</th>
            <th>E-mail</th>
            <th>Pró-labore</th>
            <th>Adiantamentos</th>
            <th>Saldo a receber</th>
          </tr>
        </thead>

        <tbody>
          {managersWithSummary.map((manager) => (
            <tr key={manager.id}>
              <td>
                <strong>{manager.name}</strong>
              </td>
              <td>{manager.email}</td>
              <td>{money(manager.proLabore)}</td>
              <td>{money(manager.advances)}</td>
              <td>
                <strong>{money(manager.saldoReceber)}</strong>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {managersWithSummary.length === 0 && (
        <p>Nenhum gestor ativo encontrado.</p>
      )}
    </div>
  </article>

  <article className="panel">
    <div className="panel-header">
      <div>
        <h2>Adiantamentos registrados</h2>
        <p>Histórico do mês selecionado.</p>
      </div>

      <span>{advances.length} registro(s)</span>
    </div>

    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            <th>Data</th>
            <th>Gestor</th>
            <th>Descrição</th>
            <th>Valor</th>
            <th>Cadastrado por</th>
            {isProgrammer && <th>Ações</th>}
          </tr>
        </thead>

        <tbody>
          {advances.map((advance) => (
            <tr key={advance.id}>
              <td>{formatDate(advance.paidAt)}</td>

              <td>
                <strong>
                  {advance.manager?.name || "Gestor não informado"}
                </strong>
                <small className="table-small">
                  {advance.manager?.email || ""}
                </small>
              </td>

              <td>
                <strong>
                  {advance.description || "Adiantamento de pró-labore"}
                </strong>
                <small className="table-small">{advance.notes || ""}</small>
              </td>

              <td>
                <strong>{money(advance.amount)}</strong>
              </td>

              <td>{advance.createdBy?.name || "-"}</td>

              {isProgrammer && (
                <td>
                  <div className="table-actions">
                    <button
                      className="mini-button"
                      type="button"
                      onClick={() => startEditAdvance(advance)}
                    >
                      Editar
                    </button>

                    <button
                      className="mini-button danger"
                      type="button"
                      onClick={() => handleDeleteAdvance(advance)}
                    >
                      Excluir
                    </button>
                  </div>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>

      {advances.length === 0 && (
        <p>Nenhum adiantamento registrado neste mês.</p>
      )}
    </div>
  </article>
</div>
        </>
      )}
    </section>
  );
}

function ProcessingOverlay({ message }: { message: string }) {
  if (!message) return null;

  return (
    <div className="processing-overlay">
      <div className="processing-modal">
        <div className="processing-spinner" />

        <div>
          <h3>Processando solicitação</h3>
          <p>{message}</p>
          <small>Aguarde. Não feche esta página.</small>
        </div>
      </div>
    </div>
  );
}

function ProtocolsPage() {
  const [processingMessage, setProcessingMessage] = useState("");
  const [items, setItems] = useState<BackendProtocol[]>([]);
  const [serviceTypes, setServiceTypes] = useState<BackendServiceType[]>([]);
  const [managers, setManagers] = useState<BackendManager[]>([]);

  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showNewProtocol, setShowNewProtocol] = useState(false);

  const [clientName, setClientName] = useState("");
  const [clientCpfCnpj, setClientCpfCnpj] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [clientCity, setClientCity] = useState("Macapá");
  const [clientState, setClientState] = useState("AP");

  const [serviceTypeId, setServiceTypeId] = useState("");
  const [protocolDescription, setProtocolDescription] = useState("");
  const [priority, setPriority] = useState("NORMAL");

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState("DOCUMENTO_INICIAL");

  const [managerUserId, setManagerUserId] = useState("");
  const [appointmentDate, setAppointmentDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("60");
  const [meetingType, setMeetingType] = useState("Presencial");
  const [meetingLocation, setMeetingLocation] = useState(
    "AMAZONIKA - Av. Almirante Barroso, 620-B, Centro, Macapá/AP"
  );
  const [meetingLink, setMeetingLink] = useState("");
  const [appointmentNotes, setAppointmentNotes] = useState("");

  const [availability, setAvailability] = useState<AvailabilityResponse | null>(
    null
  );
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [protocolsData, serviceTypesData, managersData] =
        await Promise.all([
          api.protocols() as Promise<BackendProtocol[]>,
          api.serviceTypes() as Promise<BackendServiceType[]>,
          api.managers() as Promise<BackendManager[]>,
        ]);

      setItems(protocolsData);
      setServiceTypes(serviceTypesData);
      setManagers(managersData);

      if (!serviceTypeId && serviceTypesData.length > 0) {
        setServiceTypeId(String(serviceTypesData[0].id));
      }

      if (!managerUserId && managersData.length > 0) {
        setManagerUserId(String(managersData[0].id));
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar dados dos protocolos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function loadAvailability() {
    if (!managerUserId || !appointmentDate) {
      setAvailability(null);
      return;
    }

    try {
      setAvailabilityLoading(true);
      setError("");

      const data = (await api.appointmentAvailability(
        Number(managerUserId),
        appointmentDate
      )) as AvailabilityResponse;

      setAvailability(data);

      const firstAvailable = data.slots.find((slot) => slot.available);
      setSelectedTime(firstAvailable?.time || "");
    } catch (err) {
      setAvailability(null);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao consultar disponibilidade."
      );
    } finally {
      setAvailabilityLoading(false);
    }
  }

  useEffect(() => {
    loadAvailability();
  }, [managerUserId, appointmentDate]);

  function resetForm() {
    setClientName("");
    setClientCpfCnpj("");
    setClientPhone("");
    setClientWhatsapp("");
    setClientEmail("");
    setClientAddress("");
    setClientCity("Macapá");
    setClientState("AP");
    setProtocolDescription("");
    setPriority("NORMAL");
    setDocumentFile(null);
    setDocumentType("DOCUMENTO_INICIAL");
    setSelectedTime("");
    setAppointmentDate("");
    setDurationMinutes("60");
    setMeetingType("Presencial");
    setMeetingLocation(
      "AMAZONIKA - Av. Almirante Barroso, 620-B, Centro, Macapá/AP"
    );
    setMeetingLink("");
    setAppointmentNotes("");
    setAvailability(null);
  }

  async function handleCreateProtocolFlow() {
    try {
 setSaving(true);

setProcessingMessage("Criando protocolo e preparando agendamento...");
setError("");
setSuccess("");

      if (!clientName.trim()) {
        throw new Error("Informe o nome do cliente.");
      }

      if (!serviceTypeId) {
        throw new Error("Selecione o tipo de serviço.");
      }

      if (!managerUserId) {
        throw new Error("Selecione o gestor responsável.");
      }

      if (!appointmentDate || !selectedTime) {
        throw new Error("Selecione a data e o horário do agendamento.");
      }

      const selectedSlot = availability?.slots.find(
        (slot) => slot.time === selectedTime
      );

      if (selectedSlot && !selectedSlot.available) {
        throw new Error(
          `Horário ocupado pelo protocolo ${selectedSlot.appointment?.protocolNumber}. Escolha outro horário.`
        );
      }

      setProcessingMessage("Registrando dados do cliente...");

      const client = (await api.createClient({
        name: clientName,
        personType: clientCpfCnpj.length > 14 ? "PJ" : "PF",
        cpfCnpj: clientCpfCnpj,
        phone: clientPhone,
        whatsapp: clientWhatsapp || clientPhone,
        email: clientEmail,
        address: clientAddress,
        city: clientCity,
        state: clientState,
      })) as { id: number; name: string };

      setProcessingMessage("Criando protocolo no sistema...");

      const protocol = (await api.createProtocol({
        clientId: client.id,
        serviceTypeId: Number(serviceTypeId),
        description: protocolDescription,
        priority,
      })) as BackendProtocol;

      setProcessingMessage("Enviando documento para análise...");

      if (documentFile) {
        await api.uploadProtocolDocument(
          protocol.id,
          documentFile,
          documentType
        );
      }

      const scheduledAt = `${appointmentDate}T${selectedTime}:00-03:00`;

      setProcessingMessage("Registrando agendamento e verificando disponibilidade...");

      await api.createAppointment({
        protocolId: protocol.id,
        clientId: client.id,
        managerUserId: Number(managerUserId),
        scheduledAt,
        durationMinutes: Number(durationMinutes || 60),
        meetingType,
        location: meetingType === "Presencial" ? meetingLocation : undefined,
        meetingLink:
          meetingType === "Google Meet" || meetingType === "Online"
            ? meetingLink
            : undefined,
        notes: appointmentNotes,
      });

      setProcessingMessage("Gerando PDF e enviando e-mails para cliente, gestor e empresa...");

      setSuccess(
        `Protocolo ${protocol.protocolNumber} criado e agendamento enviado ao gestor.`
      );

      resetForm();
      setShowNewProtocol(false);
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao criar protocolo."
      );
    } finally {
      
      setSaving(false);
      setProcessingMessage("");
    }
  }

  const filtered = items.filter((item) => {
    const text = `${item.protocolNumber} ${item.client.name} ${
      item.serviceType.name
    } ${item.status} ${item.appointments?.[0]?.manager?.name || ""}`
      .toLowerCase();

    return text.includes(search.toLowerCase());
  });

  

  return (
    <section className="page">
      <ProcessingOverlay message={processingMessage} />
      <div className="page-heading">
        <div>
          <span className="eyebrow">Atendimento</span>
          <h1>Protocolos e agendamentos</h1>
        </div>

        <button
          className="button primary"
          onClick={() => setShowNewProtocol((value) => !value)}
        >
          {showNewProtocol ? "Fechar cadastro" : "Novo protocolo"}
        </button>
      </div>

      {success && <div className="panel success-panel">{success}</div>}
      {error && <div className="panel error-panel">{error}</div>}

      {showNewProtocol && (
        <div className="panel protocol-form-panel">
          <div className="panel-header">
            <h2>Novo protocolo com agendamento</h2>
          </div>

          <div className="protocol-form-grid">
            <div className="form-section">
              <h3>1. Dados do cliente</h3>

              <label>
                Nome do cliente *
                <input
                  value={clientName}
                  onChange={(event) => setClientName(event.target.value)}
                  placeholder="Nome completo, empresa ou propriedade"
                />
              </label>

              <div className="form-row">
                <label>
                  CPF/CNPJ
                  <input
                    value={clientCpfCnpj}
                    onChange={(event) => setClientCpfCnpj(event.target.value)}
                    placeholder="CPF ou CNPJ"
                  />
                </label>

                <label>
                  E-mail
                  <input
                    value={clientEmail}
                    onChange={(event) => setClientEmail(event.target.value)}
                    placeholder="cliente@email.com"
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Telefone
                  <input
                    value={clientPhone}
                    onChange={(event) => setClientPhone(event.target.value)}
                    placeholder="+55 (96) 99999-9999"
                  />
                </label>

                <label>
                  WhatsApp
                  <input
                    value={clientWhatsapp}
                    onChange={(event) => setClientWhatsapp(event.target.value)}
                    placeholder="+55 (96) 99999-9999"
                  />
                </label>
              </div>

              <label>
                Endereço
                <input
                  value={clientAddress}
                  onChange={(event) => setClientAddress(event.target.value)}
                  placeholder="Endereço do cliente ou imóvel"
                />
              </label>

              <div className="form-row">
                <label>
                  Município
                  <input
                    value={clientCity}
                    onChange={(event) => setClientCity(event.target.value)}
                  />
                </label>

                <label>
                  UF
                  <input
                    value={clientState}
                    onChange={(event) => setClientState(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="form-section">
              <h3>2. Serviço e protocolo</h3>

              <label>
                Tipo de serviço *
                <select
                  value={serviceTypeId}
                  onChange={(event) => setServiceTypeId(event.target.value)}
                >
                  {serviceTypes.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Prioridade
                <select
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                >
                  <option value="BAIXA">Baixa</option>
                  <option value="NORMAL">Normal</option>
                  <option value="ALTA">Alta</option>
                  <option value="URGENTE">Urgente</option>
                </select>
              </label>

              <label>
                Descrição da demanda
                <textarea
                  value={protocolDescription}
                  onChange={(event) =>
                    setProtocolDescription(event.target.value)
                  }
                  rows={5}
                  placeholder="Descreva a solicitação do cliente, documentos mencionados, objetivo do serviço e observações iniciais."
                />
              </label>

              <label>
                Documento para análise
                <input
                  type="file"
                  onChange={(event) =>
                    setDocumentFile(event.target.files?.[0] || null)
                  }
                />
              </label>

              <label>
                Tipo de documento
                <select
                  value={documentType}
                  onChange={(event) => setDocumentType(event.target.value)}
                >
                  <option value="DOCUMENTO_INICIAL">Documento inicial</option>
                  <option value="RG_CPF_CNPJ">RG/CPF/CNPJ</option>
                  <option value="DOCUMENTO_IMOVEL">Documento do imóvel</option>
                  <option value="CAR">CAR</option>
                  <option value="MATRICULA">Matrícula</option>
                  <option value="CCIR_ITR">CCIR/ITR</option>
                  <option value="OUTRO">Outro</option>
                </select>
              </label>
            </div>

            <div className="form-section calendar-section">
              <h3>3. Gestor e disponibilidade</h3>

              <div className="form-row">
                <label>
                  Gestor responsável *
                  <select
                    value={managerUserId}
                    onChange={(event) => setManagerUserId(event.target.value)}
                  >
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} — {manager.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Data da reunião *
                  <input
                    type="date"
                    value={appointmentDate}
                    onChange={(event) => setAppointmentDate(event.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Duração
                  <select
                    value={durationMinutes}
                    onChange={(event) => setDurationMinutes(event.target.value)}
                  >
                    <option value="30">30 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="90">1 hora e 30 minutos</option>
                    <option value="120">2 horas</option>
                  </select>
                </label>

                <label>
                  Tipo da reunião
                  <select
                    value={meetingType}
                    onChange={(event) => setMeetingType(event.target.value)}
                  >
                    <option value="Presencial">Presencial</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Google Meet">Google Meet</option>
                    <option value="Online">Online</option>
                    <option value="Telefone">Telefone</option>
                  </select>
                </label>
              </div>

              {meetingType === "Presencial" && (
                <label>
                  Local da reunião
                  <input
                    value={meetingLocation}
                    onChange={(event) => setMeetingLocation(event.target.value)}
                  />
                </label>
              )}

              {(meetingType === "Google Meet" || meetingType === "Online") && (
                <label>
                  Link da reunião
                  <input
                    value={meetingLink}
                    onChange={(event) => setMeetingLink(event.target.value)}
                    placeholder="https://meet.google.com/..."
                  />
                </label>
              )}

              <label>
                Observações do agendamento
                <textarea
                  value={appointmentNotes}
                  onChange={(event) => setAppointmentNotes(event.target.value)}
                  rows={3}
                  placeholder="Informações para o gestor antes da reunião."
                />
              </label>

              <div className="availability-box">
                <div className="availability-header">
                  <strong>Agenda do gestor</strong>

                  {availabilityLoading && <span>Consultando...</span>}
                  {!availabilityLoading && appointmentDate && (
                    <span>{appointmentDate}</span>
                  )}
                </div>

                {!managerUserId && (
                  <p>Selecione um gestor para visualizar a agenda.</p>
                )}

                {managerUserId && !appointmentDate && (
                  <p>Selecione uma data para visualizar os horários.</p>
                )}

                {managerUserId && appointmentDate && availability && (
                  <div className="slot-grid">
                    {availability.slots.map((slot) => (
                      <button
                        type="button"
                        key={slot.time}
                        className={`slot-button ${
                          slot.available ? "available" : "busy"
                        } ${selectedTime === slot.time ? "selected" : ""}`}
                        disabled={!slot.available}
                        onClick={() => setSelectedTime(slot.time)}
                        title={
                          slot.appointment
                            ? `${slot.appointment.protocolNumber} - ${slot.appointment.clientName}`
                            : "Disponível"
                        }
                      >
                        <strong>{slot.time}</strong>

                        <span>
                          {slot.available
                            ? "Disponível"
                            : `Ocupado: ${slot.appointment?.clientName}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}

                {managerUserId &&
                  appointmentDate &&
                  !availability &&
                  !availabilityLoading && (
                    <p>Não foi possível carregar a agenda deste gestor.</p>
                  )}
              </div>
            </div>
          </div>

          <div className="form-actions">
            <button
              type="button"
              className="button secondary-action"
              onClick={() => {
                resetForm();
                setShowNewProtocol(false);
              }}
            >
              Cancelar
            </button>

            <button
              type="button"
              className="button primary"
              onClick={handleCreateProtocolFlow}
              disabled={saving}
            >
              {saving
                ? "Salvando protocolo..."
                : "Criar protocolo e agendar"}
            </button>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2>Protocolos registrados</h2>

          <input
            className="search-input"
            placeholder="Buscar protocolo, cliente, serviço, gestor ou status"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>

        {loading && <p>Carregando protocolos...</p>}

        {!loading && (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Agendamento</th>
                  <th>Gestor</th>
                  <th>Status</th>
                  <th>Documentos</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {filtered.map((item) => {
                  const appointment = item.appointments?.[0];

                  return (
                    
                    <tr key={item.id}>
                      <td>
                        <Link
                          className="table-link"
                          to={`/app/protocolos/${item.id}`}
                        >
                          {item.protocolNumber}
                        </Link>
                      </td>

                      <td>{item.client.name}</td>

                      <td>{item.serviceType.name}</td>

                      <td>
                        {appointment
                          ? formatDateTime(appointment.scheduledAt)
                          : "Não agendado"}
                      </td>

                      <td>
                        {appointment?.manager ? (
                          <>
                            {appointment.manager.name}
                            <small className="table-small">
                              {appointment.manager.email}
                            </small>
                          </>
                        ) : (
                          "-"
                        )}
                      </td>

                      <td>
                        <span className={`badge ${item.status.toLowerCase()}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>

                      <td>{item.documents?.length || 0}</td>

                      <td>
                        <div className="table-actions">
                          <Link
                            className="mini-button"
                            to={`/app/protocolos/${item.id}`}
                          >
                            Detalhes
                          </Link>

                          <Link
                            className="mini-button"
                            to={`/app/protocolos/${item.id}?edit=1`}
                          >
                            Editar
                          </Link>

                          <button
                            className="mini-button"
                            type="button"
                            onClick={async () => {
                              try {
                                setSaving(true);
                                setError("");
                                setSuccess("");

                                await api.resendAppointmentEmail(item.id);

                                setSuccess(
                                  "E-mail de agendamento reenviado aos gestores."
                                );
                              } catch (err) {
                                setError(
                                  err instanceof Error
                                    ? err.message
                                    : "Erro ao reenviar e-mail."
                                );
                              } finally {
                                setSaving(false);
                              }
                            }}
                          >
                            Reenviar
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filtered.length === 0 && <p>Nenhum protocolo encontrado.</p>}
          </div>
        )}
      </div>
    </section>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value?: string | number | null;
}) {
  return (
    <div className="detail-row">
      <span>{label}</span>
      <strong>{value || "-"}</strong>
    </div>
  );
}

function ProposalPanel({
  protocol,
  onReload,
}: {
  protocol: BackendProtocol;
  onReload?: () => Promise<void> | void;
}) {
  const today = new Date().toISOString().slice(0, 10);

  const [proposals, setProposals] = useState<BackendProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);
  const [editingProposal, setEditingProposal] =
    useState<BackendProposal | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [technicalScope, setTechnicalScope] = useState("");
  const [paymentMode, setPaymentMode] =
    useState<BackendProposal["paymentMode"]>("ENTRADA_PARCELAS");

  const [entryAmount, setEntryAmount] = useState("");
  const [installmentQty, setInstallmentQty] = useState("3");
  const [executionDays, setExecutionDays] = useState("30");
  const [validUntil, setValidUntil] = useState("");
  const [clientMessage, setClientMessage] = useState("");
  const [internalNotes, setInternalNotes] = useState("");

  const [items, setItems] = useState<ProposalFormItem[]>([
    {
      serviceName: protocol.serviceType?.name || "",
      description: protocol.description || "",
      quantity: "1",
      unitAmount: String(protocol.estimatedValue || protocol.finalValue || ""),
    },
  ]);

  async function loadProposals() {
    try {
      setLoading(true);
      setError("");

      const data = (await api.proposals(protocol.id)) as BackendProposal[];
      setProposals(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar propostas."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProposals();
  }, [protocol.id]);

  function resetForm() {
    setEditingProposal(null);
    setTitle(`Proposta Comercial — ${protocol.protocolNumber}`);
    setDescription(protocol.description || "");
    setTechnicalScope(protocol.description || "");
    setPaymentMode("ENTRADA_PARCELAS");
    setEntryAmount("");
    setInstallmentQty("3");
    setExecutionDays("30");
    setValidUntil(today);
    setClientMessage(
      "Prezado(a) cliente, segue proposta comercial referente aos serviços solicitados junto à AMAZONIKA Engenharia & Meio Ambiente."
    );
    setInternalNotes("");
    setItems([
      {
        serviceName: protocol.serviceType?.name || "",
        description: protocol.description || "",
        quantity: "1",
        unitAmount: String(protocol.estimatedValue || protocol.finalValue || ""),
      },
    ]);
  }

  function startNewProposal() {
    resetForm();
    setShowForm(true);
  }

  function startEditProposal(proposal: BackendProposal) {
    setEditingProposal(proposal);
    setShowForm(true);

    setTitle(proposal.title || "");
    setDescription(proposal.description || "");
    setTechnicalScope(proposal.technicalScope || "");
    setPaymentMode(proposal.paymentMode || "ENTRADA_PARCELAS");
    setEntryAmount(String(proposal.entryAmount || ""));
    setInstallmentQty(
      proposal.installmentQty !== null && proposal.installmentQty !== undefined
        ? String(proposal.installmentQty)
        : ""
    );
    setExecutionDays(
      proposal.executionDays !== null && proposal.executionDays !== undefined
        ? String(proposal.executionDays)
        : ""
    );
    setValidUntil(proposal.validUntil ? proposal.validUntil.slice(0, 10) : "");
    setClientMessage(proposal.clientMessage || "");
    setInternalNotes(proposal.internalNotes || "");

    setItems(
      proposal.items.map((item) => ({
        serviceName: item.serviceName,
        description: item.description || "",
        quantity: String(item.quantity || 1),
        unitAmount: String(item.unitAmount || 0),
      }))
    );
  }

  function addItem() {
    setItems((current) => [
      ...current,
      {
        serviceName: "",
        description: "",
        quantity: "1",
        unitAmount: "",
      },
    ]);
  }

  function updateItem(
    index: number,
    field: keyof ProposalFormItem,
    value: string
  ) {
    setItems((current) =>
      current.map((item, itemIndex) =>
        itemIndex === index ? { ...item, [field]: value } : item
      )
    );
  }

  function removeItem(index: number) {
    setItems((current) => current.filter((_, itemIndex) => itemIndex !== index));
  }

  const proposalTotal = items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 1);
    const unitAmount = Number(item.unitAmount || 0);

    if (Number.isNaN(quantity) || Number.isNaN(unitAmount)) {
      return sum;
    }

    return sum + quantity * unitAmount;
  }, 0);

  const entryValue =
    paymentMode === "A_VISTA"
      ? proposalTotal
      : entryAmount
      ? Number(entryAmount)
      : Math.round(proposalTotal * 0.3);

  const installmentValue =
    paymentMode !== "A_VISTA" && installmentQty && Number(installmentQty) > 0
      ? Math.round((proposalTotal - entryValue) / Number(installmentQty))
      : 0;

  const hasInvalidProposalValues =
    proposalTotal <= 0 ||
    Number.isNaN(entryValue) ||
    entryValue < 0 ||
    entryValue > proposalTotal ||
    (paymentMode === "ENTRADA_PARCELAS" &&
      (!installmentQty || Number(installmentQty) <= 0));

  async function handleSaveProposal() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!title.trim()) {
        throw new Error("Informe o título da proposta.");
      }

      const validItems = items.filter(
        (item) =>
          item.serviceName.trim() &&
          Number(item.quantity || 1) > 0 &&
          Number(item.unitAmount || 0) > 0
      );

      if (validItems.length === 0) {
        throw new Error("Inclua pelo menos um item com descrição e valor.");
      }

      const totalToValidate = validItems.reduce((sum, item) => {
        const quantity = Number(item.quantity || 1);
        const unitAmount = Number(item.unitAmount || 0);
        return sum + quantity * unitAmount;
      }, 0);

      const entryValueToValidate =
        paymentMode === "A_VISTA"
          ? totalToValidate
          : entryAmount
          ? Number(entryAmount)
          : Math.round(totalToValidate * 0.3);

      if (totalToValidate <= 0) {
        throw new Error("O valor total da proposta deve ser maior que zero.");
      }

      if (Number.isNaN(entryValueToValidate)) {
        throw new Error("Informe um valor de entrada válido.");
      }

      if (entryValueToValidate < 0) {
        throw new Error("A entrada não pode ser negativa.");
      }

      if (entryValueToValidate > totalToValidate) {
        throw new Error(
          "A entrada não pode ser maior que o valor total da proposta."
        );
      }

      if (
        paymentMode === "ENTRADA_PARCELAS" &&
        (!installmentQty || Number(installmentQty) <= 0)
      ) {
        throw new Error(
          "Informe a quantidade de parcelas para pagamento com entrada + parcelas."
        );
      }

      const payload = {
        protocolId: protocol.id,
        title: title.trim(),
        description: description || null,
        technicalScope: technicalScope || null,
        paymentMode,
        entryAmount: entryValueToValidate,
        installmentQty:
          paymentMode === "A_VISTA"
            ? null
            : installmentQty
            ? Number(installmentQty)
            : null,
        executionDays: executionDays ? Number(executionDays) : null,
        validUntil: validUntil || null,
        clientMessage: clientMessage || null,
        internalNotes: internalNotes || null,
        items: validItems.map((item) => ({
          serviceName: item.serviceName.trim(),
          description: item.description || null,
          quantity: Number(item.quantity || 1),
          unitAmount: Number(item.unitAmount || 0),
        })),
      };

      if (editingProposal) {
        await api.updateProposal(editingProposal.id, payload);
        setSuccess("Proposta atualizada com sucesso.");
      } else {
        await api.createProposal(payload);
        setSuccess("Proposta criada com sucesso.");
      }

      resetForm();
      setShowForm(false);
      await loadProposals();
      await onReload?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar proposta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleSendProposalEmail(item: BackendProposal) {
    const confirmed = window.confirm(
      `Deseja enviar a proposta ${item.proposalNumber} para o e-mail do cliente?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = (await api.sendProposalEmail(item.id)) as {
        sent: boolean;
        publicUrl?: string;
        recipient?: string;
      };

      setSuccess(
        response?.publicUrl
          ? `Proposta enviada por e-mail com sucesso. Link público: ${response.publicUrl}`
          : "Proposta enviada por e-mail com sucesso."
      );

      await loadProposals();
      await onReload?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao enviar proposta por e-mail."
      );
    } finally {
      setSaving(false);
    }
  }

return (
  <article className="panel proposal-panel">
    <div className="panel-header">
      <div>
        <h2>Propostas comerciais</h2>
        <p>
          Gere propostas com itens, valores, forma de pagamento e aceite do
          cliente.
        </p>
      </div>

      <button
        className="button primary"
        type="button"
        onClick={() => {
          if (showForm) {
            resetForm();
            setShowForm(false);
            return;
          }

          startNewProposal();
        }}
      >
        {showForm ? "Fechar formulário" : "Gerar proposta"}
      </button>
    </div>

    {saving && (
      <div className="modal-backdrop">
        <div className="protocol-modal progress-modal">
          <h2>Processando...</h2>
          <p>Aguarde enquanto o sistema atualiza a proposta.</p>
        </div>
      </div>
    )}

    {success && <div className="panel success-panel">{success}</div>}
    {error && <div className="panel error-panel">{error}</div>}

    {showForm && (
      <div className="panel soft-panel">
        <h3>{editingProposal ? "Editar proposta" : "Nova proposta"}</h3>

        <div className="form-row">
          <label>
            Título da proposta
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Ex: Proposta Comercial de Licenciamento Ambiental"
            />
          </label>

          <label>
            Validade da proposta
            <input
              type="date"
              value={validUntil}
              onChange={(event) => setValidUntil(event.target.value)}
            />
          </label>

          <label>
            Prazo de execução em dias
            <input
              type="number"
              value={executionDays}
              onChange={(event) => setExecutionDays(event.target.value)}
            />
          </label>
        </div>

        <label>
          Descrição comercial
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Resumo da proposta comercial"
          />
        </label>

        <label>
          Escopo técnico
          <textarea
            value={technicalScope}
            onChange={(event) => setTechnicalScope(event.target.value)}
            rows={4}
            placeholder="Descreva o escopo técnico dos serviços"
          />
        </label>

        <div className="proposal-items-header">
          <h4>Itens da proposta</h4>

          <button className="mini-button" type="button" onClick={addItem}>
            Adicionar item
          </button>
        </div>

        <div className="proposal-items-list">
          {items.map((item, index) => (
            <div className="proposal-item-card" key={`item-${index}`}>
              <div className="form-row">
                <label>
                  Serviço / Item
                  <input
                    value={item.serviceName}
                    onChange={(event) =>
                      updateItem(index, "serviceName", event.target.value)
                    }
                    placeholder="Ex: Licenciamento ambiental"
                  />
                </label>

                <label>
                  Quantidade
                  <input
                    type="number"
                    value={item.quantity}
                    onChange={(event) =>
                      updateItem(index, "quantity", event.target.value)
                    }
                  />
                </label>

                <label>
                  Valor unitário
                  <input
                    type="number"
                    value={item.unitAmount}
                    onChange={(event) =>
                      updateItem(index, "unitAmount", event.target.value)
                    }
                    placeholder="0"
                  />
                </label>
              </div>

              <label>
                Descrição do item
                <textarea
                  value={item.description}
                  onChange={(event) =>
                    updateItem(index, "description", event.target.value)
                  }
                  rows={2}
                />
              </label>

              <div className="proposal-item-footer">
                <strong>
                  Total do item:{" "}
                  {money(
                    Number(item.quantity || 1) * Number(item.unitAmount || 0)
                  )}
                </strong>

                {items.length > 1 && (
                  <button
                    className="mini-button danger"
                    type="button"
                    onClick={() => removeItem(index)}
                  >
                    Remover
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="proposal-payment-grid">
          <label>
            Forma de pagamento
            <select
              value={paymentMode}
              onChange={(event) => {
                const value = event.target
                  .value as BackendProposal["paymentMode"];

                setPaymentMode(value);

                if (value === "A_VISTA") {
                  setEntryAmount("");
                  setInstallmentQty("");
                }

                if (value === "ENTRADA_PARCELAS" && !installmentQty) {
                  setInstallmentQty("3");
                }
              }}
            >
              <option value="A_VISTA">À vista</option>
              <option value="ENTRADA_PARCELAS">Entrada + parcelas</option>
              <option value="PARCELADO">Parcelado</option>
              <option value="PERSONALIZADO">Personalizado</option>
            </select>
          </label>

          <label>
            Entrada
            <input
              type="number"
              value={
                paymentMode === "A_VISTA" ? String(proposalTotal) : entryAmount
              }
              onChange={(event) => setEntryAmount(event.target.value)}
              placeholder="30% automático se vazio"
              disabled={paymentMode === "A_VISTA"}
            />
          </label>

          <label>
            Número de parcelas
            <input
              type="number"
              value={installmentQty}
              onChange={(event) => setInstallmentQty(event.target.value)}
              disabled={paymentMode === "A_VISTA"}
            />
          </label>

          <div className="proposal-total-card">
            <span>Total da proposta</span>
            <strong>{money(proposalTotal)}</strong>
            <small>
              Entrada: {money(entryValue)} · Parcela estimada:{" "}
              {money(installmentValue)}
            </small>
          </div>
        </div>

        <label>
          Mensagem ao cliente
          <textarea
            value={clientMessage}
            onChange={(event) => setClientMessage(event.target.value)}
            rows={3}
          />
        </label>

        <label>
          Observações internas
          <textarea
            value={internalNotes}
            onChange={(event) => setInternalNotes(event.target.value)}
            rows={3}
          />
        </label>

        {hasInvalidProposalValues && (
          <div className="panel error-panel">
            Verifique os valores da proposta: o total deve ser maior que zero, a
            entrada não pode ser negativa e não pode ser maior que o valor total.
          </div>
        )}

        <div className="form-actions">
          <button
            className="secondary-action"
            type="button"
            onClick={() => {
              resetForm();
              setShowForm(false);
            }}
          >
            Cancelar
          </button>

          <button
            className="button primary"
            type="button"
            disabled={saving || hasInvalidProposalValues}
            onClick={handleSaveProposal}
          >
            {saving
              ? "Salvando..."
              : editingProposal
              ? "Atualizar proposta"
              : "Salvar proposta"}
          </button>
        </div>
      </div>
    )}

    {loading && <div className="panel">Carregando propostas...</div>}

    {!loading && (
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Proposta</th>
              <th>Status</th>
              <th>Valor total</th>
              <th>Entrada</th>
              <th>Pagamento</th>
              <th>Validade</th>
              <th>Ações</th>
            </tr>
          </thead>

          <tbody>
            {proposals.map((proposal) => (
              <tr key={proposal.id}>
                <td>
                  <strong>{proposal.proposalNumber}</strong>
                  <small className="table-small">{proposal.title}</small>
                </td>

                <td>
                  <span
                    className={`badge proposal-${proposalStatusClass(
                      proposal.status
                    )}`}
                  >
                    {proposalStatusLabel(proposal.status)}
                  </span>
                </td>

                <td>{money(proposal.totalAmount)}</td>
                <td>{money(proposal.entryAmount)}</td>
                <td>{paymentModeLabel(proposal.paymentMode)}</td>
                <td>
                  {proposal.validUntil ? formatDate(proposal.validUntil) : "-"}
                </td>

                <td>
                  <div className="table-actions">
                    {(proposal.status === "RASCUNHO" ||
                      proposal.status === "AJUSTE_SOLICITADO") && (
                      <>
                        <button
                          className="mini-button"
                          type="button"
                          onClick={() => startEditProposal(proposal)}
                        >
                          Editar
                        </button>

                        <button
                          className="mini-button"
                          type="button"
                          disabled={saving}
                          onClick={() => handleSendProposalEmail(proposal)}
                        >
                          Enviar
                        </button>
                      </>
                    )}

                    {proposal.status === "ENVIADA" && (
                      <a
                        className="mini-button"
                        href={`/proposta/${proposal.publicToken}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver link
                      </a>
                    )}

                    {proposal.status === "ACEITA" && (
                      <a
                        className="mini-button"
                        href={`/proposta/${proposal.publicToken}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver aceite
                      </a>
                    )}

                    {proposal.status === "RECUSADA" && (
                      <a
                        className="mini-button"
                        href={`/proposta/${proposal.publicToken}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver recusa
                      </a>
                    )}

                    {proposal.status === "CONVERTIDA_EM_CONTRATO" && (
                      <span className="table-small">
                        Convertida em contrato
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {proposals.length === 0 && (
          <p>Nenhuma proposta criada para este protocolo.</p>
        )}
      </div>
    )}
  </article>
);
}

function ContractPanel({
  protocol,
  onReload,
}: {
  protocol: BackendProtocol;
  onReload?: () => Promise<void> | void;
}) {
  const [contracts, setContracts] = useState<BackendContract[]>([]);
  const [proposals, setProposals] = useState<BackendProposal[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [contractsData, proposalsData] = await Promise.all([
        api.contracts(protocol.id) as Promise<BackendContract[]>,
        api.proposals(protocol.id) as Promise<BackendProposal[]>,
      ]);

      setContracts(Array.isArray(contractsData) ? contractsData : []);
      setProposals(Array.isArray(proposalsData) ? proposalsData : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar contratos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [protocol.id]);


const proposalIdsWithContract = new Set(
  contracts
    .filter(
      (contract) =>
        contract.status !== "CANCELADO" &&
        contract.status !== "SUBSTITUIDO" &&
        contract.proposalId
    )
    .map((contract) => contract.proposalId)
);

const acceptedProposal = proposals.find(
  (proposal) =>
    proposal.status === "ACEITA" && !proposalIdsWithContract.has(proposal.id)
);

const hasAcceptedProposalPendingContract = Boolean(acceptedProposal);



  async function handleGenerateContract() {
    if (!acceptedProposal) {
      setError("Nenhuma proposta aceita foi encontrada para gerar contrato.");
      return;
    }

    const confirmed = window.confirm(
      `Deseja gerar contrato a partir da proposta ${acceptedProposal.proposalNumber}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = (await api.generateContractFromProposal(
        acceptedProposal.id
      )) as BackendContract;

      setSuccess(
        `Contrato ${response.contractNumber} gerado com sucesso.`
      );

      await loadData();
      await onReload?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao gerar contrato."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleSendContract(contract: BackendContract) {
    const confirmed = window.confirm(
      `Deseja enviar o contrato ${contract.contractNumber} para o e-mail do cliente?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const response = (await api.sendContract(contract.id)) as BackendContract;

      setSuccess(
        response?.publicUrl
          ? `Contrato enviado com sucesso. Link público: ${response.publicUrl}`
          : "Contrato enviado com sucesso."
      );

      await loadData();
      await onReload?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao enviar contrato."
      );
    } finally {
      setSaving(false);
    }
  }

  function copyPublicLink(contract: BackendContract) {
    const url =
      contract.publicUrl ||
      `${window.location.origin}/contrato/${contract.publicToken}`;

    navigator.clipboard
      .writeText(url)
      .then(() => {
        setSuccess("Link público do contrato copiado.");
      })
      .catch(() => {
        setError("Não foi possível copiar o link.");
      });
  }

  return (
    <article className="panel contract-panel no-print">
      <div className="panel-header">
        <div>
          <h2>Contratos</h2>
          <p>
            Gere o contrato após o aceite da proposta e envie o link de assinatura
            eletrônica ao cliente.
          </p>
        </div>

<button
  className="button primary"
  type="button"
  disabled={saving || !hasAcceptedProposalPendingContract}
  onClick={handleGenerateContract}
  title={
    !hasAcceptedProposalPendingContract
      ? "É necessário ter uma proposta aceita ainda não convertida em contrato."
      : "Gerar contrato"
  }
>
  Gerar contrato
</button>
      </div>

      {saving && (
        <div className="modal-backdrop">
          <div className="protocol-modal progress-modal">
            <h2>Processando...</h2>
            <p>Aguarde enquanto o sistema atualiza o contrato.</p>
          </div>
        </div>
      )}

      {success && <div className="panel success-panel">{success}</div>}
      {error && <div className="panel error-panel">{error}</div>}

{!acceptedProposal && !loading && (
  <div className="info-panel">
    O contrato só poderá ser gerado quando existir uma proposta aceita que ainda
    não tenha sido convertida em contrato.
  </div>
)}

      {acceptedProposal && !loading && (
        <div className="contract-source-box">
          <span>Proposta vinculável</span>
          <strong>{acceptedProposal.proposalNumber}</strong>
          <small>
            {proposalStatusLabel(acceptedProposal.status)} ·{" "}
            Valor total: {money(acceptedProposal.totalAmount)} · Entrada:{" "}
            {money(acceptedProposal.entryAmount)}
          </small>
        </div>
      )}

      {loading && <div className="panel">Carregando contratos...</div>}

      {!loading && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Contrato</th>
                <th>Status</th>
                <th>Valor</th>
                <th>Entrada</th>
                <th>Enviado em</th>
                <th>Assinado em</th>
                <th>Ações</th>
              </tr>
            </thead>

            <tbody>
              {contracts.map((contract) => (
                <tr key={contract.id}>
                  <td>
                    <strong>{contract.contractNumber}</strong>
                    <small className="table-small">
                      {contract.title || "Contrato de prestação de serviços"}
                    </small>
                  </td>

                  <td>
                    <span
                      className={`badge contract-${contractStatusClass(
                        contract.status
                      )}`}
                    >
                      {contractStatusLabel(contract.status)}
                    </span>
                  </td>

                  <td>{money(contract.contractValue || 0)}</td>
                  <td>{money(contract.entryAmount || 0)}</td>
                  <td>{formatDateTime(contract.sentToClientAt)}</td>
                  <td>{formatDateTime(contract.signedAt)}</td>

                  <td>
                    <div className="table-actions">
                      {(contract.status === "GERADO" ||
                        contract.status === "ENVIADO" ||
                        contract.status === "AGUARDANDO_ASSINATURA") && (
                        <button
                          className="mini-button"
                          type="button"
                          disabled={saving}
                          onClick={() => handleSendContract(contract)}
                        >
                          Enviar
                        </button>
                      )}

                      <a
                        className="mini-button"
                        href={`/contrato/${contract.publicToken}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Ver link
                      </a>

                      <button
                        className="mini-button"
                        type="button"
                        onClick={() => copyPublicLink(contract)}
                      >
                        Copiar link
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {contracts.length === 0 && (
            <p>Nenhum contrato gerado para este protocolo.</p>
          )}
        </div>
      )}
    </article>
  );
}

function BillingPanel({
  protocol,
  onReload,
}: {
  protocol: BackendProtocol;
  onReload?: () => Promise<void> | void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const defaultDueDate = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const [contracts, setContracts] = useState<BackendContract[]>([]);
  const [charges, setCharges] = useState<BackendBillingCharge[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [dueDate, setDueDate] = useState(defaultDueDate);
  const [chargeDescription, setChargeDescription] = useState("");

  const defaultFirstInstallmentDueDate = new Date(
  Date.now() + 30 * 24 * 60 * 60 * 1000
)
  .toISOString()
  .slice(0, 10);

const [firstInstallmentDueDate, setFirstInstallmentDueDate] = useState(
  defaultFirstInstallmentDueDate
);

const [installmentIntervalDays, setInstallmentIntervalDays] = useState("30");

const [installmentFiscalMode, setInstallmentFiscalMode] =
  useState<"NOTA_FISCAL_ANTES" | "RECIBO_POSTERIOR">("RECIBO_POSTERIOR");

const [installmentNotes, setInstallmentNotes] = useState("");

  const [selectedFiscalMode, setSelectedFiscalMode] =
    useState<"NOTA_FISCAL_ANTES" | "RECIBO_POSTERIOR">("NOTA_FISCAL_ANTES");

  const [documentFile, setDocumentFile] = useState<File | null>(null);
  const [documentType, setDocumentType] =
    useState<"NOTA_FISCAL" | "RECIBO" | "COMPROVANTE" | "OUTRO">("NOTA_FISCAL");
  const [documentMoment, setDocumentMoment] =
    useState<"PRE_COBRANCA" | "POS_PAGAMENTO">("PRE_COBRANCA");
  const [documentNumber, setDocumentNumber] = useState("");
  const [documentIssuedAt, setDocumentIssuedAt] = useState(today);
  const [documentAmount, setDocumentAmount] = useState("");
  const [documentNotes, setDocumentNotes] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [contractsData, chargesData] = await Promise.all([
        api.contracts(protocol.id) as Promise<BackendContract[]>,
        api.billingCharges(protocol.id) as Promise<BackendBillingCharge[]>,
      ]);

      setContracts(Array.isArray(contractsData) ? contractsData : []);
      setCharges(Array.isArray(chargesData) ? chargesData : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar cobranças."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, [protocol.id]);

  const signedContract = contracts.find(
    (contract) => contract.status === "ASSINADO"
  );
const activeCharge = charges.find(
  (charge) =>
    charge.contractId === signedContract?.id &&
    charge.status !== "PAGA" &&
    charge.status !== "CANCELADA" &&
    charge.status !== "VENCIDA" &&
    charge.status !== "ERRO"
);

const entryChargePaid = charges.some(
  (charge) =>
    charge.contractId === signedContract?.id &&
    charge.chargeType === "ENTRADA" &&
    charge.status === "PAGA"
);

const installmentCharges = charges.filter(
  (charge) =>
    charge.contractId === signedContract?.id &&
    charge.chargeType === "PARCELA" &&
    charge.status !== "CANCELADA" &&
    charge.status !== "ERRO"
);

const hasInstallmentCharges = installmentCharges.length > 0;

const contractTotalValue = Number(signedContract?.contractValue || 0);
const contractEntryValue = Number(signedContract?.entryAmount || 0);
const contractBalanceValue = Math.max(0, contractTotalValue - contractEntryValue);

const proposalInstallmentQty =
  signedContract?.proposal?.installmentQty !== null &&
  signedContract?.proposal?.installmentQty !== undefined
    ? Number(signedContract.proposal.installmentQty)
    : 0;

  async function handleGenerateEntryCharge() {
    if (!signedContract) {
      setError("É necessário ter um contrato assinado para gerar a cobrança.");
      return;
    }

    const confirmed = window.confirm(
      `Deseja gerar a cobrança da entrada do contrato ${signedContract.contractNumber}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.generateEntryCharge(signedContract.id, {
        dueDate,
        description:
          chargeDescription ||
          `Entrada do contrato ${signedContract.contractNumber}`,
      });

      setSuccess("Cobrança da entrada criada com sucesso.");
      await loadData();
      await onReload?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao gerar cobrança da entrada."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleGenerateInstallmentCharges() {
  if (!signedContract) {
    setError("É necessário ter um contrato assinado para gerar as parcelas.");
    return;
  }

  if (!entryChargePaid) {
    setError(
      "A entrada precisa estar marcada como paga antes de gerar as parcelas do saldo."
    );
    return;
  }

  if (hasInstallmentCharges) {
    setError("Este contrato já possui parcelas geradas.");
    return;
  }

  if (!proposalInstallmentQty || proposalInstallmentQty <= 0) {
    setError(
      "A proposta vinculada ao contrato não possui quantidade de parcelas configurada."
    );
    return;
  }

  if (!contractBalanceValue || contractBalanceValue <= 0) {
    setError("Não há saldo restante para geração de parcelas.");
    return;
  }

  const confirmed = window.confirm(
    `Deseja gerar ${proposalInstallmentQty} parcela(s) do saldo de ${money(
      contractBalanceValue
    )} para o contrato ${signedContract.contractNumber}?`
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.generateInstallmentCharges(signedContract.id, {
      firstDueDate: firstInstallmentDueDate,
      intervalDays: Number(installmentIntervalDays || 30),
      fiscalMode: installmentFiscalMode,
      notes:
        installmentNotes ||
        "Parcelas do saldo geradas após entrega/finalização dos serviços.",
    });

    setSuccess("Parcelas do saldo geradas com sucesso.");
    await loadData();
    await onReload?.();
  } catch (err) {
    setError(
      err instanceof Error
        ? err.message
        : "Erro ao gerar parcelas do saldo."
    );
  } finally {
    setSaving(false);
  }
}

  async function handleSelectFiscalMode(charge: BackendBillingCharge) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.selectBillingFiscalMode(charge.id, {
        fiscalMode: selectedFiscalMode,
      });

      setSuccess("Modo fiscal atualizado com sucesso.");
      await loadData();
      await onReload?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao definir modo fiscal."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleUploadFiscalDocument(charge: BackendBillingCharge) {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!documentFile) {
        throw new Error("Selecione o arquivo da Nota Fiscal, recibo ou comprovante.");
      }

      await api.uploadBillingFiscalDocument(charge.id, documentFile, {
        type: documentType,
        moment: documentMoment,
        number: documentNumber || undefined,
        issuedAt: documentIssuedAt || undefined,
        amount: documentAmount ? Number(documentAmount) : undefined,
        notes: documentNotes || undefined,
      });

      setSuccess("Documento fiscal anexado com sucesso.");
      setDocumentFile(null);
      setDocumentNumber("");
      setDocumentAmount("");
      setDocumentNotes("");

      await loadData();
      await onReload?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao anexar documento fiscal."
      );
    } finally {
      setSaving(false);
    }
  }

async function handleEmitCharge(charge: BackendBillingCharge) {
  const confirmed = window.confirm(
    charge.chargeType === "PARCELA"
      ? "Deseja emitir a cobrança Pix com vencimento desta parcela?"
      : "Deseja emitir o Pix da entrada?"
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.emitBillingCharge(charge.id);

    setSuccess("Cobrança emitida com sucesso.");
    await loadData();
    await onReload?.();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Erro ao emitir cobrança.");
  } finally {
    setSaving(false);
  }
}

  async function handleSendCharge(charge: BackendBillingCharge) {
const confirmed = window.confirm(
  charge.chargeType === "PARCELA"
    ? "Deseja enviar esta parcela para o e-mail do cliente?"
    : "Deseja enviar a cobrança da entrada para o e-mail do cliente?"
);
    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.sendBillingCharge(charge.id);

      setSuccess("Cobrança enviada ao cliente com sucesso.");
      await loadData();
      await onReload?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar cobrança.");
    } finally {
      setSaving(false);
    }
  }

  async function handleMarkPaid(charge: BackendBillingCharge) {
    const confirmed = window.confirm(
      "Confirmar pagamento manual desta cobrança? O protocolo será liberado para execução."
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.markBillingChargePaid(charge.id, {
        paidAt: today,
        paidAmount: charge.amount,
        notes: "Pagamento confirmado manualmente no painel administrativo.",
      });

      setSuccess("Pagamento confirmado. Protocolo liberado para execução.");
      await loadData();
      await onReload?.();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao confirmar pagamento."
      );
    } finally {
      setSaving(false);
    }
  }

  function copyChargeLink(charge: BackendBillingCharge) {
    const url = `${window.location.origin}/cobranca/${charge.id}`;

    navigator.clipboard
      .writeText(url)
      .then(() => setSuccess("Link público da cobrança copiado."))
      .catch(() => setError("Não foi possível copiar o link da cobrança."));
  }

  async function handleReissuePix(charge: BackendBillingCharge) {
  const confirmed = window.confirm(
    `Deseja reemitir o Pix da cobrança #${charge.id}? O QR Code e o Pix copia e cola atuais serão substituídos.`
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.reissueBillingPix(charge.id);

    setSuccess("Pix reemitido com sucesso. O link público da cobrança já foi atualizado.");

    await loadData();
    await onReload?.();
  } catch (err) {
    setError(err instanceof Error ? err.message : "Erro ao reemitir Pix.");
  } finally {
    setSaving(false);
  }
}

  return (
    <article className="panel billing-panel no-print">
      <div className="panel-header">
        <div>
          <h2>Cobrança da entrada</h2>
          <p>
            Após a assinatura do contrato, anexe a Nota Fiscal ou defina recibo
            posterior, emita a cobrança e envie ao cliente.
          </p>
        </div>

        <button
          className="button primary"
          type="button"
          disabled={saving || !signedContract || Boolean(activeCharge)}
          onClick={handleGenerateEntryCharge}
          title={
            !signedContract
              ? "É necessário contrato assinado."
              : activeCharge
              ? "Já existe cobrança ativa para este contrato."
              : "Gerar cobrança da entrada"
          }
        >
          Gerar cobrança
        </button>
      </div>

      {saving && (
        <div className="modal-backdrop">
          <div className="protocol-modal progress-modal">
            <h2>Processando...</h2>
            <p>Aguarde enquanto o sistema atualiza a cobrança.</p>
          </div>
        </div>
      )}

      {success && <div className="panel success-panel">{success}</div>}
      {error && <div className="panel error-panel">{error}</div>}

      {loading && <div className="panel">Carregando cobranças...</div>}

      {!loading && !signedContract && (
        <div className="info-panel">
          A cobrança da entrada será liberada após o contrato estar assinado.
        </div>
      )}

      {!loading && signedContract && !activeCharge && (
        <div className="billing-create-box">
          <div>
            <span>Contrato assinado</span>
            <strong>{signedContract.contractNumber}</strong>
            <small>
             
  Entrada prevista: {money(signedContract.entryAmount || 0)}
</small>
           
          </div>

          <div className="form-row">
            <label>
              Vencimento da cobrança
              <input
                type="date"
                value={dueDate}
                onChange={(event) => setDueDate(event.target.value)}
              />
            </label>

            <label>
              Descrição
              <input
                value={chargeDescription}
                onChange={(event) => setChargeDescription(event.target.value)}
                placeholder={`Entrada do contrato ${signedContract.contractNumber}`}
              />
            </label>
          </div>
        </div>
      )}

      {!loading && signedContract && (
  <div className="billing-create-box installment-create-box">
    <div>
      <span>Parcelas do saldo</span>
      <strong>{signedContract.contractNumber}</strong>

      <small>
        Valor total: {money(contractTotalValue)} · Entrada:{" "}
        {money(contractEntryValue)} · Saldo: {money(contractBalanceValue)}
      </small>

      <small>
        Parcelas previstas:{" "}
        {proposalInstallmentQty > 0
          ? `${proposalInstallmentQty} parcela(s)`
          : "não configuradas"}
      </small>
    </div>

    {!entryChargePaid && (
      <div className="warning-panel">
        A geração das parcelas será liberada após a entrada estar marcada como
        paga.
      </div>
    )}

    {entryChargePaid && hasInstallmentCharges && (
      <div className="info-panel">
        As parcelas do saldo já foram geradas para este contrato.
      </div>
    )}

    {entryChargePaid && !hasInstallmentCharges && (
      <>
        <div className="form-row">
          <label>
            Primeiro vencimento
            <input
              type="date"
              value={firstInstallmentDueDate}
              onChange={(event) =>
                setFirstInstallmentDueDate(event.target.value)
              }
            />
          </label>

          <label>
            Intervalo entre parcelas em dias
            <input
              type="number"
              value={installmentIntervalDays}
              onChange={(event) =>
                setInstallmentIntervalDays(event.target.value)
              }
              placeholder="30"
            />
          </label>

          <label>
            Documento fiscal das parcelas
            <select
              value={installmentFiscalMode}
              onChange={(event) =>
                setInstallmentFiscalMode(
                  event.target.value as
                    | "NOTA_FISCAL_ANTES"
                    | "RECIBO_POSTERIOR"
                )
              }
            >
              <option value="RECIBO_POSTERIOR">
                Emitir Pix e gerar recibo após pagamento
              </option>
              <option value="NOTA_FISCAL_ANTES">
                Exigir Nota Fiscal antes de cada cobrança
              </option>
            </select>
          </label>
        </div>

        <label>
          Observações das parcelas
          <textarea
            rows={2}
            value={installmentNotes}
            onChange={(event) => setInstallmentNotes(event.target.value)}
            placeholder="Ex: Parcelas do saldo após entrega dos serviços."
          />
        </label>

        <button
          className="button primary"
          type="button"
          disabled={
            saving ||
            !entryChargePaid ||
            hasInstallmentCharges ||
            !proposalInstallmentQty ||
            contractBalanceValue <= 0
          }
          onClick={handleGenerateInstallmentCharges}
        >
          Gerar parcelas do saldo
        </button>
      </>
    )}
  </div>
)}

      {!loading && charges.length > 0 && (
  <div className="table-wrap billing-history-table">
    <h3>Histórico de cobranças</h3>

    <table className="data-table">
      <thead>
        <tr>
          <th>Cobrança</th>
          <th>Contrato</th>
          <th>Status</th>
          <th>Valor</th>
          <th>Vencimento</th>
          <th>Pago em</th>
          <th>Documento fiscal</th>
          <th>Ações</th>
        </tr>
      </thead>

      <tbody>
        {charges.map((charge) => {
          const receipt = (charge.fiscalDocuments || []).find(
            (document) =>
              document.status === "ANEXADO" &&
              document.type === "RECIBO" &&
              document.moment === "POS_PAGAMENTO"
          );

          const invoice = (charge.fiscalDocuments || []).find(
            (document) =>
              document.status === "ANEXADO" &&
              document.type === "NOTA_FISCAL"
          );

          const mainDocument = receipt || invoice;

          return (
            <tr key={`billing-history-${charge.id}`}>
<td>
  <strong>
    #{charge.id} ·{" "}
    {charge.chargeType === "PARCELA"
      ? `Parcela ${charge.installmentNumber || "-"}`
      : charge.chargeType === "ENTRADA"
      ? "Entrada"
      : "Avulsa"}
  </strong>
  <small className="table-small">{charge.description}</small>
</td>
              <td>{charge.contract?.contractNumber || "-"}</td>

              <td>
                <span
                  className={`badge billing-${billingStatusClass(
                    charge.status
                  )}`}
                >
                  {billingStatusLabel(charge.status)}
                </span>
              </td>

              <td>{money(charge.amount)}</td>

              <td>{formatDate(charge.dueDate)}</td>

              <td>{charge.paidAt ? formatDateTime(charge.paidAt) : "-"}</td>

              <td>
                {mainDocument ? (
                  <a
                    className="mini-button"
                    href={api.fileUrl(mainDocument.filePath)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {fiscalDocumentTypeLabel(mainDocument.type)}
                  </a>
                ) : (
                  "-"
                )}
              </td>

              <td>
                <div className="table-actions">
                  {(charge.status === "EMITIDA" ||
                    charge.status === "ENVIADA" ||
                    charge.status === "PAGA") && (
                    <a
                      className="mini-button"
                      href={`/cobranca/${charge.id}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Ver cobrança
                    </a>
                  )}

                  <button
                    className="mini-button"
                    type="button"
                    onClick={() => copyChargeLink(charge)}
                  >
                    Copiar link
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  </div>
)}

      {!loading && charges.length > 0 && (
        <div className="billing-charge-list">
          {charges.map((charge) => {
            const hasInvoice = (charge.fiscalDocuments || []).some(
              (document) =>
                document.status === "ANEXADO" &&
                document.type === "NOTA_FISCAL" &&
                document.moment === "PRE_COBRANCA"
            );

            const needsReceipt =
              charge.fiscalMode === "RECIBO_POSTERIOR" &&
              charge.status === "PAGA" &&
              !(charge.fiscalDocuments || []).some(
                (document) =>
                  document.status === "ANEXADO" &&
                  document.type === "RECIBO" &&
                  document.moment === "POS_PAGAMENTO"
              );

            return (
              <div className="billing-charge-card" key={charge.id}>
                <div className="billing-charge-head">
                  <div>
                    <span>Cobrança #{charge.id}</span>
                    <h3>{charge.description}</h3>
                    <p>
                      Vencimento: {formatDate(charge.dueDate)} · Modo fiscal:{" "}
                      {fiscalModeLabel(charge.fiscalMode)}
                    </p>
                  </div>

                  <div>
                    <strong>{money(charge.amount)}</strong>
                    <span
                      className={`badge billing-${billingStatusClass(
                        charge.status
                      )}`}
                    >
                      {billingStatusLabel(charge.status)}
                    </span>
                  </div>
                </div>

                {charge.status === "AGUARDANDO_DOCUMENTO_FISCAL" && (
                  <div className="billing-step-box">
                    <h4>1. Definição fiscal</h4>

                    <div className="form-row">
                      <label>
                        Como deseja seguir?
                        <select
                          value={selectedFiscalMode}
                          onChange={(event) =>
                            setSelectedFiscalMode(
                              event.target.value as
                                | "NOTA_FISCAL_ANTES"
                                | "RECIBO_POSTERIOR"
                            )
                          }
                        >
                          <option value="NOTA_FISCAL_ANTES">
                            Anexar Nota Fiscal antes da cobrança
                          </option>
                          <option value="RECIBO_POSTERIOR">
                            Emitir cobrança agora e anexar recibo após pagamento
                          </option>
                        </select>
                      </label>

                      <button
                        className="mini-button"
                        type="button"
                        disabled={saving}
                        onClick={() => handleSelectFiscalMode(charge)}
                      >
                        Confirmar modo fiscal
                      </button>
                    </div>
                  </div>
                )}

{(charge.status === "AGUARDANDO_DOCUMENTO_FISCAL" ||
  charge.status === "PRONTA_PARA_EMISSAO" ||
  charge.status === "EMITIDA" ||
  charge.status === "ENVIADA" ||
  needsReceipt) && (
                  <div className="billing-step-box">
                    <h4>
                      {charge.status === "PAGA"
                        ? "Documento pós-pagamento"
                        : "Documento fiscal"}
                    </h4>

                    {charge.fiscalMode === "NOTA_FISCAL_ANTES" && !hasInvoice && (
                      <div className="warning-panel">
                        Para emitir a cobrança, anexe a Nota Fiscal como
                        documento pré-cobrança.
                      </div>
                    )}

                    {needsReceipt && (
                      <div className="warning-panel">
                        Esta cobrança foi paga com recibo posterior. Anexe o
                        recibo para concluir a etapa documental.
                      </div>
                    )}

                    <div className="form-row">
                      <label>
                        Tipo
                        <select
                          value={documentType}
                          onChange={(event) =>
                            setDocumentType(
                              event.target.value as
                                | "NOTA_FISCAL"
                                | "RECIBO"
                                | "COMPROVANTE"
                                | "OUTRO"
                            )
                          }
                        >
                          <option value="NOTA_FISCAL">Nota Fiscal</option>
                          <option value="RECIBO">Recibo</option>
                          <option value="COMPROVANTE">Comprovante</option>
                          <option value="OUTRO">Outro</option>
                        </select>
                      </label>

                      <label>
                        Momento
                        <select
                          value={documentMoment}
                          onChange={(event) =>
                            setDocumentMoment(
                              event.target.value as
                                | "PRE_COBRANCA"
                                | "POS_PAGAMENTO"
                            )
                          }
                        >
                          <option value="PRE_COBRANCA">
                            Antes da cobrança
                          </option>
                          <option value="POS_PAGAMENTO">
                            Após pagamento
                          </option>
                        </select>
                      </label>

                      <label>
                        Número
                        <input
                          value={documentNumber}
                          onChange={(event) =>
                            setDocumentNumber(event.target.value)
                          }
                          placeholder="Número da NF/recibo"
                        />
                      </label>
                    </div>

                    <div className="form-row">
                      <label>
                        Data de emissão
                        <input
                          type="date"
                          value={documentIssuedAt}
                          onChange={(event) =>
                            setDocumentIssuedAt(event.target.value)
                          }
                        />
                      </label>

                      <label>
                        Valor
                        <input
                          type="number"
                          value={documentAmount}
                          onChange={(event) =>
                            setDocumentAmount(event.target.value)
                          }
                          placeholder="Valor do documento"
                        />
                      </label>

                      <label>
                        Arquivo
                        <input
                          type="file"
                          onChange={(event) =>
                            setDocumentFile(event.target.files?.[0] || null)
                          }
                        />
                      </label>
                    </div>

                    <label>
                      Observações
                      <textarea
                        rows={2}
                        value={documentNotes}
                        onChange={(event) =>
                          setDocumentNotes(event.target.value)
                        }
                      />
                    </label>

                    <button
                      className="mini-button"
                      type="button"
                      disabled={saving}
                      onClick={() => handleUploadFiscalDocument(charge)}
                    >
                      Anexar documento
                    </button>
                  </div>
                )}

                {(charge.fiscalDocuments || []).length > 0 && (
                  <div className="billing-documents-list">
                    <h4>Documentos vinculados</h4>

                    {(charge.fiscalDocuments || []).map((document) => (
                      <div key={document.id} className="billing-document-row">
                        <div>
                          <strong>{fiscalDocumentTypeLabel(document.type)}</strong>
                          <small>
                            {document.number ? `Nº ${document.number} · ` : ""}
                            {document.moment === "PRE_COBRANCA"
                              ? "Pré-cobrança"
                              : "Pós-pagamento"}{" "}
                            · {formatDateTime(document.createdAt)}
                          </small>
                        </div>

                        <a
                          className="mini-button"
                          href={api.fileUrl(document.filePath)}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Abrir
                        </a>
                      </div>
                    ))}
                  </div>
                )}

                {charge.status === "PRONTA_PARA_EMISSAO" && (
                  <button
                    className="button primary"
                    type="button"
                    disabled={saving}
                    onClick={() => handleEmitCharge(charge)}
                  >
                    Emitir Pix
                  </button>
                )}

                {(charge.status === "EMITIDA" ||
  charge.status === "ENVIADA" ||
  charge.status === "VENCIDA" ||
  charge.status === "ERRO") && (
  <div className="billing-payment-box">
    <h4>Dados de pagamento</h4>

    <DetailRow label="PIX copia e cola" value={charge.pixCopyPaste} />
    <DetailRow label="Linha digitável" value={charge.linhaDigitavel} />
    <DetailRow label="TXID" value={charge.txid} />

    <div className="table-actions">
  {charge.status === "EMITIDA" && (
    <button
      className="mini-button"
      type="button"
      disabled={saving}
      onClick={() => handleSendCharge(charge)}
    >
      Enviar ao cliente
    </button>
  )}

  <a
    className="mini-button"
    href={`/cobranca/${charge.id}`}
    target="_blank"
    rel="noreferrer"
  >
    Ver cobrança
  </a>

  <button
    className="mini-button"
    type="button"
    onClick={() => copyChargeLink(charge)}
  >
    Copiar link
  </button>

  <button
    className="mini-button"
    type="button"
    disabled={saving}
    onClick={() => handleReissuePix(charge)}
  >
    Reemitir Pix
  </button>

  {(charge.status === "EMITIDA" || charge.status === "ENVIADA") && (
    <button
      className="mini-button"
      type="button"
      disabled={saving}
      onClick={() => handleMarkPaid(charge)}
    >
      Marcar como pago
    </button>
  )}
</div>
  </div>
)}

                {charge.status === "PAGA" && (
                  <div className="success-panel">
                    Pagamento confirmado em {formatDateTime(charge.paidAt)}. O
                    protocolo foi liberado para execução.
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && charges.length === 0 && (
        <p>Nenhuma cobrança gerada para este protocolo.</p>
      )}
    </article>
  );
}

function PublicProposalPage() {
  const { token } = useParams();
  const navigate = useNavigate();

  const [proposal, setProposal] = useState<BackendProposal | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [adjustmentMessage, setAdjustmentMessage] = useState("");
  const [refuseMessage, setRefuseMessage] = useState("");
  const [mode, setMode] = useState<"VIEW" | "ADJUST" | "REFUSE">("VIEW");

  async function loadProposal() {
    try {
      setLoading(true);
      setError("");

      if (!token) {
        throw new Error("Token da proposta não informado.");
      }

      const data = (await api.publicProposal(token)) as BackendProposal;
      setProposal(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar proposta."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProposal();
  }, [token]);

  async function handleAccept() {
    const confirmed = window.confirm("Deseja aceitar esta proposta comercial?");

    if (!confirmed || !token) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.acceptPublicProposal(token);

      setSuccess(
        "Proposta aceita com sucesso. A equipe da AMAZONIKA dará continuidade à geração do contrato."
      );

      await loadProposal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao aceitar proposta.");
    } finally {
      setSaving(false);
    }
  }

  async function handleRequestAdjustment() {
    if (!token) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!adjustmentMessage.trim()) {
        throw new Error("Descreva o ajuste solicitado.");
      }

      await api.requestPublicProposalAdjustment(token, adjustmentMessage);

      setSuccess(
        "Solicitação de ajuste enviada com sucesso. A equipe técnica avaliará sua solicitação."
      );

      setMode("VIEW");
      await loadProposal();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao solicitar ajuste."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRefuse() {
    if (!token) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.refusePublicProposal(token, refuseMessage);

      setSuccess("Proposta recusada. A equipe da AMAZONIKA foi notificada.");
      setMode("VIEW");
      await loadProposal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao recusar proposta.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="proposal-public-shell">
        <section className="public-proposal-card premium-public-proposal-card">
          Carregando proposta...
        </section>
      </main>
    );
  }

  if (!proposal) {
    return (
      <main className="proposal-public-shell">
        <section className="panel error-panel public-proposal-card premium-public-proposal-card">
          {error || "Proposta não encontrada."}
        </section>
      </main>
    );
  }

  const canRespond = proposal.status === "ENVIADA";

  return (
    <main className="proposal-public-shell">
      {saving && (
        <div className="modal-backdrop">
          <div className="protocol-modal progress-modal">
            <h2>Processando...</h2>
            <p>Aguarde enquanto registramos sua resposta.</p>
          </div>
        </div>
      )}

      <section className="public-proposal-card premium-public-proposal-card">
        <header className="premium-proposal-topbar">
          <div className="premium-proposal-brand">
            <div className="premium-proposal-logo-box">
              <img
                src="/brand/logo-amazonika.png"
                alt="AMAZONIKA Soluções Ambientais"
                className="premium-proposal-logo"
              />
            </div>

            <div>
              <strong>AMAZONIKA</strong>
              <span>Soluções Ambientais</span>
            </div>
          </div>

          <button
            className="premium-proposal-contact"
            type="button"
            onClick={() => navigate("/")}
          >
            Contato
          </button>
        </header>

        <section className="premium-proposal-title-area">
          <div>
            <span className="eyebrow">PROPOSTA COMERCIAL</span>

            <h1>{proposal.title}</h1>

            <p>
              Proposta nº <strong>{proposal.proposalNumber}</strong> vinculada
              ao protocolo{" "}
              <strong>{proposal.protocol?.protocolNumber || "-"}</strong>.
            </p>
          </div>

          <span className={`badge ${String(proposal.status || "").toLowerCase()}`}>
            {proposalStatusLabel(proposal.status)}
          </span>
        </section>

        {success && <div className="panel success-panel">{success}</div>}
        {error && <div className="panel error-panel">{error}</div>}

        <div className="public-proposal-client">
          <div>
            <span>Cliente</span>
            <strong>{proposal.client?.name || "-"}</strong>
          </div>

          <div>
            <span>Serviço principal</span>
            <strong>{proposal.protocol?.serviceType?.name || "-"}</strong>
          </div>

          <div>
            <span>Validade</span>
            <strong>
              {proposal.validUntil ? formatDate(proposal.validUntil) : "-"}
            </strong>
          </div>
        </div>

        {proposal.clientMessage && (
          <div className="public-proposal-message">
            <p>{proposal.clientMessage}</p>
          </div>
        )}

        {proposal.description && (
          <section>
            <h2>Descrição da proposta</h2>
            <p>{proposal.description}</p>
          </section>
        )}

        {proposal.technicalScope && (
          <section>
            <h2>Escopo técnico</h2>
            <p>{proposal.technicalScope}</p>
          </section>
        )}

        <section>
          <h2>Itens e valores</h2>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Descrição</th>
                  <th>Qtd.</th>
                  <th>Valor unitário</th>
                  <th>Total</th>
                </tr>
              </thead>

              <tbody>
                {proposal.items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.serviceName}</strong>
                    </td>
                    <td>{item.description || "-"}</td>
                    <td>{item.quantity}</td>
                    <td>{money(item.unitAmount)}</td>
                    <td>
                      <strong>{money(item.totalAmount)}</strong>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="public-proposal-payment">
          <div>
            <span>Valor total</span>
            <strong>{money(proposal.totalAmount)}</strong>
          </div>

          <div>
            <span>Entrada</span>
            <strong>{money(proposal.entryAmount)}</strong>
          </div>

          <div>
            <span>Parcelas</span>
            <strong>
              {proposal.installmentQty
                ? `${proposal.installmentQty}x de ${money(
                    proposal.installmentAmount || 0
                  )}`
                : "-"}
            </strong>
          </div>

          <div>
            <span>Forma de pagamento</span>
            <strong>{paymentModeLabel(proposal.paymentMode)}</strong>
          </div>
        </section>

        {canRespond && mode === "VIEW" && (
          <div className="public-proposal-actions">
            <button className="button primary" type="button" onClick={handleAccept}>
              Aceitar proposta
            </button>

            <button
              className="secondary-action"
              type="button"
              onClick={() => setMode("ADJUST")}
            >
              Solicitar ajuste
            </button>

            <button
              className="secondary-action danger"
              type="button"
              onClick={() => setMode("REFUSE")}
            >
              Recusar
            </button>
          </div>
        )}

        {canRespond && mode === "ADJUST" && (
          <div className="panel soft-panel">
            <h3>Solicitar ajuste</h3>

            <label>
              Descreva o ajuste desejado
              <textarea
                rows={4}
                value={adjustmentMessage}
                onChange={(event) => setAdjustmentMessage(event.target.value)}
              />
            </label>

            <div className="form-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={() => setMode("VIEW")}
              >
                Voltar
              </button>

              <button
                className="button primary"
                type="button"
                onClick={handleRequestAdjustment}
              >
                Enviar solicitação
              </button>
            </div>
          </div>
        )}

        {canRespond && mode === "REFUSE" && (
          <div className="panel soft-panel">
            <h3>Recusar proposta</h3>

            <label>
              Motivo da recusa, opcional
              <textarea
                rows={4}
                value={refuseMessage}
                onChange={(event) => setRefuseMessage(event.target.value)}
              />
            </label>

            <div className="form-actions">
              <button
                className="secondary-action"
                type="button"
                onClick={() => setMode("VIEW")}
              >
                Voltar
              </button>

              <button
                className="button primary"
                type="button"
                onClick={handleRefuse}
              >
                Confirmar recusa
              </button>
            </div>
          </div>
        )}

        {!canRespond && (
          <div className="panel info-panel">
            Esta proposta já possui uma resposta registrada:{" "}
            <strong>{proposalStatusLabel(proposal.status)}</strong>.
          </div>
        )}

        <div className="public-proposal-footer">
          <button
            className="secondary-action"
            type="button"
            onClick={() => navigate("/")}
          >
            Voltar ao site
          </button>
        </div>
      </section>
    </main>
  );
}

function ProposalHistoryPanel({ protocolId, refreshKey = 0}: { protocolId: number; refreshKey: number }) {
  const [items, setItems] = useState<BackendProposalHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadHistory() {
    try {
      setLoading(true);
      setError("");

      const data = (await api.proposalHistory(
        protocolId
      )) as BackendProposalHistory[];

      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar histórico de propostas."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadHistory();
  }, [protocolId, refreshKey]);

function eventLabel(type: string) {
  const map: Record<string, string> = {
    PROPOSTA_GERADA: "Gerada",
    PROPOSTA_ENVIADA: "Enviada",
    PROPOSTA_VISUALIZADA: "Visualizada",
    PROPOSTA_ACEITA: "Aceita",
    PROPOSTA_RECUSADA: "Recusada",
    AJUSTE_SOLICITADO: "Ajuste solicitado",
    PROPOSTA_AJUSTADA: "Ajustada",
    PROPOSTA_AJUSTADA_ENVIADA: "Ajustada enviada",
    CONTRATO_GERADO: "Contrato gerado",
    CONTRATO_ENVIADO: "Contrato enviado",
    CONTRATO_ASSINADO: "Contrato assinado",
    COBRANCA_EMITIDA: "Cobrança emitida",
    PAGAMENTO_CONFIRMADO: "Pagamento confirmado",
  };

  return map[type] || type;
}

  function eventClass(type: string) {
    const normalized = String(type || "").toLowerCase();

    if (normalized.includes("aceita") || normalized.includes("assinado")) {
      return "success";
    }

    if (normalized.includes("recusada") || normalized.includes("cancelada")) {
      return "danger";
    }

    if (normalized.includes("enviada") || normalized.includes("gerado")) {
      return "info";
    }

    if (normalized.includes("pagamento") || normalized.includes("cobranca")) {
      return "money";
    }

    return "default";
  }

  return (
    <article className="panel proposal-history-panel no-print">
      <div className="panel-header">
        <div>
          <h2>Histórico comercial do protocolo</h2>
          <p>
            Registro das interações de proposta, aceite, contrato e cobrança
            vinculadas exclusivamente a este protocolo.
          </p>
        </div>

        <span>{items.length} evento(s)</span>
      </div>

      {loading && <p>Carregando histórico...</p>}

      {error && <div className="panel error-panel">{error}</div>}

      {!loading && !error && items.length === 0 && (
        <p>Nenhuma interação comercial registrada neste protocolo.</p>
      )}

      {!loading && !error && items.length > 0 && (
        <div className="proposal-history-timeline">
          {items.map((item) => (
            <div key={item.id} className="proposal-history-item">
              <div
                className={`proposal-history-marker ${eventClass(
                  item.eventType
                )}`}
              />

              <div className="proposal-history-content">
                <div className="proposal-history-top">
                  <strong>{item.title || eventLabel(item.eventType)}</strong>

                  <span
                    className={`proposal-history-badge ${eventClass(
                      item.eventType
                    )}`}
                  >
                    {eventLabel(item.eventType)}
                  </span>
                </div>

                {item.description && (
  <p className={item.eventType === "AJUSTE_SOLICITADO" ? "proposal-client-message" : ""}>
    {item.description}
  </p>
)}

                <small>
                  {formatDateTime(item.createdAt)}
                  {item.recipient ? ` · Destinatário: ${item.recipient}` : ""}
                  {item.senderName ? ` · Por: ${item.senderName}` : ""}
                </small>
              </div>
            </div>
          ))}
        </div>
      )}
    </article>
  );
}

function ProtocolDetailsPage() {
  const [processingMessage, setProcessingMessage] = useState("");
  const { id } = useParams();
  const navigate = useNavigate();

  const [protocol, setProtocol] = useState<BackendProtocol | null>(null);
  const [serviceTypes, setServiceTypes] = useState<BackendServiceType[]>([]);
  const [managers, setManagers] = useState<BackendManager[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [editing, setEditing] = useState(false);

  const [editClientName, setEditClientName] = useState("");
  const [editClientCpfCnpj, setEditClientCpfCnpj] = useState("");
  const [editClientPhone, setEditClientPhone] = useState("");
  const [editClientWhatsapp, setEditClientWhatsapp] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editClientAddress, setEditClientAddress] = useState("");
  const [editClientCity, setEditClientCity] = useState("");
  const [editClientState, setEditClientState] = useState("");

  const [editServiceTypeId, setEditServiceTypeId] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editPriority, setEditPriority] = useState("NORMAL");
  const [editStatus, setEditStatus] = useState<ProtocolStatus>("NOVO");
  const [editDeadlineDate, setEditDeadlineDate] = useState("");

  const [editManagerUserId, setEditManagerUserId] = useState("");
  const [editAppointmentDate, setEditAppointmentDate] = useState("");
  const [editAppointmentTime, setEditAppointmentTime] = useState("");
  const [editDurationMinutes, setEditDurationMinutes] = useState("60");
  const [editMeetingType, setEditMeetingType] = useState("Presencial");
  const [editMeetingLocation, setEditMeetingLocation] = useState("");
  const [editMeetingLink, setEditMeetingLink] = useState("");
  const [editAppointmentNotes, setEditAppointmentNotes] = useState("");
  const [editAppointmentStatus, setEditAppointmentStatus] =
    useState("AGENDADO");

  const [editDocumentFile, setEditDocumentFile] = useState<File | null>(null);
  const [editDocumentType, setEditDocumentType] = useState(
    "DOCUMENTO_COMPLEMENTAR"
  );

  const [editAvailability, setEditAvailability] =
    useState<AvailabilityResponse | null>(null);

  const [editAvailabilityLoading, setEditAvailabilityLoading] = useState(false);

const [proposalHistoryRefreshKey, setProposalHistoryRefreshKey] = useState(0);

  async function loadDetails() {
    try {
      setLoading(true);
      setError("");

      const [protocolData, servicesData, managersData] = await Promise.all([
        api.protocolById(Number(id)) as Promise<BackendProtocol>,
        api.serviceTypes() as Promise<BackendServiceType[]>,
        api.managers() as Promise<BackendManager[]>,
      ]);

      setProtocol(protocolData);
      setServiceTypes(servicesData);
      setManagers(managersData);

      fillEditForm(protocolData, managersData);

      const shouldOpenEditing = window.location.search.includes("edit=1");
      if (shouldOpenEditing) {
        setEditing(true);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar protocolo."
      );
    } finally {
      setLoading(false);
    }
  }

  function fillEditForm(
    item: BackendProtocol,
    managersData: BackendManager[] = managers
  ) {
    const appointment = item.appointments?.[0];

    setEditClientName(item.client.name || "");
    setEditClientCpfCnpj(item.client.cpfCnpj || "");
    setEditClientPhone(item.client.phone || "");
    setEditClientWhatsapp(item.client.whatsapp || "");
    setEditClientEmail(item.client.email || "");
    setEditClientAddress(item.client.address || "");
    setEditClientCity(item.client.city || "Macapá");
    setEditClientState(item.client.state || "AP");

    setEditServiceTypeId(String(item.serviceType.id));
    setEditDescription(item.description || "");
    setEditPriority(item.priority || "NORMAL");
    setEditStatus(item.status);
    setEditDeadlineDate(item.deadlineDate ? item.deadlineDate.slice(0, 10) : "");

    setEditManagerUserId(
      appointment?.manager?.id
        ? String(appointment.manager.id)
        : managersData[0]?.id
        ? String(managersData[0].id)
        : ""
    );

    setEditAppointmentDate(
      appointment?.scheduledAt ? appointment.scheduledAt.slice(0, 10) : ""
    );

    setEditAppointmentTime(
      appointment?.scheduledAt ? formatTime(appointment.scheduledAt) : ""
    );

    if (appointment?.scheduledAt && appointment?.scheduledEndAt) {
      const start = new Date(appointment.scheduledAt).getTime();
      const end = new Date(appointment.scheduledEndAt).getTime();
      setEditDurationMinutes(String(Math.round((end - start) / 60000) || 60));
    } else {
      setEditDurationMinutes("60");
    }

    setEditMeetingType(appointment?.meetingType || "Presencial");
    setEditMeetingLocation(
      appointment?.location ||
        "AMAZONIKA - Av. Almirante Barroso, 620-B, Centro, Macapá/AP"
    );
    setEditMeetingLink(appointment?.meetingLink || "");
    setEditAppointmentNotes(appointment?.notes || "");
    setEditAppointmentStatus(appointment?.status || "AGENDADO");

    setEditDocumentFile(null);
    setEditDocumentType("DOCUMENTO_COMPLEMENTAR");
  }

  useEffect(() => {
    loadDetails();
  }, [id]);

  useEffect(() => {
    async function loadEditAvailability() {
      if (!editing || !editManagerUserId || !editAppointmentDate) {
        setEditAvailability(null);
        return;
      }

      try {
        setEditAvailabilityLoading(true);

        const data = (await api.appointmentAvailability(
          Number(editManagerUserId),
          editAppointmentDate
        )) as AvailabilityResponse;

        setEditAvailability(data);
      } catch {
        setEditAvailability(null);
      } finally {
        setEditAvailabilityLoading(false);
      }
    }

    loadEditAvailability();
  }, [editing, editManagerUserId, editAppointmentDate]);

  async function handleSave() {
    if (!protocol) return;

    try {
setSaving(true);
setProcessingMessage("Salvando alterações do protocolo...");
setError("");
setSuccess("");

setProcessingMessage("Atualizando dados do cliente...");

      await api.updateClient(protocol.client.id, {
        name: editClientName,
        personType: editClientCpfCnpj.length > 14 ? "PJ" : "PF",
        cpfCnpj: editClientCpfCnpj,
        phone: editClientPhone,
        whatsapp: editClientWhatsapp || editClientPhone,
        email: editClientEmail,
        address: editClientAddress,
        city: editClientCity,
        state: editClientState,
      });

      setProcessingMessage("Atualizando dados do protocolo...");

      await api.updateProtocol(protocol.id, {
        serviceTypeId: Number(editServiceTypeId),
        description: editDescription,
        priority: editPriority,
        status: editStatus,
        deadlineDate: editDeadlineDate || undefined,
        responsibleUserId: editManagerUserId
          ? Number(editManagerUserId)
          : undefined,
      });

      const appointment = protocol.appointments?.[0];

      if (editManagerUserId && editAppointmentDate && editAppointmentTime) {
        const scheduledAt = `${editAppointmentDate}T${editAppointmentTime}:00-03:00`;

        setProcessingMessage("Atualizando agendamento e agenda do gestor...");

        if (appointment) {
          await api.updateAppointment(appointment.id, {
            managerUserId: Number(editManagerUserId),
            scheduledAt,
            durationMinutes: Number(editDurationMinutes || 60),
            meetingType: editMeetingType,
            location:
              editMeetingType === "Presencial" ? editMeetingLocation : undefined,
            meetingLink:
              editMeetingType === "Google Meet" || editMeetingType === "Online"
                ? editMeetingLink
                : undefined,
            notes: editAppointmentNotes,
            status: editAppointmentStatus,
          });
        } else {
          await api.createAppointment({
            protocolId: protocol.id,
            clientId: protocol.client.id,
            managerUserId: Number(editManagerUserId),
            scheduledAt,
            durationMinutes: Number(editDurationMinutes || 60),
            meetingType: editMeetingType,
            location:
              editMeetingType === "Presencial" ? editMeetingLocation : undefined,
            meetingLink:
              editMeetingType === "Google Meet" || editMeetingType === "Online"
                ? editMeetingLink
                : undefined,
            notes: editAppointmentNotes,
          });
        }
      }

      setProcessingMessage("Enviando documento complementar...");

      if (editDocumentFile) {
        await api.uploadProtocolDocument(
          protocol.id,
          editDocumentFile,
          editDocumentType
        );
      }
try {
  await api.resendAppointmentEmail(protocol.id);
} catch (emailError) {
  console.warn("Protocolo salvo, mas o e-mail não foi reenviado:", emailError);
}
      setSuccess("Protocolo atualizado com sucesso.");
      setEditing(false);
      setEditAvailability(null);
      await loadDetails();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar alterações."
      );
    } finally {
      setSaving(false);
setProcessingMessage("");
    }
  }

async function handleResend(protocol: BackendProtocol) {
  try {
    setSaving(true);
    setProcessingMessage(
      `Reenviando e-mail de agendamento do protocolo ${protocol.protocolNumber}...`
    );
    setError("");
    setSuccess("");

    await api.resendAppointmentEmail(protocol.id);

    setSuccess(
      "E-mail de agendamento reenviado para cliente, gestor e empresa."
    );
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Erro ao reenviar e-mail."
    );
  } finally {
    setSaving(false);
    setProcessingMessage("");
  }
}


  async function handleCancel() {
    if (!protocol) return;

    const confirmed = window.confirm(
      `Deseja cancelar o protocolo ${protocol.protocolNumber}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      await api.deleteProtocol(protocol.id, "Cancelado na página de detalhes.");
      navigate("/app/protocolos");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cancelar protocolo."
      );
    } finally {
      setSaving(false);
    }
  }

  function printPage() {
    window.print();
  }

  if (loading) {
    return (
      <section className="page">
        <div className="panel">Carregando protocolo...</div>
      </section>
    );
  }

  if (error && !protocol) {
    return (
      <section className="page">
        <div className="panel error-panel">{error}</div>
      </section>
    );
  }

  if (!protocol) return null;

const appointment = protocol.appointments?.[0];

return (
    <section className="page protocol-detail-page">
      <ProcessingOverlay message={processingMessage} />
      <div className="page-heading no-print">
        <div>
          <span className="eyebrow">Detalhes do protocolo</span>
          <h1>{protocol.protocolNumber}</h1>
          <p>{protocol.client.name}</p>
        </div>

        <div className="detail-actions">
          <button className="secondary-action" onClick={printPage}>
            Imprimir
          </button>

          <button
            className="secondary-action"
            onClick={() => {
              if (editing) {
                setEditing(false);
                setEditAvailability(null);
                return;
              }

              fillEditForm(protocol);
              setEditing(true);
            }}
          >
            {editing ? "Cancelar edição" : "Editar"}
          </button>

          <button className="secondary-action" onClick={() => handleResend(protocol)}>
            Reenviar e-mail
          </button>

          <button className="secondary-action danger" onClick={handleCancel}>
            Cancelar protocolo
          </button>
        </div>
      </div>

      {success && <div className="panel success-panel no-print">{success}</div>}
      {error && <div className="panel error-panel no-print">{error}</div>}

      {!editing ? (
        <div className="detail-grid">
          <article className="panel">
            <h2>Dados do cliente</h2>
            <DetailRow label="Nome" value={protocol.client.name} />
            <DetailRow label="CPF/CNPJ" value={protocol.client.cpfCnpj} />
            <DetailRow label="Telefone" value={protocol.client.phone} />
            <DetailRow label="WhatsApp" value={protocol.client.whatsapp} />
            <DetailRow label="E-mail" value={protocol.client.email} />
            <DetailRow label="Endereço" value={protocol.client.address} />
            <DetailRow
              label="Município/UF"
              value={`${protocol.client.city || "-"} / ${
                protocol.client.state || "-"
              }`}
            />
          </article>

          <article className="panel">
            <h2>Dados do protocolo</h2>
            <DetailRow label="Serviço" value={protocol.serviceType.name} />
            <DetailRow label="Status" value={statusLabel(protocol.status)} />
            <DetailRow label="Prioridade" value={protocol.priority} />
            <DetailRow label="Prazo" value={formatDate(protocol.deadlineDate)} />
            <DetailRow label="Descrição" value={protocol.description} />
          </article>

          <article className="panel">
            <h2>Agendamento</h2>

            {appointment ? (
              <>
                <DetailRow
                  label="Gestor"
                  value={`${appointment.manager?.name || "-"} ${
                    appointment.manager?.email
                      ? `(${appointment.manager.email})`
                      : ""
                  }`}
                />
                <DetailRow label="Data" value={formatDate(appointment.scheduledAt)} />
                <DetailRow
                  label="Horário"
                  value={`${formatTime(appointment.scheduledAt)}${
                    appointment.scheduledEndAt
                      ? ` - ${formatTime(appointment.scheduledEndAt)}`
                      : ""
                  }`}
                />
                <DetailRow label="Tipo" value={appointment.meetingType} />
                <DetailRow
                  label="Local/Link"
                  value={appointment.location || appointment.meetingLink}
                />
                <DetailRow label="Status" value={appointment.status} />
                <DetailRow label="Observações" value={appointment.notes} />
              </>
            ) : (
              <p>Nenhum agendamento registrado.</p>
            )}
          </article>

          <article className="panel">
            <h2>Documentos anexados</h2>

            <div className="document-table">
              {protocol.documents?.length ? (
                protocol.documents.map((document) => (
                  <div key={document.id} className="document-row">
                    <div>
                      <strong>{document.fileName}</strong>
                      <span>
                        {document.documentType} | {formatDate(document.createdAt)}
                      </span>
                    </div>

                    <a
                      href={api.fileUrl(document.filePath)}
                      target="_blank"
                      rel="noreferrer"
                      className="mini-button"
                    >
                      Baixar
                    </a>
                  </div>
                ))
              ) : (
                <p>Nenhum documento anexado.</p>
              )}
            </div>
          </article>
        </div>
      ) : (
        <div className="panel no-print">
          <h2>Editar protocolo</h2>

          <div className="protocol-form-grid">
            <div className="form-section">
              <h3>Cliente</h3>

              <label>
                Nome
                <input
                  value={editClientName}
                  onChange={(event) => setEditClientName(event.target.value)}
                />
              </label>

              <div className="form-row">
                <label>
                  CPF/CNPJ
                  <input
                    value={editClientCpfCnpj}
                    onChange={(event) =>
                      setEditClientCpfCnpj(event.target.value)
                    }
                  />
                </label>

                <label>
                  E-mail
                  <input
                    value={editClientEmail}
                    onChange={(event) => setEditClientEmail(event.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Telefone
                  <input
                    value={editClientPhone}
                    onChange={(event) => setEditClientPhone(event.target.value)}
                  />
                </label>

                <label>
                  WhatsApp
                  <input
                    value={editClientWhatsapp}
                    onChange={(event) =>
                      setEditClientWhatsapp(event.target.value)
                    }
                  />
                </label>
              </div>

              <label>
                Endereço
                <input
                  value={editClientAddress}
                  onChange={(event) =>
                    setEditClientAddress(event.target.value)
                  }
                />
              </label>

              <div className="form-row">
                <label>
                  Município
                  <input
                    value={editClientCity}
                    onChange={(event) => setEditClientCity(event.target.value)}
                  />
                </label>

                <label>
                  UF
                  <input
                    value={editClientState}
                    onChange={(event) => setEditClientState(event.target.value)}
                  />
                </label>
              </div>
            </div>

            <div className="form-section">
              <h3>Protocolo</h3>

              <label>
                Serviço
                <select
                  value={editServiceTypeId}
                  onChange={(event) =>
                    setEditServiceTypeId(event.target.value)
                  }
                >
                  {serviceTypes.map((service) => (
                    <option key={service.id} value={service.id}>
                      {service.name}
                    </option>
                  ))}
                </select>
              </label>

              <div className="form-row">
                <label>
                  Status
                  <select
                    value={editStatus}
                    onChange={(event) =>
                      setEditStatus(event.target.value as ProtocolStatus)
                    }
                  >
                    <option value="NOVO">Novo</option>
                    <option value="AGENDADO">Agendado</option>
                    <option value="REUNIAO_REALIZADA">Reunião realizada</option>
                    <option value="PROPOSTA_ENVIADA">Proposta enviada</option>
                    <option value="ACORDO_FECHADO">Acordo fechado</option>
                    <option value="CONTRATO_ENVIADO">Contrato enviado</option>
                    <option value="AGUARDANDO_ASSINATURA">
                      Aguardando assinatura
                    </option>
                    <option value="CONTRATO_ASSINADO">Contrato assinado</option>
                    <option value="EM_EXECUCAO">Em execução</option>
                    <option value="AGUARDANDO_DOCUMENTOS">
                      Aguardando documentos
                    </option>
                    <option value="AGUARDANDO_ORGAO_PUBLICO">
                      Aguardando órgão público
                    </option>
                    <option value="FINALIZADO">Finalizado</option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </label>

                <label>
                  Prioridade
                  <select
                    value={editPriority}
                    onChange={(event) => setEditPriority(event.target.value)}
                  >
                    <option value="BAIXA">Baixa</option>
                    <option value="NORMAL">Normal</option>
                    <option value="ALTA">Alta</option>
                    <option value="URGENTE">Urgente</option>
                  </select>
                </label>
              </div>

              <label>
                Prazo
                <input
                  type="date"
                  value={editDeadlineDate}
                  onChange={(event) => setEditDeadlineDate(event.target.value)}
                />
              </label>

              <label>
                Descrição
                <textarea
                  value={editDescription}
                  onChange={(event) => setEditDescription(event.target.value)}
                  rows={5}
                />
              </label>
            </div>

            <div className="form-section calendar-section">
              <h3>Agendamento</h3>

              <div className="form-row">
                <label>
                  Gestor
                  <select
                    value={editManagerUserId}
                    onChange={(event) =>
                      setEditManagerUserId(event.target.value)
                    }
                  >
                    {managers.map((manager) => (
                      <option key={manager.id} value={manager.id}>
                        {manager.name} — {manager.email}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Data
                  <input
                    type="date"
                    value={editAppointmentDate}
                    onChange={(event) =>
                      setEditAppointmentDate(event.target.value)
                    }
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Horário
                  <input
                    type="time"
                    value={editAppointmentTime}
                    onChange={(event) =>
                      setEditAppointmentTime(event.target.value)
                    }
                  />
                </label>

                <label>
                  Duração
                  <select
                    value={editDurationMinutes}
                    onChange={(event) =>
                      setEditDurationMinutes(event.target.value)
                    }
                  >
                    <option value="30">30 minutos</option>
                    <option value="60">1 hora</option>
                    <option value="90">1 hora e 30 minutos</option>
                    <option value="120">2 horas</option>
                  </select>
                </label>
              </div>

              <div className="availability-box">
                <div className="availability-header">
                  <strong>Agenda do gestor</strong>

                  {editAvailabilityLoading && <span>Consultando...</span>}

                  {!editAvailabilityLoading && editAppointmentDate && (
                    <span>{editAppointmentDate}</span>
                  )}
                </div>

                {!editManagerUserId && (
                  <p>Selecione um gestor para visualizar a agenda.</p>
                )}

                {editManagerUserId && !editAppointmentDate && (
                  <p>Selecione uma data para visualizar os horários.</p>
                )}

                {editManagerUserId && editAppointmentDate && editAvailability && (
                  <div className="slot-grid">
                    {editAvailability.slots.map((slot) => {
                      const currentAppointmentId =
                        protocol.appointments?.[0]?.id;

                      const isCurrentAppointment =
                        slot.appointment?.id === currentAppointmentId;

                      const canSelect = slot.available || isCurrentAppointment;

                      return (
                        <button
                          type="button"
                          key={slot.time}
                          className={`slot-button ${
                            canSelect ? "available" : "busy"
                          } ${
                            editAppointmentTime === slot.time ? "selected" : ""
                          }`}
                          disabled={!canSelect}
                          onClick={() => setEditAppointmentTime(slot.time)}
                          title={
                            slot.appointment
                              ? `${slot.appointment.protocolNumber} - ${slot.appointment.clientName}`
                              : "Disponível"
                          }
                        >
                          <strong>{slot.time}</strong>

                          <span>
                            {slot.available
                              ? "Disponível"
                              : isCurrentAppointment
                              ? "Horário atual deste protocolo"
                              : `Ocupado: ${slot.appointment?.clientName}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {editManagerUserId &&
                  editAppointmentDate &&
                  !editAvailability &&
                  !editAvailabilityLoading && (
                    <p>Não foi possível carregar a agenda deste gestor.</p>
                  )}
              </div>

              <div className="form-row">
                <label>
                  Tipo
                  <select
                    value={editMeetingType}
                    onChange={(event) => setEditMeetingType(event.target.value)}
                  >
                    <option value="Presencial">Presencial</option>
                    <option value="WhatsApp">WhatsApp</option>
                    <option value="Google Meet">Google Meet</option>
                    <option value="Online">Online</option>
                    <option value="Telefone">Telefone</option>
                  </select>
                </label>

                <label>
                  Status
                  <select
                    value={editAppointmentStatus}
                    onChange={(event) =>
                      setEditAppointmentStatus(event.target.value)
                    }
                  >
                    <option value="AGENDADO">Agendado</option>
                    <option value="REAGENDADO">Reagendado</option>
                    <option value="REALIZADO">Realizado</option>
                    <option value="CLIENTE_NAO_COMPARECEU">
                      Cliente não compareceu
                    </option>
                    <option value="CANCELADO">Cancelado</option>
                  </select>
                </label>
              </div>

              <label>
                Local
                <input
                  value={editMeetingLocation}
                  onChange={(event) =>
                    setEditMeetingLocation(event.target.value)
                  }
                />
              </label>

              <label>
                Link
                <input
                  value={editMeetingLink}
                  onChange={(event) => setEditMeetingLink(event.target.value)}
                />
              </label>

              <label>
                Observações
                <textarea
                  value={editAppointmentNotes}
                  onChange={(event) =>
                    setEditAppointmentNotes(event.target.value)
                  }
                  rows={3}
                />
              </label>
            </div>

            <div className="form-section calendar-section">
              <h3>Novo documento</h3>

              <div className="form-row">
                <label>
                  Arquivo
                  <input
                    type="file"
                    onChange={(event) =>
                      setEditDocumentFile(event.target.files?.[0] || null)
                    }
                  />
                </label>

                <label>
                  Tipo
                  <select
                    value={editDocumentType}
                    onChange={(event) =>
                      setEditDocumentType(event.target.value)
                    }
                  >
                    <option value="DOCUMENTO_COMPLEMENTAR">
                      Documento complementar
                    </option>
                    <option value="RG_CPF_CNPJ">RG/CPF/CNPJ</option>
                    <option value="DOCUMENTO_IMOVEL">Documento do imóvel</option>
                    <option value="CAR">CAR</option>
                    <option value="MATRICULA">Matrícula</option>
                    <option value="CCIR_ITR">CCIR/ITR</option>
                    <option value="CONTRATO_ASSINADO">Contrato assinado</option>
                    <option value="OUTRO">Outro</option>
                  </select>
                </label>
              </div>
            </div>
          </div>

<div className="form-actions">
            <button
              className="secondary-action"
              onClick={() => {
                fillEditForm(protocol);
                setEditing(false);
                setEditAvailability(null);
              }}
            >
              Cancelar
            </button>

            <button
              className="button primary"
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? "Salvando..." : "Salvar alterações"}
            </button>
          </div>
        </div>
      )}

{!editing && (
  <>
    <ProposalPanel
      protocol={protocol}
      onReload={async () => {
        await loadDetails();
        setProposalHistoryRefreshKey((value) => value + 1);
      }}
    />

<ContractPanel
  protocol={protocol}
  onReload={async () => {
    await loadDetails();
    setProposalHistoryRefreshKey((value) => value + 1);
  }}
/>

<BillingPanel
  protocol={protocol}
  onReload={async () => {
    await loadDetails();
    setProposalHistoryRefreshKey((value) => value + 1);
  }}
/>

<ProposalHistoryPanel
  protocolId={protocol.id}
  refreshKey={proposalHistoryRefreshKey}
/>
  </>
)}
    </section>
  );

}

function SchedulePage() {
  const [items, setItems] = useState<BackendAppointment[]>([]);
  const [managers, setManagers] = useState<BackendManager[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [search, setSearch] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("");
  const [page, setPage] = useState(1);

  const pageSize = 10;

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [appointmentsData, managersData] = await Promise.all([
        api.appointments() as Promise<BackendAppointment[]>,
        api.managers() as Promise<BackendManager[]>,
      ]);

      setItems(appointmentsData);
      setManagers(managersData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar agendamentos."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function handleCancelAppointment(item: BackendAppointment) {
    const confirmed = window.confirm(
      `Deseja realmente cancelar o agendamento do protocolo ${item.protocol.protocolNumber}?`
    );

    if (!confirmed) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.deleteAppointment(item.id);

      setSuccess("Agendamento cancelado com sucesso.");
      await loadData();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cancelar agendamento."
      );
    } finally {
      setSaving(false);
    }
  }

  const filtered = items.filter((item) => {
    const text = `${item.client?.name || ""} ${
      item.protocol?.protocolNumber || ""
    } ${item.protocol?.serviceType?.name || ""} ${
      item.manager?.name || ""
    } ${item.manager?.email || ""} ${item.meetingType || ""}`.toLowerCase();

    const matchesSearch = text.includes(search.trim().toLowerCase());

    const matchesManager =
      !managerFilter || String(item.manager?.id || "") === managerFilter;

    const matchesStatus = !statusFilter || item.status === statusFilter;

    const matchesType = !typeFilter || item.meetingType === typeFilter;

    const matchesDate =
      !dateFilter ||
      new Date(item.scheduledAt).toISOString().slice(0, 10) === dateFilter;

    return (
      matchesSearch &&
      matchesManager &&
      matchesStatus &&
      matchesType &&
      matchesDate
    );
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(page, totalPages);

  const paginated = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  function clearFilters() {
    setSearch("");
    setManagerFilter("");
    setStatusFilter("");
    setTypeFilter("");
    setDateFilter("");
    setPage(1);
  }

  return (
    <section className="page schedule-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Agenda</span>
          <h1>Agendamentos</h1>
          <p>
            Consulte, filtre e gerencie os agendamentos vinculados aos
            protocolos cadastrados.
          </p>
        </div>

        <Link to="/app/protocolos" className="button primary">
          Novo agendamento
        </Link>
      </div>

      {saving && (
        <div className="modal-backdrop">
          <div className="protocol-modal progress-modal">
            <h2>Processando...</h2>
            <p>Aguarde enquanto o sistema atualiza o agendamento.</p>
          </div>
        </div>
      )}

      {success && <div className="panel success-panel">{success}</div>}
      {error && <div className="panel error-panel">{error}</div>}

      <div className="panel schedule-filter-panel">
        <div className="schedule-filters agenda-filters">
          <input
            placeholder="Buscar cliente, protocolo, gestor ou serviço"
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setPage(1);
            }}
          />

          <input
            type="date"
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
              setPage(1);
            }}
          />

          <select
            value={managerFilter}
            onChange={(event) => {
              setManagerFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os gestores</option>
            {managers.map((manager) => (
              <option key={manager.id} value={manager.id}>
                {manager.name}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os status</option>
            <option value="AGENDADO">Agendado</option>
            <option value="REAGENDADO">Reagendado</option>
            <option value="REALIZADO">Realizado</option>
            <option value="CLIENTE_NAO_COMPARECEU">
              Cliente não compareceu
            </option>
            <option value="CANCELADO">Cancelado</option>
          </select>

          <select
            value={typeFilter}
            onChange={(event) => {
              setTypeFilter(event.target.value);
              setPage(1);
            }}
          >
            <option value="">Todos os tipos</option>
            <option value="Presencial">Presencial</option>
            <option value="WhatsApp">WhatsApp</option>
            <option value="Google Meet">Google Meet</option>
            <option value="Online">Online</option>
            <option value="Telefone">Telefone</option>
          </select>

          <button
            className="secondary-action"
            type="button"
            onClick={clearFilters}
          >
            Limpar
          </button>
        </div>
      </div>

      {loading && <div className="panel">Carregando agendamentos...</div>}

      {!loading && !error && (
        <div className="panel">
          <div className="panel-header">
            <div>
              <h2>Lista de agendamentos</h2>
              <p>Resultado filtrado da agenda técnica.</p>
            </div>

            <span>{filtered.length} registro(s)</span>
          </div>

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Protocolo</th>
                  <th>Cliente</th>
                  <th>Serviço</th>
                  <th>Gestor</th>
                  <th>Data</th>
                  <th>Horário</th>
                  <th>Tipo</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {paginated.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <Link
                        className="table-link"
                        to={`/app/protocolos/${item.protocol.id}`}
                      >
                        {item.protocol.protocolNumber}
                      </Link>
                    </td>

                    <td>{item.client?.name || "-"}</td>

                    <td>{item.protocol?.serviceType?.name || "-"}</td>

                    <td>
                      {item.manager ? (
                        <span>
                          {item.manager.name}
                          <small className="table-small">
                            {item.manager.email}
                          </small>
                        </span>
                      ) : (
                        "-"
                      )}
                    </td>

                    <td>{formatDate(item.scheduledAt)}</td>

                    <td>
                      {formatTime(item.scheduledAt)}
                      {item.scheduledEndAt
                        ? ` - ${formatTime(item.scheduledEndAt)}`
                        : ""}
                    </td>

                    <td>{item.meetingType || "-"}</td>

                    <td>
                      <span
                        className={`badge appointment-${item.status.toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        <Link
                          className="mini-button"
                          to={`/app/protocolos/${item.protocol.id}`}
                        >
                          Detalhes
                        </Link>

                        <Link
                          className="mini-button"
                          to={`/app/protocolos/${item.protocol.id}?edit=1`}
                        >
                          Editar
                        </Link>

                        <button
                          className="mini-button danger"
                          type="button"
                          disabled={saving || item.status === "CANCELADO"}
                          onClick={() => handleCancelAppointment(item)}
                        >
                          {item.status === "CANCELADO"
                            ? "Cancelado"
                            : "Cancelar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {paginated.length === 0 && (
              <p>Nenhum agendamento encontrado.</p>
            )}
          </div>

          <div className="pagination">
            <button
              className="secondary-action"
              type="button"
              disabled={safePage === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
            >
              Anterior
            </button>

            <span>
              Página {safePage} de {totalPages}
            </span>

            <button
              className="secondary-action"
              type="button"
              disabled={safePage === totalPages}
              onClick={() =>
                setPage((value) => Math.min(totalPages, value + 1))
              }
            >
              Próxima
            </button>
          </div>
        </div>
      )}
    </section>
  );
}




type FinanceCategoryType = "RECEITA" | "DESPESA";
type FinanceTransactionType = "ENTRADA" | "SAIDA";
type FinanceTransactionStatus = "PENDENTE" | "PAGO" | "CANCELADO";
type FinanceTransactionSource =
  | "CONTRATO"
  | "SERVICO_AVULSO"
  | "CUSTO_FIXO"
  | "SALARIO"
  | "IMPOSTO"
  | "TAXA"
  | "OUTRO";

type BackendFinanceCategory = {
  id: number;
  name: string;
  type: FinanceCategoryType;
  color?: string | null;
  active: boolean;
};

type BackendFinanceTransaction = {
  id: number;
  type: FinanceTransactionType;
  source: FinanceTransactionSource;
  status: FinanceTransactionStatus;
  description: string;
  amount: number;
  dueDate?: string | null;
  paidAt?: string | null;
  competenceMonth?: string | null;
  clientName?: string | null;
  notes?: string | null;
  category?: BackendFinanceCategory | null;
  protocol?: {
    id: number;
    protocolNumber: string;
    client?: {
      id: number;
      name: string;
    };
    serviceType?: {
      id: number;
      name: string;
    };
  } | null;
};

type BackendFinanceFixedCost = {
  id: number;
  description: string;
  amount: number;
  dueDay: number;
  active: boolean;
  notes?: string | null;
  category?: BackendFinanceCategory | null;
};

type BackendFinanceSalary = {
  id: number;
  employeeName: string;
  roleDescription?: string | null;
  amount: number;
  dueDay: number;
  active: boolean;
  notes?: string | null;
  category?: BackendFinanceCategory | null;
};

type BackendFinanceSummary = {
  month: string;

  entradas: number;
  entradasRecebidas: number;
  entradasPendentes: number;

  saidasLancadas: number;
  saidasPagas: number;
  saidasPendentes: number;

  custoFixoMensal: number;
  salariosMensais: number;
  saidasProjetadas: number;

  resultadoPrevisto: number;
  resultadoRealizado: number;

  transactionCount: number;
  fixedCostCount: number;
  salaryCount: number;

  byCategory: {
    category: string;
    type: FinanceTransactionType;
    amount: number;
    count: number;
    color?: string | null;
  }[];
};

type BackendProLaboreAdvance = {
  id: number;
  managerUserId: number;
  competenceMonth: string;
  amount: number;
  paidAt: string;
  description?: string | null;
  notes?: string | null;
  manager?: {
    id: number;
    name: string;
    email: string;
  };
  createdBy?: {
    id: number;
    name: string;
    email: string;
  };
};



function FinancePage() {
  const currentMonth = new Date().toISOString().slice(0, 7);

  const [activeTab, setActiveTab] = useState<
    "OVERVIEW" | "TRANSACTIONS" | "FIXED_COSTS" | "SALARIES" | "CATEGORIES" | "PARTNERS"
  >("OVERVIEW");

  const [month, setMonth] = useState(currentMonth);
  const [summary, setSummary] = useState<BackendFinanceSummary | null>(null);
  const [transactions, setTransactions] = useState<BackendFinanceTransaction[]>(
    []
  );
  const [fixedCosts, setFixedCosts] = useState<BackendFinanceFixedCost[]>([]);
  const [salaries, setSalaries] = useState<BackendFinanceSalary[]>([]);
  const [categories, setCategories] = useState<BackendFinanceCategory[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [transactionSearch, setTransactionSearch] = useState("");
  const [transactionTypeFilter, setTransactionTypeFilter] = useState<
    "" | FinanceTransactionType
  >("");
  const [transactionStatusFilter, setTransactionStatusFilter] = useState<
    "" | FinanceTransactionStatus
  >("");

  const [showTransactionForm, setShowTransactionForm] = useState(false);
  const [editingTransaction, setEditingTransaction] =
    useState<BackendFinanceTransaction | null>(null);

  const [transactionType, setTransactionType] =
    useState<FinanceTransactionType>("ENTRADA");
  const [transactionSource, setTransactionSource] =
    useState<FinanceTransactionSource>("CONTRATO");
  const [transactionStatus, setTransactionStatus] =
    useState<FinanceTransactionStatus>("PENDENTE");
  const [transactionCategoryId, setTransactionCategoryId] = useState("");
  const [transactionDescription, setTransactionDescription] = useState("");
  const [transactionAmount, setTransactionAmount] = useState("");
  const [transactionDueDate, setTransactionDueDate] = useState("");
  const [transactionPaidAt, setTransactionPaidAt] = useState("");
  const [transactionClientName, setTransactionClientName] = useState("");
  const [transactionNotes, setTransactionNotes] = useState("");

  const [showFixedCostForm, setShowFixedCostForm] = useState(false);
  const [editingFixedCost, setEditingFixedCost] =
    useState<BackendFinanceFixedCost | null>(null);

  const [fixedDescription, setFixedDescription] = useState("");
  const [fixedAmount, setFixedAmount] = useState("");
  const [fixedDueDay, setFixedDueDay] = useState("10");
  const [fixedCategoryId, setFixedCategoryId] = useState("");
  const [fixedActive, setFixedActive] = useState(true);
  const [fixedNotes, setFixedNotes] = useState("");

  const [showSalaryForm, setShowSalaryForm] = useState(false);
  const [editingSalary, setEditingSalary] =
    useState<BackendFinanceSalary | null>(null);

  const [salaryEmployeeName, setSalaryEmployeeName] = useState("");
  const [salaryRoleDescription, setSalaryRoleDescription] = useState("");
  const [salaryAmount, setSalaryAmount] = useState("");
  const [salaryDueDay, setSalaryDueDay] = useState("5");
  const [salaryCategoryId, setSalaryCategoryId] = useState("");
  const [salaryActive, setSalaryActive] = useState(true);
  const [salaryNotes, setSalaryNotes] = useState("");

  const [showCategoryForm, setShowCategoryForm] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryType, setCategoryType] =
    useState<FinanceCategoryType>("RECEITA");
  const [categoryColor, setCategoryColor] = useState("#0f766e");

  const [clientSearch, setClientSearch] = useState("");
  const [clientResults, setClientResults] = useState<any[]>([]);
  const [clientSearchLoading, setClientSearchLoading] = useState(false);

  async function handleSearchClients() {
  try {
    setClientSearchLoading(true);
    setError("");

    if (!clientSearch.trim()) {
      setClientResults([]);
      return;
    }

    const data = (await api.searchClients(clientSearch.trim())) as any[];

    setClientResults(data);
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Erro ao buscar clientes."
    );
  } finally {
    setClientSearchLoading(false);
  }
}

  

  async function loadFinance() {
    try {
      setLoading(true);
      setError("");

      const [summaryData, categoriesData, transactionsData, fixedCostsData, salariesData] =
        await Promise.all([
          api.financeSummary(month) as Promise<BackendFinanceSummary>,
          api.financeCategories() as Promise<BackendFinanceCategory[]>,
          api.financeTransactions({
            month,
            type: transactionTypeFilter || undefined,
            status: transactionStatusFilter || undefined,
            search: transactionSearch || undefined,
          }) as Promise<BackendFinanceTransaction[]>,
          api.financeFixedCosts() as Promise<BackendFinanceFixedCost[]>,
          api.financeSalaries() as Promise<BackendFinanceSalary[]>,
        ]);

      setSummary(summaryData);
      setCategories(categoriesData);
      setTransactions(transactionsData);
      setFixedCosts(fixedCostsData);
      setSalaries(salariesData);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar financeiro."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadFinance();
  }, [month]);

  function clearMessages() {
    setError("");
    setSuccess("");
  }

  function incomeCategories() {
    return categories.filter(
      (category) => category.type === "RECEITA" && category.active
    );
  }

  function expenseCategories() {
    return categories.filter(
      (category) => category.type === "DESPESA" && category.active
    );
  }

  function availableCategoriesForTransaction() {
    return transactionType === "ENTRADA" ? incomeCategories() : expenseCategories();
  }

  function resetTransactionForm() {
    setEditingTransaction(null);
    setTransactionType("ENTRADA");
    setTransactionSource("CONTRATO");
    setTransactionStatus("PENDENTE");
    setTransactionCategoryId("");
    setTransactionDescription("");
    setTransactionAmount("");
    setTransactionDueDate("");
    setTransactionPaidAt("");
    setTransactionClientName("");
    setTransactionNotes("");
  }

  function startEditTransaction(item: BackendFinanceTransaction) {
    setEditingTransaction(item);
    setShowTransactionForm(true);
    setTransactionType(item.type);
    setTransactionSource(item.source);
    setTransactionStatus(item.status);
    setTransactionCategoryId(item.category?.id ? String(item.category.id) : "");
    setTransactionDescription(item.description || "");
    setTransactionAmount(String(item.amount || ""));
    setTransactionDueDate(item.dueDate ? item.dueDate.slice(0, 10) : "");
    setTransactionPaidAt(item.paidAt ? item.paidAt.slice(0, 10) : "");
    setTransactionClientName(item.clientName || item.protocol?.client?.name || "");
    setTransactionNotes(item.notes || "");
  }

  async function handleSaveTransaction() {
    try {
      setSaving(true);
      clearMessages();

      if (!transactionDescription.trim()) {
        throw new Error("Informe a descrição do lançamento.");
      }

      if (!transactionAmount || Number(transactionAmount) <= 0) {
        throw new Error("Informe um valor válido.");
      }

      const payload = {
        type: transactionType,
        source: transactionSource,
        status: transactionStatus,
        categoryId: transactionCategoryId ? Number(transactionCategoryId) : null,
        description: transactionDescription,
        amount: Number(transactionAmount),
        dueDate: transactionDueDate || null,
        paidAt:
          transactionStatus === "PAGO"
            ? transactionPaidAt || new Date().toISOString().slice(0, 10)
            : null,
        competenceMonth: month,
        clientName: transactionClientName || null,
        notes: transactionNotes || null,
      };

      if (editingTransaction) {
        await api.updateFinanceTransaction(editingTransaction.id, payload);
        setSuccess("Lançamento financeiro atualizado com sucesso.");
      } else {
        await api.createFinanceTransaction(payload);
        setSuccess("Lançamento financeiro cadastrado com sucesso.");
      }

      resetTransactionForm();
      setShowTransactionForm(false);
      await loadFinance();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar lançamento."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handlePayTransaction(item: BackendFinanceTransaction) {
    if (!window.confirm(`Marcar "${item.description}" como pago?`)) return;

    try {
      setSaving(true);
      clearMessages();

      await api.payFinanceTransaction(item.id);

      setSuccess("Lançamento marcado como pago.");
      await loadFinance();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao marcar como pago."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleCancelTransaction(item: BackendFinanceTransaction) {
    if (!window.confirm(`Cancelar o lançamento "${item.description}"?`)) return;

    try {
      setSaving(true);
      clearMessages();

      await api.cancelFinanceTransaction(item.id);

      setSuccess("Lançamento cancelado com sucesso.");
      await loadFinance();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cancelar lançamento."
      );
    } finally {
      setSaving(false);
    }
  }

  function resetFixedCostForm() {
    setEditingFixedCost(null);
    setFixedDescription("");
    setFixedAmount("");
    setFixedDueDay("10");
    setFixedCategoryId("");
    setFixedActive(true);
    setFixedNotes("");
  }

  function startEditFixedCost(item: BackendFinanceFixedCost) {
    setEditingFixedCost(item);
    setShowFixedCostForm(true);
    setFixedDescription(item.description || "");
    setFixedAmount(String(item.amount || ""));
    setFixedDueDay(String(item.dueDay || 10));
    setFixedCategoryId(item.category?.id ? String(item.category.id) : "");
    setFixedActive(item.active);
    setFixedNotes(item.notes || "");
  }

  async function handleSaveFixedCost() {
    try {
      setSaving(true);
      clearMessages();

      if (!fixedDescription.trim()) {
        throw new Error("Informe a descrição do custo fixo.");
      }

      if (!fixedAmount || Number(fixedAmount) <= 0) {
        throw new Error("Informe um valor válido.");
      }

      const payload = {
        description: fixedDescription,
        amount: Number(fixedAmount),
        categoryId: fixedCategoryId ? Number(fixedCategoryId) : null,
        dueDay: Number(fixedDueDay || 10),
        active: fixedActive,
        notes: fixedNotes || null,
      };

      if (editingFixedCost) {
        await api.updateFinanceFixedCost(editingFixedCost.id, payload);
        setSuccess("Custo fixo atualizado com sucesso.");
      } else {
        await api.createFinanceFixedCost(payload);
        setSuccess("Custo fixo cadastrado com sucesso.");
      }

      resetFixedCostForm();
      setShowFixedCostForm(false);
      await loadFinance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar custo fixo.");
    } finally {
      setSaving(false);
    }
  }


  async function handleDeleteFixedCost(id: number) {
  const confirmed = window.confirm(
    "Deseja realmente excluir/desativar este custo fixo?"
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.deleteFixedCost(id);

    setSuccess("Custo fixo excluído/desativado com sucesso.");
    await loadFinance();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Erro ao excluir custo fixo."
    );
  } finally {
    setSaving(false);
  }
}

async function handleDeleteCategory(id: number) {
  const confirmed = window.confirm(
    "Deseja realmente excluir/desativar esta categoria?"
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.deleteFinanceCategory(id);

    setSuccess("Categoria excluída/desativada com sucesso.");
    await loadFinance();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Erro ao excluir categoria."
    );
  } finally {
    setSaving(false);
  }
}

  function resetSalaryForm() {
    setEditingSalary(null);
    setSalaryEmployeeName("");
    setSalaryRoleDescription("");
    setSalaryAmount("");
    setSalaryDueDay("5");
    setSalaryCategoryId("");
    setSalaryActive(true);
    setSalaryNotes("");
  }

  function startEditSalary(item: BackendFinanceSalary) {
    setEditingSalary(item);
    setShowSalaryForm(true);
    setSalaryEmployeeName(item.employeeName || "");
    setSalaryRoleDescription(item.roleDescription || "");
    setSalaryAmount(String(item.amount || ""));
    setSalaryDueDay(String(item.dueDay || 5));
    setSalaryCategoryId(item.category?.id ? String(item.category.id) : "");
    setSalaryActive(item.active);
    setSalaryNotes(item.notes || "");
  }

  

  async function handleSaveSalary() {
    try {
      setSaving(true);
      clearMessages();

      if (!salaryEmployeeName.trim()) {
        throw new Error("Informe o nome do funcionário.");
      }

      if (!salaryAmount || Number(salaryAmount) <= 0) {
        throw new Error("Informe um valor válido.");
      }

      const payload = {
        employeeName: salaryEmployeeName,
        roleDescription: salaryRoleDescription || null,
        amount: Number(salaryAmount),
        categoryId: salaryCategoryId ? Number(salaryCategoryId) : null,
        dueDay: Number(salaryDueDay || 5),
        active: salaryActive,
        notes: salaryNotes || null,
      };

      if (editingSalary) {
        await api.updateFinanceSalary(editingSalary.id, payload);
        setSuccess("Salário atualizado com sucesso.");
      } else {
        await api.createFinanceSalary(payload);
        setSuccess("Salário cadastrado com sucesso.");
      }

      resetSalaryForm();
      setShowSalaryForm(false);
      await loadFinance();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar salário.");
    } finally {
      setSaving(false);
    }
  }

async function handleDeleteSalary(id: number) {
  const confirmed = window.confirm(
    "Deseja realmente excluir/desativar este salário?"
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.deleteEmployeeSalary(id);

    setSuccess("Salário excluído/desativado com sucesso.");
    await loadFinance();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Erro ao excluir salário."
    );
  } finally {
    setSaving(false);
  }
}

  async function handleCreateCategory() {
    try {
      setSaving(true);
      clearMessages();

      if (!categoryName.trim()) {
        throw new Error("Informe o nome da categoria.");
      }

      await api.createFinanceCategory({
        name: categoryName,
        type: categoryType,
        color: categoryColor,
        active: true,
      });

      setCategoryName("");
      setCategoryType("RECEITA");
      setCategoryColor("#0f766e");
      setShowCategoryForm(false);
      setSuccess("Categoria cadastrada com sucesso.");
      await loadFinance();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao cadastrar categoria."
      );
    } finally {
      setSaving(false);
    }
  }

  async function applyFilters() {
    await loadFinance();
  }

  const maxCategoryAmount = Math.max(
    ...(summary?.byCategory || []).map((item) => item.amount),
    1
  );

  const resultIsPositive = (summary?.resultadoPrevisto || 0) >= 0;


  async function handleDeleteTransaction(id: number) {
  const confirmed = window.confirm(
    "Deseja realmente excluir este lançamento financeiro?"
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.deleteFinancialTransaction(id);

    setSuccess("Lançamento excluído com sucesso.");
    await loadFinance();
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Erro ao excluir lançamento."
    );
  } finally {
    setSaving(false);
  }
}


  return (
    <section className="page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Gestão financeira premium</h1>
          <p>
            Controle mensal de entradas, saídas, custos fixos, salários,
            contratos e serviços avulsos.
          </p>
        </div>

        <div className="detail-actions">
          <input
            type="month"
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />

          <button className="button primary" onClick={loadFinance}>
            Atualizar
          </button>
        </div>
      </div>

      {saving && (
        <div className="modal-backdrop">
          <div className="protocol-modal progress-modal">
            <h2>Processando...</h2>
            <p>Aguarde enquanto o sistema grava as informações financeiras.</p>
          </div>
        </div>
      )}

      {success && <div className="panel success-panel">{success}</div>}
      {error && <div className="panel error-panel">{error}</div>}

      <div className="settings-tabs finance-tabs">
        <button
          className={activeTab === "OVERVIEW" ? "active" : ""}
          onClick={() => setActiveTab("OVERVIEW")}
        >
          Visão geral
        </button>

        <button
          className={activeTab === "TRANSACTIONS" ? "active" : ""}
          onClick={() => setActiveTab("TRANSACTIONS")}
        >
          Lançamentos
        </button>

        <button
          className={activeTab === "FIXED_COSTS" ? "active" : ""}
          onClick={() => setActiveTab("FIXED_COSTS")}
        >
          Custos fixos
        </button>

        <button
          className={activeTab === "SALARIES" ? "active" : ""}
          onClick={() => setActiveTab("SALARIES")}
        >
          Salários
        </button>

        <button
          className={activeTab === "CATEGORIES" ? "active" : ""}
          onClick={() => setActiveTab("CATEGORIES")}
        >
          Categorias
        </button>

        <button
          className={activeTab === "PARTNERS" ? "active" : ""}
          onClick={() => setActiveTab("PARTNERS")}
        >
          Parceiros
        </button>
      </div>

      {loading && <div className="panel">Carregando financeiro...</div>}

      {!loading && activeTab === "PARTNERS" && (
        <PartnersFinanceTab />
      )}

      {!loading && summary && activeTab === "OVERVIEW" && (
        <>
          <div className="metrics-grid three">
            <MetricCard
              title="Entradas previstas"
              value={money(summary.entradas)}
              hint="receitas lançadas no mês"
              icon={WalletCards}
            />

            <MetricCard
              title="Saídas projetadas"
              value={money(summary.saidasProjetadas)}
              hint="despesas + custos fixos + salários"
              icon={BarChart3}
            />

            <MetricCard
              title="Resultado previsto"
              value={money(summary.resultadoPrevisto)}
              hint={resultIsPositive ? "saldo positivo" : "saldo negativo"}
              icon={Clock}
            />
          </div>

          <div className="metrics-grid three">
            <MetricCard
              title="Recebido"
              value={money(summary.entradasRecebidas)}
              hint="entradas pagas"
              icon={WalletCards}
            />

            <MetricCard
              title="A receber"
              value={money(summary.entradasPendentes)}
              hint="entradas pendentes"
              icon={Clock}
            />

            <MetricCard
              title="Resultado realizado"
              value={money(summary.resultadoRealizado)}
              hint="recebido menos saídas pagas"
              icon={BarChart3}
            />
          </div>

          <div className="dashboard-grid">
            <article className="panel">
              <div className="panel-header">
                <h2>Distribuição por categoria</h2>
                <span>{summary.byCategory.length} categoria(s)</span>
              </div>

              <div className="finance-bars">
                {summary.byCategory.length === 0 && (
                  <p>Nenhum lançamento no mês selecionado.</p>
                )}

                {summary.byCategory.map((item) => {
                  const width = Math.max(
                    6,
                    Math.round((item.amount / maxCategoryAmount) * 100)
                  );

                  return (
                    <div key={`${item.type}-${item.category}`} className="finance-bar-row">
                      <div className="finance-bar-info">
                        <strong>{item.category}</strong>
                        <span>
                          {item.type === "ENTRADA" ? "Entrada" : "Saída"} ·{" "}
                          {item.count} lançamento(s)
                        </span>
                      </div>

                      <div className="finance-bar-track">
                        <div
                          className={`finance-bar-fill ${
                            item.type === "ENTRADA" ? "income" : "expense"
                          }`}
                          style={{ width: `${width}%` }}
                        />
                      </div>

                      <b>{money(item.amount)}</b>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="panel">
              <div className="panel-header">
                <h2>Resumo executivo</h2>
              </div>

              <div className="detail-list">
                <div>
                  <span>Custos fixos ativos</span>
                  <strong>{money(summary.custoFixoMensal)}</strong>
                </div>

                <div>
                  <span>Folha salarial mensal</span>
                  <strong>{money(summary.salariosMensais)}</strong>
                </div>

                <div>
                  <span>Saídas lançadas</span>
                  <strong>{money(summary.saidasLancadas)}</strong>
                </div>

                <div>
                  <span>Saídas pendentes</span>
                  <strong>{money(summary.saidasPendentes)}</strong>
                </div>

                <div>
                  <span>Total de lançamentos</span>
                  <strong>{summary.transactionCount}</strong>
                </div>

                <div>
                  <span>Mês de competência</span>
                  <strong>{summary.month}</strong>
                </div>
              </div>
            </article>
          </div>
        </>
      )}

      {!loading && activeTab === "TRANSACTIONS" && (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Lançamentos financeiros</h2>
              <p>Entradas, saídas, contratos, serviços avulsos e despesas.</p>
            </div>

            <button
              className="button primary"
              onClick={() => {
                resetTransactionForm();
                setShowTransactionForm((value) => !value);
              }}
            >
              {showTransactionForm ? "Fechar formulário" : "Novo lançamento"}
            </button>
          </div>

          <div className="form-row">
            <label>
              Buscar
              <input
                value={transactionSearch}
                onChange={(event) => setTransactionSearch(event.target.value)}
                placeholder="Cliente, descrição ou observação"
              />
            </label>

            <label>
              Tipo
              <select
                value={transactionTypeFilter}
                onChange={(event) =>
                  setTransactionTypeFilter(
                    event.target.value as "" | FinanceTransactionType
                  )
                }
              >
                <option value="">Todos</option>
                <option value="ENTRADA">Entradas</option>
                <option value="SAIDA">Saídas</option>
              </select>
            </label>

            <label>
              Status
              <select
                value={transactionStatusFilter}
                onChange={(event) =>
                  setTransactionStatusFilter(
                    event.target.value as "" | FinanceTransactionStatus
                  )
                }
              >
                <option value="">Todos</option>
                <option value="PENDENTE">Pendente</option>
                <option value="PAGO">Pago</option>
                <option value="CANCELADO">Cancelado</option>
              </select>
            </label>

            <button className="secondary-action" onClick={applyFilters}>
              Filtrar
            </button>
          </div>

          {showTransactionForm && (
            <div className="panel soft-panel">
              <h3>{editingTransaction ? "Editar lançamento" : "Novo lançamento"}</h3>

              <div className="protocol-form-grid">
                <div className="form-section">
                  <label>
                    Tipo
                    <select
                      value={transactionType}
                      onChange={(event) => {
                        const nextType = event.target.value as FinanceTransactionType;
                        setTransactionType(nextType);
                        setTransactionCategoryId("");

                        if (nextType === "ENTRADA") {
                          setTransactionSource("CONTRATO");
                        } else {
                          setTransactionSource("OUTRO");
                        }
                      }}
                    >
                      <option value="ENTRADA">Entrada</option>
                      <option value="SAIDA">Saída</option>
                    </select>
                  </label>

                  <label>
                    Origem
                    <select
                      value={transactionSource}
                      onChange={(event) =>
                        setTransactionSource(
                          event.target.value as FinanceTransactionSource
                        )
                      }
                    >
                      <option value="CONTRATO">Contrato</option>
                      <option value="SERVICO_AVULSO">Serviço avulso</option>
                      <option value="CUSTO_FIXO">Custo fixo</option>
                      <option value="SALARIO">Salário</option>
                      <option value="IMPOSTO">Imposto</option>
                      <option value="TAXA">Taxa</option>
                      <option value="OUTRO">Outro</option>
                    </select>
                  </label>

                  <label>
                    Categoria
                    <select
                      value={transactionCategoryId}
                      onChange={(event) =>
                        setTransactionCategoryId(event.target.value)
                      }
                    >
                      <option value="">Sem categoria</option>
                      {availableCategoriesForTransaction().map((category) => (
                        <option key={category.id} value={category.id}>
                          {category.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="form-section">
                  <label>
                    Descrição
                    <input
                      value={transactionDescription}
                      onChange={(event) =>
                        setTransactionDescription(event.target.value)
                      }
                      placeholder="Ex: Entrada contrato georreferenciamento"
                    />
                  </label>

<div className="client-search-box">
  <label>
    Cliente vinculado
    <input
      value={transactionClientName}
      onChange={(event) => {
        setTransactionClientName(event.target.value);
        setClientSearch(event.target.value);
      }}
      placeholder="Nome do cliente, empresa ou origem"
    />
  </label>

  <div className="form-actions compact-actions">
    <button
      type="button"
      className="secondary-action"
      onClick={handleSearchClients}
      disabled={clientSearchLoading}
    >
      {clientSearchLoading ? "Buscando..." : "Buscar cliente"}
    </button>

    {transactionClientName && (
      <button
        type="button"
        className="secondary-action"
        onClick={() => {
          setTransactionClientName("");
          setClientSearch("");
          setClientResults([]);
        }}
      >
        Limpar cliente
      </button>
    )}
  </div>

  {clientResults.length > 0 && (
    <div className="client-search-results">
      {clientResults.map((client) => (
        <button
          key={client.id}
          type="button"
          className="client-search-result"
          onClick={() => {
            setTransactionClientName(client.name);
            setClientSearch(client.name);
            setClientResults([]);

            if (!transactionDescription.trim()) {
              setTransactionDescription(`Lançamento financeiro - ${client.name}`);
            }
          }}
        >
          <strong>{client.name}</strong>
          <small>
            {client.cpfCnpj || "CPF/CNPJ não informado"} ·{" "}
            {client.email || "sem e-mail"}
          </small>
        </button>
      ))}
    </div>
  )}
</div>

                  <label>
                    Valor
                    <input
                      type="number"
                      value={transactionAmount}
                      onChange={(event) =>
                        setTransactionAmount(event.target.value)
                      }
                      placeholder="0"
                    />
                  </label>
                </div>

                <div className="form-section">
                  <label>
                    Status
                    <select
                      value={transactionStatus}
                      onChange={(event) =>
                        setTransactionStatus(
                          event.target.value as FinanceTransactionStatus
                        )
                      }
                    >
                      <option value="PENDENTE">Pendente</option>
                      <option value="PAGO">Pago</option>
                      <option value="CANCELADO">Cancelado</option>
                    </select>
                  </label>

                  <label>
                    Vencimento
                    <input
                      type="date"
                      value={transactionDueDate}
                      onChange={(event) =>
                        setTransactionDueDate(event.target.value)
                      }
                    />
                  </label>

                  <label>
                    Data de pagamento
                    <input
                      type="date"
                      value={transactionPaidAt}
                      onChange={(event) =>
                        setTransactionPaidAt(event.target.value)
                      }
                    />
                  </label>
                </div>

                <div className="form-section">
                  <label>
                    Observações
                    <textarea
                      value={transactionNotes}
                      onChange={(event) => setTransactionNotes(event.target.value)}
                      rows={5}
                    />
                  </label>
                </div>
              </div>

              <div className="form-actions">
                <button
                  className="secondary-action"
                  onClick={() => {
                    resetTransactionForm();
                    setShowTransactionForm(false);
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="button primary"
                  onClick={handleSaveTransaction}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Salvar lançamento"}
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Cliente/Protocolo</th>
                  <th>Categoria</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {transactions.map((item) => (
                  <tr key={item.id}>
                    <td>{item.type === "ENTRADA" ? "Entrada" : "Saída"}</td>

                    <td>
                      <strong>{item.description}</strong>
                      <small className="table-small">{item.source}</small>
                    </td>

                    <td>
                      {item.clientName || item.protocol?.client?.name || "-"}
                      {item.protocol && (
                        <small className="table-small">
                          {item.protocol.protocolNumber}
                        </small>
                      )}
                    </td>

                    <td>{item.category?.name || "-"}</td>
                    <td>{formatDate(item.dueDate)}</td>
                    <td>{money(item.amount)}</td>

                    <td>
                      <span
                        className={`badge payment-${item.status.toLowerCase()}`}
                      >
                        {item.status}
                      </span>
                    </td>

<td>
  <div className="table-actions">
    <button
      className="mini-button"
      type="button"
      onClick={() => startEditTransaction(item)}
    >
      Editar
    </button>

    {item.status !== "PAGO" && (
      <button
        className="mini-button"
        type="button"
        onClick={() => handlePayTransaction(item)}
      >
        Pagar
      </button>
    )}

    {item.status !== "CANCELADO" && (
      <button
        className="mini-button"
        type="button"
        onClick={() => handleCancelTransaction(item)}
      >
        Cancelar
      </button>
    )}

    <button
      className="mini-button danger"
      type="button"
      onClick={() => handleDeleteTransaction(item.id)}
    >
      Excluir
    </button>
  </div>
</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {transactions.length === 0 && <p>Nenhum lançamento encontrado.</p>}
          </div>
        </article>
      )}

      {!loading && activeTab === "FIXED_COSTS" && (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Custos fixos</h2>
              <p>Aluguel, internet, energia, contabilidade, sistemas e despesas recorrentes.</p>
            </div>

            <button
              className="button primary"
              onClick={() => {
                resetFixedCostForm();
                setShowFixedCostForm((value) => !value);
              }}
            >
              {showFixedCostForm ? "Fechar formulário" : "Novo custo fixo"}
            </button>
          </div>

          {showFixedCostForm && (
            <div className="panel soft-panel">
              <h3>{editingFixedCost ? "Editar custo fixo" : "Novo custo fixo"}</h3>

              <div className="form-row">
                <label>
                  Descrição
                  <input
                    value={fixedDescription}
                    onChange={(event) => setFixedDescription(event.target.value)}
                  />
                </label>

                <label>
                  Valor mensal
                  <input
                    type="number"
                    value={fixedAmount}
                    onChange={(event) => setFixedAmount(event.target.value)}
                  />
                </label>

                <label>
                  Dia de vencimento
                  <input
                    type="number"
                    value={fixedDueDay}
                    onChange={(event) => setFixedDueDay(event.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Categoria
                  <select
                    value={fixedCategoryId}
                    onChange={(event) => setFixedCategoryId(event.target.value)}
                  >
                    <option value="">Sem categoria</option>
                    {expenseCategories().map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={fixedActive}
                    onChange={(event) => setFixedActive(event.target.checked)}
                  />
                  Custo ativo
                </label>
              </div>

              <label>
                Observações
                <textarea
                  value={fixedNotes}
                  onChange={(event) => setFixedNotes(event.target.value)}
                  rows={3}
                />
              </label>

              <div className="form-actions">
                <button
                  className="secondary-action"
                  onClick={() => {
                    resetFixedCostForm();
                    setShowFixedCostForm(false);
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="button primary"
                  onClick={handleSaveFixedCost}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Salvar custo fixo"}
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Descrição</th>
                  <th>Categoria</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {fixedCosts.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>{item.description}</strong>
                      <small className="table-small">{item.notes || ""}</small>
                    </td>
                    <td>{item.category?.name || "-"}</td>
                    <td>Dia {item.dueDay}</td>
                    <td>{money(item.amount)}</td>
                    <td>
                      <span
                        className={`badge ${
                          item.active ? "em_execucao" : "cancelado"
                        }`}
                      >
                        {item.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
<td>
  <div className="table-actions">
    <button
      className="mini-button"
      type="button"
      onClick={() => startEditFixedCost(item)}
    >
      Editar
    </button>

    {item.active && (
      <button
        className="mini-button danger"
        type="button"
        onClick={() => handleDeleteFixedCost(item.id)}
      >
        Excluir
      </button>
    )}

    {!item.active && (
      <span className="table-small">Desativado</span>
    )}
  </div>
</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {fixedCosts.length === 0 && <p>Nenhum custo fixo cadastrado.</p>}
          </div>
        </article>
      )}

      {!loading && activeTab === "SALARIES" && (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Salários e equipe</h2>
              <p>Controle de salários, funções e vencimentos mensais.</p>
            </div>

            <button
              className="button primary"
              onClick={() => {
                resetSalaryForm();
                setShowSalaryForm((value) => !value);
              }}
            >
              {showSalaryForm ? "Fechar formulário" : "Novo salário"}
            </button>
          </div>

          {showSalaryForm && (
            <div className="panel soft-panel">
              <h3>{editingSalary ? "Editar salário" : "Novo salário"}</h3>

              <div className="form-row">
                <label>
                  Funcionário
                  <input
                    value={salaryEmployeeName}
                    onChange={(event) =>
                      setSalaryEmployeeName(event.target.value)
                    }
                  />
                </label>

                <label>
                  Função
                  <input
                    value={salaryRoleDescription}
                    onChange={(event) =>
                      setSalaryRoleDescription(event.target.value)
                    }
                  />
                </label>

                <label>
                  Salário
                  <input
                    type="number"
                    value={salaryAmount}
                    onChange={(event) => setSalaryAmount(event.target.value)}
                  />
                </label>
              </div>

              <div className="form-row">
                <label>
                  Dia de pagamento
                  <input
                    type="number"
                    value={salaryDueDay}
                    onChange={(event) => setSalaryDueDay(event.target.value)}
                  />
                </label>

                <label>
                  Categoria
                  <select
                    value={salaryCategoryId}
                    onChange={(event) => setSalaryCategoryId(event.target.value)}
                  >
                    <option value="">Sem categoria</option>
                    {expenseCategories().map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={salaryActive}
                    onChange={(event) => setSalaryActive(event.target.checked)}
                  />
                  Salário ativo
                </label>
              </div>

              <label>
                Observações
                <textarea
                  value={salaryNotes}
                  onChange={(event) => setSalaryNotes(event.target.value)}
                  rows={3}
                />
              </label>

              <div className="form-actions">
                <button
                  className="secondary-action"
                  onClick={() => {
                    resetSalaryForm();
                    setShowSalaryForm(false);
                  }}
                >
                  Cancelar
                </button>

                <button
                  className="button primary"
                  onClick={handleSaveSalary}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Salvar salário"}
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Funcionário</th>
                  <th>Função</th>
                  <th>Categoria</th>
                  <th>Pagamento</th>
                  <th>Valor</th>
                  <th>Status</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {salaries.map((item) => (
                  <tr key={item.id}>
                    <td>{item.employeeName}</td>
                    <td>{item.roleDescription || "-"}</td>
                    <td>{item.category?.name || "-"}</td>
                    <td>Dia {item.dueDay}</td>
                    <td>{money(item.amount)}</td>
                    <td>
                      <span
                        className={`badge ${
                          item.active ? "em_execucao" : "cancelado"
                        }`}
                      >
                        {item.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>
<td>
  <div className="table-actions">
    <button
      className="mini-button"
      type="button"
      onClick={() => startEditSalary(item)}
    >
      Editar
    </button>

    {item.active && (
      <button
        className="mini-button danger"
        type="button"
        onClick={() => handleDeleteSalary(item.id)}
      >
        Excluir
      </button>
    )}

    {!item.active && (
      <span className="table-small">Desativado</span>
    )}
  </div>
</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {salaries.length === 0 && <p>Nenhum salário cadastrado.</p>}
          </div>
        </article>
      )}

      {!loading && activeTab === "CATEGORIES" && (
        <article className="panel">
          <div className="panel-header">
            <div>
              <h2>Categorias financeiras</h2>
              <p>Classificação das receitas e despesas do sistema.</p>
            </div>

            <button
              className="button primary"
              onClick={() => setShowCategoryForm((value) => !value)}
            >
              {showCategoryForm ? "Fechar formulário" : "Nova categoria"}
            </button>
          </div>

          {showCategoryForm && (
            <div className="panel soft-panel">
              <h3>Nova categoria</h3>

              <div className="form-row">
                <label>
                  Nome
                  <input
                    value={categoryName}
                    onChange={(event) => setCategoryName(event.target.value)}
                    placeholder="Ex: Impostos e taxas"
                  />
                </label>

                <label>
                  Tipo
                  <select
                    value={categoryType}
                    onChange={(event) =>
                      setCategoryType(event.target.value as FinanceCategoryType)
                    }
                  >
                    <option value="RECEITA">Receita</option>
                    <option value="DESPESA">Despesa</option>
                  </select>
                </label>

                <label>
                  Cor
                  <input
                    type="color"
                    value={categoryColor}
                    onChange={(event) => setCategoryColor(event.target.value)}
                  />
                </label>
              </div>

              <div className="form-actions">
                <button
                  className="secondary-action"
                  onClick={() => setShowCategoryForm(false)}
                >
                  Cancelar
                </button>

                <button
                  className="button primary"
                  onClick={handleCreateCategory}
                  disabled={saving}
                >
                  {saving ? "Salvando..." : "Cadastrar categoria"}
                </button>
              </div>
            </div>
          )}

          <div className="table-wrap">
            <table className="data-table">
              <thead>
  <tr>
    <th>Categoria</th>
    <th>Tipo</th>
    <th>Cor</th>
    <th>Status</th>
    <th>Ações</th>
  </tr>
</thead>

<tbody>
  {categories.map((category) => (
    <tr key={category.id}>
      <td>{category.name}</td>

      <td>{category.type}</td>

      <td>
        <span
          style={{
            display: "inline-block",
            width: 18,
            height: 18,
            borderRadius: 999,
            background: category.color || "#64748b",
            verticalAlign: "middle",
            marginRight: 8,
          }}
        />
        {category.color || "-"}
      </td>

      <td>
        <span
          className={`badge ${
            category.active ? "em_execucao" : "cancelado"
          }`}
        >
          {category.active ? "Ativa" : "Inativa"}
        </span>
      </td>

      <td>
        <div className="table-actions">
          {category.active ? (
            <button
              className="mini-button danger"
              type="button"
              onClick={() => handleDeleteCategory(category.id)}
            >
              Excluir
            </button>
          ) : (
            <span className="table-small">Desativada</span>
          )}
        </div>
      </td>
    </tr>
  ))}
</tbody>
            </table>
          </div>
        </article>
      )}
    </section>
  );
}

function SettingsPage() {
  const [activeTab, setActiveTab] = useState<
    "USERS" | "SMTP" | "COMPANY" | "LOGS"
  >("USERS");

  const tabs = [
    {
      key: "USERS",
      title: "Usuários e permissões",
      description: "Cadastre usuários, defina perfis e controle acessos.",
    },
    {
      key: "SMTP",
      title: "SMTP",
      description: "Configure envio de e-mails e alertas automáticos.",
    },
    {
      key: "COMPANY",
      title: "Dados da empresa",
      description: "Informações institucionais usadas nos documentos.",
    },
    {
      key: "LOGS",
      title: "Logs e auditoria",
      description: "Acompanhe ações relevantes realizadas no sistema.",
    },
  ] as const;

  return (
    <section className="page settings-page">
      <div className="page-heading">
        <div>
          <span className="eyebrow">Sistema</span>
          <h1>Configurações do programador</h1>
          <p>
            Área administrativa para parametrização do SIS Amazonika, controle
            de usuários, permissões, SMTP, dados da empresa e auditoria.
          </p>
        </div>
      </div>

      <div className="settings-tab-grid">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            type="button"
            className={`settings-tab-card ${
              activeTab === tab.key ? "active" : ""
            }`}
            onClick={() => setActiveTab(tab.key)}
          >
            <Settings size={20} />
            <strong>{tab.title}</strong>
            <span>{tab.description}</span>
          </button>
        ))}
      </div>

      <div className="settings-content">
        {activeTab === "USERS" && <UsersPermissionsPanel />}
        {activeTab === "SMTP" && <SmtpSettingsPanel />}
    {activeTab === "COMPANY" && <CompanySettingsPanel />}
        {activeTab === "LOGS" && <AuditLogsPanel />}
      </div>
    </section>
  );
}

function UsersPermissionsPanel() {
  const [users, setUsers] = useState<BackendUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUser, setEditingUser] = useState<BackendUser | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("123456");
  const [role, setRole] = useState<Role>("ATENDENTE");
  const [active, setActive] = useState(true);

  async function loadUsers() {
    try {
      setLoading(true);
      setError("");

      const data = (await api.users()) as BackendUser[];
      setUsers(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar usuários."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  function resetForm() {
    setEditingUser(null);
    setName("");
    setEmail("");
    setPassword("123456");
    setRole("ATENDENTE");
    setActive(true);
  }

  function openNewUserModal() {
    resetForm();
    setError("");
    setSuccess("");
    setShowUserModal(true);
  }

  function closeUserModal() {
    resetForm();
    setShowUserModal(false);
  }

  function startEdit(user: BackendUser) {
    setEditingUser(user);
    setName(user.name);
    setEmail(user.email);
    setPassword("");
    setRole(user.role);
    setActive(user.active);
    setError("");
    setSuccess("");
    setShowUserModal(true);
  }

  async function handleSaveUser() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!name.trim() || !email.trim()) {
        throw new Error("Nome e e-mail são obrigatórios.");
      }

      if (!editingUser && !password.trim()) {
        throw new Error("Senha inicial é obrigatória para novo usuário.");
      }

      if (editingUser) {
        await api.updateUser(editingUser.id, {
          name,
          email,
          password: password || undefined,
          role,
          active,
        });

        setSuccess("Usuário atualizado com sucesso.");
      } else {
        await api.createUser({
          name,
          email,
          password,
          role,
          active,
        });

        setSuccess("Usuário cadastrado com sucesso.");
      }

      closeUserModal();
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar usuário.");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggle(user: BackendUser) {
    const confirmText = user.active
      ? `Deseja desativar o usuário ${user.name}?`
      : `Deseja ativar o usuário ${user.name}?`;

    if (!window.confirm(confirmText)) return;

    try {
      setSaving(true);
      setError("");
      setSuccess("");

      await api.toggleUserActive(user.id);

      setSuccess(
        user.active
          ? "Usuário desativado com sucesso."
          : "Usuário ativado com sucesso."
      );

      await loadUsers();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao alterar usuário."
      );
    } finally {
      setSaving(false);
    }
  }

  const activeUsers = users.filter((user) => user.active).length;
  const inactiveUsers = users.length - activeUsers;

  async function handleDeleteUser(user: BackendUser) {
  const confirmed = window.confirm(
    `Deseja realmente excluir/desativar o usuário ${user.name}?`
  );

  if (!confirmed) return;

  try {
    setSaving(true);
    setError("");
    setSuccess("");

    await api.deleteUser(user.id);

    setSuccess("Usuário excluído/desativado com sucesso.");
    await loadUsers();

    if (editingUser?.id === user.id) {
      resetForm();
    }
  } catch (err) {
    setError(
      err instanceof Error ? err.message : "Erro ao excluir usuário."
    );
  } finally {
    setSaving(false);
  }
}

  return (
    <div className="users-permissions-module compact-users-module">
      <div className="settings-summary-grid">
        <article className="settings-summary-card">
          <span>Total de usuários</span>
          <strong>{users.length}</strong>
        </article>

        <article className="settings-summary-card">
          <span>Usuários ativos</span>
          <strong>{activeUsers}</strong>
        </article>

        <article className="settings-summary-card">
          <span>Usuários inativos</span>
          <strong>{inactiveUsers}</strong>
        </article>

        <article className="settings-summary-card">
          <span>Perfis disponíveis</span>
          <strong>4</strong>
        </article>
      </div>

      {success && <div className="panel success-panel settings-message">{success}</div>}
      {error && !showUserModal && (
        <div className="panel error-panel settings-message">{error}</div>
      )}

      <article className="panel settings-users-table-card full-width-users">
        <div className="panel-header users-panel-header">
          <div>
            <h2>Usuários cadastrados</h2>
            <p>Controle de acesso dos perfis internos e clientes.</p>
          </div>

          <div className="users-header-actions">
            <span>{users.length} usuário(s)</span>

            <button
              type="button"
              className="button primary"
              onClick={openNewUserModal}
            >
              Novo usuário
            </button>
          </div>
        </div>

        {loading ? (
          <p>Carregando usuários...</p>
        ) : (
          <div className="table-wrap">
            <table className="data-table users-table">
              <thead>
                <tr>
                  <th>Usuário</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Status</th>
                  <th>Último acesso</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.name}</strong>
                    </td>

                    <td>
                      {user.email}
                      {user.lastLoginIp && (
                        <small className="table-small">
                          IP: {user.lastLoginIp}
                        </small>
                      )}
                    </td>

                    <td>{roleLabels[user.role]}</td>

                    <td>
                      <span
                        className={`badge ${
                          user.active ? "em_execucao" : "cancelado"
                        }`}
                      >
                        {user.active ? "Ativo" : "Inativo"}
                      </span>
                    </td>

                    <td>{formatDateTime(user.lastLoginAt)}</td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => startEdit(user)}
                        >
                          Editar
                        </button>

                        <button
                          type="button"
                          className="mini-button"
                          onClick={() => handleToggle(user)}
                        >
                          {user.active ? "Desativar" : "Ativar"}
                        </button>
                        <button
  className="mini-button danger"
  onClick={() => handleDeleteUser(user)}
>
  Excluir
</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {users.length === 0 && <p>Nenhum usuário cadastrado.</p>}
          </div>
        )}
      </article>

      {showUserModal && (
        <div className="modal-backdrop" onClick={closeUserModal}>
          <div
            className="user-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-header">
              <div>
                <span className="eyebrow">
                  {editingUser ? "Editar acesso" : "Novo acesso"}
                </span>
                <h2>{editingUser ? "Editar usuário" : "Cadastrar usuário"}</h2>
                <p>
                  {editingUser
                    ? "Altere dados cadastrais, perfil de acesso, senha e status."
                    : "Cadastre um novo usuário e atribua o perfil de acesso ao sistema."}
                </p>
              </div>

              <button type="button" onClick={closeUserModal}>
                Fechar
              </button>
            </div>

            {error && <div className="error-panel settings-message">{error}</div>}

            <div className="user-modal-grid">
              <div className="settings-user-form">
                <label>
                  Nome do usuário
                  <input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Ex: Maria Silva"
                  />
                </label>

                <label>
                  E-mail de acesso
                  <input
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="usuario@amazonika.com.br"
                  />
                </label>

                <div className="form-row">
                  <label>
                    Senha
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder={
                        editingUser
                          ? "Deixe em branco para manter"
                          : "Senha inicial"
                      }
                    />
                  </label>

                  <label>
                    Perfil de acesso
                    <select
                      value={role}
                      onChange={(event) => setRole(event.target.value as Role)}
                    >
                      <option value="ATENDENTE">Atendente</option>
                      <option value="GERENTE">Gerente</option>
                      <option value="PROGRAMADOR">Programador</option>
                      <option value="CLIENTE">Cliente</option>
                    </select>
                  </label>
                </div>

                <label className="checkbox-line">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                  />
                  Usuário ativo
                </label>
              </div>

              <aside className="permission-description modal-permission-box">
                <strong>Permissões do perfil selecionado</strong>

                {role === "ATENDENTE" && (
                  <p>
                    Pode cadastrar clientes, abrir protocolos, anexar documentos,
                    consultar agenda dos gestores e criar agendamentos. Não acessa
                    financeiro nem configurações.
                  </p>
                )}

                {role === "GERENTE" && (
                  <p>
                    Pode visualizar protocolos, agendamentos, dados gerenciais,
                    financeiro, contratos e acompanhar execução dos serviços.
                  </p>
                )}

                {role === "PROGRAMADOR" && (
                  <p>
                    Acesso total ao sistema, incluindo configurações, usuários,
                    permissões, SMTP, logs e manutenção técnica.
                  </p>
                )}

                {role === "CLIENTE" && (
                  <p>
                    Acesso restrito à área do cliente, para acompanhar status do
                    serviço, documentos e movimentações liberadas.
                  </p>
                )}
              </aside>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-action"
                onClick={closeUserModal}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                onClick={handleSaveUser}
                disabled={saving}
              >
                {saving
                  ? "Salvando..."
                  : editingUser
                  ? "Salvar usuário"
                  : "Cadastrar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function SmtpSettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [smtpHost, setSmtpHost] = useState("smtp.gmail.com");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUser, setSmtpUser] = useState("amazonika@amazonikaengenharia.com.br");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpPassConfigured, setSmtpPassConfigured] = useState(false);
  const [smtpFrom, setSmtpFrom] = useState(
    "SIS Amazonika <amazonika@amazonikaengenharia.com.br>"
  );
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [companyAlertEmail, setCompanyAlertEmail] = useState(
    "amazonika@amazonikaengenharia.com.br"
  );
  const [testEmail, setTestEmail] = useState("amazonika@amazonikaengenharia.com.br");

  async function loadSmtp() {
    try {
      setLoading(true);
      setError("");

      const data = (await api.smtpSettings()) as SmtpSettingsResponse;

      setSmtpHost(data.smtpHost || "smtp.gmail.com");
      setSmtpPort(String(data.smtpPort || 587));
      setSmtpUser(data.smtpUser || "amazonika@amazonikaengenharia.com.br");
      setSmtpFrom(
        data.smtpFrom || "SIS Amazonika <amazonika@amazonikaengenharia.com.br>"
      );
      setSmtpSecure(Boolean(data.smtpSecure));
      setCompanyAlertEmail(
        data.companyAlertEmail || "amazonika@amazonikaengenharia.com.br"
      );
      setSmtpPassConfigured(Boolean(data.smtpPassConfigured));
      setTestEmail(data.companyAlertEmail || "amazonika@amazonikaengenharia.com.br");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao carregar SMTP."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSmtp();
  }, []);

  async function handleSaveSmtp() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!smtpHost.trim()) {
        throw new Error("Informe o host SMTP.");
      }

      if (!smtpPort.trim()) {
        throw new Error("Informe a porta SMTP.");
      }

      if (!smtpUser.trim()) {
        throw new Error("Informe o usuário SMTP.");
      }

      if (!smtpFrom.trim()) {
        throw new Error("Informe o remetente.");
      }

      if (!companyAlertEmail.trim()) {
        throw new Error("Informe o e-mail da empresa.");
      }

      await api.updateSmtpSettings({
        smtpHost,
        smtpPort: Number(smtpPort),
        smtpUser,
        smtpPass: smtpPass || undefined,
        smtpFrom,
        smtpSecure,
        companyAlertEmail,
      });

      setSmtpPass("");
      setSuccess("Configurações SMTP salvas com sucesso.");
      await loadSmtp();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao salvar SMTP."
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleTestSmtp() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!testEmail.trim()) {
        throw new Error("Informe o e-mail para teste.");
      }

      await api.testSmtp({
        testEmail,
      });

      setSuccess("E-mail de teste enviado com sucesso.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erro ao testar SMTP."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <article className="panel settings-wide-panel">
        <p>Carregando configurações SMTP...</p>
      </article>
    );
  }

  return (
    <div className="smtp-settings-module">
      {success && <div className="panel success-panel settings-message">{success}</div>}
      {error && <div className="panel error-panel settings-message">{error}</div>}

      <article className="panel settings-wide-panel">
        <div className="panel-header">
          <div>
            <h2>Configuração SMTP</h2>
            <p>
              Configure o servidor responsável pelo envio dos e-mails de
              protocolo, agendamento, reenvio e alertas automáticos.
            </p>
          </div>

          <span>
            {smtpPassConfigured ? "Senha configurada" : "Senha não configurada"}
          </span>
        </div>

        <div className="smtp-grid">
          <label>
            Host SMTP
            <input
              value={smtpHost}
              onChange={(event) => setSmtpHost(event.target.value)}
              placeholder="smtp.gmail.com"
            />
          </label>

          <label>
            Porta
            <input
              value={smtpPort}
              onChange={(event) => setSmtpPort(event.target.value)}
              placeholder="587"
            />
          </label>

          <label>
            Usuário SMTP
            <input
              value={smtpUser}
              onChange={(event) => setSmtpUser(event.target.value)}
              placeholder="amazonika@amazonikaengenharia.com.br"
            />
          </label>

          <label>
            Senha SMTP / senha de app
            <input
              type="password"
              value={smtpPass}
              onChange={(event) => setSmtpPass(event.target.value)}
              placeholder={
                smtpPassConfigured
                  ? "Deixe em branco para manter a senha atual"
                  : "Informe a senha de app"
              }
            />
          </label>

          <label className="span-2">
            Remetente
            <input
              value={smtpFrom}
              onChange={(event) => setSmtpFrom(event.target.value)}
              placeholder="SIS Amazonika <amazonika@amazonikaengenharia.com.br>"
            />
          </label>

          <label className="span-2">
            E-mail da empresa para alertas
            <input
              value={companyAlertEmail}
              onChange={(event) => setCompanyAlertEmail(event.target.value)}
              placeholder="amazonika@amazonikaengenharia.com.br"
            />
          </label>

          <label className="checkbox-line span-2">
            <input
              type="checkbox"
              checked={smtpSecure}
              onChange={(event) => setSmtpSecure(event.target.checked)}
            />
            Usar conexão segura SSL/TLS direta
          </label>
        </div>

        <div className="smtp-help-box">
          <strong>Configuração recomendada para Gmail nesta fase de teste</strong>
          <p>
            Use host <b>smtp.gmail.com</b>, porta <b>587</b>, segurança direta
            desmarcada e uma <b>senha de app do Gmail</b>. A senha normal da
            conta geralmente não é aceita pelo Gmail.
          </p>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="button primary"
            onClick={handleSaveSmtp}
            disabled={saving}
          >
            {saving ? "Salvando..." : "Salvar SMTP"}
          </button>
        </div>
      </article>

      <article className="panel settings-wide-panel">
        <div className="panel-header">
          <div>
            <h2>Teste de envio</h2>
            <p>
              Envie um e-mail de teste para validar usuário, senha, porta,
              remetente e conexão SMTP.
            </p>
          </div>
        </div>

        <div className="smtp-test-row">
          <label>
            E-mail para teste
            <input
              value={testEmail}
              onChange={(event) => setTestEmail(event.target.value)}
              placeholder="amazonika@amazonikaengenharia.com.br"
            />
          </label>

          <button
            type="button"
            className="button primary"
            onClick={handleTestSmtp}
            disabled={saving}
          >
            {saving ? "Enviando..." : "Enviar teste"}
          </button>
        </div>
      </article>

      <article className="panel settings-wide-panel smtp-flow-card">
        <h2>Destinatários dos agendamentos</h2>
        <p>
          Após o cadastro de protocolo e agendamento, o SIS Amazonika enviará
          automaticamente o e-mail para:
        </p>

        <div className="smtp-recipient-grid">
          <div>
            <strong>E-mail da empresa</strong>
            <span>{companyAlertEmail || "-"}</span>
          </div>

          <div>
            <strong>Gestor da reunião</strong>
            <span>E-mail cadastrado no perfil do gestor.</span>
          </div>

          <div>
            <strong>Cliente</strong>
            <span>E-mail informado no cadastro do protocolo.</span>
          </div>
        </div>
      </article>
    </div>
  );
}

function CompanySettingsPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [companyName, setCompanyName] = useState("");
  const [companyLegalName, setCompanyLegalName] = useState("");
  const [companyCnpj, setCompanyCnpj] = useState("");
  const [companyEmail, setCompanyEmail] = useState("");
  const [companyPhone, setCompanyPhone] = useState("");
  const [companyWhatsapp, setCompanyWhatsapp] = useState("");
  const [companyWebsite, setCompanyWebsite] = useState("");
  const [companyAddress, setCompanyAddress] = useState("");
  const [companyCity, setCompanyCity] = useState("");
  const [companyState, setCompanyState] = useState("");
  const [companyZipCode, setCompanyZipCode] = useState("");
  const [companyFooterText, setCompanyFooterText] = useState("");

  async function loadCompanySettings() {
    try {
      setLoading(true);
      setError("");

      const data = (await api.companySettings()) as BackendCompanySettings;

      setCompanyName(data.companyName || "");
      setCompanyLegalName(data.companyLegalName || "");
      setCompanyCnpj(data.companyCnpj || "");
      setCompanyEmail(data.companyEmail || "");
      setCompanyPhone(data.companyPhone || "");
      setCompanyWhatsapp(data.companyWhatsapp || "");
      setCompanyWebsite(data.companyWebsite || "");
      setCompanyAddress(data.companyAddress || "");
      setCompanyCity(data.companyCity || "");
      setCompanyState(data.companyState || "");
      setCompanyZipCode(data.companyZipCode || "");
      setCompanyFooterText(data.companyFooterText || "");
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar dados da empresa."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCompanySettings();
  }, []);

  async function handleSaveCompanySettings() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!companyName.trim()) {
        throw new Error("Informe o nome fantasia da empresa.");
      }

      if (!companyLegalName.trim()) {
        throw new Error("Informe a razão social ou nome institucional.");
      }

      const response = (await api.updateCompanySettings({
        companyName,
        companyLegalName,
        companyCnpj,
        companyEmail,
        companyPhone,
        companyWhatsapp,
        companyWebsite,
        companyAddress,
        companyCity,
        companyState,
        companyZipCode,
        companyFooterText,
      })) as {
        message?: string;
        settings?: BackendCompanySettings;
      };

      setSuccess(response.message || "Dados da empresa salvos com sucesso.");

      if (response.settings) {
        setCompanyName(response.settings.companyName || "");
        setCompanyLegalName(response.settings.companyLegalName || "");
        setCompanyCnpj(response.settings.companyCnpj || "");
        setCompanyEmail(response.settings.companyEmail || "");
        setCompanyPhone(response.settings.companyPhone || "");
        setCompanyWhatsapp(response.settings.companyWhatsapp || "");
        setCompanyWebsite(response.settings.companyWebsite || "");
        setCompanyAddress(response.settings.companyAddress || "");
        setCompanyCity(response.settings.companyCity || "");
        setCompanyState(response.settings.companyState || "");
        setCompanyZipCode(response.settings.companyZipCode || "");
        setCompanyFooterText(response.settings.companyFooterText || "");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao salvar dados da empresa."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <article className="panel settings-panel-wide">
        <p>Carregando dados da empresa...</p>
      </article>
    );
  }

  return (
    <article className="panel settings-panel-wide">
      <div className="panel-header">
        <div>
          <h2>Dados da empresa</h2>
          <p>
            Configure as informações institucionais usadas nos e-mails, PDFs,
            protocolos e documentos gerados pelo sistema.
          </p>
        </div>
      </div>

      {error && <div className="error-panel settings-message">{error}</div>}
      {success && (
        <div className="success-panel settings-message">{success}</div>
      )}

      <div className="company-settings-grid">
        <div className="form-section flat">
          <h3>Identificação institucional</h3>

          <label>
            Nome fantasia
            <input
              value={companyName}
              onChange={(event) => setCompanyName(event.target.value)}
              placeholder="AMAZONIKA"
            />
          </label>

          <label>
            Razão social / nome institucional
            <input
              value={companyLegalName}
              onChange={(event) => setCompanyLegalName(event.target.value)}
              placeholder="AMAZONIKA Engenharia & Meio Ambiente"
            />
          </label>

          <label>
            CNPJ
            <input
              value={companyCnpj}
              onChange={(event) => setCompanyCnpj(event.target.value)}
              placeholder="49.158.834/0001-19"
            />
          </label>

          <label>
            Texto institucional do rodapé
            <textarea
              value={companyFooterText}
              onChange={(event) => setCompanyFooterText(event.target.value)}
              rows={4}
              placeholder="Compromisso com soluções sustentáveis e responsabilidade ambiental."
            />
          </label>
        </div>

        <div className="form-section flat">
          <h3>Contato</h3>

          <label>
            E-mail institucional
            <input
              value={companyEmail}
              onChange={(event) => setCompanyEmail(event.target.value)}
              placeholder="contato@amazonika.com.br"
            />
          </label>

          <div className="form-row">
            <label>
              Telefone
              <input
                value={companyPhone}
                onChange={(event) => setCompanyPhone(event.target.value)}
                placeholder="+55 (96) 0000-0000"
              />
            </label>

            <label>
              WhatsApp
              <input
                value={companyWhatsapp}
                onChange={(event) => setCompanyWhatsapp(event.target.value)}
                placeholder="+55 (96) 99999-9999"
              />
            </label>
          </div>

          <label>
            Site
            <input
              value={companyWebsite}
              onChange={(event) => setCompanyWebsite(event.target.value)}
              placeholder="https://www.amazonika.com.br"
            />
          </label>
        </div>

        <div className="form-section flat company-address-section">
          <h3>Endereço</h3>

          <label>
            Logradouro
            <input
              value={companyAddress}
              onChange={(event) => setCompanyAddress(event.target.value)}
              placeholder="Av. Almirante Barroso, 620-B, Centro"
            />
          </label>

          <div className="form-row">
            <label>
              Município
              <input
                value={companyCity}
                onChange={(event) => setCompanyCity(event.target.value)}
                placeholder="Macapá"
              />
            </label>

            <label>
              UF
              <input
                value={companyState}
                onChange={(event) => setCompanyState(event.target.value)}
                placeholder="AP"
                maxLength={2}
              />
            </label>

            <label>
              CEP
              <input
                value={companyZipCode}
                onChange={(event) => setCompanyZipCode(event.target.value)}
                placeholder="68901-336"
              />
            </label>
          </div>
        </div>

        <div className="company-preview-card">
          <span className="eyebrow">Pré-visualização</span>

          <div className="company-preview-brand">
            <img
              src="/brand/logo-amazonika.png"
              alt="AMAZONIKA"
              onError={(event) => {
                event.currentTarget.style.display = "none";
              }}
            />

            <div>
              <strong>{companyName || "AMAZONIKA"}</strong>
              <small>{companyLegalName || "Engenharia & Meio Ambiente"}</small>
            </div>
          </div>

          <div className="company-preview-lines">
            <p>
              <strong>CNPJ:</strong> {companyCnpj || "-"}
            </p>
            <p>
              <strong>E-mail:</strong> {companyEmail || "-"}
            </p>
            <p>
              <strong>Telefone:</strong> {companyPhone || "-"}
            </p>
            <p>
              <strong>WhatsApp:</strong> {companyWhatsapp || "-"}
            </p>
            <p>
              <strong>Site:</strong> {companyWebsite || "-"}
            </p>
            <p>
              <strong>Endereço:</strong>{" "}
              {[companyAddress, companyCity, companyState, companyZipCode]
                .filter(Boolean)
                .join(" - ") || "-"}
            </p>
          </div>

          <div className="company-preview-footer">
            {companyFooterText ||
              "Compromisso com soluções sustentáveis e responsabilidade ambiental."}
          </div>
        </div>
      </div>

      <div className="form-actions">
        <button
          className="button primary"
          onClick={handleSaveCompanySettings}
          disabled={saving}
        >
          {saving ? "Salvando dados..." : "Salvar dados da empresa"}
        </button>
      </div>
    </article>
  );
}

function AuditLogsPanel() {
  const [logs, setLogs] = useState<BackendAuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadLogs() {
      try {
        setLoading(true);
        setError("");

        const data = (await api.auditLogs()) as BackendAuditLog[];
        setLogs(data);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Erro ao carregar logs."
        );
      } finally {
        setLoading(false);
      }
    }

    loadLogs();
  }, []);

  return (
    <article className="panel settings-wide-panel">
      <div className="panel-header">
        <div>
          <h2>Logs e auditoria</h2>
          <p>Registro das ações administrativas realizadas no sistema.</p>
        </div>

        <span>Últimos 200 registros</span>
      </div>

      {loading && <p>Carregando logs...</p>}
      {error && <div className="error-panel settings-message">{error}</div>}

      {!loading && !error && (
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Data/Hora</th>
                <th>Usuário</th>
                <th>Ação</th>
                <th>Entidade</th>
                <th>Descrição</th>
              </tr>
            </thead>

            <tbody>
              {logs.map((log) => (
                <tr key={log.id}>
                  <td>{formatDateTime(log.createdAt)}</td>

                  <td>
                    {log.userName || "-"}
                    <small className="table-small">{log.userEmail}</small>
                  </td>

                  <td>{log.action}</td>

                  <td>
                    {log.entity || "-"}
                    {log.entityId && (
                      <small className="table-small">ID: {log.entityId}</small>
                    )}
                  </td>

                  <td>{log.description || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {logs.length === 0 && <p>Nenhum log registrado.</p>}
        </div>
      )}
    </article>
  );
}

function ClientLayout() {
  const navigate = useNavigate();

function logout() {
  clearAuth();
  navigate("/login");
}

  return (
    <div className="client-shell">
      <header className="client-header">
        <Link to="/" className="brand">
          <img
            src="/brand/logo-amazonika.png"
            alt="AMAZONIKA"
            onError={(event) => {
              event.currentTarget.style.display = "none";
            }}
          />
          <div>
            <strong>AMAZONIKA</strong>
            <span>Área do Cliente</span>
          </div>
        </Link>

        <button className="logout-button compact" onClick={logout}>
          <LogOut size={18} />
          Sair
        </button>
      </header>

      <Outlet />
    </div>
  );
}

function ClientDashboard() {
  const protocol = protocols[0];

  const timeline = [
    "Protocolo aberto",
    "Reunião realizada",
    "Contrato assinado",
    "Serviço em execução",
    "Produto final em elaboração",
  ];

  return (
    <main className="client-page">
      <section className="client-hero">
        <div>
          <span className="eyebrow">Acompanhamento do serviço</span>
          <h1>{protocol.number}</h1>
          <p>
            Aqui o cliente acompanha o status do serviço, documentos, prazos e
            movimentações liberadas pela empresa.
          </p>
        </div>

        <span className={`badge ${protocol.status.toLowerCase()}`}>
          {statusLabel(protocol.status)}
        </span>
      </section>

      <div className="client-grid">
        <article className="panel">
          <div className="panel-header">
            <h2>Resumo do protocolo</h2>
          </div>

          <div className="detail-list">
            <div>
              <span>Cliente</span>
              <strong>{protocol.client}</strong>
            </div>
            <div>
              <span>Serviço</span>
              <strong>{protocol.service}</strong>
            </div>
            <div>
              <span>Agendamento</span>
              <strong>{protocol.appointment}</strong>
            </div>
            <div>
              <span>Prazo previsto</span>
              <strong>{protocol.deadline}</strong>
            </div>
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Linha do tempo</h2>
          </div>

          <div className="timeline">
            {timeline.map((item, index) => (
              <div key={item} className={index <= 3 ? "done" : ""}>
                <span />
                <p>{item}</p>
              </div>
            ))}
          </div>
        </article>

        <article className="panel">
          <div className="panel-header">
            <h2>Documentos</h2>
          </div>

          <div className="document-list">
            <div>
              <FileText size={20} />
              <span>Contrato assinado</span>
              <b>Recebido</b>
            </div>
            <div>
              <FileText size={20} />
              <span>Matrícula do imóvel</span>
              <b>Pendente</b>
            </div>
            <div>
              <FileText size={20} />
              <span>Comprovante de pagamento</span>
              <b>Recebido</b>
            </div>
          </div>
        </article>
      </div>
    </main>
  );
}

function App() {
  const internalRoles: Role[] = ["ATENDENTE", "GERENTE", "PROGRAMADOR"];

  return (
    <Routes>
      <Route path="/" element={<PublicHome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/proposta/:token" element={<PublicProposalPage />} />
      <Route path="/contrato/:token" element={<PublicContractPage />} />
      <Route path="/cobranca/:id" element={<PublicBillingChargePage />} />

      <Route
        path="/app"
        element={
          <ProtectedRoute allowed={internalRoles}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/app/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="agendamentos" element={<SchedulePage />} />

        <Route
          path="financeiro"
          element={
            <ProtectedRoute allowed={["GERENTE", "PROGRAMADOR"]}>
              <FinancePage />
            </ProtectedRoute>
          }
        />

        <Route
          path="pro-labore"
          element={
            <ProtectedRoute allowed={["GERENTE", "PROGRAMADOR"]}>
              <ProLaboreAdvancesPage />
            </ProtectedRoute>
          }
        />

        <Route path="protocolos" element={<ProtocolsPage />} />

        <Route
          path="protocolos/:id"
          element={
            <ProtectedRoute allowed={["ATENDENTE", "GERENTE", "PROGRAMADOR"]}>
              <ProtocolDetailsPage />
            </ProtectedRoute>
          }
        />

        <Route
          path="configuracoes"
          element={
            <ProtectedRoute allowed={["PROGRAMADOR"]}>
              <SettingsPage />
            </ProtectedRoute>
          }
        />
      </Route>

      <Route
        path="/cliente"
        element={
          <ProtectedRoute allowed={["CLIENTE"]}>
            <ClientLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/cliente/dashboard" replace />} />
        <Route path="dashboard" element={<ClientDashboard />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;