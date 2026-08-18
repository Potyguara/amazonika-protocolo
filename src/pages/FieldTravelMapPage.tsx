import {
  AlertTriangle,
  ArrowLeft,
  BriefcaseBusiness,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Clock3,
  MapPin,
  Navigation,
  PlaneTakeoff,
  Route,
  Users,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";
import { Link } from "react-router-dom";
import { api } from "../services/api";
import "./FieldTravelMapPage.css";

type FieldManager = {
  id: number;
  userId: number;
  name: string;
  email: string;
};

type FieldSchedule = {
  id: number;
  title: string;
  description?: string | null;

  type: string;
  status: string;

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

  managers?: FieldManager[];
};

const MONTH_NAMES = [
  "Janeiro",
  "Fevereiro",
  "Março",
  "Abril",
  "Maio",
  "Junho",
  "Julho",
  "Agosto",
  "Setembro",
  "Outubro",
  "Novembro",
  "Dezembro",
];

const WEEK_DAYS = [
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
  "Dom",
];

function operationalDate(
  value: string
) {
  return new Date(value);
}

function dateKey(
  value: Date
) {
  const year =
    value.getFullYear();

  const month =
    String(
      value.getMonth() + 1
    ).padStart(2, "0");

  const day =
    String(
      value.getDate()
    ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }
  ).format(
    operationalDate(value)
  );
}

function typeLabel(
  type?: string
) {
  const labels: Record<
    string,
    string
  > = {
    GEORREFERENCIAMENTO:
      "Georreferenciamento",
    TOPOGRAFIA:
      "Topografia",
    DRONE:
      "Aerolevantamento / Drone",
    INVENTARIO_FLORESTAL:
      "Inventário Florestal",
    VISTORIA_AMBIENTAL:
      "Vistoria Ambiental",
    LEVANTAMENTO_AMBIENTAL:
      "Levantamento Ambiental",
    OUTRO:
      "Outra atividade",
  };

  return (
    labels[type || ""] ||
    type ||
    "Atividade"
  );
}

function statusLabel(
  status?: string
) {
  const labels: Record<
    string,
    string
  > = {
    PLANEJADO: "Planejado",
    CONFIRMADO: "Confirmado",
    EM_DESLOCAMENTO:
      "Em deslocamento",
    EM_CAMPO: "Em campo",
    CONCLUIDO: "Concluído",
    ADIADO: "Adiado",
    CANCELADO: "Cancelado",
  };

  return (
    labels[status || ""] ||
    status ||
    "-"
  );
}

function scheduleClass(
  status?: string
) {
  switch (status) {
    case "CONFIRMADO":
      return "confirmed";

    case "EM_DESLOCAMENTO":
    case "EM_CAMPO":
      return "active";

    case "ADIADO":
      return "postponed";

    case "CANCELADO":
      return "cancelled";

    case "CONCLUIDO":
      return "done";

    default:
      return "planned";
  }
}

