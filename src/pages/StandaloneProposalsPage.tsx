import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  FilePlus2,
  FileText,
  Search,
  Send,
  BadgeCheck,
  Link2,
  XCircle,
} from "lucide-react";

import { api } from "../services/api";
import "./StandaloneProposalsPage.css";

type ProposalStatus =
  | "RASCUNHO"
  | "GERADA"
  | "ENVIADA"
  | "APROVADA_VERBALMENTE"
  | "AGUARDANDO_ASSINATURA"
  | "ASSINADA_ELETRONICAMENTE"
  | "PDF_ASSINADO_ANEXADO"
  | "RECUSADA"
  | "EXPIRADA"
  | "VINCULADA_PROTOCOLO"
  | "CANCELADA";

type StandaloneProposal = {
  id: number;
  proposalNumber: string;
  clientName: string;
  title: string;
  status: ProposalStatus;
  subtotalAmount: number;
  discountAmount: number;
  additionAmount: number;
  totalAmount: number;
  createdAt: string;
  sentAt?: string | null;

  _count?: {
    items: number;
    attachments: number;
    signatures: number;
  };
};

type Summary = {
  total: number;
  drafts: number;
  sent: number;
  waitingSignature: number;
  approved: number;
  linked: number;
};

type Client = {
  id: number;
  name: string;
  cpfCnpj?: string | null;
  email?: string | null;
  phone?: string | null;
  whatsapp?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
};

