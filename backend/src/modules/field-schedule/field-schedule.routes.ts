import { Express } from "express";
import {
  FieldNotificationStatus,
  FieldScheduleStatus,
  FieldScheduleType,
  PrismaClient,
} from "@prisma/client";

type RegisterFieldScheduleRoutesParams = {
  app: Express;
  prisma: PrismaClient;
  authMiddleware: any;
  requireRoles: (roles: any[]) => any;

  createTransporterFromSettings: () => Promise<any>;
  getSmtpSettings: () => Promise<any>;
  getEmailImageAttachments: () => any[];
};

const FIELD_ROLES = [
  "GERENTE",
  "PROGRAMADOR",
];

const FIELD_TYPES = new Set(
  Object.values(FieldScheduleType)
);

const FIELD_STATUSES = new Set(
  Object.values(FieldScheduleStatus)
);

function escapeHtml(
  value?: string | null
) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function fieldScheduleTypeLabel(
  type: FieldScheduleType
) {
  const labels:
    Record<FieldScheduleType, string> = {
      GEORREFERENCIAMENTO:
        "Georreferenciamento",

      TOPOGRAFIA:
        "Topografia",

      DRONE:
        "Operação com Drone",

      INVENTARIO_FLORESTAL:
        "Inventário Florestal",

      VISTORIA_AMBIENTAL:
        "Vistoria Ambiental",

      LEVANTAMENTO_AMBIENTAL:
        "Levantamento Ambiental",

      OUTRO:
        "Outra atividade",
    };

  return labels[type];
}

function formatFieldDate(
  value: Date
) {
  return new Intl.DateTimeFormat(
    "pt-BR",
    {
      timeZone:
        "America/Belem",

      weekday:
        "long",

      day:
        "2-digit",

      month:
        "long",

      year:
        "numeric",
    }
  ).format(value);
}

function textOrNull(value: unknown) {
  const text =
    String(value ?? "").trim();

  return text || null;
}

function intOrNull(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.round(parsed);
}

function floatOrNull(value: unknown) {
  if (
    value === null ||
    value === undefined ||
    value === ""
  ) {
    return null;
  }

  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  return parsed;
}

function booleanValue(
  value: unknown,
  fallback = false
) {
  if (
    value === undefined ||
    value === null
  ) {
    return fallback;
  }

  if (typeof value === "boolean") {
    return value;
  }

  const normalized =
    String(value)
      .trim()
      .toLowerCase();

  return [
    "true",
    "1",
    "yes",
    "sim",
    "on",
  ].includes(normalized);
}

/*
 * A data operacional é recebida como YYYY-MM-DD.
 *
 * Armazenamos o dia às 12h no fuso -03:00 para evitar
 * deslocamento acidental de data no frontend.
 */
function operationalDate(
  value: unknown
) {
  if (!value) {
    return null;
  }

  const raw =
    String(value).trim();

  const match =
    raw.match(
      /^(\d{4})-(\d{2})-(\d{2})$/
    );

  if (match) {
    const date =
      new Date(
        `${raw}T12:00:00-03:00`
      );

    return Number.isNaN(
      date.getTime()
    )
      ? null
      : date;
  }

  const parsed =
    new Date(raw);

  return Number.isNaN(
    parsed.getTime()
  )
    ? null
    : parsed;
}

/*
 * Gera a data do alerta às 08:00 no fuso -03:00.
 *
 * A aritmética é feita sobre os componentes da data,
 * evitando depender do timezone da VPS.
 */
function notificationDate(
  startDate: Date,
  daysBefore: number
) {
  const year =
    Number(
      new Intl.DateTimeFormat(
        "en",
        {
          timeZone:
            "America/Belem",
          year: "numeric",
        }
      ).format(startDate)
    );

  const month =
    Number(
      new Intl.DateTimeFormat(
        "en",
        {
          timeZone:
            "America/Belem",
          month: "2-digit",
        }
      ).format(startDate)
    );

  const day =
    Number(
      new Intl.DateTimeFormat(
        "en",
        {
          timeZone:
            "America/Belem",
          day: "2-digit",
        }
      ).format(startDate)
    );

  const utc =
    new Date(
      Date.UTC(
        year,
        month - 1,
        day
      )
    );

  utc.setUTCDate(
    utc.getUTCDate() -
      daysBefore
  );

  const y =
    utc.getUTCFullYear();

  const m =
    String(
      utc.getUTCMonth() + 1
    ).padStart(2, "0");

  const d =
    String(
      utc.getUTCDate()
    ).padStart(2, "0");

  return new Date(
    `${y}-${m}-${d}T08:00:00-03:00`
  );
}

function normalizeManagerIds(
  value: unknown
) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) =>
          Number(item)
        )
        .filter(
          (item) =>
            Number.isInteger(item) &&
            item > 0
        )
    )
  );
}