export default function FieldTravelMapPage() {
  const today =
    new Date();

  const [
    schedules,
    setSchedules,
  ] = useState<FieldSchedule[]>(
    []
  );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const [
    selectedMonth,
    setSelectedMonth,
  ] = useState(
    today.getMonth()
  );

  const [
    selectedYear,
    setSelectedYear,
  ] = useState(
    today.getFullYear()
  );

  const [
    selectedDay,
    setSelectedDay,
  ] = useState<string | null>(
    null
  );

  const [
    dayPanelOpen,
    setDayPanelOpen,
  ] = useState(false);

  useEffect(() => {
    void loadSchedules();
  }, []);

  async function loadSchedules() {
    try {
      setLoading(true);
      setError("");

      const response: any =
        await api.fieldSchedules({});

      const data =
        Array.isArray(response)
          ? response
          : response?.items ||
            response?.schedules ||
            [];

      setSchedules(data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar cronograma."
      );
    } finally {
      setLoading(false);
    }
  }

  const monthStart =
    new Date(
      selectedYear,
      selectedMonth,
      1
    );

  const monthEnd =
    new Date(
      selectedYear,
      selectedMonth + 1,
      0,
      23,
      59,
      59
    );

  const monthSchedules =
    useMemo(
      () =>
        schedules.filter(
          (schedule) => {
            if (
              schedule.status ===
              "CANCELADO"
            ) {
              return false;
            }

            const start =
              operationalDate(
                schedule.startDate
              );

            const end =
              schedule.endDate
                ? operationalDate(
                    schedule.endDate
                  )
                : start;

            return (
              start <= monthEnd &&
              end >= monthStart
            );
          }
        ),
      [
        schedules,
        selectedMonth,
        selectedYear,
      ]
    );

  const occupationByDay =
    useMemo(() => {
      const map =
        new Map<
          string,
          FieldSchedule[]
        >();

      for (
        const schedule
        of monthSchedules
      ) {
        const start =
          operationalDate(
            schedule.startDate
          );

        const end =
          schedule.endDate
            ? operationalDate(
                schedule.endDate
              )
            : start;

        const cursor =
          new Date(
            start.getFullYear(),
            start.getMonth(),
            start.getDate()
          );

        const last =
          new Date(
            end.getFullYear(),
            end.getMonth(),
            end.getDate()
          );

        while (
          cursor <= last
        ) {
          const key =
            dateKey(cursor);

          const current =
            map.get(key) ||
            [];

          current.push(
            schedule
          );

          map.set(
            key,
            current
          );

          cursor.setDate(
            cursor.getDate() + 1
          );
        }
      }

      return map;
    }, [monthSchedules]);

  const selectedDaySchedules =
    selectedDay
      ? occupationByDay.get(
          selectedDay
        ) || []
      : [];

  const selectedDayDate =
    selectedDay
      ? new Date(
          `${selectedDay}T12:00:00`
        )
      : null;

  const selectedDayConflicts =
    useMemo(() => {
      if (
        selectedDaySchedules.length <
        2
      ) {
        return [];
      }

      const managerMap =
        new Map<
          number,
          {
            name: string;
            schedules:
              FieldSchedule[];
          }
        >();

      for (
        const schedule
        of selectedDaySchedules
      ) {
        for (
          const manager
          of schedule.managers ||
          []
        ) {
          const current =
            managerMap.get(
              manager.userId
            ) || {
              name:
                manager.name,
              schedules: [],
            };

          current.schedules.push(
            schedule
          );

          managerMap.set(
            manager.userId,
            current
          );
        }
      }

      return [
        ...managerMap.values(),
      ].filter(
        (item) =>
          item.schedules.length >
          1
      );
    }, [
      selectedDaySchedules,
    ]);

  const daysInMonth =
    new Date(
      selectedYear,
      selectedMonth + 1,
      0
    ).getDate();

  const firstWeekDay =
    (
      new Date(
        selectedYear,
        selectedMonth,
        1
      ).getDay() +
      6
    ) % 7;

  const calendarCells:
    Array<
      number | null
    > = [
      ...Array(
        firstWeekDay
      ).fill(null),
      ...Array.from(
        {
          length:
            daysInMonth,
        },
        (_, index) =>
          index + 1
      ),
    ];

  while (
    calendarCells.length %
      7 !==
    0
  ) {
    calendarCells.push(
      null
    );
  }

  const occupiedDays =
    [...occupationByDay.keys()]
      .filter((key) =>
        key.startsWith(
          `${selectedYear}-${String(
            selectedMonth + 1
          ).padStart(
            2,
            "0"
          )}`
        )
      ).length;

  const freeDays =
    Math.max(
      0,
      daysInMonth -
        occupiedDays
    );

  const activeSchedules =
    monthSchedules.filter(
      (item) =>
        [
          "EM_DESLOCAMENTO",
          "EM_CAMPO",
        ].includes(
          item.status
        )
    );

  const futureSchedules =
    [...monthSchedules]
      .filter(
        (item) =>
          operationalDate(
            item.startDate
          ) >= today &&
          ![
            "CANCELADO",
            "CONCLUIDO",
          ].includes(
            item.status
          )
      )
      .sort(
        (a, b) =>
          operationalDate(
            a.startDate
          ).getTime() -
          operationalDate(
            b.startDate
          ).getTime()
      );

  const nextSchedule =
    futureSchedules[0] ||
    null;

  const managers =
    useMemo(() => {
      const map =
        new Map<
          number,
          {
            id: number;
            name: string;
            email: string;
            schedules:
              FieldSchedule[];
          }
        >();

      for (
        const schedule
        of monthSchedules
      ) {
        for (
          const manager
          of schedule.managers ||
          []
        ) {
          const current =
            map.get(
              manager.userId
            ) || {
              id:
                manager.userId,
              name:
                manager.name,
              email:
                manager.email,
              schedules: [],
            };

          current.schedules.push(
            schedule
          );

          map.set(
            manager.userId,
            current
          );
        }
      }

      return [
        ...map.values(),
      ];
    }, [monthSchedules]);

  function previousMonth() {
    if (
      selectedMonth === 0
    ) {
      setSelectedMonth(11);
      setSelectedYear(
        (value) =>
          value - 1
      );
    } else {
      setSelectedMonth(
        (value) =>
          value - 1
      );
    }
  }

  function nextMonth() {
    if (
      selectedMonth === 11
    ) {
      setSelectedMonth(0);
      setSelectedYear(
        (value) =>
          value + 1
      );
    } else {
      setSelectedMonth(
        (value) =>
          value + 1
      );
    }
  }

  return (
    <section className="ftm-page">
      <div className="ftm-topbar">
        <Link
          to="/app/cronograma-campo"
          className="ftm-back"
        >
          <ArrowLeft
            size={17}
          />
          Cronograma de Campo
        </Link>
      </div>

      <header className="ftm-header">
        <div>
          <span className="eyebrow">
            OPERAÇÕES DE CAMPO
          </span>

          <h1>
            Mapa de Viagens
          </h1>

          <p>
            Visualize ocupação,
            disponibilidade,
            destinos e equipes
            programadas para as
            operações externas da
            empresa.
          </p>
        </div>

        <div className="ftm-month-switch">
          <button
            type="button"
            onClick={
              previousMonth
            }
          >
            ‹
          </button>

          <strong>
            {
              MONTH_NAMES[
                selectedMonth
              ]
            }{" "}
            {selectedYear}
          </strong>

          <button
            type="button"
            onClick={
              nextMonth
            }
          >
            ›
          </button>
        </div>
      </header>

      {error && (
        <div className="ftm-error">
          {error}
        </div>
      )}

      <div className="ftm-kpis">
        <article>
          <CalendarDays
            size={20}
          />

          <span>
            Dias livres
          </span>

          <strong>
            {freeDays}
          </strong>

          <small>
            no mês selecionado
          </small>
        </article>

        <article>
          <CalendarRange
            size={20}
          />

          <span>
            Dias ocupados
          </span>

          <strong>
            {occupiedDays}
          </strong>

          <small>
            com atividade externa
          </small>
        </article>

        <article>
          <Navigation
            size={20}
          />

          <span>
            Em operação
          </span>

          <strong>
            {
              activeSchedules.length
            }
          </strong>

          <small>
            deslocamento / campo
          </small>
        </article>

        <article className="ftm-next-card">
          <PlaneTakeoff
            size={20}
          />

          <span>
            Próxima saída
          </span>

          <strong>
            {nextSchedule
              ? formatDate(
                  nextSchedule.startDate
                )
              : "Livre"}
          </strong>

          <small>
            {nextSchedule
              ? nextSchedule.title
              : "sem viagem programada"}
          </small>
        </article>
      </div>

      <div className="ftm-main-grid">
        <article className="ftm-panel ftm-calendar-panel">
          <div className="ftm-panel-heading">
            <div>
              <span className="eyebrow">
                DISPONIBILIDADE
              </span>

              <h2>
                Agenda operacional
              </h2>

              <p>
                Dias disponíveis e
                períodos comprometidos
                com atividades de campo.
              </p>
            </div>

            <div className="ftm-legend">
              <span>
                <i className="free" />
                Livre
              </span>

              <span>
                <i className="planned" />
                Planejado
              </span>

              <span>
                <i className="confirmed" />
                Confirmado
              </span>

              <span>
                <i className="active" />
                Em campo
              </span>
            </div>
          </div>

          <div className="ftm-weekdays">
            {WEEK_DAYS.map(
              (day) => (
                <span key={day}>
                  {day}
                </span>
              )
            )}
          </div>

          <div className="ftm-calendar">
            {calendarCells.map(
              (
                day,
                index
              ) => {
                if (!day) {
                  return (
                    <div
                      key={
                        `empty-${index}`
                      }
                      className="ftm-day empty"
                    />
                  );
                }

                const cellDate =
                  new Date(
                    selectedYear,
                    selectedMonth,
                    day
                  );

                const key =
                  dateKey(
                    cellDate
                  );

                const daySchedules =
                  occupationByDay.get(
                    key
                  ) || [];

                const isToday =
                  dateKey(today) ===
                  key;

                const dominant =
                  daySchedules.find(
                    (item) =>
                      item.status ===
                        "EM_CAMPO" ||
                      item.status ===
                        "EM_DESLOCAMENTO"
                  ) ||
                  daySchedules.find(
                    (item) =>
                      item.status ===
                      "CONFIRMADO"
                  ) ||
                  daySchedules[0];

                return (
                  <button
                    type="button"
                    key={key}
                    className={[
                      "ftm-day",
                      dominant
                        ? scheduleClass(
                            dominant.status
                          )
                        : "free",
                      isToday
                        ? "today"
                        : "",
                      selectedDay === key
                        ? "selected"
                        : "",
                    ]
                      .filter(
                        Boolean
                      )
                      .join(" ")}
                    onClick={() => {
                      setSelectedDay(
                        key
                      );
                      setDayPanelOpen(
                        true
                      );
                    }}
                  >
                    <span className="ftm-day-number">
                      {day}
                    </span>

                    {daySchedules
                      .slice(0, 2)
                      .map(
                        (
                          schedule
                        ) => (
                          <div
                            key={
                              schedule.id
                            }
                            className="ftm-day-event"
                            title={
                              schedule.title
                            }
                          >
                            {
                              schedule.title
                            }
                          </div>
                        )
                      )}

                    {daySchedules.length >
                      2 && (
                      <small>
                        +
                        {daySchedules.length -
                          2}{" "}
                        atividade(s)
                      </small>
                    )}
                  </button>
                );
              }
            )}
          </div>
        </article>

        <aside className="ftm-side-stack">
          <article className="ftm-panel">
            <div className="ftm-panel-heading compact">
              <div>
                <span className="eyebrow">
                  EQUIPE
                </span>

                <h2>
                  Disponibilidade
                </h2>
              </div>

              <Users
                size={20}
              />
            </div>

            {managers.length ===
            0 ? (
              <div className="ftm-empty-mini">
                Nenhum responsável
                programado neste mês.
              </div>
            ) : (
              <div className="ftm-manager-list">
                {managers.map(
                  (manager) => (
                    <div
                      key={
                        manager.id
                      }
                      className="ftm-manager"
                    >
                      <div className="ftm-manager-avatar">
                        {manager.name
                          .slice(
                            0,
                            1
                          )
                          .toUpperCase()}
                      </div>

                      <div>
                        <strong>
                          {
                            manager.name
                          }
                        </strong>

                        <span>
                          {
                            manager
                              .schedules
                              .length
                          }{" "}
                          atividade(s)
                        </span>
                      </div>
                    </div>
                  )
                )}
              </div>
            )}
          </article>

          <article className="ftm-panel">
            <div className="ftm-panel-heading compact">
              <div>
                <span className="eyebrow">
                  CAPACIDADE
                </span>

                <h2>
                  Ocupação mensal
                </h2>
              </div>

              <BriefcaseBusiness
                size={20}
              />
            </div>

            <div className="ftm-occupancy-ring">
              <div
                className="ftm-ring"
                style={{
                  ["--occupancy" as string]:
                    `${
                      daysInMonth
                        ? Math.round(
                            occupiedDays /
                              daysInMonth *
                              100
                          )
                        : 0
                    }%`,
                }}
              >
                <strong>
                  {daysInMonth
                    ? Math.round(
                        occupiedDays /
                          daysInMonth *
                          100
                      )
                    : 0}
                  %
                </strong>

                <span>
                  ocupado
                </span>
              </div>
            </div>
          </article>
        </aside>
      </div>

      <article className="ftm-panel ftm-trips-panel">
        <div className="ftm-panel-heading">
          <div>
            <span className="eyebrow">
              DESLOCAMENTOS
            </span>

            <h2>
              Viagens programadas
            </h2>

            <p>
              Roteiro operacional
              consolidado do mês.
            </p>
          </div>

          <Route
            size={22}
          />
        </div>

        {loading ? (
          <div className="ftm-empty">
            Carregando agenda...
          </div>
        ) : monthSchedules.length ===
          0 ? (
          <div className="ftm-empty">
            <CheckCircle2
              size={28}
            />

            <strong>
              Mês disponível
            </strong>

            <span>
              Não há viagens
              programadas para este
              período.
            </span>
          </div>
        ) : (
          <div className="ftm-trip-list">
            {[...monthSchedules]
              .sort(
                (a, b) =>
                  operationalDate(
                    a.startDate
                  ).getTime() -
                  operationalDate(
                    b.startDate
                  ).getTime()
              )
              .map(
                (
                  schedule,
                  index
                ) => (
                  <div
                    key={
                      schedule.id
                    }
                    className="ftm-trip"
                  >
                    <div className="ftm-trip-sequence">
                      <span>
                        {String(
                          index + 1
                        ).padStart(
                          2,
                          "0"
                        )}
                      </span>

                      <i />
                    </div>

                    <div className="ftm-trip-main">
                      <div className="ftm-trip-title">
                        <div>
                          <span
                            className={`ftm-status ${scheduleClass(
                              schedule.status
                            )}`}
                          >
                            {statusLabel(
                              schedule.status
                            )}
                          </span>

                          <strong>
                            {
                              schedule.title
                            }
                          </strong>
                        </div>

                        <span className="ftm-trip-type">
                          {typeLabel(
                            schedule.type
                          )}
                        </span>
                      </div>

                      <div className="ftm-trip-info">
                        <span>
                          <CalendarDays
                            size={15}
                          />

                          {formatDate(
                            schedule.startDate
                          )}

                          {schedule.endDate &&
                            schedule.endDate !==
                              schedule.startDate &&
                            ` a ${formatDate(
                              schedule.endDate
                            )}`}
                        </span>

                        <span>
                          <Clock3
                            size={15}
                          />

                          {schedule.departureTime ||
                            "Horário não definido"}
                        </span>

                        <span>
                          <MapPin
                            size={15}
                          />

                          {[
                            schedule.propertyName,
                            schedule.municipality &&
                            schedule.state
                              ? `${schedule.municipality}/${schedule.state}`
                              : schedule.municipality ||
                                schedule.state,
                          ]
                            .filter(
                              Boolean
                            )
                            .join(
                              " • "
                            ) ||
                            "Destino não informado"}
                        </span>

                        <span>
                          <Users
                            size={15}
                          />

                          {schedule.managers
                            ?.map(
                              (
                                item
                              ) =>
                                item.name
                            )
                            .join(
                              ", "
                            ) ||
                            "Equipe não definida"}
                        </span>
                      </div>
                    </div>
                  </div>
                )
              )}
          </div>
        )}
      </article>

      {dayPanelOpen && (
        <div
          className="ftm-day-overlay"
          onMouseDown={(event) => {
            if (
              event.target ===
              event.currentTarget
            ) {
              setDayPanelOpen(
                false
              );
            }
          }}
        >
          <aside className="ftm-day-drawer">
            <header className="ftm-day-drawer-header">
              <div>
                <span className="eyebrow">
                  DISPONIBILIDADE
                </span>

                <h2>
                  {selectedDayDate
                    ? new Intl.DateTimeFormat(
                        "pt-BR",
                        {
                          weekday:
                            "long",
                          day:
                            "2-digit",
                          month:
                            "long",
                          year:
                            "numeric",
                        }
                      ).format(
                        selectedDayDate
                      )
                    : "Dia selecionado"}
                </h2>

                <p>
                  Verificação operacional
                  da agenda da equipe.
                </p>
              </div>

              <button
                type="button"
                className="ftm-drawer-close"
                onClick={() =>
                  setDayPanelOpen(
                    false
                  )
                }
              >
                ×
              </button>
            </header>

            {selectedDaySchedules.length ===
            0 ? (
              <div className="ftm-day-available">
                <div className="ftm-available-icon">
                  <CheckCircle2
                    size={30}
                  />
                </div>

                <span>
                  DATA DISPONÍVEL
                </span>

                <strong>
                  Livre para nova
                  viagem
                </strong>

                <p>
                  Nenhuma atividade
                  externa está
                  programada para este
                  dia.
                </p>

                <Link
                  to="/app/cronograma-campo"
                  className="button primary"
                >
                  <PlaneTakeoff
                    size={17}
                  />
                  Programar saída
                </Link>
              </div>
            ) : (
              <>
                <div className="ftm-day-summary">
                  <article>
                    <span>
                      Atividades
                    </span>

                    <strong>
                      {
                        selectedDaySchedules.length
                      }
                    </strong>
                  </article>

                  <article>
                    <span>
                      Conflitos
                    </span>

                    <strong>
                      {
                        selectedDayConflicts.length
                      }
                    </strong>
                  </article>
                </div>

                {selectedDayConflicts.length >
                  0 && (
                  <div className="ftm-conflict-alert">
                    <AlertTriangle
                      size={20}
                    />

                    <div>
                      <strong>
                        Conflito de equipe
                        detectado
                      </strong>

                      {selectedDayConflicts.map(
                        (
                          conflict
                        ) => (
                          <span
                            key={
                              conflict.name
                            }
                          >
                            {
                              conflict.name
                            }{" "}
                            está alocado em{" "}
                            {
                              conflict
                                .schedules
                                .length
                            }{" "}
                            atividades.
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )}

                <div className="ftm-day-schedule-list">
                  {selectedDaySchedules.map(
                    (
                      schedule
                    ) => (
                      <article
                        key={
                          schedule.id
                        }
                        className="ftm-day-schedule-card"
                      >
                        <div className="ftm-day-schedule-heading">
                          <span
                            className={`ftm-status ${scheduleClass(
                              schedule.status
                            )}`}
                          >
                            {statusLabel(
                              schedule.status
                            )}
                          </span>

                          <span>
                            {typeLabel(
                              schedule.type
                            )}
                          </span>
                        </div>

                        <h3>
                          {
                            schedule.title
                          }
                        </h3>

                        <div className="ftm-day-schedule-details">
                          <span>
                            <MapPin
                              size={15}
                            />

                            {[
                              schedule.propertyName,
                              schedule.municipality &&
                              schedule.state
                                ? `${schedule.municipality}/${schedule.state}`
                                : schedule.municipality ||
                                  schedule.state,
                            ]
                              .filter(
                                Boolean
                              )
                              .join(
                                " • "
                              ) ||
                              "Destino não informado"}
                          </span>

                          <span>
                            <Clock3
                              size={15}
                            />

                            {schedule.departureTime ||
                              "Horário não informado"}
                          </span>

                          <span>
                            <Users
                              size={15}
                            />

                            {schedule.managers
                              ?.map(
                                (
                                  item
                                ) =>
                                  item.name
                              )
                              .join(
                                ", "
                              ) ||
                              "Equipe não definida"}
                          </span>
                        </div>
                      </article>
                    )
                  )}
                </div>
              </>
            )}
          </aside>
        </div>
      )}
    </section>
  );
}