function moneyFromCents(value?: number | null) {
  return (Number(value || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR").format(
    new Date(value)
  );
}

function statusLabel(status: ProposalStatus) {
  const map: Record<ProposalStatus, string> = {
    RASCUNHO: "Rascunho",
    GERADA: "PDF gerado",
    ENVIADA: "Enviada",
    APROVADA_VERBALMENTE: "Aprovada verbalmente",
    AGUARDANDO_ASSINATURA: "Aguardando assinatura",
    ASSINADA_ELETRONICAMENTE: "Assinada eletronicamente",
    PDF_ASSINADO_ANEXADO: "PDF assinado anexado",
    RECUSADA: "Recusada",
    EXPIRADA: "Expirada",
    VINCULADA_PROTOCOLO: "Vinculada ao protocolo",
    CANCELADA: "Cancelada",
  };

  return map[status] || status;
}

function statusClass(status: ProposalStatus) {
  if (
    status === "APROVADA_VERBALMENTE" ||
    status === "ASSINADA_ELETRONICAMENTE" ||
    status === "PDF_ASSINADO_ANEXADO" ||
    status === "VINCULADA_PROTOCOLO"
  ) {
    return "success";
  }

  if (
    status === "RECUSADA" ||
    status === "CANCELADA" ||
    status === "EXPIRADA"
  ) {
    return "danger";
  }

  if (
    status === "ENVIADA" ||
    status === "AGUARDANDO_ASSINATURA"
  ) {
    return "warning";
  }

  return "neutral";
}

export default function StandaloneProposalsPage() {
  const navigate = useNavigate();
  const [items, setItems] = useState<StandaloneProposal[]>([]);
  const [summary, setSummary] = useState<Summary>({
    total: 0,
    drafts: 0,
    sent: 0,
    waitingSignature: 0,
    approved: 0,
    linked: 0,
  });

  const [clients, setClients] = useState<Client[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [showForm, setShowForm] = useState(false);

  const [clientId, setClientId] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientPhone, setClientPhone] = useState("");
  const [clientWhatsapp, setClientWhatsapp] = useState("");
  const [clientCity, setClientCity] = useState("");
  const [clientState, setClientState] = useState("");

  const [title, setTitle] = useState("");
  const [objectText, setObjectText] = useState("");

  async function loadData() {
    try {
      setLoading(true);
      setError("");

      const [listData, summaryData, clientData] =
        await Promise.all([
          api.standaloneProposals({
            search,
            status,
          }) as Promise<StandaloneProposal[]>,

          api.standaloneProposalSummary() as Promise<Summary>,

          api.clients() as Promise<Client[]>,
        ]);

      setItems(listData || []);
      setSummary(summaryData);
      setClients(clientData || []);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar propostas avulsas."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  function selectClient(value: string) {
    setClientId(value);

    const client = clients.find(
      (item) => item.id === Number(value)
    );

    if (!client) {
      return;
    }

    setClientName(client.name || "");
    setClientEmail(client.email || "");
    setClientPhone(client.phone || "");
    setClientWhatsapp(client.whatsapp || "");
    setClientCity(client.city || "");
    setClientState(client.state || "");
  }

  function resetForm() {
    setClientId("");
    setClientName("");
    setClientEmail("");
    setClientPhone("");
    setClientWhatsapp("");
    setClientCity("");
    setClientState("");
    setTitle("");
    setObjectText("");
  }

  async function createProposal() {
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      if (!clientName.trim()) {
        throw new Error("Informe o cliente.");
      }

      if (!title.trim()) {
        throw new Error(
          "Informe o objeto resumido da proposta."
        );
      }

      const created = (await api.createStandaloneProposal({
        clientId:
          clientId
            ? Number(clientId)
            : null,

        clientName:
          clientName.trim(),

        clientEmail:
          clientEmail.trim() || null,

        clientPhone:
          clientPhone.trim() || null,

        clientWhatsapp:
          clientWhatsapp.trim() || null,

        clientCity:
          clientCity.trim() || null,

        clientState:
          clientState.trim() || null,

        title:
          title.trim(),

        objectText:
          objectText.trim() || null,
      })) as StandaloneProposal;

      resetForm();
      setShowForm(false);

      navigate(
        `/app/propostas-avulsas/${created.id}`
      );
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao criar proposta."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="standalone-page">
      <header className="standalone-header">
        <div>
          <span className="eyebrow">COMERCIAL</span>

          <h1>Propostas Avulsas</h1>

          <p>
            Gere orçamentos sem protocolo prévio e,
            posteriormente, vincule a proposta aprovada ao
            fluxo formal.
          </p>
        </div>

        <button
          className="button primary"
          type="button"
          onClick={() =>
            setShowForm(true)
          }
        >
          <FilePlus2 size={18} />
          Nova proposta
        </button>
      </header>

      {error && (
        <div className="panel error-panel">
          {error}
        </div>
      )}

      {success && (
        <div className="panel success-panel">
          {success}
        </div>
      )}

      <div className="standalone-kpis">
        <article>
          <FileText size={19} />
          <span>Total</span>
          <strong>{summary.total}</strong>
        </article>

        <article>
          <FilePlus2 size={19} />
          <span>Rascunhos</span>
          <strong>{summary.drafts}</strong>
        </article>

        <article>
          <Send size={19} />
          <span>Enviadas</span>
          <strong>{summary.sent}</strong>
        </article>

        <article>
          <BadgeCheck size={19} />
          <span>Aprovadas</span>
          <strong>{summary.approved}</strong>
        </article>

        <article>
          <Link2 size={19} />
          <span>Vinculadas</span>
          <strong>{summary.linked}</strong>
        </article>
      </div>

      <article className="panel standalone-filters">
        <div className="standalone-search">
          <Search size={17} />

          <input
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Buscar por número, cliente ou objeto..."
          />
        </div>

        <select
          value={status}
          onChange={(event) =>
            setStatus(event.target.value)
          }
        >
          <option value="">
            Todos os status
          </option>

          <option value="RASCUNHO">
            Rascunho
          </option>

          <option value="GERADA">
            PDF gerado
          </option>

          <option value="ENVIADA">
            Enviada
          </option>

          <option value="APROVADA_VERBALMENTE">
            Aprovada verbalmente
          </option>

          <option value="AGUARDANDO_ASSINATURA">
            Aguardando assinatura
          </option>

          <option value="VINCULADA_PROTOCOLO">
            Vinculada ao protocolo
          </option>

          <option value="CANCELADA">
            Cancelada
          </option>
        </select>

        <button
          type="button"
          className="button secondary"
          onClick={loadData}
        >
          Atualizar
        </button>
      </article>

      <article className="panel standalone-list">
        <div className="standalone-list-heading">
          <div>
            <h2>Propostas comerciais</h2>
            <p>
              {items.length} proposta(s)
              encontrada(s).
            </p>
          </div>
        </div>

        {loading ? (
          <p>Carregando...</p>
        ) : items.length === 0 ? (
          <div className="standalone-empty">
            <FileText size={34} />

            <h3>
              Nenhuma proposta avulsa cadastrada
            </h3>

            <p>
              Crie a primeira proposta para começar.
            </p>

            <button
              className="button primary"
              type="button"
              onClick={() =>
                setShowForm(true)
              }
            >
              Nova proposta
            </button>
          </div>
        ) : (
          <div className="standalone-table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Proposta</th>
                  <th>Cliente</th>
                  <th>Objeto</th>
                  <th>Itens</th>
                  <th>Total</th>
                  <th>Status</th>
                  <th>Data</th>
                  <th>Ações</th>
                </tr>
              </thead>

              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <strong>
                        {item.proposalNumber}
                      </strong>
                    </td>

                    <td>
                      {item.clientName}
                    </td>

                    <td>
                      {item.title}
                    </td>

                    <td>
                      {item._count?.items || 0}
                    </td>

                    <td>
                      <strong>
                        {moneyFromCents(
                          item.totalAmount
                        )}
                      </strong>
                    </td>

                    <td>
                      <span
                        className={`standalone-status ${statusClass(
                          item.status
                        )}`}
                      >
                        {statusLabel(
                          item.status
                        )}
                      </span>
                    </td>

                    <td>
                      {formatDate(
                        item.createdAt
                      )}
                    </td>

                    <td>
                      <Link
                        className="button ghost"
                        to={`/app/propostas-avulsas/${item.id}`}
                      >
                        Abrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </article>

      {showForm && (
        <div className="standalone-modal-backdrop">
          <section className="standalone-modal">
            <header>
              <div>
                <span className="eyebrow">
                  COMERCIAL
                </span>

                <h2>Nova proposta avulsa</h2>

                <p>
                  Cadastre os dados básicos. Os serviços
                  serão adicionados na próxima etapa.
                </p>
              </div>

              <button
                type="button"
                className="standalone-close"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                <XCircle size={22} />
              </button>
            </header>

            <div className="standalone-form">
              <label className="full">
                Cliente cadastrado

                <select
                  value={clientId}
                  onChange={(event) =>
                    selectClient(
                      event.target.value
                    )
                  }
                >
                  <option value="">
                    Cliente não cadastrado / preencher manualmente
                  </option>

                  {clients.map((client) => (
                    <option
                      key={client.id}
                      value={client.id}
                    >
                      {client.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Nome / Razão Social *

                <input
                  value={clientName}
                  onChange={(event) =>
                    setClientName(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                E-mail

                <input
                  value={clientEmail}
                  onChange={(event) =>
                    setClientEmail(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Telefone

                <input
                  value={clientPhone}
                  onChange={(event) =>
                    setClientPhone(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                WhatsApp

                <input
                  value={clientWhatsapp}
                  onChange={(event) =>
                    setClientWhatsapp(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                Município

                <input
                  value={clientCity}
                  onChange={(event) =>
                    setClientCity(
                      event.target.value
                    )
                  }
                />
              </label>

              <label>
                UF

                <input
                  maxLength={2}
                  value={clientState}
                  onChange={(event) =>
                    setClientState(
                      event.target.value.toUpperCase()
                    )
                  }
                />
              </label>

              <label className="full">
                Objeto resumido *

                <input
                  value={title}
                  onChange={(event) =>
                    setTitle(
                      event.target.value
                    )
                  }
                  placeholder="Ex.: Licenciamento Ambiental para Comércio Varejista de Combustíveis"
                />
              </label>

              <label className="full">
                Texto do objeto

                <textarea
                  value={objectText}
                  onChange={(event) =>
                    setObjectText(
                      event.target.value
                    )
                  }
                  rows={5}
                  placeholder="Prestação de serviços técnicos para..."
                />
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="button secondary"
                onClick={() => {
                  resetForm();
                  setShowForm(false);
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={saving}
                onClick={createProposal}
              >
                {saving
                  ? "Salvando..."
                  : "Criar proposta"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
