import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Pencil,
  Play,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { api } from "../services/api";
import "./DemandsPage.css";

type DemandType = "TRABALHO" | "VIAGEM" | "PAGAMENTO" | "LEMBRETE" | "OUTRO";
type DemandStatus = "A_FAZER" | "EM_ANDAMENTO" | "CONCLUIDA" | "CANCELADA";
type DemandPriority = "BAIXA" | "NORMAL" | "ALTA" | "URGENTE";

type Person = {
  id: number;
  name: string;
  role: string;
  hasWhatsapp: boolean;
  whatsappMasked: string;
  whatsappPhone?: string;
  whatsappAlertsEnabled: boolean;
};

type Demand = {
  id: number;
  title: string;
  description: string | null;
  type: DemandType;
  status: DemandStatus;
  priority: DemandPriority;
  dueAt: string | null;
  remindBeforeMinutes: number;
  sortOrder: number;
  assigneeId: number | null;
  assignee: { id: number; name: string; role: string } | null;
  createdBy: { id: number; name: string } | null;
  completedAt: string | null;
  overdue: boolean;
};

const TYPE_LABEL: Record<DemandType, string> = {
  TRABALHO: "Trabalho",
  VIAGEM: "Viagem",
  PAGAMENTO: "Pagamento",
  LEMBRETE: "Lembrete",
  OUTRO: "Outro",
};

const STATUS_LABEL: Record<DemandStatus, string> = {
  A_FAZER: "A fazer",
  EM_ANDAMENTO: "Em andamento",
  CONCLUIDA: "Concluída",
  CANCELADA: "Cancelada",
};

const PRIORITY_LABEL: Record<DemandPriority, string> = {
  BAIXA: "Baixa",
  NORMAL: "Normal",
  ALTA: "Alta",
  URGENTE: "Urgente",
};

const REMIND_OPTIONS = [
  { value: 0, label: "Sem lembrete antes" },
  { value: 30, label: "30 minutos antes" },
  { value: 60, label: "1 hora antes" },
  { value: 120, label: "2 horas antes" },
  { value: 1440, label: "1 dia antes" },
  { value: 2880, label: "2 dias antes" },
  { value: 4320, label: "3 dias antes" },
];

const ROLE_LABEL: Record<string, string> = {
  GERENTE: "Gestor",
  PROGRAMADOR: "Programador",
  SECRETARIA: "Secretária",
};

type FormState = {
  id: number | null;
  title: string;
  description: string;
  type: DemandType;
  priority: DemandPriority;
  assigneeId: string;
  dueAt: string;
  remindBeforeMinutes: number;
};

function emptyForm(assigneeId = ""): FormState {
  return {
    id: null,
    title: "",
    description: "",
    type: "TRABALHO",
    priority: "NORMAL",
    assigneeId,
    dueAt: "",
    remindBeforeMinutes: 1440,
  };
}

/** ISO -> "2026-11-27T10:00" no horário de Macapá (UTC-3). */
function toLocalInput(iso: string | null) {
  if (!iso) return "";
  const date = new Date(new Date(iso).getTime() - 3 * 3600 * 1000);
  return date.toISOString().slice(0, 16);
}

