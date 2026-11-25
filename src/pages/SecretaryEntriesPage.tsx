import { CheckCircle2, FileText, Receipt, RefreshCw, Search, Wallet, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { formatMoneyCents, reaisFormValueToCents } from "../lib/money";
import { api } from "../services/api";
import "./SecretaryEntriesPage.css";

/*
 * Tela de lançamentos do perfil Secretária.
 * Mostra só o que ela precisa para lançar e os lançamentos
 * que ela mesma fez. Nenhum total, saldo ou lucro aparece aqui.
 */

type ClientOption = {
  id: number;
  name: string;
  cpfCnpj?: string | null;
  city?: string | null;
  state?: string | null;
};

type ScheduleItem = {
  id: number;
  type: "ENTRADA" | "PARCELA";
  installmentNumber: number;
  totalInstallments: number | null;
  amountCents: number;
  dueDate: string;
  label: string;
  state: "DISPONIVEL" | "LANCADA" | "COBRANCA";
  transactionStatus?: string;
  chargeStatus?: string;
};

type ProposalOption = {
  id: number;
  proposalNumber: string;
  title: string;
  status: string;
  acceptedAt?: string | null;
  totalAmountCents: number;
  protocol?: { id: number; protocolNumber: string } | null;
  schedule: ScheduleItem[];
};

type Category = { id: number; name: string; type: "RECEITA" | "DESPESA" };

type Entry = {
  id: number;
  type: "ENTRADA" | "PARCELA" | "SAIDA";
  status: "PENDENTE" | "PAGO" | "CANCELADO";
  description: string;
  amountCents: number;
  dueDate?: string | null;
  paidAt?: string | null;
  createdAt: string;
  client?: { id: number; name: string } | null;
  clientName?: string | null;
  proposal?: { id: number; proposalNumber: string; title: string } | null;
  category?: { id: number; name: string } | null;
  linkedToBillingCharge: boolean;
};

type Mode = "RECEITA" | "DESPESA";

function todayInput() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function dateBR(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR", { timeZone: "UTC" });
}

// Data escolhida no formulário (AAAA-MM-DD) gravada ao meio-dia UTC,
// para não "voltar um dia" no fuso do Brasil.
function inputDateToIso(value: string) {
  return value ? `${value}T12:00:00.000Z` : null;
}

const statusLabels: Record<Entry["status"], string> = {
  PENDENTE: "Pendente",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

const typeLabels: Record<Entry["type"], string> = {
  ENTRADA: "Receita (entrada)",
  PARCELA: "Receita (parcela)",
  SAIDA: "Despesa",
};

function ClientPicker({
  value,
  onChange,
  optional = false,
}: {
  value: ClientOption | null;
  onChange: (client: ClientOption | null) => void;
  optional?: boolean;
}) {
  const [query, setQuery] = useState("");
  const [options, setOptions] = useState<ClientOption[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (value || query.trim().length < 2) {
      setOptions([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setLoading(true);
        setOptions((await api.secretaryClients(query.trim())) as ClientOption[]);
      } catch {
        setOptions([]);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => window.clearTimeout(handle);
  }, [query, value]);

  if (value) {
    return (
      <div className="sec-selected-client">
        <div>
          <strong>{value.name}</strong>
          <span>
            {[value.cpfCnpj, [value.city, value.state].filter(Boolean).join("/")]
              .filter(Boolean)
              .join(" · ") || "Cliente cadastrado"}
          </span>
        </div>
        <button type="button" className="sec-icon-button" onClick={() => onChange(null)} title="Trocar cliente">
          <X size={16} />
        </button>
      </div>
    );
  }

  return (
    <div className="sec-client-search">
      <label>
        Cliente{optional ? " (opcional)" : ""}
        <div className="sec-search-input">
          <Search size={16} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Digite o nome ou CPF/CNPJ (mín. 2 letras)"
          />
        </div>
      </label>

      {loading && <p className="sec-muted">Buscando…</p>}

      {!loading && query.trim().length >= 2 && options.length === 0 && (
        <p className="sec-muted">Nenhum cliente cadastrado com esse nome. Peça a um gestor para cadastrar.</p>
      )}

      {options.length > 0 && (
        <ul className="sec-client-options">
          {options.map((client) => (
            <li key={client.id}>
              <button
                type="button"
                onClick={() => {
                  onChange(client);
                  setQuery("");
                }}
              >
                <strong>{client.name}</strong>
                <span>{client.cpfCnpj || ""}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function SecretaryEntriesPage() {
  const [mode, setMode] = useState<Mode>("RECEITA");
  const [entries, setEntries] = useState<Entry[]>([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Receita
  const [client, setClient] = useState<ClientOption | null>(null);
  const [proposals, setProposals] = useState<ProposalOption[]>([]);
  const [proposalsLoading, setProposalsLoading] = useState(false);
  const [proposalId, setProposalId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [incomeStatus, setIncomeStatus] = useState<"PENDENTE" | "PAGO">("PENDENTE");
  const [incomePaidAt, setIncomePaidAt] = useState(todayInput());
  const [incomeNotes, setIncomeNotes] = useState("");

  // Despesa
  const [expenseCategoryId, setExpenseCategoryId] = useState("");
  const [expenseDescription, setExpenseDescription] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDueDate, setExpenseDueDate] = useState(todayInput());
  const [expenseStatus, setExpenseStatus] = useState<"PENDENTE" | "PAGO">("PENDENTE");
  const [expensePaidAt, setExpensePaidAt] = useState(todayInput());
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseClient, setExpenseClient] = useState<ClientOption | null>(null);

  const selectedProposal = useMemo(
    () => proposals.find((proposal) => proposal.id === proposalId) || null,
    [proposals, proposalId]
  );

  const selectedTotalCents = useMemo(
    () =>
      (selectedProposal?.schedule || [])
        .filter((item) => selectedItems.includes(item.id))
        .reduce((sum, item) => sum + item.amountCents, 0),
    [selectedProposal, selectedItems]
  );

  async function loadEntries() {
    try {
      setEntriesLoading(true);
      setEntries((await api.secretaryEntries()) as Entry[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar seus lançamentos.");
    } finally {
      setEntriesLoading(false);
    }
  }

  async function loadProposals(clientId: number) {
    try {
      setProposalsLoading(true);
      const data = (await api.secretaryClientProposals(clientId)) as ProposalOption[];
      setProposals(data);
      setProposalId(data.length === 1 ? data[0].id : null);
      setSelectedItems([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar propostas.");
    } finally {
      setProposalsLoading(false);
    }
  }

  useEffect(() => {
    loadEntries();
    api
      .secretaryCategories("DESPESA")
      .then((data) => setCategories(data as Category[]))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    setProposals([]);
    setProposalId(null);
    setSelectedItems([]);
    if (client) loadProposals(client.id);
  }, [client]);

  function toggleItem(item: ScheduleItem) {
    if (item.state !== "DISPONIVEL") return;

    setSelectedItems((current) => {
      if (current.includes(item.id)) return current.filter((id) => id !== item.id);
      // Pagamento é registrado uma etapa por vez.
      if (incomeStatus === "PAGO") return [item.id];
      return [...current, item.id];
    });
  }

  function flash(text: string) {
    setMessage(text);
    setError("");
    window.setTimeout(() => setMessage(""), 6000);
  }

  async function submitIncome(event: React.FormEvent) {
    event.preventDefault();
    if (!selectedProposal || selectedItems.length === 0) return;

    try {
      setSaving(true);
      setError("");
      await api.secretaryCreateProposalEntry({
        proposalId: selectedProposal.id,
        scheduleItemIds: selectedItems,
        status: incomeStatus,
        paidAt: incomeStatus === "PAGO" ? inputDateToIso(incomePaidAt) : null,
        notes: incomeNotes.trim() || null,
      });
      flash(
        selectedItems.length === 1
          ? "Lançamento registrado."
          : `${selectedItems.length} lançamentos registrados.`
      );
      setIncomeNotes("");
      setSelectedItems([]);
      if (client) await loadProposals(client.id);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar o lançamento.");
    } finally {
      setSaving(false);
    }
  }

  async function submitExpense(event: React.FormEvent) {
    event.preventDefault();

    let amountCents = 0;

    try {
      const typed = expenseAmount.trim().replace(/^R\$\s*/, "");
      // "1.250,90" (padrão BR) ou "1250.90".
      const normalized = typed.includes(",") ? typed.replace(/\./g, "").replace(",", ".") : typed;
      amountCents = reaisFormValueToCents(normalized);
    } catch {
      setError("Valor inválido. Use, por exemplo, 1250,90.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await api.secretaryCreateExpense({
        categoryId: Number(expenseCategoryId),
        description: expenseDescription.trim(),
        amountCents,
        dueDate: inputDateToIso(expenseDueDate) || "",
        status: expenseStatus,
        paidAt: expenseStatus === "PAGO" ? inputDateToIso(expensePaidAt) : null,
        clientId: expenseClient?.id || null,
        notes: expenseNotes.trim() || null,
      });
      flash("Despesa registrada.");
      setExpenseDescription("");
      setExpenseAmount("");
      setExpenseNotes("");
      setExpenseClient(null);
      await loadEntries();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar a despesa.");
    } finally {
      setSaving(false);
    }
  }

  async function payEntry(entry: Entry) {
    const typed = window.prompt("Data do pagamento (DD/MM/AAAA):", new Date().toLocaleDateString("pt-BR"));
    if (typed === null) return;

    const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(typed.trim());
    if (!match) {
      setError("Data inválida. Use DD/MM/AAAA.");
      return;
    }

    try {
      await api.secretaryPayEntry(entry.id, `${match[3]}-${match[2]}-${match[1]}T12:00:00.000Z`);
      flash("Pagamento registrado.");
      await loadEntries();
      if (client) await loadProposals(client.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao registrar o pagamento.");
    }
  }

  async function cancelEntry(entry: Entry) {
    if (!window.confirm(`Cancelar o lançamento "${entry.description}"?`)) return;

    try {
      await api.secretaryCancelEntry(entry.id);
      flash("Lançamento cancelado.");
      await loadEntries();
      if (client) await loadProposals(client.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao cancelar o lançamento.");
    }
  }

  return (
    <section className="sec-page">
      <header className="sec-heading">
        <div>
          <span className="eyebrow">Financeiro</span>
          <h1>Lançamentos</h1>
          <p>
            Registre recebimentos das propostas aceitas pelos clientes e as despesas da empresa.
            Valores e vencimentos das receitas seguem o cronograma financeiro aprovado na proposta.
          </p>
        </div>
      </header>

      {message && (
        <div className="sec-alert success">
          <CheckCircle2 size={18} /> {message}
        </div>
      )}
      {error && (
        <div className="sec-alert error">
          <X size={18} /> {error}
        </div>
      )}

      <div className="sec-tabs" role="tablist">
        <button
          type="button"
          role="tab"
          aria-selected={mode === "RECEITA"}
          className={mode === "RECEITA" ? "active" : ""}
          onClick={() => setMode("RECEITA")}
        >
          <Receipt size={16} /> Receita de proposta
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === "DESPESA"}
          className={mode === "DESPESA" ? "active" : ""}
          onClick={() => setMode("DESPESA")}
        >
          <Wallet size={16} /> Despesa
        </button>
      </div>

      {mode === "RECEITA" && (
        <form className="sec-card" onSubmit={submitIncome}>
          <h2>1. Cliente</h2>
          <ClientPicker value={client} onChange={setClient} />

          {client && (
            <>
              <h2>2. Proposta aceita</h2>
              {proposalsLoading && <p className="sec-muted">Carregando propostas…</p>}
              {!proposalsLoading && proposals.length === 0 && (
                <p className="sec-muted">
                  Este cliente não tem proposta aceita com cronograma financeiro. Peça a um gestor para conferir a proposta.
                </p>
              )}
              {proposals.length > 0 && (
                <div className="sec-proposals">
                  {proposals.map((proposal) => (
                    <label
                      key={proposal.id}
                      className={`sec-proposal ${proposal.id === proposalId ? "selected" : ""}`}
                    >
                      <input
                        type="radio"
                        name="proposal"
                        checked={proposal.id === proposalId}
                        onChange={() => {
                          setProposalId(proposal.id);
                          setSelectedItems([]);
                        }}
                      />
                      <FileText size={18} />
                      <span>
                        <strong>{proposal.proposalNumber}</strong> · {proposal.title}
                        <small>
                          {proposal.protocol?.protocolNumber ? `Protocolo ${proposal.protocol.protocolNumber} · ` : ""}
                          {proposal.status === "CONVERTIDA_EM_CONTRATO" ? "Contrato gerado" : "Aceita"}
                          {proposal.acceptedAt ? ` em ${dateBR(proposal.acceptedAt)}` : ""}
                        </small>
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </>
          )}

          {selectedProposal && (
            <>
              <h2>3. Etapas do cronograma</h2>
              <div className="sec-table-wrap">
                <table className="sec-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Etapa</th>
                      <th>Vencimento</th>
                      <th className="num">Valor</th>
                      <th>Situação</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedProposal.schedule.map((item) => (
                      <tr
                        key={item.id}
                        className={item.state !== "DISPONIVEL" ? "disabled" : ""}
                        onClick={() => toggleItem(item)}
                      >
                        <td>
                          <input
                            type="checkbox"
                            disabled={item.state !== "DISPONIVEL"}
                            checked={selectedItems.includes(item.id)}
                            onChange={() => toggleItem(item)}
                            onClick={(event) => event.stopPropagation()}
                            aria-label={item.label}
                          />
                        </td>
                        <td>{item.label}</td>
                        <td>{dateBR(item.dueDate)}</td>
                        <td className="num">{formatMoneyCents(item.amountCents)}</td>
                        <td>
                          {item.state === "DISPONIVEL" && <span className="sec-badge">A lançar</span>}
                          {item.state === "LANCADA" && (
                            <span className="sec-badge done">
                              Lançada{item.transactionStatus === "PAGO" ? " · paga" : ""}
                            </span>
                          )}
                          {item.state === "COBRANCA" && <span className="sec-badge info">Cobrança emitida</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="sec-grid">
                <label>
                  Situação
                  <select
                    value={incomeStatus}
                    onChange={(event) => {
                      const value = event.target.value as "PENDENTE" | "PAGO";
                      setIncomeStatus(value);
                      if (value === "PAGO") setSelectedItems((current) => current.slice(0, 1));
                    }}
                  >
                    <option value="PENDENTE">A receber (pendente)</option>
                    <option value="PAGO">Já recebido</option>
                  </select>
                </label>

                {incomeStatus === "PAGO" && (
                  <label>
                    Data do recebimento
                    <input
                      type="date"
                      value={incomePaidAt}
                      onChange={(event) => setIncomePaidAt(event.target.value)}
                      required
                    />
                  </label>
                )}

                <label className="wide">
                  Observação (opcional)
                  <input
                    value={incomeNotes}
                    onChange={(event) => setIncomeNotes(event.target.value)}
                    placeholder="Ex.: comprovante enviado por WhatsApp"
                  />
                </label>
              </div>

              <div className="sec-actions">
                <span className="sec-muted">
                  {selectedItems.length === 0
                    ? "Selecione a etapa a lançar."
                    : `${selectedItems.length} etapa(s) · ${formatMoneyCents(selectedTotalCents)}`}
                </span>
                <button type="submit" className="button primary" disabled={saving || selectedItems.length === 0}>
                  {saving ? "Salvando…" : "Registrar lançamento"}
                </button>
              </div>
            </>
          )}
        </form>
      )}

      {mode === "DESPESA" && (
        <form className="sec-card" onSubmit={submitExpense}>
          <div className="sec-grid">
            <label>
              Categoria
              <select
                value={expenseCategoryId}
                onChange={(event) => setExpenseCategoryId(event.target.value)}
                required
              >
                <option value="">Selecione…</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Valor (R$)
              <input
                value={expenseAmount}
                onChange={(event) => setExpenseAmount(event.target.value)}
                placeholder="0,00"
                inputMode="decimal"
                required
              />
            </label>

            <label className="wide">
              Descrição
              <input
                value={expenseDescription}
                onChange={(event) => setExpenseDescription(event.target.value)}
                placeholder="Ex.: Conta de energia do escritório"
                required
              />
            </label>

            <label>
              Vencimento
              <input
                type="date"
                value={expenseDueDate}
                onChange={(event) => setExpenseDueDate(event.target.value)}
                required
              />
            </label>

            <label>
              Situação
              <select
                value={expenseStatus}
                onChange={(event) => setExpenseStatus(event.target.value as "PENDENTE" | "PAGO")}
              >
                <option value="PENDENTE">A pagar (pendente)</option>
                <option value="PAGO">Já pago</option>
              </select>
            </label>

            {expenseStatus === "PAGO" && (
              <label>
                Data do pagamento
                <input
                  type="date"
                  value={expensePaidAt}
                  onChange={(event) => setExpensePaidAt(event.target.value)}
                  required
                />
              </label>
            )}

            <div className="wide">
              <ClientPicker value={expenseClient} onChange={setExpenseClient} optional />
            </div>

            <label className="wide">
              Observação (opcional)
              <input value={expenseNotes} onChange={(event) => setExpenseNotes(event.target.value)} />
            </label>
          </div>

          {categories.length === 0 && (
            <p className="sec-muted">Nenhuma categoria de despesa ativa. Peça a um gestor para cadastrar.</p>
          )}

          <div className="sec-actions">
            <span />
            <button type="submit" className="button primary" disabled={saving}>
              {saving ? "Salvando…" : "Registrar despesa"}
            </button>
          </div>
        </form>
      )}

      <section className="sec-card">
        <div className="sec-card-heading">
          <h2>Meus lançamentos</h2>
          <button type="button" className="button secondary" onClick={loadEntries} disabled={entriesLoading}>
            <RefreshCw size={15} /> Atualizar
          </button>
        </div>

        {entriesLoading && <p className="sec-muted">Carregando…</p>}
        {!entriesLoading && entries.length === 0 && <p className="sec-muted">Você ainda não fez lançamentos.</p>}

        {entries.length > 0 && (
          <div className="sec-table-wrap">
            <table className="sec-table">
              <thead>
                <tr>
                  <th>Lançado em</th>
                  <th>Tipo</th>
                  <th>Descrição</th>
                  <th>Cliente</th>
                  <th>Vencimento</th>
                  <th className="num">Valor</th>
                  <th>Situação</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className={entry.status === "CANCELADO" ? "disabled" : ""}>
                    <td>{dateBR(entry.createdAt)}</td>
                    <td>{typeLabels[entry.type]}</td>
                    <td className="sec-desc">
                      {entry.description}
                      {entry.category ? <small className="sec-sub">{entry.category.name}</small> : null}
                    </td>
                    <td>{entry.client?.name || entry.clientName || "—"}</td>
                    <td>{dateBR(entry.dueDate)}</td>
                    <td className="num">{formatMoneyCents(entry.amountCents)}</td>
                    <td>
                      <span
                        className={`sec-badge ${
                          entry.status === "PAGO" ? "done" : entry.status === "CANCELADO" ? "muted" : ""
                        }`}
                      >
                        {statusLabels[entry.status]}
                        {entry.status === "PAGO" && entry.paidAt ? ` em ${dateBR(entry.paidAt)}` : ""}
                      </span>
                    </td>
                    <td className="sec-row-actions">
                      {entry.status === "PENDENTE" && !entry.linkedToBillingCharge && (
                        <>
                          <button type="button" className="sec-link" onClick={() => payEntry(entry)}>
                            Registrar pagamento
                          </button>
                          <button type="button" className="sec-link danger" onClick={() => cancelEntry(entry)}>
                            Cancelar
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </section>
  );
}