async function resolveManagers(
  prisma: PrismaClient,
  managerIds: number[]
) {
  if (
    managerIds.length === 0
  ) {
    return [];
  }

  const managers =
    await prisma.user.findMany({
      where: {
        id: {
          in: managerIds,
        },

        active: true,

        role: {
          in: [
            "GERENTE",
            "PROGRAMADOR",
          ] as any,
        },
      },

      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

  if (
    managers.length !==
    managerIds.length
  ) {
    throw new Error(
      "Um ou mais responsáveis selecionados são inválidos ou estão inativos."
    );
  }

  return managers;
}

async function rebuildNotifications(
  prisma: PrismaClient,
  scheduleId: number
) {
  const schedule =
    await prisma.fieldSchedule.findUnique({
      where: {
        id: scheduleId,
      },

      include: {
        managers: true,
      },
    });

  if (!schedule) {
    throw new Error(
      "Cronograma não encontrado."
    );
  }

  /*
   * Só recriamos notificações ainda não enviadas.
   *
   * ENVIADO permanece como evidência histórica.
   */
  await prisma.fieldScheduleNotification.deleteMany({
    where: {
      scheduleId,

      status: {
        in: [
          FieldNotificationStatus.PENDENTE,
          FieldNotificationStatus.ERRO,
          FieldNotificationStatus.CANCELADO,
        ],
      },
    },
  });

  if (
    !schedule.alertEnabled ||
    schedule.status ===
      FieldScheduleStatus.CANCELADO ||
    schedule.status ===
      FieldScheduleStatus.CONCLUIDO
  ) {
    return;
  }

  const daysBefore =
    Math.max(
      0,
      schedule.alertDaysBefore
    );

  const scheduledFor =
    notificationDate(
      schedule.startDate,
      daysBefore
    );

  for (
    const manager
    of schedule.managers
  ) {
    const alreadySent =
      await prisma.fieldScheduleNotification.findFirst({
        where: {
          scheduleId,
          managerId:
            manager.id,
          daysBefore,
          status:
            FieldNotificationStatus.ENVIADO,
        },
      });

    if (alreadySent) {
      continue;
    }

    await prisma.fieldScheduleNotification.create({
      data: {
        scheduleId,

        managerId:
          manager.id,

        daysBefore,

        scheduledFor,

        recipientEmail:
          manager.email,

        status:
          FieldNotificationStatus.PENDENTE,

        subject:
          `Aviso de saída para campo — ${schedule.title}`,
      },
    });
  }
}


// ============================================================
// MOTOR CENTRAL DE CONFLITOS DO CRONOGRAMA DE CAMPO
// ============================================================

/**
 * Localiza atividades operacionais que conflitam com
 * determinado período e um ou mais responsáveis.
 *
 * Regras:
 *
 * - PLANEJADO não bloqueia outra atividade planejada;
 * - CONFIRMADO bloqueia;
 * - EM_DESLOCAMENTO bloqueia;
 * - EM_CAMPO bloqueia;
 * - CANCELADO, ADIADO e CONCLUIDO não bloqueiam;
 * - excludeScheduleId evita conflito da atividade consigo mesma.
 */
async function findBlockingFieldScheduleConflicts(
  prisma: PrismaClient,
  params: {
    managerIds: number[];
    startDate: Date;
    endDate?: Date | null;
    excludeScheduleId?: number | null;
  }
) {
  const managerIds =
    Array.from(
      new Set(
        params.managerIds
          .map(
            (id) =>
              Number(id)
          )
          .filter(
            (id) =>
              Number.isInteger(id) &&
              id > 0
          )
      )
    );

  if (
    managerIds.length === 0
  ) {
    return [];
  }

  const periodStart =
    params.startDate;

  const periodEnd =
    params.endDate ||
    params.startDate;

  const blockingStatuses: FieldScheduleStatus[] = [
    FieldScheduleStatus.CONFIRMADO,
    FieldScheduleStatus.EM_DESLOCAMENTO,
    FieldScheduleStatus.EM_CAMPO,
  ];

  const conflicts =
    await prisma.fieldSchedule.findMany({
      where: {
        ...(params.excludeScheduleId
          ? {
              id: {
                not:
                  params.excludeScheduleId,
              },
            }
          : {}),

        status: {
          in:
            blockingStatuses,
        },

        managers: {
          some: {
            userId: {
              in:
                managerIds,
            },
          },
        },

        /*
         * Sobreposição:
         *
         * atividade existente começa antes do fim solicitado
         * E
         * termina depois do início solicitado.
         *
         * Quando endDate é null, a atividade existente
         * ocupa apenas seu startDate.
         */
        AND: [
          {
            startDate: {
              lte:
                periodEnd,
            },
          },

          {
            OR: [
              {
                endDate: {
                  gte:
                    periodStart,
                },
              },

              {
                AND: [
                  {
                    endDate:
                      null,
                  },

                  {
                    startDate: {
                      gte:
                        periodStart,
                    },
                  },
                ],
              },
            ],
          },
        ],
      },

      include: {
        managers: {
          where: {
            userId: {
              in:
                managerIds,
            },
          },

          orderBy: {
            name:
              "asc",
          },
        },
      },

      orderBy: [
        {
          startDate:
            "asc",
        },

        {
          id:
            "asc",
        },
      ],
    });

  return conflicts;
}


/**
 * Normaliza a resposta enviada ao frontend quando existe
 * conflito de agenda.
 */
function buildFieldConflictResponse(
  conflicts: Array<any>
) {
  return conflicts.map(
    (schedule) => ({
      id:
        schedule.id,

      title:
        schedule.title,

      type:
        schedule.type,

      status:
        schedule.status,

      clientName:
        schedule.clientName ||
        null,

      propertyName:
        schedule.propertyName ||
        null,

      municipality:
        schedule.municipality ||
        null,

      state:
        schedule.state ||
        null,

      startDate:
        schedule.startDate,

      endDate:
        schedule.endDate ||
        null,

      departureTime:
        schedule.departureTime ||
        null,

      returnTime:
        schedule.returnTime ||
        null,

      managers:
        Array.isArray(
          schedule.managers
        )
          ? schedule.managers.map(
              (manager: any) => ({
                userId:
                  manager.userId,

                name:
                  manager.name,

                email:
                  manager.email,
              })
            )
          : [],
    })
  );
}


const scheduleInclude = {
  managers: {
    orderBy: {
      name: "asc" as const,
    },
  },

  notifications: {
    orderBy: {
      scheduledFor:
        "asc" as const,
    },
  },
};

export function registerFieldScheduleRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
  createTransporterFromSettings,
  getSmtpSettings,
  getEmailImageAttachments,
}: RegisterFieldScheduleRoutesParams) {

  // =====================================================
  // MOTOR DE NOTIFICAÇÕES
  // =====================================================

  async function processPendingNotifications(
    options?: {
      limit?: number;
    }
  ) {
    const limit =
      Math.min(
        100,
        Math.max(
          1,
          options?.limit ??
            50
        )
      );

    const now =
      new Date();

    const due =
      await prisma.fieldScheduleNotification.findMany({
        where: {
          status:
            FieldNotificationStatus.PENDENTE,

          scheduledFor: {
            lte:
              now,
          },
        },

        include: {
          schedule: true,
          manager: true,
        },

        orderBy: {
          scheduledFor:
            "asc",
        },

        take:
          limit,
      });

    const result = {
      found:
        due.length,

      sent:
        0,

      cancelled:
        0,

      errors:
        0,

      skipped:
        0,

      items:
        [] as Array<{
          id: number;
          status: string;
          recipient: string;
          message?: string;
        }>,
    };

    if (
      due.length === 0
    ) {
      return result;
    }

    const transporter =
      await createTransporterFromSettings();

    if (!transporter) {
      throw new Error(
        "SMTP não configurado corretamente."
      );
    }

    const smtp =
      await getSmtpSettings();

    for (
      const notification
      of due
    ) {
      /*
       * CLAIM ATÔMICO:
       *
       * somente um processo consegue transformar
       * PENDENTE -> PROCESSANDO.
       */
      const claimed =
        await prisma.fieldScheduleNotification.updateMany({
          where: {
            id:
              notification.id,

            status:
              FieldNotificationStatus.PENDENTE,
          },

          data: {
            status:
              FieldNotificationStatus.PROCESSANDO,

            errorText:
              null,
          },
        });

      if (
        claimed.count !== 1
      ) {
        result.skipped +=
          1;

        continue;
      }

      try {
        const schedule =
          notification.schedule;

        /*
         * Nunca enviamos aviso de atividade
         * encerrada, cancelada ou cujo alerta
         * foi posteriormente desativado.
         */
        if (
          !schedule.alertEnabled ||
          schedule.status ===
            FieldScheduleStatus.CANCELADO ||
          schedule.status ===
            FieldScheduleStatus.CONCLUIDO
        ) {
          await prisma.fieldScheduleNotification.update({
            where: {
              id:
                notification.id,
            },

            data: {
              status:
                FieldNotificationStatus.CANCELADO,

              errorText:
                null,
            },
          });

          result.cancelled +=
            1;

          result.items.push({
            id:
              notification.id,

            status:
              "CANCELADO",

            recipient:
              notification.recipientEmail,

            message:
              "Atividade cancelada, concluída ou com alerta desativado.",
          });

          continue;
        }

        const typeLabel =
          fieldScheduleTypeLabel(
            schedule.type
          );

        const place =
          [
            schedule.propertyName,
            schedule.municipality &&
            schedule.state
              ? `${schedule.municipality}/${schedule.state}`
              : schedule.municipality ||
                schedule.state,
          ]
            .filter(Boolean)
            .join(" — ");

        const locationDetails =
          [
            schedule.location,
            schedule.reference,
          ]
            .filter(Boolean)
            .join(" • ");

        const subject =
          notification.subject ||
          `Aviso de saída para campo — ${schedule.title}`;

        const content = `
          <div
            style="
              margin:0;
              padding:0;
              background:#f4f7f5;
              font-family:Arial,Helvetica,sans-serif;
              color:#10231b;
            "
          >
            <table
              role="presentation"
              width="100%"
              cellspacing="0"
              cellpadding="0"
              style="
                background:#f4f7f5;
                padding:24px 0;
              "
            >
              <tr>
                <td align="center">

                  <table
                    role="presentation"
                    width="760"
                    cellspacing="0"
                    cellpadding="0"
                    style="
                      width:760px;
                      max-width:96%;
                      background:#ffffff;
                      border-radius:18px;
                      overflow:hidden;
                      border:1px solid #dbe7e1;
                    "
                  >

                    <tr>
                      <td>
                        <img
                          src="cid:amazonika-header"
                          alt="AMAZÔNIKA Engenharia & Meio Ambiente"
                          style="
                            display:block;
                            width:100%;
                            max-width:760px;
                            height:auto;
                            border:0;
                          "
                        />
                      </td>
                    </tr>

                    <tr>
                      <td
                        style="
                          padding:34px 42px;
                        "
                      >

                        <div
                          style="
                            margin-bottom:8px;
                            color:#155e49;
                            font-size:11px;
                            font-weight:800;
                            letter-spacing:1.8px;
                            text-transform:uppercase;
                          "
                        >
                          Cronograma de Campo
                        </div>

                        <h1
                          style="
                            margin:0 0 12px;
                            color:#17372d;
                            font-size:28px;
                            line-height:1.15;
                          "
                        >
                          Aviso de saída para campo
                        </h1>

                        <p
                          style="
                            margin:0 0 24px;
                            color:#5f7067;
                            font-size:16px;
                            line-height:1.6;
                          "
                        >
                          Olá,
                          <strong>
                            ${escapeHtml(
                              notification.manager.name
                            )}
                          </strong>.
                          Há uma atividade de campo programada
                          para os próximos
                          <strong>
                            ${notification.daysBefore}
                            dia(s)
                          </strong>.
                        </p>

                        <div
                          style="
                            padding:20px;
                            margin-bottom:20px;
                            background:#f5f9f7;
                            border:1px solid #dae8e1;
                            border-radius:15px;
                          "
                        >
                          <div
                            style="
                              color:#74837b;
                              font-size:10px;
                              font-weight:bold;
                              letter-spacing:1px;
                              text-transform:uppercase;
                              margin-bottom:6px;
                            "
                          >
                            Atividade
                          </div>

                          <strong
                            style="
                              display:block;
                              color:#153d30;
                              font-size:19px;
                            "
                          >
                            ${escapeHtml(
                              schedule.title
                            )}
                          </strong>

                          <span
                            style="
                              display:block;
                              margin-top:5px;
                              color:#68776f;
                              font-size:13px;
                            "
                          >
                            ${escapeHtml(
                              typeLabel
                            )}
                          </span>
                        </div>

                        <table
                          role="presentation"
                          width="100%"
                          cellspacing="0"
                          cellpadding="0"
                        >

                          <tr>
                            <td
                              style="
                                padding:12px 0;
                                border-bottom:1px solid #edf1ef;
                                color:#718078;
                                width:170px;
                              "
                            >
                              Data da saída
                            </td>

                            <td
                              style="
                                padding:12px 0;
                                border-bottom:1px solid #edf1ef;
                                color:#192d25;
                                font-weight:bold;
                              "
                            >
                              ${escapeHtml(
                                formatFieldDate(
                                  schedule.startDate
                                )
                              )}
                            </td>
                          </tr>

                          ${
                            schedule.departureTime
                              ? `
                                <tr>
                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#718078;
                                    "
                                  >
                                    Horário previsto
                                  </td>

                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#192d25;
                                      font-weight:bold;
                                    "
                                  >
                                    ${escapeHtml(
                                      schedule.departureTime
                                    )}
                                  </td>
                                </tr>
                              `
                              : ""
                          }

                          ${
                            schedule.clientName
                              ? `
                                <tr>
                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#718078;
                                    "
                                  >
                                    Cliente
                                  </td>

                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#192d25;
                                      font-weight:bold;
                                    "
                                  >
                                    ${escapeHtml(
                                      schedule.clientName
                                    )}
                                  </td>
                                </tr>
                              `
                              : ""
                          }

                          ${
                            place
                              ? `
                                <tr>
                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#718078;
                                    "
                                  >
                                    Imóvel / Município
                                  </td>

                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#192d25;
                                      font-weight:bold;
                                    "
                                  >
                                    ${escapeHtml(
                                      place
                                    )}
                                  </td>
                                </tr>
                              `
                              : ""
                          }

                          ${
                            schedule.meetingPoint
                              ? `
                                <tr>
                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#718078;
                                    "
                                  >
                                    Ponto de encontro
                                  </td>

                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#192d25;
                                      font-weight:bold;
                                    "
                                  >
                                    ${escapeHtml(
                                      schedule.meetingPoint
                                    )}
                                  </td>
                                </tr>
                              `
                              : ""
                          }

                          ${
                            locationDetails
                              ? `
                                <tr>
                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#718078;
                                    "
                                  >
                                    Localização
                                  </td>

                                  <td
                                    style="
                                      padding:12px 0;
                                      border-bottom:1px solid #edf1ef;
                                      color:#192d25;
                                    "
                                  >
                                    ${escapeHtml(
                                      locationDetails
                                    )}
                                  </td>
                                </tr>
                              `
                              : ""
                          }

                        </table>

                        ${
                          schedule.description
                            ? `
                              <div
                                style="
                                  margin-top:22px;
                                  padding:16px 18px;
                                  background:#f8faf9;
                                  border-left:4px solid #155e49;
                                  color:#42554c;
                                  font-size:14px;
                                  line-height:1.6;
                                "
                              >
                                ${escapeHtml(
                                  schedule.description
                                )}
                              </div>
                            `
                            : ""
                        }

                        ${
                          schedule.notes
                            ? `
                              <div
                                style="
                                  margin-top:14px;
                                  padding:14px 16px;
                                  background:#fff9e9;
                                  border:1px solid #f0e4bc;
                                  border-radius:12px;
                                  color:#665629;
                                  font-size:13px;
                                  line-height:1.55;
                                "
                              >
                                <strong>
                                  Observações:
                                </strong><br/>
                                ${escapeHtml(
                                  schedule.notes
                                )}
                              </div>
                            `
                            : ""
                        }

                        <p
                          style="
                            margin:26px 0 0;
                            color:#65766d;
                            font-size:13px;
                            line-height:1.55;
                          "
                        >
                          Esta mensagem foi gerada
                          automaticamente pelo SIS Amazonika
                          conforme o Cronograma de Campo.
                        </p>

                        <p
                          style="
                            margin:24px 0 0;
                            font-size:14px;
                            line-height:1.5;
                          "
                        >
                          Atenciosamente,<br/>
                          <strong
                            style="
                              color:#155e49;
                            "
                          >
                            SIS Amazonika
                          </strong>
                        </p>

                      </td>
                    </tr>

                    <tr>
                      <td>
                        <img
                          src="cid:amazonika-footer"
                          alt="AMAZÔNIKA Engenharia & Meio Ambiente"
                          style="
                            display:block;
                            width:100%;
                            max-width:760px;
                            height:auto;
                            border:0;
                          "
                        />
                      </td>
                    </tr>

                  </table>

                </td>
              </tr>
            </table>
          </div>
        `;

        const info =
          await transporter.sendMail({
            from:
              smtp.smtpFrom,

            to:
              notification.recipientEmail,

            subject,

            html:
              content,

            attachments:
              getEmailImageAttachments(),
          });

        await prisma.fieldScheduleNotification.update({
          where: {
            id:
              notification.id,
          },

          data: {
            status:
              FieldNotificationStatus.ENVIADO,

            sentAt:
              new Date(),

            subject,

            messageId:
              info.messageId ||
              null,

            errorText:
              null,
          },
        });

        result.sent +=
          1;

        result.items.push({
          id:
            notification.id,

          status:
            "ENVIADO",

          recipient:
            notification.recipientEmail,

          message:
            info.messageId ||
            undefined,
        });
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : String(error);

        await prisma.fieldScheduleNotification.update({
          where: {
            id:
              notification.id,
          },

          data: {
            status:
              FieldNotificationStatus.ERRO,

            errorText:
              message.slice(
                0,
                2000
              ),
          },
        });

        result.errors +=
          1;

        result.items.push({
          id:
            notification.id,

          status:
            "ERRO",

          recipient:
            notification.recipientEmail,

          message,
        });

        console.error(
          `Erro ao enviar alerta de campo ${notification.id}:`,
          error
        );
      }
    }

    return result;
  }


  // =====================================================
  // PROCESSAMENTO MANUAL DOS ALERTAS
  // =====================================================

  app.post(
    "/field-schedules/process-notifications",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req, res) => {
      try {
        const limit =
          req.body?.limit !==
          undefined
            ? Number(
                req.body.limit
              )
            : 50;

        const result =
          await processPendingNotifications({
            limit:
              Number.isFinite(limit)
                ? limit
                : 50,
          });

        return res.json({
          message:
            "Processamento de alertas concluído.",

          ...result,
        });
      } catch (error) {
        console.error(
          "Erro ao processar alertas de campo:",
          error
        );

        return res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Erro ao processar alertas.",
        });
      }
    }
  );


  // =====================================================
  // REPROCESSAR ALERTA COM ERRO
  // =====================================================

  app.post(
    "/field-schedules/notifications/:id/retry",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req, res) => {
      try {
        const id =
          Number(
            req.params.id
          );

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return res.status(400).json({
            message:
              "ID da notificação inválido.",
          });
        }

        const notification =
          await prisma.fieldScheduleNotification.findUnique({
            where: {
              id,
            },

            include: {
              schedule: true,
            },
          });

        if (!notification) {
          return res.status(404).json({
            message:
              "Notificação não encontrada.",
          });
        }

        if (
          notification.status !==
          FieldNotificationStatus.ERRO
        ) {
          return res.status(409).json({
            message:
              "Somente alertas com erro podem ser reenfileirados.",
          });
        }

        await prisma.fieldScheduleNotification.update({
          where: {
            id,
          },

          data: {
            status:
              FieldNotificationStatus.PENDENTE,

            errorText:
              null,

            scheduledFor:
              new Date(),
          },
        });

        return res.json({
          message:
            "Alerta reenfileirado com sucesso.",
        });
      } catch (error) {
        console.error(
          "Erro ao reenfileirar alerta:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao reenfileirar alerta.",
        });
      }
    }
  );


  // =====================================================
  // PROCESSAMENTO AUTOMÁTICO — CRON / VPS
  // =====================================================

  app.post(
    "/internal/field-schedules/process-notifications",
    async (req: any, res) => {
      try {
        const configuredSecret =
          String(
            process.env.FIELD_CRON_SECRET || ""
          ).trim();

        if (!configuredSecret) {
          console.error(
            "FIELD_CRON_SECRET não configurado."
          );

          return res.status(503).json({
            message:
              "Processador automático não configurado.",
          });
        }

        const receivedSecret =
          String(
            req.headers[
              "x-field-cron-secret"
            ] || ""
          ).trim();

        if (
          !receivedSecret ||
          receivedSecret !== configuredSecret
        ) {
          return res.status(401).json({
            message:
              "Credencial do processador inválida.",
          });
        }

        const result =
          await processPendingNotifications({
            limit: 100,
          });

        return res.json({
          message:
            "Processamento automático concluído.",
          result,
          processedAt:
            new Date().toISOString(),
        });
      } catch (error) {
        console.error(
          "Erro no processamento automático "
            + "dos alertas de campo:",
          error
        );

        return res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Erro ao processar alertas.",
        });
      }
    }
  );


  // =====================================================
  // RESUMO
  // =====================================================

  app.get(
    "/field-schedules/summary",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (_req, res) => {
      try {
        const now =
          new Date();

        const sevenDays =
          new Date(
            now.getTime() +
              7 *
                24 *
                60 *
                60 *
                1000
          );

        const [
          total,
          planned,
          confirmed,
          inField,
          upcoming,
          pendingAlerts,
          alertErrors,
        ] =
          await Promise.all([
            prisma.fieldSchedule.count(),

            prisma.fieldSchedule.count({
              where: {
                status:
                  FieldScheduleStatus.PLANEJADO,
              },
            }),

            prisma.fieldSchedule.count({
              where: {
                status:
                  FieldScheduleStatus.CONFIRMADO,
              },
            }),

            prisma.fieldSchedule.count({
              where: {
                status:
                  FieldScheduleStatus.EM_CAMPO,
              },
            }),

            prisma.fieldSchedule.count({
              where: {
                startDate: {
                  gte: now,
                  lte: sevenDays,
                },

                status: {
                  notIn: [
                    FieldScheduleStatus.CANCELADO,
                    FieldScheduleStatus.CONCLUIDO,
                  ],
                },
              },
            }),

            prisma.fieldScheduleNotification.count({
              where: {
                status:
                  FieldNotificationStatus.PENDENTE,
              },
            }),

            prisma.fieldScheduleNotification.count({
              where: {
                status:
                  FieldNotificationStatus.ERRO,
              },
            }),
          ]);

        return res.json({
          total,
          planned,
          confirmed,
          inField,
          upcoming,
          pendingAlerts,
          alertErrors,
        });
      } catch (error) {
        console.error(
          "Erro ao carregar resumo do cronograma:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao carregar resumo do cronograma.",
        });
      }
    }
  );

  // =====================================================
  // GERENTES / RESPONSÁVEIS DISPONÍVEIS
  // =====================================================

  app.get(
    "/field-schedules/managers",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (_req, res) => {
      try {
        const managers =
          await prisma.user.findMany({
            where: {
              active: true,

              role: {
                in: [
                  "GERENTE",
                  "PROGRAMADOR",
                ] as any,
              },
            },

            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },

            orderBy: {
              name: "asc",
            },
          });

        return res.json(
          managers
        );
      } catch (error) {
        console.error(
          "Erro ao listar responsáveis do cronograma:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao listar responsáveis.",
        });
      }
    }
  );

  // =====================================================
  // LISTAGEM
  // =====================================================

  app.get(
    "/field-schedules",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req, res) => {
      try {
        const search =
          String(
            req.query?.search ||
              ""
          ).trim();

        const status =
          String(
            req.query?.status ||
              ""
          ).trim();

        const type =
          String(
            req.query?.type ||
              ""
          ).trim();

        const from =
          operationalDate(
            req.query?.from
          );

        const to =
          operationalDate(
            req.query?.to
          );

        const where: any = {};

        if (search) {
          where.OR = [
            {
              title: {
                contains:
                  search,
              },
            },
            {
              clientName: {
                contains:
                  search,
              },
            },
            {
              propertyName: {
                contains:
                  search,
              },
            },
            {
              municipality: {
                contains:
                  search,
              },
            },
          ];
        }

        if (
          status &&
          FIELD_STATUSES.has(
            status as FieldScheduleStatus
          )
        ) {
          where.status =
            status;
        }

        if (
          type &&
          FIELD_TYPES.has(
            type as FieldScheduleType
          )
        ) {
          where.type =
            type;
        }

        if (
          from ||
          to
        ) {
          where.startDate = {};

          if (from) {
            where.startDate.gte =
              from;
          }

          if (to) {
            const end =
              new Date(
                to.getTime() +
                  24 *
                    60 *
                    60 *
                    1000
              );

            where.startDate.lt =
              end;
          }
        }

        const schedules =
          await prisma.fieldSchedule.findMany({
            where,

            include:
              scheduleInclude,

            orderBy: [
              {
                startDate:
                  "asc",
              },
              {
                id: "asc",
              },
            ],
          });

        return res.json(
          schedules
        );
      } catch (error) {
        console.error(
          "Erro ao listar cronograma de campo:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao listar cronograma de campo.",
        });
      }
    }
  );

  // =====================================================
  // DETALHE
  // =====================================================

  app.get(
    "/field-schedules/:id",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req, res) => {
      try {
        const id =
          Number(
            req.params.id
          );

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return res.status(400).json({
            message:
              "ID do cronograma inválido.",
          });
        }

        const schedule =
          await prisma.fieldSchedule.findUnique({
            where: {
              id,
            },

            include:
              scheduleInclude,
          });

        if (!schedule) {
          return res.status(404).json({
            message:
              "Atividade de campo não encontrada.",
          });
        }

        return res.json(
          schedule
        );
      } catch (error) {
        console.error(
          "Erro ao carregar atividade de campo:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao carregar atividade de campo.",
        });
      }
    }
  );

  // =====================================================
  // CRIAÇÃO
  // =====================================================

  app.post(
    "/field-schedules",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req: any, res) => {
      try {
        const title =
          String(
            req.body?.title ||
              ""
          ).trim();

        if (!title) {
          return res.status(400).json({
            message:
              "Informe o título da atividade.",
          });
        }

        const type =
          String(
            req.body?.type ||
              ""
          ).trim() as FieldScheduleType;

        if (
          !FIELD_TYPES.has(type)
        ) {
          return res.status(400).json({
            message:
              "Informe um tipo de atividade válido.",
          });
        }

        const startDate =
          operationalDate(
            req.body?.startDate
          );

        if (!startDate) {
          return res.status(400).json({
            message:
              "Informe uma data de saída válida.",
          });
        }

        const endDate =
          req.body?.endDate
            ? operationalDate(
                req.body.endDate
              )
            : null;

        if (
          endDate &&
          endDate <
            startDate
        ) {
          return res.status(400).json({
            message:
              "A data de retorno não pode ser anterior à saída.",
          });
        }

        const managerIds =
          normalizeManagerIds(
            req.body?.managerIds
          );

        const managers =
          await resolveManagers(
            prisma,
            managerIds
          );

        const alertEnabled =
          booleanValue(
            req.body?.alertEnabled,
            true
          );

        const alertDaysBefore =
          Math.max(
            0,
            intOrNull(
              req.body
                ?.alertDaysBefore
            ) ?? 3
          );

        const schedule =
          await prisma.fieldSchedule.create({
            data: {
              title,

              description:
                textOrNull(
                  req.body
                    ?.description
                ),

              type,

              status:
                FieldScheduleStatus.PLANEJADO,

              clientName:
                textOrNull(
                  req.body
                    ?.clientName
                ),

              propertyName:
                textOrNull(
                  req.body
                    ?.propertyName
                ),

              municipality:
                textOrNull(
                  req.body
                    ?.municipality
                ),

              state:
                textOrNull(
                  req.body?.state
                )
                  ?.toUpperCase()
                  .slice(0, 2) ||
                null,

              location:
                textOrNull(
                  req.body
                    ?.location
                ),

              reference:
                textOrNull(
                  req.body
                    ?.reference
                ),

              latitude:
                floatOrNull(
                  req.body
                    ?.latitude
                ),

              longitude:
                floatOrNull(
                  req.body
                    ?.longitude
                ),

              startDate,
              endDate,

              departureTime:
                textOrNull(
                  req.body
                    ?.departureTime
                ),

              returnTime:
                textOrNull(
                  req.body
                    ?.returnTime
                ),

              meetingPoint:
                textOrNull(
                  req.body
                    ?.meetingPoint
                ),

              alertEnabled,

              alertDaysBefore,

              notes:
                textOrNull(
                  req.body?.notes
                ),

              createdById:
                req.user?.id ||
                null,

              managers: {
                create:
                  managers.map(
                    (manager) => ({
                      userId:
                        manager.id,

                      name:
                        manager.name,

                      email:
                        manager.email,
                    })
                  ),
              },
            },

            include:
              scheduleInclude,
          });

        await rebuildNotifications(
          prisma,
          schedule.id
        );

        const refreshed =
          await prisma.fieldSchedule.findUnique({
            where: {
              id:
                schedule.id,
            },

            include:
              scheduleInclude,
          });

        return res
          .status(201)
          .json(refreshed);
      } catch (error) {
        console.error(
          "Erro ao cadastrar atividade de campo:",
          error
        );

        return res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Erro ao cadastrar atividade de campo.",
        });
      }
    }
  );

  // =====================================================
  // EDIÇÃO
  // =====================================================

  app.put(
    "/field-schedules/:id",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req: any, res) => {
      try {
        const id =
          Number(
            req.params.id
          );

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return res.status(400).json({
            message:
              "ID do cronograma inválido.",
          });
        }

        const existing =
          await prisma.fieldSchedule.findUnique({
            where: {
              id,
            },
          });

        if (!existing) {
          return res.status(404).json({
            message:
              "Atividade de campo não encontrada.",
          });
        }

        const title =
          req.body?.title !==
          undefined
            ? String(
                req.body.title
              ).trim()
            : existing.title;

        if (!title) {
          return res.status(400).json({
            message:
              "Informe o título da atividade.",
          });
        }

        const type =
          req.body?.type !==
          undefined
            ? String(
                req.body.type
              ) as FieldScheduleType
            : existing.type;

        if (
          !FIELD_TYPES.has(type)
        ) {
          return res.status(400).json({
            message:
              "Tipo de atividade inválido.",
          });
        }

        const startDate =
          req.body?.startDate !==
          undefined
            ? operationalDate(
                req.body.startDate
              )
            : existing.startDate;

        if (!startDate) {
          return res.status(400).json({
            message:
              "Informe uma data de saída válida.",
          });
        }

        const endDate =
          req.body?.endDate !==
          undefined
            ? (
                req.body.endDate
                  ? operationalDate(
                      req.body
                        .endDate
                    )
                  : null
              )
            : existing.endDate;

        if (
          endDate &&
          endDate <
            startDate
        ) {
          return res.status(400).json({
            message:
              "A data de retorno não pode ser anterior à saída.",
          });
        }

        let managers:
          Awaited<
            ReturnType<
              typeof resolveManagers
            >
          > | null = null;

        if (
          req.body
            ?.managerIds !==
          undefined
        ) {
          managers =
            await resolveManagers(
              prisma,
              normalizeManagerIds(
                req.body
                  .managerIds
              )
            );
        }

        await prisma.$transaction(
          async (tx) => {
            await tx.fieldSchedule.update({
              where: {
                id,
              },

              data: {
                title,

                description:
                  req.body
                    ?.description !==
                  undefined
                    ? textOrNull(
                        req.body
                          .description
                      )
                    : existing.description,

                type,

                clientName:
                  req.body
                    ?.clientName !==
                  undefined
                    ? textOrNull(
                        req.body
                          .clientName
                      )
                    : existing.clientName,

                propertyName:
                  req.body
                    ?.propertyName !==
                  undefined
                    ? textOrNull(
                        req.body
                          .propertyName
                      )
                    : existing.propertyName,

                municipality:
                  req.body
                    ?.municipality !==
                  undefined
                    ? textOrNull(
                        req.body
                          .municipality
                      )
                    : existing.municipality,

                state:
                  req.body
                    ?.state !==
                  undefined
                    ? (
                        textOrNull(
                          req.body.state
                        )
                          ?.toUpperCase()
                          .slice(
                            0,
                            2
                          ) ||
                        null
                      )
                    : existing.state,

                location:
                  req.body
                    ?.location !==
                  undefined
                    ? textOrNull(
                        req.body
                          .location
                      )
                    : existing.location,

                reference:
                  req.body
                    ?.reference !==
                  undefined
                    ? textOrNull(
                        req.body
                          .reference
                      )
                    : existing.reference,

                latitude:
                  req.body
                    ?.latitude !==
                  undefined
                    ? floatOrNull(
                        req.body
                          .latitude
                      )
                    : existing.latitude,

                longitude:
                  req.body
                    ?.longitude !==
                  undefined
                    ? floatOrNull(
                        req.body
                          .longitude
                      )
                    : existing.longitude,

                startDate,
                endDate,

                departureTime:
                  req.body
                    ?.departureTime !==
                  undefined
                    ? textOrNull(
                        req.body
                          .departureTime
                      )
                    : existing.departureTime,

                returnTime:
                  req.body
                    ?.returnTime !==
                  undefined
                    ? textOrNull(
                        req.body
                          .returnTime
                      )
                    : existing.returnTime,

                meetingPoint:
                  req.body
                    ?.meetingPoint !==
                  undefined
                    ? textOrNull(
                        req.body
                          .meetingPoint
                      )
                    : existing.meetingPoint,

                alertEnabled:
                  req.body
                    ?.alertEnabled !==
                  undefined
                    ? booleanValue(
                        req.body
                          .alertEnabled,
                        existing.alertEnabled
                      )
                    : existing.alertEnabled,

                alertDaysBefore:
                  req.body
                    ?.alertDaysBefore !==
                  undefined
                    ? Math.max(
                        0,
                        intOrNull(
                          req.body
                            .alertDaysBefore
                        ) ?? 3
                      )
                    : existing.alertDaysBefore,

                notes:
                  req.body?.notes !==
                  undefined
                    ? textOrNull(
                        req.body.notes
                      )
                    : existing.notes,
              },
            });

            if (managers) {
              /*
               * Só removemos managers cujas notificações
               * ainda não foram efetivamente enviadas.
               *
               * Como o histórico enviado deve ser preservado,
               * as notificações ENVIADO serão mantidas.
               */
              await tx.fieldScheduleNotification.deleteMany({
                where: {
                  scheduleId:
                    id,

                  status: {
                    not:
                      FieldNotificationStatus.ENVIADO,
                  },
                },
              });

              const sentManagerIds =
                await tx.fieldScheduleNotification.findMany({
                  where: {
                    scheduleId:
                      id,

                    status:
                      FieldNotificationStatus.ENVIADO,
                  },

                  select: {
                    managerId:
                      true,
                  },
                });

              const protectedIds =
                new Set(
                  sentManagerIds.map(
                    (item) =>
                      item.managerId
                  )
                );

              await tx.fieldScheduleManager.deleteMany({
                where: {
                  scheduleId:
                    id,

                  id: {
                    notIn:
                      Array.from(
                        protectedIds
                      ),
                  },
                },
              });

              const current =
                await tx.fieldScheduleManager.findMany({
                  where: {
                    scheduleId:
                      id,
                  },

                  select: {
                    userId: true,
                  },
                });

              const currentIds =
                new Set(
                  current.map(
                    (item) =>
                      item.userId
                  )
                );

              for (
                const manager
                of managers
              ) {
                if (
                  currentIds.has(
                    manager.id
                  )
                ) {
                  continue;
                }

                await tx.fieldScheduleManager.create({
                  data: {
                    scheduleId:
                      id,

                    userId:
                      manager.id,

                    name:
                      manager.name,

                    email:
                      manager.email,
                  },
                });
              }
            }
          }
        );

        await rebuildNotifications(
          prisma,
          id
        );

        const refreshed =
          await prisma.fieldSchedule.findUnique({
            where: {
              id,
            },

            include:
              scheduleInclude,
          });

        return res.json(
          refreshed
        );
      } catch (error) {
        console.error(
          "Erro ao atualizar atividade de campo:",
          error
        );

        return res.status(500).json({
          message:
            error instanceof Error
              ? error.message
              : "Erro ao atualizar atividade de campo.",
        });
      }
    }
  );

  // =====================================================
  // ALTERAÇÃO DE STATUS
  // =====================================================

  app.patch(
    "/field-schedules/:id/status",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req, res) => {
      try {
        const id =
          Number(
            req.params.id
          );

        const status =
          String(
            req.body?.status ||
              ""
          ) as FieldScheduleStatus;

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return res.status(400).json({
            message:
              "ID do cronograma inválido.",
          });
        }

        if (
          !FIELD_STATUSES.has(
            status
          )
        ) {
          return res.status(400).json({
            message:
              "Status inválido.",
          });
        }

        const existing =
          await prisma.fieldSchedule.findUnique({
            where: {
              id,
            },
          });

        if (!existing) {
          return res.status(404).json({
            message:
              "Atividade de campo não encontrada.",
          });
        }

        
        /*
         * ==================================================
         * VALIDAÇÃO DE CONFLITO NA CONFIRMAÇÃO
         * ==================================================
         *
         * Duas atividades podem permanecer PLANEJADAS.
         *
         * Entretanto, antes de assumir um estado operacional
         * efetivo, a disponibilidade dos responsáveis é
         * novamente validada.
         */
        const targetStatusForConflict =
          String(
            req.body?.status ||
            ""
          ).trim() as FieldScheduleStatus;

        const blockingTargetStatuses =
          new Set<FieldScheduleStatus>([
            FieldScheduleStatus.CONFIRMADO,
            FieldScheduleStatus.EM_DESLOCAMENTO,
            FieldScheduleStatus.EM_CAMPO,
          ]);

        if (
          blockingTargetStatuses.has(
            targetStatusForConflict
          )
        ) {
          const scheduleForConflict =
            await prisma.fieldSchedule.findUnique({
              where: {
                id,
              },

              include: {
                managers: {
                  select: {
                    userId: true,
                    name: true,
                    email: true,
                  },
                },
              },
            });

          if (
            !scheduleForConflict
          ) {
            return res.status(404).json({
              message:
                "Atividade de campo não encontrada.",
            });
          }

          const managerIdsForConflict =
            scheduleForConflict.managers.map(
              (manager) =>
                manager.userId
            );

          const blockingConflicts =
            await findBlockingFieldScheduleConflicts(
              prisma,
              {
                managerIds:
                  managerIdsForConflict,

                startDate:
                  scheduleForConflict.startDate,

                endDate:
                  scheduleForConflict.endDate,

                excludeScheduleId:
                  scheduleForConflict.id,
              }
            );

          if (
            blockingConflicts.length >
            0
          ) {
            const firstConflict =
              blockingConflicts[0];

            const conflictingManagers =
              firstConflict.managers
                .map(
                  (manager) =>
                    manager.name
                )
                .join(", ");

            return res.status(409).json({
              code:
                "FIELD_SCHEDULE_STATUS_CONFLICT",

              message:
                `Não foi possível confirmar esta atividade. ${
                  conflictingManagers ||
                  "Um dos responsáveis"
                } já está comprometido com "${firstConflict.title}" no mesmo período.`,

              requestedStatus:
                targetStatusForConflict,

              conflicts:
                buildFieldConflictResponse(
                  blockingConflicts
                ),
            });
          }
        }

await prisma.fieldSchedule.update({
          where: {
            id,
          },

          data: {
            status,
          },
        });

        if (
          status ===
            FieldScheduleStatus.CANCELADO ||
          status ===
            FieldScheduleStatus.CONCLUIDO
        ) {
          await prisma.fieldScheduleNotification.updateMany({
            where: {
              scheduleId:
                id,

              status:
                FieldNotificationStatus.PENDENTE,
            },

            data: {
              status:
                FieldNotificationStatus.CANCELADO,
            },
          });
        } else {
          await rebuildNotifications(
            prisma,
            id
          );
        }

        const refreshed =
          await prisma.fieldSchedule.findUnique({
            where: {
              id,
            },

            include:
              scheduleInclude,
          });

        return res.json(
          refreshed
        );
      } catch (error) {
        console.error(
          "Erro ao alterar status do cronograma:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao alterar status do cronograma.",
        });
      }
    }
  );

  // =====================================================
  // EXCLUSÃO
  // =====================================================

  app.delete(
    "/field-schedules/:id",
    authMiddleware,
    requireRoles(FIELD_ROLES),
    async (req, res) => {
      try {
        const id =
          Number(
            req.params.id
          );

        if (
          !Number.isInteger(id) ||
          id <= 0
        ) {
          return res.status(400).json({
            message:
              "ID do cronograma inválido.",
          });
        }

        const existing =
          await prisma.fieldSchedule.findUnique({
            where: {
              id,
            },
          });

        if (!existing) {
          return res.status(404).json({
            message:
              "Atividade de campo não encontrada.",
          });
        }

        /*
         * Cronograma com alerta já enviado passa a fazer
         * parte da rastreabilidade operacional.
         * Nesse caso não permitimos exclusão física.
         */
        const sentNotifications =
          await prisma.fieldScheduleNotification.count({
            where: {
              scheduleId:
                id,

              status:
                FieldNotificationStatus.ENVIADO,
            },
          });

        if (
          sentNotifications > 0
        ) {
          return res.status(409).json({
            message:
              "Esta atividade possui alertas já enviados. Cancele a atividade em vez de excluí-la.",
          });
        }

        await prisma.fieldSchedule.delete({
          where: {
            id,
          },
        });

        return res.json({
          message:
            "Atividade removida com sucesso.",
        });
      } catch (error) {
        console.error(
          "Erro ao remover atividade de campo:",
          error
        );

        return res.status(500).json({
          message:
            "Erro ao remover atividade de campo.",
        });
      }
    }
  );
}
