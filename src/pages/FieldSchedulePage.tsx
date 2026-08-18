import {
  AlertTriangle,
  Bell,
  CalendarDays,
  CheckCircle2,
  Clock3,
  MapPin,
  Pencil,
  Plus,
  Search,
  Trash2,
  Users,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { api } from "../services/api";
import "./FieldSchedulePage.css";

type FieldType =
  | "GEORREFERENCIAMENTO"
  | "TOPOGRAFIA"
  | "DRONE"
  | "INVENTARIO_FLORESTAL"
  | "VISTORIA_AMBIENTAL"
  | "LEVANTAMENTO_AMBIENTAL"
  | "OUTRO";

type FieldStatus =
  | "PLANEJADO"
  | "CONFIRMADO"
  | "EM_DESLOCAMENTO"
  | "EM_CAMPO"
  | "CONCLUIDO"
  | "ADIADO"
  | "CANCELADO";

type NotificationStatus =
  | "PENDENTE"
  | "PROCESSANDO"
  | "ENVIADO"
  | "ERRO"
  | "CANCELADO";

type Manager = {
  id: number;
  name: string;
  email: string;
  role?: string;
};

type ScheduleManager = {
  id: number;
  userId: number;
  name: string;
  email: string;
};

type FieldNotification = {
  id: number;
  daysBefore: number;
  status: NotificationStatus;
  scheduledFor: string;
  sentAt?: string | null;
  recipientEmail: string;
  subject?: string | null;
  messageId?: string | null;
  errorText?: string | null;
};

type FieldSchedule = {
  id: number;

  title: string;
  description?: string | null;

  type: FieldType;
  status: FieldStatus;

  clientName?: string | null;
  propertyName?: string | null;

  municipality?: string | null;
  state?: string | null;

  location?: string | null;
  reference?: string | null;

  latitude?: number | null;
  longitude?: number | null;

  startDate: string;
  endDate?: string | null;

  departureTime?: string | null;
  returnTime?: string | null;

  meetingPoint?: string | null;

  alertEnabled: boolean;
  alertDaysBefore: number;

  notes?: string | null;

  managers: ScheduleManager[];
  notifications: FieldNotification[];

  createdAt: string;
  updatedAt: string;
};

type Summary = {
  total: number;
  planned: number;
  confirmed: number;
  inField: number;
  upcoming: number;
  pendingAlerts: number;
  alertErrors: number;
};

const typeLabels: Record<FieldType, string> = {
  GEORREFERENCIAMENTO: "Georreferenciamento",
  TOPOGRAFIA: "Topografia",
  DRONE: "Operação com Drone",
  INVENTARIO_FLORESTAL: "Inventário Florestal",
  VISTORIA_AMBIENTAL: "Vistoria Ambiental",
  LEVANTAMENTO_AMBIENTAL: "Levantamento Ambiental",
  OUTRO: "Outra atividade",
};

const statusLabels: Record<FieldStatus, string> = {
  PLANEJADO: "Planejado",
  CONFIRMADO: "Confirmado",
  EM_DESLOCAMENTO: "Em deslocamento",
  EM_CAMPO: "Em campo",
  CONCLUIDO: "Concluído",
  ADIADO: "Adiado",
  CANCELADO: "Cancelado",
};

function localDateInput(
  value?: string | null
) {
  if (!value) return "";

  const date = new Date(value);

  return new Intl.DateTimeFormat(
    "en-CA",
    {
      timeZone:
        "America/Belem",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }
  ).format(date);
}

function dateBr(
  value?: string | null
) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone:
        "America/Belem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(
    new Date(value)
  );
}

function dateTimeBr(
  value?: string | null
) {
  if (!value) return "-";

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone:
        "America/Belem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }
  ).format(
    new Date(value)
  );
}

function blankForm() {
  return {
    title: "",
    description: "",

    type:
      "GEORREFERENCIAMENTO" as FieldType,

    clientName: "",
    propertyName: "",

    municipality: "",
    state: "AP",

    location: "",
    reference: "",

    latitude: "",
    longitude: "",

    startDate: "",
    endDate: "",

    departureTime: "",
    returnTime: "",

    meetingPoint: "",

    alertEnabled: true,
    alertDaysBefore: "3",

    notes: "",

    managerIds:
      [] as number[],
  };
}