function formatDue(iso: string) {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

function currentUserId() {
  try {
    return Number(JSON.parse(localStorage.getItem("amazonika_user") || "{}").id) || null;
  } catch {
    return null;
  }
}

export default function DemandsPage() {
  const role = localStorage.getItem("amazonika_role") || "";
  const isManager = role === "GERENTE" || role === "PROGRAMADOR";
  const myId = currentUserId();

  const [demands, setDemands] = useState<Demand[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [assigneeFilter, setAssigneeFilter] = useState("ALL");
  const [statusFilter, setStatusFilter] = useState("OPEN");
  const [typeFilter, setTypeFilter] = useState("");

  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [showWhatsapp, setShowWhatsapp] = useState(false);

  async function load() {
    try {
      setLoading(true);
      const [list, persons] = await Promise.all([
        api.demands({
          status: statusFilter,
          type: typeFilter,
          assigneeId: assigneeFilter === "ALL" ? "" : assigneeFilter,
        }),
        api.demandPeople(),
      ]);
      setDemands(list as Demand[]);
      setPeople(persons as Person[]);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível carregar as demandas.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assigneeFilter, statusFilter, typeFilter]);

  const columns = useMemo(() => {
    const groups = new Map<string, { key: string; title: string; subtitle: string; items: Demand[] }>();

    const ensure = (key: string, title: string, subtitle: string) => {
      if (!groups.has(key)) groups.set(key, { key, title, subtitle, items: [] });
      return groups.get(key)!;
    };

    if (assigneeFilter === "ALL") {
      people.forEach((person) =>
        ensure(String(person.id), person.name, ROLE_LABEL[person.role] || person.role)
      );
    }

    demands.forEach((demand) => {
      const group = demand.assignee
        ? ensure(String(demand.assignee.id), demand.assignee.name, ROLE_LABEL[demand.assignee.role] || "")
        : ensure("none", "Sem responsável", "Distribuir");
      group.items.push(demand);
    });

    return [...groups.values()].filter((group) => assigneeFilter !== "ALL" || group.items.length || group.key !== "none");
  }, [demands, people, assigneeFilter]);

  const kpis = useMemo(() => {
    const open = demands.filter((d) => d.status === "A_FAZER" || d.status === "EM_ANDAMENTO");
    const now = Date.now();
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);
    return {
      open: open.length,
      overdue: open.filter((d) => d.overdue).length,
      today: open.filter((d) => d.dueAt && new Date(d.dueAt).getTime() >= now && new Date(d.dueAt) <= endToday).length,
      doing: open.filter((d) => d.status === "EM_ANDAMENTO").length,
    };
  }, [demands]);

  function flash(message: string) {
    setSuccess(message);
    setError("");
    window.setTimeout(() => setSuccess(""), 4000);
  }

  async function submitForm(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;

    const payload = {
      title: form.title,
      description: form.description,
      type: form.type,
      priority: form.priority,
      assigneeId: form.assigneeId ? Number(form.assigneeId) : null,
      dueAt: form.dueAt || null,
      remindBeforeMinutes: form.remindBeforeMinutes,
    };

    try {
      setSaving(true);
      if (form.id) await api.updateDemand(form.id, payload);
      else await api.createDemand(payload);

      const assignee = people.find((p) => String(p.id) === form.assigneeId);
      const notifies = assignee && assignee.id !== myId;

      flash(
        form.id
          ? "Demanda atualizada."
          : notifies
            ? assignee!.hasWhatsapp
              ? `Demanda criada. ${assignee!.name.split(" ")[0]} será avisado(a) no WhatsApp.`
              : `Demanda criada. ${assignee!.name.split(" ")[0]} não tem WhatsApp cadastrado, então não recebe aviso.`
            : "Demanda criada."
      );
      setForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(demand: Demand, status: DemandStatus) {
    try {
      await api.updateDemand(demand.id, { status });
      flash(`"${demand.title}" agora está ${STATUS_LABEL[status].toLowerCase()}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível atualizar.");
    }
  }

  async function remove(demand: Demand) {
    if (!window.confirm(`Excluir a demanda "${demand.title}"?`)) return;
    try {
      await api.deleteDemand(demand.id);
      flash("Demanda excluída.");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível excluir.");
    }
  }

  async function move(items: Demand[], index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= items.length) return;
    const ids = items.map((d) => d.id);
    [ids[index], ids[target]] = [ids[target], ids[index]];
    try {
      await api.reorderDemands(ids);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível reordenar.");
    }
  }

  function edit(demand: Demand) {
    setForm({
      id: demand.id,
      title: demand.title,
      description: demand.description || "",
      type: demand.type,
      priority: demand.priority,
      assigneeId: demand.assigneeId ? String(demand.assigneeId) : "",
      dueAt: toLocalInput(demand.dueAt),
      remindBeforeMinutes: demand.remindBeforeMinutes,
    });
  }

  return (
    <div className="page demands-page">
      <header className="demands-header">
        <div>
          <span className="eyebrow">Agenda da equipe</span>
          <h1>Demandas</h1>
          <p>
            O que cada um faz, em que ordem e até quando. Os avisos saem pelo WhatsApp: ao receber
            uma demanda, antes do prazo, quando atrasa e num resumo diário às 7h.
          </p>
        </div>
        <div className="demands-header-actions">
          <button className="button secondary" type="button" onClick={() => setShowWhatsapp(true)}>
            <MessageCircle size={16} /> WhatsApp
          </button>
          <button
            className="button primary"
            type="button"
            onClick={() => setForm(emptyForm(assigneeFilter.match(/^\d+$/) ? assigneeFilter : ""))}
          >
            <Plus size={16} /> Nova demanda
          </button>
        </div>
      </header>

      {error && (
        <div className="demands-message error">
          <AlertTriangle size={16} /> {error}
        </div>
      )}
      {success && (
        <div className="demands-message success">
          <CheckCircle2 size={16} /> {success}
        </div>
      )}

      <section className="demands-kpis">
        <article>
          <span>Abertas</span>
          <strong>{kpis.open}</strong>
        </article>
        <article className={kpis.overdue ? "alert" : ""}>
          <span>Atrasadas</span>
          <strong>{kpis.overdue}</strong>
        </article>
        <article>
          <span>Vencem hoje</span>
          <strong>{kpis.today}</strong>
        </article>
        <article>
          <span>Em andamento</span>
          <strong>{kpis.doing}</strong>
        </article>
      </section>

      <section className="demands-filters panel">
        <label>
          Responsável
          <select value={assigneeFilter} onChange={(e) => setAssigneeFilter(e.target.value)}>
            <option value="ALL">Toda a equipe</option>
            <option value="me">Minhas demandas</option>
            {people.map((person) => (
              <option key={person.id} value={String(person.id)}>
                {person.name}
              </option>
            ))}
            <option value="none">Sem responsável</option>
          </select>
        </label>
        <label>
          Situação
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="OPEN">Abertas</option>
            <option value="">Todas</option>
            {Object.entries(STATUS_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          Tipo
          <select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">Todos</option>
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </section>

      {loading ? (
        <div className="panel demands-empty">Carregando demandas...</div>
      ) : (
        <section className="demands-board">
          {columns.map((column) => (
            <div className="demands-column" key={column.key}>
              <div className="demands-column-head">
                <div>
                  <strong>{column.title}</strong>
                  <span>{column.subtitle}</span>
                </div>
                <em>{column.items.length}</em>
              </div>

              {column.items.length === 0 && <p className="demands-column-empty">Nada na fila.</p>}

              {column.items.map((demand, index) => {
                const open = demand.status === "A_FAZER" || demand.status === "EM_ANDAMENTO";
                return (
                  <article
                    key={demand.id}
                    className={`demand-card priority-${demand.priority.toLowerCase()} ${demand.overdue ? "overdue" : ""} ${open ? "" : "closed"}`}
                  >
                    <div className="demand-card-top">
                      <span className={`demand-type type-${demand.type.toLowerCase()}`}>{TYPE_LABEL[demand.type]}</span>
                      {(demand.priority === "ALTA" || demand.priority === "URGENTE") && (
                        <span className="demand-priority">{PRIORITY_LABEL[demand.priority]}</span>
                      )}
                      <span className="demand-status">{STATUS_LABEL[demand.status]}</span>
                    </div>

                    <h3>{demand.title}</h3>
                    {demand.description && <p>{demand.description}</p>}

                    <div className="demand-meta">
                      {demand.dueAt ? (
                        <span className={demand.overdue ? "late" : ""}>
                          <Clock3 size={13} /> {demand.overdue ? "Venceu " : "Prazo "}
                          {formatDue(demand.dueAt)}
                        </span>
                      ) : (
                        <span>Sem prazo</span>
                      )}
                      {demand.createdBy && <span>por {demand.createdBy.name.split(" ")[0]}</span>}
                    </div>

                    <div className="demand-actions">
                      {demand.status === "A_FAZER" && (
                        <button type="button" onClick={() => changeStatus(demand, "EM_ANDAMENTO")}>
                          <Play size={13} /> Iniciar
                        </button>
                      )}
                      {open && (
                        <button type="button" onClick={() => changeStatus(demand, "CONCLUIDA")}>
                          <CheckCircle2 size={13} /> Concluir
                        </button>
                      )}
                      {!open && (
                        <button type="button" onClick={() => changeStatus(demand, "A_FAZER")}>
                          Reabrir
                        </button>
                      )}
                      <button type="button" title="Editar" onClick={() => edit(demand)}>
                        <Pencil size={13} />
                      </button>
                      {open && column.items.length > 1 && (
                        <>
                          <button type="button" title="Fazer antes" disabled={index === 0} onClick={() => move(column.items, index, -1)}>
                            <ArrowUp size={13} />
                          </button>
                          <button
                            type="button"
                            title="Fazer depois"
                            disabled={index === column.items.length - 1}
                            onClick={() => move(column.items, index, 1)}
                          >
                            <ArrowDown size={13} />
                          </button>
                        </>
                      )}
                      {isManager ? (
                        <button type="button" className="danger" title="Excluir" onClick={() => remove(demand)}>
                          <Trash2 size={13} />
                        </button>
                      ) : (
                        open && (
                          <button type="button" className="danger" title="Cancelar" onClick={() => changeStatus(demand, "CANCELADA")}>
                            <X size={13} />
                          </button>
                        )
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ))}
        </section>
      )}

      {form && (
        <div className="demands-modal-backdrop" onClick={() => !saving && setForm(null)}>
          <form className="demands-modal" onClick={(e) => e.stopPropagation()} onSubmit={submitForm}>
            <div className="demands-modal-head">
              <h2>{form.id ? "Editar demanda" : "Nova demanda"}</h2>
              <button type="button" className="demands-close" onClick={() => setForm(null)}>
                <X size={18} />
              </button>
            </div>

            <label className="full">
              Título
              <input
                autoFocus
                required
                maxLength={200}
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex.: Finalizar memorial descritivo do Lote 12"
              />
            </label>

            <label className="full">
              Detalhes
              <textarea
                rows={3}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                placeholder="O que precisa ser feito, cliente, protocolo, observações..."
              />
            </label>

            <label>
              Responsável
              <select value={form.assigneeId} onChange={(e) => setForm({ ...form, assigneeId: e.target.value })}>
                <option value="">Sem responsável</option>
                {people.map((person) => (
                  <option key={person.id} value={String(person.id)}>
                    {person.name}
                    {person.hasWhatsapp ? "" : " (sem WhatsApp)"}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Tipo
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value as DemandType })}>
                {Object.entries(TYPE_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Prazo
              <input
                type="datetime-local"
                value={form.dueAt}
                onChange={(e) => setForm({ ...form, dueAt: e.target.value })}
              />
            </label>

            <label>
              Prioridade
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as DemandPriority })}
              >
                {Object.entries(PRIORITY_LABEL).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>

            <label className="full">
              Lembrete no WhatsApp
              <select
                value={form.remindBeforeMinutes}
                disabled={!form.dueAt}
                onChange={(e) => setForm({ ...form, remindBeforeMinutes: Number(e.target.value) })}
              >
                {REMIND_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <div className="demands-modal-actions full">
              <button type="button" className="button secondary" onClick={() => setForm(null)}>
                Cancelar
              </button>
              <button type="submit" className="button primary" disabled={saving}>
                {saving ? "Salvando..." : form.id ? "Salvar" : "Criar demanda"}
              </button>
            </div>
          </form>
        </div>
      )}

      {showWhatsapp && (
        <WhatsappPanel
          isManager={isManager}
          people={people}
          onClose={() => setShowWhatsapp(false)}
          onChanged={load}
        />
      )}
    </div>
  );
}

function WhatsappPanel({
  isManager,
  people,
  onClose,
  onChanged,
}: {
  isManager: boolean;
  people: Person[];
  onClose: () => void;
  onChanged: () => void;
}) {
  const [phone, setPhone] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [status, setStatus] = useState<any>(null);
  const [message, setMessage] = useState("");
  const [errorText, setErrorText] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<Record<number, string>>({});

  useEffect(() => {
    api
      .myWhatsapp()
      .then((data: any) => {
        setPhone(data.whatsappPhone || "");
        setEnabled(data.whatsappAlertsEnabled !== false);
      })
      .catch(() => undefined);

    if (isManager) {
      api
        .whatsappStatus()
        .then(setStatus)
        .catch((err) => setStatus({ error: err instanceof Error ? err.message : String(err) }));
    }
  }, [isManager]);

  async function run(action: () => Promise<unknown>, done: string) {
    try {
      setBusy(true);
      setErrorText("");
      const result: any = await action();
      setMessage(result?.message || done);
      onChanged();
    } catch (err) {
      setMessage("");
      setErrorText(err instanceof Error ? err.message : "Falhou.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="demands-modal-backdrop" onClick={onClose}>
      <div className="demands-modal" onClick={(e) => e.stopPropagation()}>
        <div className="demands-modal-head">
          <h2>WhatsApp dos alertas</h2>
          <button type="button" className="demands-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {errorText && <div className="demands-message error full">{errorText}</div>}
        {message && <div className="demands-message success full">{message}</div>}

        <label>
          Meu WhatsApp
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="96 99123-4567" />
        </label>

        <label className="demands-check">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Receber alertas de demandas
        </label>

        <div className="demands-modal-actions full">
          <button
            type="button"
            className="button secondary"
            disabled={busy}
            onClick={() => run(() => api.sendWhatsappTest(), "Mensagem de teste enviada.")}
          >
            Enviar teste para mim
          </button>
          <button
            type="button"
            className="button primary"
            disabled={busy}
            onClick={() =>
              run(() => api.saveMyWhatsapp({ whatsappPhone: phone, whatsappAlertsEnabled: enabled }), "WhatsApp salvo.")
            }
          >
            Salvar
          </button>
        </div>

        {isManager && (
          <>
            <WhatsappConnection />

            <div className="full demands-wa-people">
              <strong>Equipe</strong>
              {people.map((person) => {
                const first = person.name.split(" ")[0];
                const isEditing = editing[person.id] !== undefined;
                const stopEditing = () => {
                  const next = { ...editing };
                  delete next[person.id];
                  setEditing(next);
                };

                return (
                  <div key={person.id} className="demands-wa-person">
                    <span>
                      {person.name}
                      <small>
                        {person.hasWhatsapp ? person.whatsappPhone || person.whatsappMasked : "sem WhatsApp"}
                        {person.hasWhatsapp && !person.whatsappAlertsEnabled ? " (alertas desligados)" : ""}
                      </small>
                    </span>

                    {isEditing ? (
                      <>
                        <input
                          autoFocus
                          placeholder="DDD + número"
                          value={editing[person.id]}
                          onChange={(e) => setEditing({ ...editing, [person.id]: e.target.value })}
                        />
                        <div className="demands-wa-buttons">
                          <button
                            type="button"
                            className="button primary"
                            disabled={busy || !editing[person.id].trim()}
                            onClick={() =>
                              run(
                                () => api.savePersonWhatsapp(person.id, { whatsappPhone: editing[person.id] }),
                                `WhatsApp de ${first} salvo.`
                              ).then(stopEditing)
                            }
                          >
                            Salvar
                          </button>
                          <button type="button" className="button secondary" onClick={stopEditing}>
                            Cancelar
                          </button>
                        </div>
                      </>
                    ) : (
                      <div className="demands-wa-buttons">
                        <button
                          type="button"
                          className="button secondary"
                          onClick={() => setEditing({ ...editing, [person.id]: person.whatsappPhone || "" })}
                        >
                          {person.hasWhatsapp ? "Editar" : "Cadastrar"}
                        </button>
                        {person.hasWhatsapp && (
                          <button
                            type="button"
                            className="button secondary"
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  api.savePersonWhatsapp(person.id, {
                                    whatsappPhone: person.whatsappPhone || "",
                                    whatsappAlertsEnabled: !person.whatsappAlertsEnabled,
                                  }),
                                person.whatsappAlertsEnabled
                                  ? `Alertas de ${first} desligados.`
                                  : `Alertas de ${first} ligados.`
                              )
                            }
                          >
                            {person.whatsappAlertsEnabled ? "Pausar alertas" : "Ativar alertas"}
                          </button>
                        )}
                        {person.hasWhatsapp && (
                          <button
                            type="button"
                            className="button secondary danger"
                            disabled={busy}
                            onClick={() => {
                              if (!window.confirm(`Apagar o WhatsApp de ${person.name}? Essa pessoa deixa de receber alertas.`)) return;
                              run(
                                () => api.savePersonWhatsapp(person.id, { whatsappPhone: "" }),
                                `WhatsApp de ${first} apagado.`
                              );
                            }}
                          >
                            Apagar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {status?.recent?.length > 0 && (
              <div className="full demands-wa-log">
                <strong>Últimos envios</strong>
                {status.recent.map((item: any) => (
                  <div key={item.id}>
                    <span>{new Date(item.createdAt).toLocaleString("pt-BR")}</span>
                    <span>{item.kind}</span>
                    <span className={item.status === "SENT" ? "ok" : "late"}>{item.status}</span>
                    <small>{item.errorText || ""}</small>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

const WA_STATUS_LABEL: Record<string, string> = {
  ready: "Conectado",
  qr_ready: "Aguardando leitura do QR Code",
  initializing: "Iniciando...",
  authenticating: "Autenticando...",
  created: "Criada, não iniciada",
  disconnected: "Desconectado",
  action_required: "Ação necessária no celular",
  failed: "Falhou",
  sem_sessao: "Ainda não conectado",
};

function WhatsappConnection() {
  const [status, setStatus] = useState<any>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refreshStatus() {
    try {
      setStatus(await api.whatsappStatus());
    } catch (err) {
      setStatus({ error: err instanceof Error ? err.message : String(err) });
    }
  }

  useEffect(() => {
    refreshStatus();
  }, []);

  // Enquanto conecta, busca o QR a cada 3 s até o status virar "ready".
  useEffect(() => {
    if (!connecting) return;
    let stopped = false;

    async function tick() {
      try {
        const data: any = await api.whatsappQr();
        if (stopped) return;
        if (data.status === "ready") {
          setQr(null);
          setNote(`WhatsApp conectado${data.phone ? ` (${data.phone})` : ""}.`);
          setConnecting(false);
          refreshStatus();
          return;
        }
        setQr(data.qrCode || null);
        setNote(data.qrCode ? "" : data.message || WA_STATUS_LABEL[data.status] || data.status);
      } catch (err) {
        if (!stopped) setNote(err instanceof Error ? err.message : String(err));
      }
    }

    tick();
    const timer = window.setInterval(tick, 3000);
    const timeout = window.setTimeout(() => {
      setConnecting(false);
      setQr(null);
      setNote("Tempo esgotado. Clique em Conectar WhatsApp de novo.");
    }, 4 * 60 * 1000);

    return () => {
      stopped = true;
      window.clearInterval(timer);
      window.clearTimeout(timeout);
    };
  }, [connecting]);

  async function connect() {
    try {
      setBusy(true);
      setNote("Iniciando a sessão...");
      await api.whatsappConnect();
      setConnecting(true);
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    if (!window.confirm("Desconectar o WhatsApp atual? Os alertas param até você ler o QR Code de novo.")) return;
    try {
      setBusy(true);
      await api.whatsappLogout();
      setNote("WhatsApp desconectado.");
      await refreshStatus();
    } catch (err) {
      setNote(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = status?.status === "ready";

  return (
    <div className="full demands-wa-status">
      <strong>Conexão do WhatsApp (OpenWA)</strong>
      {!status ? (
        <span>Consultando...</span>
      ) : status.error && !status.status ? (
        <span className="late">{status.error}</span>
      ) : (
        <span className={ready ? "ok" : "late"}>
          {WA_STATUS_LABEL[status.status] || status.status}
          {ready && status.phone ? ` — ${status.phone}` : ""}
        </span>
      )}

      <div className="demands-wa-connect">
        {!ready && (
          <button type="button" className="button primary" disabled={busy || connecting} onClick={connect}>
            {connecting ? "Aguardando leitura..." : "Conectar WhatsApp"}
          </button>
        )}
        {ready && (
          <button type="button" className="button secondary" disabled={busy} onClick={logout}>
            Desconectar / trocar número
          </button>
        )}
      </div>

      {qr && (
        <div className="demands-wa-qr">
          <img src={qr.startsWith("data:") ? qr : `data:image/png;base64,${qr}`} alt="QR Code do WhatsApp" />
          <span>
            No celular da empresa: WhatsApp &gt; Configurações &gt; Aparelhos conectados &gt; Conectar um aparelho, e
            aponte para este código.
          </span>
        </div>
      )}
      {note && <span>{note}</span>}
    </div>
  );
}