export default function FieldSchedulePage() {
  const [
    schedules,
    setSchedules,
  ] = useState<FieldSchedule[]>([]);

  const [
    managers,
    setManagers,
  ] = useState<Manager[]>([]);

  const [
    summary,
    setSummary,
  ] = useState<Summary>({
    total: 0,
    planned: 0,
    confirmed: 0,
    inField: 0,
    upcoming: 0,
    pendingAlerts: 0,
    alertErrors: 0,
  });

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    success,
    setSuccess,
  ] = useState("");

  const [
    search,
    setSearch,
  ] = useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] = useState("");

  const [
    typeFilter,
    setTypeFilter,
  ] = useState("");

  const [
    showForm,
    setShowForm,
  ] = useState(false);

  const [
    editing,
    setEditing,
  ] =
    useState<FieldSchedule | null>(
      null
    );

  const [
    form,
    setForm,
  ] = useState(blankForm());

  const [
    saving,
    setSaving,
  ] = useState(false);

  const [
    processingAlerts,
    setProcessingAlerts,
  ] = useState(false);

  const [
    changingStatusId,
    setChangingStatusId,
  ] =
    useState<number | null>(null);

  const [
    deletingId,
    setDeletingId,
  ] =
    useState<number | null>(null);

  async function loadData() {
    try {
      setError("");

      const [
        scheduleData,
        summaryData,
        managerData,
      ] =
        await Promise.all([
          api.fieldSchedules({
            search:
              search || undefined,

            status:
              statusFilter ||
              undefined,

            type:
              typeFilter ||
              undefined,
          }),

          api.fieldScheduleSummary(),

          api.fieldScheduleManagers(),
        ]);

      setSchedules(
        scheduleData as FieldSchedule[]
      );

      setSummary(
        summaryData as Summary
      );

      setManagers(
        managerData as Manager[]
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao carregar o cronograma."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const timer =
      window.setTimeout(
        () => {
          void loadData();
        },
        250
      );

    return () =>
      window.clearTimeout(
        timer
      );
  }, [
    search,
    statusFilter,
    typeFilter,
  ]);

  const grouped =
    useMemo(() => {
      const result:
        Record<
          string,
          FieldSchedule[]
        > = {};

      for (
        const item
        of schedules
      ) {
        const key =
          localDateInput(
            item.startDate
          );

        if (!result[key]) {
          result[key] = [];
        }

        result[key].push(
          item
        );
      }

      return Object.entries(
        result
      ).sort(
        ([a], [b]) =>
          a.localeCompare(b)
      );
    }, [schedules]);

  function openCreate() {
    setEditing(null);
    setForm(blankForm());
    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function openEdit(
    item: FieldSchedule
  ) {
    setEditing(item);

    setForm({
      title:
        item.title || "",

      description:
        item.description || "",

      type:
        item.type,

      clientName:
        item.clientName || "",

      propertyName:
        item.propertyName || "",

      municipality:
        item.municipality || "",

      state:
        item.state || "AP",

      location:
        item.location || "",

      reference:
        item.reference || "",

      latitude:
        item.latitude !==
          null &&
        item.latitude !==
          undefined
          ? String(
              item.latitude
            )
          : "",

      longitude:
        item.longitude !==
          null &&
        item.longitude !==
          undefined
          ? String(
              item.longitude
            )
          : "",

      startDate:
        localDateInput(
          item.startDate
        ),

      endDate:
        localDateInput(
          item.endDate
        ),

      departureTime:
        item.departureTime ||
        "",

      returnTime:
        item.returnTime ||
        "",

      meetingPoint:
        item.meetingPoint ||
        "",

      alertEnabled:
        item.alertEnabled,

      alertDaysBefore:
        String(
          item.alertDaysBefore
        ),

      notes:
        item.notes || "",

      managerIds:
        item.managers.map(
          (manager) =>
            manager.userId
        ),
    });

    setError("");
    setSuccess("");
    setShowForm(true);
  }

  function toggleManager(
    id: number
  ) {
    setForm(
      (current) => ({
        ...current,

        managerIds:
          current.managerIds.includes(
            id
          )
            ? current.managerIds.filter(
                (item) =>
                  item !== id
              )
            : [
                ...current.managerIds,
                id,
              ],
      })
    );
  }

  async function save() {
    try {
      setError("");
      setSuccess("");

      if (!form.title.trim()) {
        throw new Error(
          "Informe o título da atividade."
        );
      }

      if (!form.startDate) {
        throw new Error(
          "Informe a data de saída."
        );
      }

      if (
        form.managerIds.length ===
          0 &&
        form.alertEnabled
      ) {
        throw new Error(
          "Selecione pelo menos um responsável para receber o alerta."
        );
      }

      setSaving(true);

      const payload = {
        title:
          form.title.trim(),

        description:
          form.description.trim() ||
          null,

        type:
          form.type,

        clientName:
          form.clientName.trim() ||
          null,

        propertyName:
          form.propertyName.trim() ||
          null,

        municipality:
          form.municipality.trim() ||
          null,

        state:
          form.state.trim() ||
          null,

        location:
          form.location.trim() ||
          null,

        reference:
          form.reference.trim() ||
          null,

        latitude:
          form.latitude
            ? Number(
                form.latitude
                  .replace(",", ".")
              )
            : null,

        longitude:
          form.longitude
            ? Number(
                form.longitude
                  .replace(",", ".")
              )
            : null,

        startDate:
          form.startDate,

        endDate:
          form.endDate ||
          null,

        departureTime:
          form.departureTime ||
          null,

        returnTime:
          form.returnTime ||
          null,

        meetingPoint:
          form.meetingPoint.trim() ||
          null,

        alertEnabled:
          form.alertEnabled,

        alertDaysBefore:
          Math.max(
            0,
            Number(
              form.alertDaysBefore ||
                0
            )
          ),

        notes:
          form.notes.trim() ||
          null,

        managerIds:
          form.managerIds,
      };

      if (editing) {
        await api.updateFieldSchedule(
          editing.id,
          payload
        );

        setSuccess(
          "Atividade atualizada com sucesso."
        );
      } else {
        await api.createFieldSchedule(
          payload
        );

        setSuccess(
          "Saída de campo cadastrada com sucesso."
        );
      }

      setShowForm(false);
      setEditing(null);
      setForm(blankForm());

      await loadData();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao salvar atividade."
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(
    item: FieldSchedule,
    status: FieldStatus
  ) {
    try {
      setError("");
      setChangingStatusId(
        item.id
      );

      await api.updateFieldScheduleStatus(
        item.id,
        status
      );

      await loadData();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao alterar status."
      );
    } finally {
      setChangingStatusId(null);
    }
  }

  async function remove(
    item: FieldSchedule
  ) {
    if (
      !window.confirm(
        `Remover "${item.title}" do cronograma?`
      )
    ) {
      return;
    }

    try {
      setError("");
      setDeletingId(
        item.id
      );

      await api.deleteFieldSchedule(
        item.id
      );

      await loadData();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao remover atividade."
      );
    } finally {
      setDeletingId(null);
    }
  }

  async function processAlerts() {
    try {
      setError("");
      setSuccess("");
      setProcessingAlerts(true);

      const result =
        await api.processFieldScheduleNotifications(
          50
        ) as {
          found?: number;
          sent?: number;
          errors?: number;
          cancelled?: number;
        };

      setSuccess(
        `Alertas processados: ${
          result.sent || 0
        } enviado(s), ${
          result.errors || 0
        } erro(s), ${
          result.cancelled || 0
        } cancelado(s).`
      );

      await loadData();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Erro ao processar alertas."
      );
    } finally {
      setProcessingAlerts(false);
    }
  }

  if (loading) {
    return (
      <section className="page field-page">
        <div className="panel">
          Carregando cronograma de campo...
        </div>
      </section>
    );
  }

  return (
    <section className="page field-page">
      <header className="field-header">
        <div>
          <span className="eyebrow">
            OPERAÇÃO
          </span>

          <h1>
            Cronograma de Campo
          </h1>

          <p>
            Planejamento de saídas,
            responsáveis e alertas
            automáticos da equipe técnica.
          </p>
        </div>

        <div className="field-header-actions">
          <a
            href="/app/cronograma-campo/mapa"
            className="button secondary field-travel-map-button"
          >
            <span className="field-travel-map-icon">
              ◈
            </span>
            Mapa de viagens
          </a>

          <button
            type="button"
            className="button secondary"
            disabled={
              processingAlerts
            }
            onClick={
              processAlerts
            }
          >
            <Bell size={17} />
            {processingAlerts
              ? "Processando..."
              : "Processar alertas"}
          </button>

          <button
            type="button"
            className="button primary"
            onClick={openCreate}
          >
            <Plus size={18} />
            Nova saída de campo
          </button>
        </div>
      </header>

      {error && (
        <div className="field-message error">
          <AlertTriangle size={17} />
          {error}
        </div>
      )}

      {success && (
        <div className="field-message success">
          <CheckCircle2 size={17} />
          {success}
        </div>
      )}

      <div className="field-kpis">
        <article>
          <CalendarDays size={20} />
          <span>Próximos 7 dias</span>
          <strong>
            {summary.upcoming}
          </strong>
        </article>

        <article>
          <CheckCircle2 size={20} />
          <span>Confirmados</span>
          <strong>
            {summary.confirmed}
          </strong>
        </article>

        <article>
          <MapPin size={20} />
          <span>Em campo</span>
          <strong>
            {summary.inField}
          </strong>
        </article>

        <article>
          <Bell size={20} />
          <span>Alertas pendentes</span>
          <strong>
            {summary.pendingAlerts}
          </strong>
        </article>

        <article
          className={
            summary.alertErrors > 0
              ? "danger"
              : ""
          }
        >
          <AlertTriangle size={20} />
          <span>Erros de alerta</span>
          <strong>
            {summary.alertErrors}
          </strong>
        </article>
      </div>

      <div className="field-filters panel">
        <div className="field-search">
          <Search size={17} />

          <input
            value={search}
            placeholder="Buscar atividade, cliente, imóvel ou município..."
            onChange={(event) =>
              setSearch(
                event.target.value
              )
            }
          />
        </div>

        <select
          value={typeFilter}
          onChange={(event) =>
            setTypeFilter(
              event.target.value
            )
          }
        >
          <option value="">
            Todos os tipos
          </option>

          {Object.entries(
            typeLabels
          ).map(
            ([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            )
          )}
        </select>

        <select
          value={statusFilter}
          onChange={(event) =>
            setStatusFilter(
              event.target.value
            )
          }
        >
          <option value="">
            Todos os status
          </option>

          {Object.entries(
            statusLabels
          ).map(
            ([value, label]) => (
              <option
                key={value}
                value={value}
              >
                {label}
              </option>
            )
          )}
        </select>
      </div>

      <div className="field-board">
        {grouped.length === 0 ? (
          <div className="panel field-empty">
            <CalendarDays size={36} />

            <h3>
              Nenhuma saída programada
            </h3>

            <p>
              Cadastre a primeira atividade
              operacional de campo.
            </p>

            <button
              type="button"
              className="button primary"
              onClick={openCreate}
            >
              <Plus size={17} />
              Nova saída de campo
            </button>
          </div>
        ) : (
          grouped.map(
            ([day, items]) => (
              <section
                className="field-day"
                key={day}
              >
                <div className="field-day-heading">
                  <CalendarDays size={17} />

                  <strong>
                    {dateBr(
                      items[0].startDate
                    )}
                  </strong>

                  <span>
                    {items.length} atividade(s)
                  </span>
                </div>

                <div className="field-day-list">
                  {items.map(
                    (item) => (
                      <article
                        key={item.id}
                        className="field-card"
                      >
                        <div className="field-card-main">
                          <div className="field-card-top">
                            <span className="field-type">
                              {typeLabels[item.type]}
                            </span>

                            <span
                              className={
                                `field-status ${item.status.toLowerCase()}`
                              }
                            >
                              {statusLabels[item.status]}
                            </span>
                          </div>

                          <h3>
                            {item.title}
                          </h3>

                          <div className="field-card-meta">
                            {(item.propertyName ||
                              item.clientName) && (
                              <span>
                                <MapPin size={14} />
                                {item.propertyName ||
                                  item.clientName}
                              </span>
                            )}

                            {(item.municipality ||
                              item.state) && (
                              <span>
                                <MapPin size={14} />
                                {[
                                  item.municipality,
                                  item.state,
                                ]
                                  .filter(Boolean)
                                  .join("/")}
                              </span>
                            )}

                            {item.departureTime && (
                              <span>
                                <Clock3 size={14} />
                                Saída {item.departureTime}
                              </span>
                            )}

                            <span>
                              <Users size={14} />
                              {item.managers.length} responsável(is)
                            </span>
                          </div>

                          {item.description && (
                            <p>
                              {item.description}
                            </p>
                          )}

                          <div className="field-alert-line">
                            <Bell size={14} />

                            {item.alertEnabled
                              ? `Aviso ${item.alertDaysBefore} dia(s) antes`
                              : "Alertas desativados"}

                            {item.notifications.some(
                              (notification) =>
                                notification.status ===
                                "ERRO"
                            ) && (
                              <strong>
                                Há alerta com erro
                              </strong>
                            )}
                          </div>
                        </div>

                        <div className="field-card-actions">
                          <select
                            value={item.status}
                            disabled={
                              changingStatusId ===
                              item.id
                            }
                            onChange={(event) =>
                              void changeStatus(
                                item,
                                event.target
                                  .value as FieldStatus
                              )
                            }
                          >
                            {Object.entries(
                              statusLabels
                            ).map(
                              ([value, label]) => (
                                <option
                                  value={value}
                                  key={value}
                                >
                                  {label}
                                </option>
                              )
                            )}
                          </select>

                          <button
                            type="button"
                            className="field-icon-button"
                            title="Editar"
                            onClick={() =>
                              openEdit(item)
                            }
                          >
                            <Pencil size={16} />
                          </button>

                          <button
                            type="button"
                            className="field-icon-button danger"
                            title="Excluir"
                            disabled={
                              deletingId ===
                              item.id
                            }
                            onClick={() =>
                              void remove(item)
                            }
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        {item.notifications.length > 0 && (
                          <div className="field-notifications">
                            {item.notifications.map(
                              (notification) => (
                                <div
                                  key={notification.id}
                                  className="field-notification"
                                >
                                  <span
                                    className={
                                      `notification-status ${notification.status.toLowerCase()}`
                                    }
                                  >
                                    {notification.status}
                                  </span>

                                  <span>
                                    {notification.recipientEmail}
                                  </span>

                                  <span>
                                    {notification.status ===
                                    "ENVIADO"
                                      ? `Enviado ${dateTimeBr(
                                          notification.sentAt
                                        )}`
                                      : `Previsto ${dateTimeBr(
                                          notification.scheduledFor
                                        )}`}
                                  </span>
                                </div>
                              )
                            )}
                          </div>
                        )}
                      </article>
                    )
                  )}
                </div>
              </section>
            )
          )
        )}
      </div>

      {showForm && (
        <div
          className="field-modal-backdrop"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget &&
              !saving
            ) {
              setShowForm(false);
            }
          }}
        >
          <section className="field-modal">
            <header>
              <div>
                <span className="eyebrow">
                  CRONOGRAMA DE CAMPO
                </span>

                <h2>
                  {editing
                    ? "Editar saída de campo"
                    : "Nova saída de campo"}
                </h2>

                <p>
                  Planejamento operacional,
                  responsáveis e notificações.
                </p>
              </div>

              <button
                type="button"
                className="field-close"
                disabled={saving}
                onClick={() =>
                  setShowForm(false)
                }
              >
                <X size={20} />
              </button>
            </header>

            <div className="field-form">
              <label className="full">
                Título da atividade *
                <input
                  value={form.title}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        title:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Ex.: Georreferenciamento Fazenda Santa Maria"
                />
              </label>

              <label>
                Tipo *
                <select
                  value={form.type}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        type:
                          event.target.value as FieldType,
                      })
                    )
                  }
                >
                  {Object.entries(
                    typeLabels
                  ).map(
                    ([value, label]) => (
                      <option
                        key={value}
                        value={value}
                      >
                        {label}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                Cliente
                <input
                  value={form.clientName}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        clientName:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Imóvel / empreendimento
                <input
                  value={form.propertyName}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        propertyName:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Município
                <input
                  value={form.municipality}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        municipality:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                UF
                <input
                  maxLength={2}
                  value={form.state}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        state:
                          event.target.value.toUpperCase(),
                      })
                    )
                  }
                />
              </label>

              <label>
                Data de saída *
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        startDate:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Data de retorno
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        endDate:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Horário de saída
                <input
                  type="time"
                  value={form.departureTime}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        departureTime:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Retorno previsto
                <input
                  type="time"
                  value={form.returnTime}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        returnTime:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label className="full">
                Ponto de encontro
                <input
                  value={form.meetingPoint}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        meetingPoint:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Ex.: Sede da Amazônika, 06:00"
                />
              </label>

              <label className="full">
                Localização / endereço
                <input
                  value={form.location}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        location:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Latitude
                <input
                  inputMode="decimal"
                  value={form.latitude}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        latitude:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label>
                Longitude
                <input
                  inputMode="decimal"
                  value={form.longitude}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        longitude:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <label className="full">
                Referência
                <input
                  value={form.reference}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        reference:
                          event.target.value,
                      })
                    )
                  }
                  placeholder="Ramal, comunidade, acesso, ponto de apoio..."
                />
              </label>

              <label className="full">
                Descrição da atividade
                <textarea
                  rows={4}
                  value={form.description}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        description:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>

              <div className="full field-form-section">
                <div>
                  <strong>
                    Responsáveis / Gerentes
                  </strong>

                  <span>
                    Selecione quem receberá
                    os alertas automáticos.
                  </span>
                </div>

                <div className="field-manager-grid">
                  {managers.map(
                    (manager) => (
                      <button
                        type="button"
                        key={manager.id}
                        className={
                          form.managerIds.includes(
                            manager.id
                          )
                            ? "selected"
                            : ""
                        }
                        onClick={() =>
                          toggleManager(
                            manager.id
                          )
                        }
                      >
                        <Users size={16} />

                        <span>
                          <strong>
                            {manager.name}
                          </strong>

                          <small>
                            {manager.email}
                          </small>
                        </span>
                      </button>
                    )
                  )}
                </div>
              </div>

              <div className="full field-alert-config">
                <label className="field-checkbox">
                  <input
                    type="checkbox"
                    checked={form.alertEnabled}
                    onChange={(event) =>
                      setForm(
                        (current) => ({
                          ...current,
                          alertEnabled:
                            event.target.checked,
                        })
                      )
                    }
                  />

                  <span>
                    <strong>
                      Enviar alerta automático
                    </strong>

                    <small>
                      Avisar os responsáveis
                      antes da saída.
                    </small>
                  </span>
                </label>

                {form.alertEnabled && (
                  <label>
                    Antecedência
                    <select
                      value={
                        form.alertDaysBefore
                      }
                      onChange={(event) =>
                        setForm(
                          (current) => ({
                            ...current,
                            alertDaysBefore:
                              event.target.value,
                          })
                        )
                      }
                    >
                      <option value="0">
                        No mesmo dia
                      </option>
                      <option value="1">
                        1 dia antes
                      </option>
                      <option value="2">
                        2 dias antes
                      </option>
                      <option value="3">
                        3 dias antes
                      </option>
                      <option value="5">
                        5 dias antes
                      </option>
                      <option value="7">
                        7 dias antes
                      </option>
                      <option value="10">
                        10 dias antes
                      </option>
                      <option value="15">
                        15 dias antes
                      </option>
                    </select>
                  </label>
                )}
              </div>

              <label className="full">
                Observações
                <textarea
                  rows={4}
                  value={form.notes}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        notes:
                          event.target.value,
                      })
                    )
                  }
                />
              </label>
            </div>

            <footer>
              <button
                type="button"
                className="button secondary"
                disabled={saving}
                onClick={() =>
                  setShowForm(false)
                }
              >
                Cancelar
              </button>

              <button
                type="button"
                className="button primary"
                disabled={saving}
                onClick={() =>
                  void save()
                }
              >
                {saving
                  ? "Salvando..."
                  : editing
                  ? "Salvar alterações"
                  : "Cadastrar saída"}
              </button>
            </footer>
          </section>
        </div>
      )}
    </section>
  );
}
