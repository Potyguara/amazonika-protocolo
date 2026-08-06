import "dotenv/config";
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { PrismaClient } from "@prisma/client";
import multer from "multer";
import path from "path";
import fs from "fs";
import nodemailer from "nodemailer";
import PDFDocument from "pdfkit";
import crypto from "crypto";
import { registerPartnerRoutes } from "./modules/partners/partners.routes";
import { registerPartnerReferralRoutes } from "./modules/partners/partner-referrals.routes";


import {
  createBbPixCharge,
  createBbPixDueCharge,
  getBbPixCharge,
} from "./services/bbPixService";

type UserRole = "CLIENTE" | "ATENDENTE" | "GERENTE" | "PROGRAMADOR";

const prisma = new PrismaClient();

const app = express();

app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use("/email", express.static(path.join(process.cwd(), "public", "email")));

const uploadsDir = path.resolve(process.cwd(), "uploads", "documents");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

app.use("/uploads", express.static(path.resolve(process.cwd(), "uploads")));

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadsDir);
  },
  filename: (_req, file, callback) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const safeOriginal = file.originalname.replace(/[^\w.\-]+/g, "_");
    callback(null, `${unique}-${safeOriginal}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

const PORT = Number(process.env.PORT || 3333);
const JWT_SECRET = process.env.JWT_SECRET || "amazonika-local-dev-secret";

type AuthRequest = Request & {
  user?: {
    id: number;
    name: string;
    email: string;
    role: UserRole;
  };
};

function generateBillingChargeReissueTxid(chargeId: number) {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = crypto.randomBytes(4).toString("hex").toUpperCase();

  return `AMZ${String(chargeId).padStart(6, "0")}${timestamp}${random}`
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 35);
}

function generateBillingChargeTxid(chargeId: number) {
  return `AMZ${String(chargeId).padStart(8, "0")}${crypto
    .randomBytes(12)
    .toString("hex")
    .toUpperCase()}`.slice(0, 35);
}

function getBbProviderEnv() {
  return String(process.env.BB_ENV || "sandbox").toLowerCase();
}

function getChargePublicUrl(chargeId: number) {
  const publicBaseUrl = getBillingPublicBaseUrl();
  return `${publicBaseUrl}/cobranca/${chargeId}`;
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return null;
  }
}

function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}



function getBillingPublicBaseUrl() {
  return (
    process.env.PUBLIC_APP_URL ||
    process.env.FRONTEND_URL ||
    "http://localhost:5173"
  );
}

function generateFakePixCopyPaste(chargeId: number, amount: number) {
  return `00020126580014br.gov.bcb.pix0136SIS-AMAZONIKA-CHARGE-${chargeId}520400005303986540${amount}5802BR5925AMAZONIKA ENGENHARIA6006MACAPA62070503***6304TEST`;
}

function generateFakeLinhaDigitavel(chargeId: number) {
  const base = String(chargeId).padStart(10, "0");
  return `00190.00009 ${base}.000001 00000.000000 1 00000000000000`;
}

async function createProposalHistory(data: {
  protocolId: number;
  proposalId?: number | null;
  eventType: string;
  title: string;
  description?: string | null;
  recipient?: string | null;
  senderName?: string | null;
  senderEmail?: string | null;
  metadata?: any;
  createdById?: number | null;
}) {
  return prisma.proposalHistory.create({
    data: {
      protocolId: data.protocolId,
      proposalId: data.proposalId || null,
      eventType: data.eventType,
      title: data.title,
      description: data.description || null,
      recipient: data.recipient || null,
      senderName: data.senderName || null,
      senderEmail: data.senderEmail || null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
      createdById: data.createdById || null,
    },
  });
}

function formatDateLongBR(value?: Date | string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

function formatTimeBR(value?: Date | string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function escapeHtml(value?: string | null) {
  return String(value || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPublicEmailAssetUrl(filename: string) {
  const frontendUrl = process.env.FRONTEND_URL || "";
  const backendUrl = process.env.BACKEND_PUBLIC_URL || "";

  const baseUrl = backendUrl || frontendUrl;

  if (!baseUrl) return "";

  return `${baseUrl.replace(/\/$/, "")}/email/${filename}`;
}

function buildEmailLayout(content: string) {
  return `
    <div style="margin:0;padding:0;background:#f4f7f5;font-family:Arial,Helvetica,sans-serif;color:#10231b;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f7f5;padding:24px 0;">
        <tr>
          <td align="center">
            <table role="presentation" width="760" cellspacing="0" cellpadding="0" style="width:760px;max-width:96%;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dbe7e1;">
              <tr>
                <td>
                  <img src="cid:amazonika-header" alt="AMAZONIKA Engenharia & Meio Ambiente" style="display:block;width:100%;max-width:760px;height:auto;border:0;" />
                </td>
              </tr>

              <tr>
                <td style="padding:34px 42px;">
                  ${content}
                </td>
              </tr>

              <tr>
                <td>
                  <img src="cid:amazonika-footer" alt="AMAZONIKA Engenharia & Meio Ambiente" style="display:block;width:100%;max-width:760px;height:auto;border:0;" />
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

function buildInfoCard(label: string, value: string, color = "#14543f") {
  return `
    <tr>
      <td style="padding:12px 0;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #cfe0d7;border-radius:14px;">
          <tr>
            <td width="92" align="center" style="width:92px;background:${color};color:#ffffff;border-radius:14px 0 0 14px;font-size:28px;font-weight:bold;">
              •
            </td>
            <td style="padding:16px 18px;">
              <div style="font-size:15px;font-weight:800;color:${color};margin-bottom:4px;">${label}</div>
              <div style="font-size:16px;color:#10231b;">${value || "-"}</div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;
}

function buildClientAppointmentEmail(params: {
  protocolNumber: string;
  clientName: string;
  serviceName: string;
  managerName: string;
  date: string;
  time: string;
  endTime: string;
  meetingType: string;
  locationOrLink: string;
  company: CompanySettings;
}) {
  const companyAddressLine = [
    params.company.companyAddress,
    params.company.companyCity,
    params.company.companyState,
    params.company.companyZipCode
      ? `CEP: ${params.company.companyZipCode}`
      : "",
  ]
    .filter(Boolean)
    .join(" - ");

  const companyContactLine = [
    params.company.companyPhone,
    params.company.companyWhatsapp,
    params.company.companyEmail,
    params.company.companyWebsite,
  ]
    .filter(Boolean)
    .join(" | ");

  const companyLegalName =
    params.company.companyLegalName || "AMAZONIKA Engenharia & Meio Ambiente";

  const companyCnpj = params.company.companyCnpj || "-";

  const content = `
    <p style="font-size:17px;margin:0 0 18px;">
      Prezado(a) ${escapeHtml(params.clientName)},
    </p>

    <p style="font-size:17px;margin:0 0 24px;line-height:1.6;">
      Seguem as informações do seu agendamento de reunião com a equipe técnica da
      <strong>${escapeHtml(companyLegalName)}</strong>.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${buildInfoCard("Protocolo", escapeHtml(params.protocolNumber))}
      ${buildInfoCard("Serviço / Assunto", escapeHtml(params.serviceName))}
      ${buildInfoCard(
        "Data e Hora",
        `${escapeHtml(params.date)} às ${escapeHtml(params.time)}${
          params.endTime ? ` até ${escapeHtml(params.endTime)}` : ""
        }`
      )}
      ${buildInfoCard(
        "Engenheiro Responsável",
        escapeHtml(params.managerName),
        "#155f96"
      )}
      ${buildInfoCard("Meio da Reunião", escapeHtml(params.meetingType))}
      ${buildInfoCard("Local / Link", escapeHtml(params.locationOrLink))}
    </table>

    <p style="font-size:16px;margin:26px 0 0;line-height:1.6;">
      Caso seja necessário reagendar ou complementar informações, entre em contato
      com a equipe de atendimento.
    </p>

    <p style="font-size:16px;margin:26px 0 0;line-height:1.5;">
      Atenciosamente,<br/>
      <strong style="color:#0f4f3a;">${escapeHtml(companyLegalName)}</strong><br/>
      CNPJ: ${escapeHtml(companyCnpj)}
      ${
        companyAddressLine
          ? `<br/><span style="color:#66766e;">${escapeHtml(
              companyAddressLine
            )}</span>`
          : ""
      }
      ${
        companyContactLine
          ? `<br/><span style="color:#66766e;">${escapeHtml(
              companyContactLine
            )}</span>`
          : ""
      }
    </p>
  `;

  return buildEmailLayout(content);
}

function buildManagerAppointmentEmail(params: {
  protocolNumber: string;
  clientName: string;
  clientEmail: string;
  clientPhone: string;
  serviceName: string;
  description: string;
  managerName: string;
  date: string;
  time: string;
  endTime: string;
  meetingType: string;
  locationOrLink: string;
  notes: string;
  company: CompanySettings;
}) {
  const companyAddressLine = [
    params.company.companyAddress,
    params.company.companyCity,
    params.company.companyState,
    params.company.companyZipCode
      ? `CEP: ${params.company.companyZipCode}`
      : "",
  ]
    .filter(Boolean)
    .join(" - ");

  const companyContactLine = [
    params.company.companyPhone,
    params.company.companyWhatsapp,
    params.company.companyEmail,
    params.company.companyWebsite,
  ]
    .filter(Boolean)
    .join(" | ");

  const companyLegalName =
    params.company.companyLegalName || "AMAZONIKA Engenharia & Meio Ambiente";

  const companyCnpj = params.company.companyCnpj || "-";

  const content = `
    <h1 style="margin:0 0 22px;color:#0f4f3a;font-size:32px;line-height:1.15;">
      Novo Agendamento Técnico
    </h1>

    <p style="font-size:17px;margin:0 0 18px;">
      Prezado(a) Engenheiro(a) ${escapeHtml(params.managerName)},
    </p>

    <p style="font-size:17px;margin:0 0 24px;line-height:1.6;">
      Um agendamento de reunião foi marcado com
      <strong>${escapeHtml(params.clientName)}</strong> sobre o assunto
      <strong>${escapeHtml(params.serviceName)}</strong>.
    </p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      ${buildInfoCard("Protocolo", escapeHtml(params.protocolNumber))}
      ${buildInfoCard("Cliente", escapeHtml(params.clientName))}
      ${buildInfoCard(
        "Contato do Cliente",
        `${escapeHtml(params.clientPhone)} | ${escapeHtml(params.clientEmail)}`
      )}
      ${buildInfoCard("Serviço / Assunto", escapeHtml(params.serviceName))}
      ${buildInfoCard(
        "Data e Hora",
        `${escapeHtml(params.date)} às ${escapeHtml(params.time)}${
          params.endTime ? ` até ${escapeHtml(params.endTime)}` : ""
        }`
      )}
      ${buildInfoCard("Meio da Reunião", escapeHtml(params.meetingType))}
      ${buildInfoCard("Local / Link", escapeHtml(params.locationOrLink))}
      ${buildInfoCard(
        "Descrição da Demanda",
        escapeHtml(params.description || "-"),
        "#155f96"
      )}
      ${buildInfoCard(
        "Observações do Agendamento",
        escapeHtml(params.notes || "-"),
        "#155f96"
      )}
    </table>

    <p style="font-size:16px;margin:26px 0 0;line-height:1.6;">
      O PDF do protocolo/agendamento segue anexo para conferência e registro.
    </p>

    <p style="font-size:16px;margin:26px 0 0;line-height:1.5;">
      Atenciosamente,<br/>
      <strong style="color:#0f4f3a;">SIS Amazonika</strong><br/>
      <strong style="color:#0f4f3a;">${escapeHtml(companyLegalName)}</strong><br/>
      CNPJ: ${escapeHtml(companyCnpj)}
      ${
        companyAddressLine
          ? `<br/><span style="color:#66766e;">${escapeHtml(
              companyAddressLine
            )}</span>`
          : ""
      }
      ${
        companyContactLine
          ? `<br/><span style="color:#66766e;">${escapeHtml(
              companyContactLine
            )}</span>`
          : ""
      }
    </p>
  `;

  return buildEmailLayout(content);
}


function formatDateTimeBR(value: string | Date | null | undefined) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

function getEmailImageAttachments() {
  const headerPath = path.join(
    process.cwd(),
    "public",
    "email",
    "email-header.png"
  );

  const footerPath = path.join(
    process.cwd(),
    "public",
    "email",
    "email-footer.png"
  );

  const attachments: any[] = [];

  if (fs.existsSync(headerPath)) {
    attachments.push({
      filename: "email-header.png",
      path: headerPath,
      cid: "amazonika-header",
    });
  }

  if (fs.existsSync(footerPath)) {
    attachments.push({
      filename: "email-footer.png",
      path: footerPath,
      cid: "amazonika-footer",
    });
  }

  return attachments;
}


async function generateProtocolPdf(
  protocol: any,
  company: CompanySettings
): Promise<{
  fileName: string;
  filePath: string;
}> {
  const appointment = protocol.appointments?.[0];

  const outputDir = path.join(process.cwd(), "uploads", "protocols");
  fs.mkdirSync(outputDir, { recursive: true });

  const fileName = `protocolo-${protocol.protocolNumber}.pdf`;
  const filePath = path.join(outputDir, fileName);

  const headerPath = path.join(
    process.cwd(),
    "public",
    "email",
    "email-header.png"
  );

  const footerPath = path.join(
    process.cwd(),
    "public",
    "email",
    "email-footer.png"
  );

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 32,
      bottom: 62,
      left: 42,
      right: 42,
    },
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const pageWidth = doc.page.width;
  const pageHeight = doc.page.height;
  const left = doc.page.margins.left;
  const right = doc.page.margins.right;
  const contentWidth = pageWidth - left - right;

  const colors = {
    green900: "#073d2b",
    green800: "#0b4b2d",
    green700: "#10603c",
    green100: "#e8f3ed",
    green050: "#f4faf6",
    blue700: "#0f4c81",
    border: "#d7e4dc",
    text: "#1f2d26",
    muted: "#66766e",
    light: "#f7faf8",
  };

  const companyLegalName =
    company.companyLegalName || "AMAZONIKA Engenharia & Meio Ambiente";

  const companyName = company.companyName || "AMAZONIKA";

  const companyCnpj = company.companyCnpj || "-";

  const companyAddressLine = [
    company.companyAddress,
    company.companyCity,
    company.companyState,
    company.companyZipCode ? `CEP: ${company.companyZipCode}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  const companyContactLine = [
    company.companyPhone,
    company.companyWhatsapp,
    company.companyEmail,
    company.companyWebsite,
  ]
    .filter(Boolean)
    .join(" | ");

  function safe(value: unknown, fallback = "-") {
    if (value === null || value === undefined) return fallback;
    const text = String(value).trim();
    return text ? text : fallback;
  }

  function formatDateOnlyBR(value?: string | Date | null) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Belem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  }

  function formatDateLongLocalBR(value?: string | Date | null) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Belem",
      weekday: "long",
      day: "2-digit",
      month: "long",
      year: "numeric",
    }).format(date);
  }

  function formatTimeLocalBR(value?: string | Date | null) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Belem",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function formatDateTimeLocalBR(value?: string | Date | null) {
    if (!value) return "-";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Belem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).format(date);
  }

  function statusLabel(value?: string | null) {
    const map: Record<string, string> = {
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

    if (!value) return "-";
    return map[value] || value;
  }

  function drawFooter() {
    const footerY = pageHeight - 64;

    if (fs.existsSync(footerPath)) {
      doc.image(footerPath, left, footerY - 8, {
        fit: [contentWidth, 52],
        align: "center",
        valign: "center",
      });
      return;
    }

    doc
      .moveTo(left, footerY - 10)
      .lineTo(left + contentWidth, footerY - 10)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    doc
      .font("Helvetica-Bold")
      .fontSize(8.8)
      .fillColor(colors.green800)
      .text(`${companyLegalName} — CNPJ: ${companyCnpj}`, left, footerY, {
        width: contentWidth,
        align: "center",
      });

    if (companyAddressLine) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(colors.muted)
        .text(companyAddressLine, left, footerY + 13, {
          width: contentWidth,
          align: "center",
        });
    }

    if (companyContactLine) {
      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(colors.muted)
        .text(companyContactLine, left, footerY + 25, {
          width: contentWidth,
          align: "center",
        });
    }
  }

  function addPageIfNeeded(requiredHeight: number) {
    const usableBottom = pageHeight - 96;

    if (doc.y + requiredHeight > usableBottom) {
      drawFooter();
      doc.addPage();
      doc.y = 42;
    }
  }

  function roundedPanel(
    x: number,
    y: number,
    width: number,
    height: number,
    fill = "#ffffff"
  ) {
    doc
      .roundedRect(x, y, width, height, 12)
      .fillAndStroke(fill, colors.border);
  }

  function drawSectionTitle(title: string) {
    addPageIfNeeded(42);

    const y = doc.y;

    doc.roundedRect(left, y, 8, 26, 4).fill(colors.green700);

    doc
      .font("Helvetica-Bold")
      .fontSize(15)
      .fillColor(colors.green900)
      .text(title, left + 18, y + 5, {
        width: contentWidth - 18,
      });

    doc.y = y + 38;
  }

  function drawInfoRow(
    label: string,
    value: string,
    x: number,
    y: number,
    width: number
  ) {
    doc
      .font("Helvetica-Bold")
      .fontSize(8.8)
      .fillColor(colors.green900)
      .text(label.toUpperCase(), x, y, {
        width,
      });

    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(colors.text)
      .text(value, x, y + 13, {
        width,
        lineGap: 2,
      });

    return doc.y;
  }

  function drawTwoColumnCard(
    rows: Array<{
      label: string;
      value: string;
    }>
  ) {
    const cardX = left;
    const cardY = doc.y;
    const gap = 18;
    const colWidth = (contentWidth - gap) / 2;
    const rowHeight = 45;
    const rowsCount = Math.ceil(rows.length / 2);
    const cardHeight = 22 + rowsCount * rowHeight;

    addPageIfNeeded(cardHeight + 20);

    const actualY = doc.y;
    roundedPanel(cardX, actualY, contentWidth, cardHeight, colors.green050);

    const innerY = actualY + 15;

    rows.forEach((item, index) => {
      const col = index % 2;
      const row = Math.floor(index / 2);

      const x = left + 18 + col * (colWidth + gap);
      const y = innerY + row * rowHeight;

      drawInfoRow(item.label, item.value, x, y, colWidth - 18);
    });

    doc.y = cardY + cardHeight + 20;
  }

  function drawFullTextCard(label: string, value: string) {
    addPageIfNeeded(88);

    const x = left;
    const y = doc.y;
    const padding = 16;

    const textWidth = contentWidth - padding * 2;

    const textHeight = doc
      .font("Helvetica")
      .fontSize(10.5)
      .heightOfString(value, {
        width: textWidth,
        lineGap: 3,
      });

    const cardHeight = Math.max(76, textHeight + 48);

    roundedPanel(x, y, contentWidth, cardHeight, "#ffffff");

    doc
      .font("Helvetica-Bold")
      .fontSize(8.8)
      .fillColor(colors.green900)
      .text(label.toUpperCase(), x + padding, y + padding, {
        width: textWidth,
      });

    doc
      .font("Helvetica")
      .fontSize(10.5)
      .fillColor(colors.text)
      .text(value, x + padding, y + padding + 17, {
        width: textWidth,
        lineGap: 3,
        align: "left",
      });

    doc.y = y + cardHeight + 20;
  }

  function drawBadge(text: string, x: number, y: number, color = colors.green800) {
    const badgeWidth = Math.max(94, doc.widthOfString(text) + 28);

    doc.roundedRect(x, y, badgeWidth, 24, 12).fill(color);

    doc
      .font("Helvetica-Bold")
      .fontSize(8.8)
      .fillColor("#ffffff")
      .text(text, x, y + 7, {
        width: badgeWidth,
        align: "center",
      });

    return badgeWidth;
  }

  let currentY = doc.page.margins.top;

  if (fs.existsSync(headerPath)) {
    doc.image(headerPath, left, currentY, {
      fit: [contentWidth, 132],
      align: "center",
      valign: "center",
    });

    currentY += 142;
  } else {
    roundedPanel(left, currentY, contentWidth, 84, colors.green050);

    doc
      .font("Helvetica-Bold")
      .fontSize(23)
      .fillColor(colors.green800)
      .text(companyName, left + 24, currentY + 19, {
        width: contentWidth - 48,
      });

    doc
      .font("Helvetica")
      .fontSize(11.5)
      .fillColor(colors.text)
      .text(companyLegalName, left + 26, currentY + 50, {
        width: contentWidth - 52,
      });

    currentY += 100;
  }

  const metaY = currentY + 4;
  const metaHeight = 78;

  roundedPanel(left, metaY, contentWidth, metaHeight, "#ffffff");

  doc
    .font("Helvetica-Bold")
    .fontSize(9)
    .fillColor(colors.muted)
    .text("PROTOCOLO DE AGENDAMENTO", left + 18, metaY + 14, {
      width: contentWidth - 36,
    });

  doc
    .font("Helvetica-Bold")
    .fontSize(19)
    .fillColor(colors.green900)
    .text(safe(protocol.protocolNumber), left + 18, metaY + 31, {
      width: contentWidth * 0.56,
    });

  drawBadge(statusLabel(protocol.status), left + contentWidth - 150, metaY + 24);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(colors.muted)
    .text(`Emitido em ${formatDateTimeLocalBR(new Date())}`, left + 18, metaY + 56, {
      width: contentWidth - 36,
    });

  doc.y = metaY + metaHeight + 24;

  drawSectionTitle("1. Dados do Cliente");

  const clientAddressParts = [
    protocol.client?.address,
    protocol.client?.city,
    protocol.client?.state,
  ].filter(Boolean);

  drawTwoColumnCard([
    {
      label: "Cliente",
      value: safe(protocol.client?.name),
    },
    {
      label: "CPF/CNPJ",
      value: safe(protocol.client?.cpfCnpj),
    },
    {
      label: "E-mail",
      value: safe(protocol.client?.email),
    },
    {
      label: "Telefone",
      value: safe(protocol.client?.phone),
    },
    {
      label: "WhatsApp",
      value: safe(protocol.client?.whatsapp),
    },
    {
      label: "Endereço",
      value: clientAddressParts.length ? clientAddressParts.join(" - ") : "-",
    },
  ]);

  drawSectionTitle("2. Serviço Solicitado");

  drawTwoColumnCard([
    {
      label: "Tipo de serviço",
      value: safe(protocol.serviceType?.name),
    },
    {
      label: "Status",
      value: statusLabel(protocol.status),
    },
    {
      label: "Prioridade",
      value: safe(protocol.priority),
    },
    {
      label: "Prazo previsto",
      value: protocol.deadlineDate
        ? formatDateOnlyBR(protocol.deadlineDate)
        : "-",
    },
  ]);

  drawFullTextCard("Descrição da demanda", safe(protocol.description));

  drawSectionTitle("3. Agendamento");

  const scheduledStartTime = formatTimeLocalBR(appointment?.scheduledAt);

  const scheduledEndTime = appointment?.scheduledEndAt
    ? formatTimeLocalBR(appointment.scheduledEndAt)
    : "";

  const scheduleTime = scheduledEndTime
    ? `${scheduledStartTime} até ${scheduledEndTime}`
    : scheduledStartTime;

  const meetingPlace =
    appointment?.location || appointment?.meetingLink || "Não informado";

  drawTwoColumnCard([
    {
      label: "Gestor/Engenheiro responsável",
      value: safe(appointment?.manager?.name),
    },
    {
      label: "E-mail do gestor",
      value: safe(appointment?.manager?.email),
    },
    {
      label: "Data da reunião",
      value: formatDateLongLocalBR(appointment?.scheduledAt),
    },
    {
      label: "Horário",
      value: scheduleTime,
    },
    {
      label: "Meio da reunião",
      value: safe(appointment?.meetingType),
    },
    {
      label: "Status do agendamento",
      value: safe(appointment?.status),
    },
  ]);

  drawFullTextCard("Local ou link da reunião", safe(meetingPlace));
  drawFullTextCard("Observações do agendamento", safe(appointment?.notes));

  if (protocol.documents?.length) {
    drawSectionTitle("4. Documentos Anexados");

    const rowHeight = 38;
    const cardHeight = 22 + protocol.documents.length * rowHeight;

    addPageIfNeeded(cardHeight + 18);

    const cardY = doc.y;
    roundedPanel(left, cardY, contentWidth, cardHeight, "#ffffff");

    let rowY = cardY + 14;

    protocol.documents.forEach((document: any, index: number) => {
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(colors.text)
        .text(
          `${index + 1}. ${safe(document.fileName, "Documento")}`,
          left + 16,
          rowY,
          {
            width: contentWidth - 32,
          }
        );

      doc
        .font("Helvetica")
        .fontSize(8.8)
        .fillColor(colors.muted)
        .text(
          `Tipo: ${safe(document.documentType)} | Inserido em: ${
            document.createdAt ? formatDateTimeLocalBR(document.createdAt) : "-"
          }`,
          left + 16,
          rowY + 15,
          {
            width: contentWidth - 32,
          }
        );

      rowY += rowHeight;
    });

    doc.y = cardY + cardHeight + 20;
  }

  addPageIfNeeded(92);

  const declarationY = doc.y;
  const declarationText = `Este protocolo registra as informações fornecidas no atendimento inicial junto à ${companyLegalName} e o respectivo agendamento de reunião técnica. A execução do serviço, prazos finais, valores e responsabilidades serão definidos conforme análise técnica e eventual formalização contratual.`;

  roundedPanel(left, declarationY, contentWidth, 82, colors.green050);

  doc
    .font("Helvetica")
    .fontSize(10.2)
    .fillColor(colors.text)
    .text(declarationText, left + 18, declarationY + 17, {
      width: contentWidth - 36,
      lineGap: 3,
      align: "justify",
    });

  doc.y = declarationY + 92;

  drawFooter();

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return {
    fileName,
    filePath,
  };
}

function generateToken(user: {
  id: number;
  name: string;
  email: string;
  role: UserRole;
}) {
  return jwt.sign(user, JWT_SECRET, { expiresIn: "7d" });
}

function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: "Token não informado." });
  }

  const [, token] = authHeader.split(" ");

  if (!token) {
    return res.status(401).json({ message: "Token inválido." });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthRequest["user"];
    req.user = decoded;
    return next();
  } catch {
    return res.status(401).json({ message: "Token expirado ou inválido." });
  }
}

function formatMoneyBR(value: number | string | null | undefined) {
  const numericValue = Number(value || 0);

  if (!Number.isFinite(numericValue)) {
    return "R$ 0,00";
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(numericValue);
}

function requireRoles(roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Usuário não autenticado." });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Acesso não autorizado." });
    }

    return next();
  };
}

async function nextProtocolNumber() {
  const year = new Date().getFullYear();

  const count = await prisma.protocol.count({
    where: {
      protocolNumber: {
        startsWith: `AMZ-${year}-`,
      },
    },
  });

  const sequence = String(count + 1).padStart(6, "0");

  return `AMZ-${year}-${sequence}`;
}


type SmtpSettings = {
  smtpHost: string;
  smtpPort: number;
  smtpUser: string;
  smtpPass: string;
  smtpFrom: string;
  companyAlertEmail: string;
  smtpSecure: boolean;
};



async function getSetting(key: string, fallback = "") {
  const setting = await prisma.systemSetting.findUnique({
    where: { key },
  });

  return setting?.value || fallback;
}

async function setSetting(key: string, value: string, group = "GENERAL") {
  return prisma.systemSetting.upsert({
    where: { key },
    update: { value, group },
    create: { key, value, group },
  });
}
type CompanySettings = {
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



async function getCompanySettings(): Promise<CompanySettings> {
  return {
    companyName: await getSetting("COMPANY_NAME", "AMAZONIKA"),
    companyLegalName: await getSetting(
      "COMPANY_LEGAL_NAME",
      "AMAZONIKA Engenharia & Meio Ambiente"
    ),
    companyCnpj: await getSetting("COMPANY_CNPJ", "49.158.834/0001-19"),
    companyEmail: await getSetting("COMPANY_EMAIL", ""),
    companyPhone: await getSetting("COMPANY_PHONE", ""),
    companyWhatsapp: await getSetting("COMPANY_WHATSAPP", ""),
    companyWebsite: await getSetting("COMPANY_WEBSITE", ""),
    companyAddress: await getSetting(
      "COMPANY_ADDRESS",
      "Av. Almirante Barroso, 620-B, Centro"
    ),
    companyCity: await getSetting("COMPANY_CITY", "Macapá"),
    companyState: await getSetting("COMPANY_STATE", "AP"),
    companyZipCode: await getSetting("COMPANY_ZIP_CODE", "68901-336"),
    companyFooterText: await getSetting(
      "COMPANY_FOOTER_TEXT",
      "Compromisso com soluções sustentáveis e responsabilidade ambiental."
    ),
  };
}

async function saveCompanySettings(data: Partial<CompanySettings>) {
  const entries: Array<[string, string | undefined]> = [
    ["COMPANY_NAME", data.companyName],
    ["COMPANY_LEGAL_NAME", data.companyLegalName],
    ["COMPANY_CNPJ", data.companyCnpj],
    ["COMPANY_EMAIL", data.companyEmail],
    ["COMPANY_PHONE", data.companyPhone],
    ["COMPANY_WHATSAPP", data.companyWhatsapp],
    ["COMPANY_WEBSITE", data.companyWebsite],
    ["COMPANY_ADDRESS", data.companyAddress],
    ["COMPANY_CITY", data.companyCity],
    ["COMPANY_STATE", data.companyState],
    ["COMPANY_ZIP_CODE", data.companyZipCode],
    ["COMPANY_FOOTER_TEXT", data.companyFooterText],
  ];

  for (const [key, value] of entries) {
    await setSetting(key, value || "", "COMPANY");
  }

  return getCompanySettings();
}

async function getSmtpSettings(): Promise<SmtpSettings> {
  const smtpHost = await getSetting("SMTP_HOST", process.env.SMTP_HOST || "");
  const smtpPort = Number(
    await getSetting("SMTP_PORT", process.env.SMTP_PORT || "587")
  );
  const smtpUser = await getSetting("SMTP_USER", process.env.SMTP_USER || "");
  const smtpPass = await getSetting("SMTP_PASS", process.env.SMTP_PASS || "");
  const smtpFrom = await getSetting(
    "SMTP_FROM",
    process.env.SMTP_FROM || `SIS Amazonika <${smtpUser}>`
  );
  const companyAlertEmail = await getSetting(
    "COMPANY_ALERT_EMAIL",
    process.env.COMPANY_ALERT_EMAIL || ""
  );

  const smtpSecureRaw = await getSetting(
    "SMTP_SECURE",
    process.env.SMTP_SECURE || "false"
  );

  return {
    smtpHost,
    smtpPort,
    smtpUser,
    smtpPass,
    smtpFrom,
    companyAlertEmail,
    smtpSecure: smtpPort === 465 || smtpSecureRaw === "true",
  };
}

async function createTransporterFromSettings() {
  const settings = await getSmtpSettings();

  const missingFields = [];

  if (!settings.smtpHost) missingFields.push("SMTP_HOST");
  if (!settings.smtpUser) missingFields.push("SMTP_USER");
  if (!settings.smtpPass) missingFields.push("SMTP_PASS");
  if (!settings.smtpFrom) missingFields.push("SMTP_FROM");

  if (missingFields.length > 0) {
    console.error("Campos SMTP ausentes:", missingFields);
    return null;
  }

  const secure = Number(settings.smtpPort) === 465;

  return nodemailer.createTransport({
    host: settings.smtpHost,
    port: Number(settings.smtpPort),
    secure,
    auth: {
      user: settings.smtpUser,
      pass: settings.smtpPass,
    },
    requireTLS: !secure,
    tls: {
      rejectUnauthorized: false,
    },
  });
}

function uniqueEmails(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(
      values
        .filter(Boolean)
        .map((email) => String(email).trim())
        .filter((email) => email.includes("@"))
    )
  );
}

async function sendAppointmentNotificationEmail(protocolId: number) {
  const protocol = await prisma.protocol.findUnique({
    where: { id: protocolId },
    include: {
      client: true,
      serviceType: true,
      appointments: {
        include: {
          manager: true,
        },
        orderBy: {
          scheduledAt: "desc",
        },
        take: 1,
      },
      documents: true,
    },
  });

  if (!protocol) {
    throw new Error("Protocolo não encontrado para envio de e-mail.");
  }

  const appointment = protocol.appointments[0];

  if (!appointment) {
    throw new Error(
      "Não existe agendamento vinculado a este protocolo para envio de e-mail."
    );
  }

  const settings = await getSmtpSettings();
  const company = await getCompanySettings();

  const transporter = await createTransporterFromSettings();

  if (!transporter) {
    const settingsDebug = {
      smtpHost: Boolean(settings.smtpHost),
      smtpPort: settings.smtpPort,
      smtpUser: Boolean(settings.smtpUser),
      smtpPass: Boolean(settings.smtpPass),
      smtpFrom: Boolean(settings.smtpFrom),
      companyAlertEmail: Boolean(settings.companyAlertEmail),
    };

    console.error("SMTP incompleto ao enviar agendamento:", {
      protocol: protocol.protocolNumber,
      settingsDebug,
    });

    throw new Error(
      "SMTP não configurado para envio de agendamento. Verifique host, porta, usuário, senha SMTP e remetente em Configurações > SMTP."
    );
  }

  const date = formatDateLongBR(appointment.scheduledAt);
  const time = formatTimeBR(appointment.scheduledAt);
  const endTime = formatTimeBR(appointment.scheduledEndAt);

  const locationOrLink =
    appointment.location || appointment.meetingLink || "Não informado";

  const pdf = await generateProtocolPdf(protocol, company);

  const attachments = [
    ...getEmailImageAttachments(),
    {
      filename: pdf.fileName,
      path: pdf.filePath,
      contentType: "application/pdf",
    },
  ];

  const clientEmail = protocol.client.email || "";
  const managerEmail = appointment.manager?.email || "";
  const companyEmail = settings.companyAlertEmail || "";

  const sentResults: any[] = [];

  if (clientEmail) {
    const clientHtml = buildClientAppointmentEmail({
      protocolNumber: protocol.protocolNumber,
      clientName: protocol.client.name,
      serviceName: protocol.serviceType.name,
      managerName: appointment.manager?.name || "-",
      date,
      time,
      endTime,
      meetingType: appointment.meetingType || "-",
      locationOrLink,
      company,
    });

    const info = await transporter.sendMail({
      from: settings.smtpFrom,
      to: clientEmail,
      subject: `Agendamento de Reunião — ${protocol.protocolNumber}`,
      html: clientHtml,
      attachments,
    });

    sentResults.push({
      type: "CLIENTE",
      to: clientEmail,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  }

  const managerAndCompanyRecipients = uniqueEmails([managerEmail, companyEmail]);

  if (managerAndCompanyRecipients.length > 0) {
    const managerHtml = buildManagerAppointmentEmail({
      protocolNumber: protocol.protocolNumber,
      clientName: protocol.client.name,
      clientEmail: protocol.client.email || "-",
      clientPhone: protocol.client.whatsapp || protocol.client.phone || "-",
      serviceName: protocol.serviceType.name,
      description: protocol.description || "-",
      managerName: appointment.manager?.name || "-",
      date,
      time,
      endTime,
      meetingType: appointment.meetingType || "-",
      locationOrLink,
      notes: appointment.notes || "-",
      company,
    });

    const info = await transporter.sendMail({
      from: settings.smtpFrom,
      to: managerAndCompanyRecipients,
      subject: `Novo agendamento técnico — ${protocol.protocolNumber}`,
      html: managerHtml,
      attachments,
    });

    sentResults.push({
      type: "GESTOR_EMPRESA",
      to: managerAndCompanyRecipients,
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });
  }

  await prisma.auditLog.create({
    data: {
      action: "SEND_APPOINTMENT_EMAIL",
      entity: "Protocol",
      entityId: String(protocol.id),
      description: `E-mails de agendamento enviados para o protocolo ${protocol.protocolNumber}.`,
      metadata: JSON.stringify({
        protocolNumber: protocol.protocolNumber,
        results: sentResults,
      }),
    },
  });

  console.log("Resultado envio agendamento:", sentResults);

  return {
    sent: sentResults.length > 0,
    results: sentResults,
  };
}

function generatePublicContractToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function generateContractNumber() {
  const year = new Date().getFullYear();

  const count = await prisma.contract.count({
    where: {
      contractNumber: {
        startsWith: `CONT-${year}-`,
      },
    },
  });

  return `CONT-${year}-${String(count + 1).padStart(6, "0")}`;
}

function formatCurrencyBRFromCents(value: number | null | undefined) {
  const amount = Number(value || 0) / 100;

  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatCurrencyBRFromFloat(value: number | null | undefined) {
  const amount = Number(value || 0);

  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function formatDateBR(value: Date | string | null | undefined) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "-";

  return date.toLocaleDateString("pt-BR", {
    timeZone: "America/Belem",
  });
}

function buildContractHtmlSnapshot(params: {
  contractNumber: string;
  proposalNumber: string;
  protocolNumber: string;
  companyName: string;
  clientName: string;
  clientCpfCnpj?: string | null;
  clientEmail?: string | null;
  clientAddress?: string | null;
  serviceName: string;
  totalAmount: number;
  entryAmount: number;
  paymentMode: string;
  installmentQty?: number | null;
  installmentAmount?: number | null;
  objectText: string;
  obligationsText: string;
  paymentText: string;
  deadlineText: string;
  legalText: string;
}) {
  const installments =
    params.installmentQty && params.installmentAmount
      ? `${params.installmentQty} parcela(s) de ${formatCurrencyBRFromCents(
          params.installmentAmount
        )}`
      : "Não aplicável";

  return `
    <section>
      <h1>Contrato de Prestação de Serviços</h1>

      <p><strong>Contrato:</strong> ${params.contractNumber}</p>
      <p><strong>Proposta vinculada:</strong> ${params.proposalNumber}</p>
      <p><strong>Protocolo:</strong> ${params.protocolNumber}</p>

      <h2>Contratada</h2>
      <p>${params.companyName}</p>

      <h2>Contratante</h2>
      <p><strong>Nome/Razão Social:</strong> ${params.clientName}</p>
      <p><strong>CPF/CNPJ:</strong> ${params.clientCpfCnpj || "-"}</p>
      <p><strong>E-mail:</strong> ${params.clientEmail || "-"}</p>
      <p><strong>Endereço:</strong> ${params.clientAddress || "-"}</p>

      <h2>Objeto</h2>
      <p>${params.objectText}</p>

      <h2>Obrigações</h2>
      <p>${params.obligationsText}</p>

      <h2>Condições comerciais</h2>
      <p><strong>Serviço principal:</strong> ${params.serviceName}</p>
      <p><strong>Valor total:</strong> ${formatCurrencyBRFromCents(
        params.totalAmount
      )}</p>
      <p><strong>Entrada:</strong> ${formatCurrencyBRFromCents(
        params.entryAmount
      )}</p>
      <p><strong>Forma de pagamento:</strong> ${params.paymentMode}</p>
      <p><strong>Parcelamento:</strong> ${installments}</p>
      <p>${params.paymentText}</p>

      <h2>Prazo</h2>
      <p>${params.deadlineText}</p>

      <h2>Cláusulas gerais</h2>
      <p>${params.legalText}</p>
    </section>
  `;
}

app.post(
  "/proposals/:id/generate-contract",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const proposalId = Number(req.params.id);

      if (!proposalId) {
        return res.status(400).json({
          message: "ID da proposta inválido.",
        });
      }

      const proposal = await prisma.proposal.findUnique({
        where: {
          id: proposalId,
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      if (!proposal) {
        return res.status(404).json({
          message: "Proposta não encontrada.",
        });
      }

      if (proposal.status !== "ACEITA") {
        return res.status(400).json({
          message:
            "Somente propostas aceitas pelo cliente podem gerar contrato.",
        });
      }

      const existingContract = await prisma.contract.findFirst({
        where: {
          proposalId: proposal.id,
          status: {
            not: "CANCELADO",
          },
        },
      });

      if (existingContract) {
        return res.status(400).json({
          message:
            "Esta proposta já possui contrato gerado. Cancele ou substitua o contrato existente antes de gerar outro.",
        });
      }

      const company = await getCompanySettings();

      const contractNumber = await generateContractNumber();

      const objectText =
        req.body?.objectText ||
        `Prestação de serviços técnicos relacionados a ${proposal.protocol.serviceType.name}, conforme proposta comercial ${proposal.proposalNumber} vinculada ao protocolo ${proposal.protocol.protocolNumber}.`;

      const obligationsText =
        req.body?.obligationsText ||
        "A CONTRATADA compromete-se a executar os serviços conforme escopo técnico aprovado na proposta comercial, observadas as informações, documentos e condições fornecidas pelo CONTRATANTE. O CONTRATANTE compromete-se a fornecer documentos, informações e acessos necessários à adequada execução dos serviços.";

const paymentText =
  req.body?.paymentText ||
  (proposal.paymentMode === "ENTRADA_PARCELAS"
    ? `O pagamento será realizado com entrada de ${formatCurrencyBRFromFloat(
        proposal.entryAmount
      )}, devida após a assinatura do contrato, e saldo remanescente parcelado em ${
        proposal.installmentQty || 1
      } parcela(s), com vencimentos definidos após a conclusão ou entrega dos serviços contratados, mediante emissão das respectivas cobranças ao CONTRATANTE.`
    : proposal.paymentMode === "A_VISTA"
    ? `O pagamento será realizado à vista, no valor total de ${formatCurrencyBRFromFloat(
        proposal.totalAmount
      )}, conforme condições aprovadas na proposta ${proposal.proposalNumber}.`
    : `O pagamento seguirá as condições comerciais aprovadas na proposta ${proposal.proposalNumber}.`);
      const deadlineText =
        req.body?.deadlineText ||
        (proposal.executionDays
          ? `O prazo estimado para execução dos serviços é de ${proposal.executionDays} dia(s), contado(s) a partir da assinatura do contrato, pagamento da entrada e entrega completa dos documentos necessários.`
          : "O prazo de execução será definido conforme complexidade técnica, disponibilidade documental e condições operacionais do serviço contratado.");

      const legalText =
        req.body?.legalText ||
        "As partes declaram ciência de que alterações de escopo, ausência de documentos, exigências de órgãos públicos, necessidade de diligências complementares ou fatos supervenientes poderão impactar prazos e valores, mediante comunicação entre as partes.";

      const htmlSnapshot = buildContractHtmlSnapshot({
        contractNumber,
        proposalNumber: proposal.proposalNumber,
        protocolNumber: proposal.protocol.protocolNumber,
        companyName:
          company.companyName || "AMAZONIKA Engenharia & Meio Ambiente",
        clientName: proposal.client.name,
        clientCpfCnpj: proposal.client.cpfCnpj,
        clientEmail: proposal.client.email,
        clientAddress: proposal.client.address,
        serviceName: proposal.protocol.serviceType.name,
        totalAmount: proposal.totalAmount,
        entryAmount: proposal.entryAmount,
        paymentMode: proposal.paymentMode,
        installmentQty: proposal.installmentQty,
        installmentAmount: proposal.installmentAmount,
        objectText,
        obligationsText,
        paymentText,
        deadlineText,
        legalText,
      });

      const contract = await prisma.contract.create({
        data: {
          protocolId: proposal.protocolId,
          clientId: proposal.clientId,
          proposalId: proposal.id,
          createdById: req.user?.id || null,

          contractNumber,
          publicToken: generatePublicContractToken(),

          templateType: "CONTRATO_PRESTACAO_SERVICOS",
          status: "GERADO",

contractValue: proposal.totalAmount,
entryAmount: proposal.entryAmount,
paymentMode: proposal.paymentMode,

          title: `Contrato de Prestação de Serviços — ${proposal.protocol.protocolNumber}`,
          objectText,
          obligationsText,
          paymentText,
          deadlineText,
          legalText,
          htmlSnapshot,

          startDate: new Date(),
          deadlineDate: proposal.executionDays
            ? new Date(Date.now() + proposal.executionDays * 24 * 60 * 60 * 1000)
            : null,

          notes: `Contrato gerado automaticamente a partir da proposta ${proposal.proposalNumber}.`,
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          proposal: true,
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await prisma.proposal.update({
        where: {
          id: proposal.id,
        },
        data: {
          status: "CONVERTIDA_EM_CONTRATO",
        },
      });

      await prisma.protocol.update({
        where: {
          id: proposal.protocolId,
        },
        data: {
          status: "CONTRATO_ENVIADO",
        },
      });

      await createProposalHistory({
        protocolId: proposal.protocolId,
        proposalId: proposal.id,
        eventType: "CONTRATO_GERADO",
        title: `Contrato ${contract.contractNumber} gerado`,
        description: `Contrato gerado a partir da proposta aceita ${proposal.proposalNumber}.`,
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          proposalNumber: proposal.proposalNumber,
          contractValue: contract.contractValue,
          entryAmount: contract.entryAmount,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "GENERATE_CONTRACT_FROM_PROPOSAL",
          entity: "Contract",
          entityId: String(contract.id),
          description: `Contrato ${contract.contractNumber} gerado a partir da proposta ${proposal.proposalNumber}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(201).json({
        ...contract,
        publicUrl: `${process.env.FRONTEND_URL || ""}/contrato/${
          contract.publicToken
        }`,
      });
    } catch (error) {
      console.error("Erro ao gerar contrato:", error);

      return res.status(500).json({
        message: "Erro ao gerar contrato.",
      });
    }
  }
);

app.get(
  "/contracts/:id",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do contrato inválido.",
        });
      }

      const contract = await prisma.contract.findUnique({
        where: {
          id,
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          proposal: {
            include: {
              items: {
                orderBy: {
                  sortOrder: "asc",
                },
              },
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          payments: true,
        },
      });

      if (!contract) {
        return res.status(404).json({
          message: "Contrato não encontrado.",
        });
      }

      return res.json({
        ...contract,
        publicUrl: `${process.env.FRONTEND_URL || ""}/contrato/${
          contract.publicToken
        }`,
      });
    } catch (error) {
      console.error("Erro ao buscar contrato:", error);

      return res.status(500).json({
        message: "Erro ao buscar contrato.",
      });
    }
  }
);

app.get(
  "/contracts",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const protocolId = req.query.protocolId
        ? Number(req.query.protocolId)
        : null;

      const contracts = await prisma.contract.findMany({
        where: protocolId ? { protocolId } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          proposal: true,
          payments: true,
        },
      });

      return res.json(
        contracts.map((contract) => ({
          ...contract,
          publicUrl: `${process.env.FRONTEND_URL || ""}/contrato/${
            contract.publicToken
          }`,
        }))
      );
    } catch (error) {
      console.error("Erro ao listar contratos:", error);

      return res.status(500).json({
        message: "Erro ao listar contratos.",
      });
    }
  }
);

app.post(
  "/contracts/:id/send",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do contrato inválido.",
        });
      }

      const contract = await prisma.contract.findUnique({
        where: {
          id,
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          proposal: true,
        },
      });

      if (!contract) {
        return res.status(404).json({
          message: "Contrato não encontrado.",
        });
      }

      if (!contract.client.email) {
        return res.status(400).json({
          message: "O cliente não possui e-mail cadastrado.",
        });
      }

      if (
        contract.status !== "GERADO" &&
        contract.status !== "ENVIADO" &&
        contract.status !== "AGUARDANDO_ASSINATURA"
      ) {
        return res.status(400).json({
          message: "Este contrato não está disponível para envio.",
        });
      }

      const settings = await getSmtpSettings();
      const company = await getCompanySettings();
      const transporter = await createTransporterFromSettings();

      if (!transporter) {
        console.error("SMTP incompleto ao enviar contrato:", {
          contractNumber: contract.contractNumber,
          smtpHost: Boolean(settings.smtpHost),
          smtpPort: settings.smtpPort,
          smtpUser: Boolean(settings.smtpUser),
          smtpPass: Boolean(settings.smtpPass),
          smtpFrom: Boolean(settings.smtpFrom),
        });

        return res.status(500).json({
          message:
            "SMTP não configurado para envio de contrato. Verifique host, porta, usuário, senha SMTP e remetente.",
        });
      }

      const publicUrl = `${process.env.FRONTEND_URL || ""}/contrato/${
        contract.publicToken
      }`;

      const html = `
        <div style="font-family:Arial,sans-serif;background:#f4f7f5;padding:24px;">
          <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dfe7e2;">
            <div style="background:#0f4f3a;color:#ffffff;padding:24px;">
              <h1 style="margin:0;font-size:24px;">Contrato disponível para assinatura</h1>
              <p style="margin:8px 0 0;">${company.companyName || "AMAZONIKA Engenharia & Meio Ambiente"}</p>
            </div>

            <div style="padding:24px;color:#1f2d26;">
              <p>Prezado(a) ${contract.client.name},</p>

              <p>
                Seu contrato referente ao protocolo <strong>${contract.protocol.protocolNumber}</strong>
                está disponível para conferência e assinatura eletrônica.
              </p>

              <div style="background:#f8fbf9;border:1px solid #dfe7e2;border-radius:14px;padding:16px;margin:18px 0;">
                <p><strong>Contrato:</strong> ${contract.contractNumber}</p>
                <p><strong>Serviço:</strong> ${contract.protocol.serviceType.name}</p>
                <p><strong>Valor:</strong> ${formatCurrencyBRFromFloat(contract.contractValue)}</p>
                <p><strong>Status:</strong> Aguardando assinatura</p>
              </div>

              <p style="text-align:center;margin:28px 0;">
                <a href="${publicUrl}" target="_blank"
                  style="display:inline-block;background:#0f4f3a;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:bold;">
                  Acessar e assinar contrato
                </a>
              </p>

              <p style="font-size:13px;color:#66766e;">
                Caso o botão não funcione, copie e cole este endereço no navegador:<br/>
                ${publicUrl}
              </p>
            </div>
          </div>
        </div>
      `;

      const info = await transporter.sendMail({
        from: settings.smtpFrom,
        to: contract.client.email,
        subject: `Contrato para assinatura — ${contract.contractNumber}`,
        html,
        attachments: getEmailImageAttachments(),
      });

      const updated = await prisma.contract.update({
        where: {
          id: contract.id,
        },
        data: {
          status: "AGUARDANDO_ASSINATURA",
          sentToClientAt: new Date(),
        },
      });

      await prisma.protocol.update({
        where: {
          id: contract.protocolId,
        },
        data: {
          status: "AGUARDANDO_ASSINATURA",
        },
      });

      await createProposalHistory({
        protocolId: contract.protocolId,
        proposalId: contract.proposalId || null,
        eventType: "CONTRATO_ENVIADO",
        title: `Contrato ${contract.contractNumber} enviado ao cliente`,
        description: `O contrato foi enviado por e-mail para ${contract.client.email}.`,
        recipient: contract.client.email,
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          publicUrl,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "SEND_CONTRACT_EMAIL",
          entity: "Contract",
          entityId: String(contract.id),
          description: `Contrato ${contract.contractNumber} enviado para ${contract.client.email}.`,
          ipAddress: req.ip,
          metadata: JSON.stringify({
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
          }),
        },
      });

      return res.json({
        ...updated,
        publicUrl,
        email: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
        },
      });
    } catch (error) {
      console.error("Erro ao enviar contrato:", error);

      return res.status(500).json({
        message: "Erro ao enviar contrato por e-mail.",
      });
    }
  }
);

app.get("/public/contracts/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const contract = await prisma.contract.findUnique({
      where: {
        publicToken: token,
      },
      include: {
        client: true,
        protocol: {
          include: {
            serviceType: true,
          },
        },
        proposal: {
          include: {
            items: {
              orderBy: {
                sortOrder: "asc",
              },
            },
          },
        },
      },
    });

    if (!contract) {
      return res.status(404).json({
        message: "Contrato não encontrado.",
      });
    }

    if (contract.status === "CANCELADO" || contract.status === "SUBSTITUIDO") {
      return res.status(400).json({
        message: "Este contrato não está mais disponível.",
      });
    }

    return res.json(contract);
  } catch (error) {
    console.error("Erro ao carregar contrato público:", error);

    return res.status(500).json({
      message: "Erro ao carregar contrato.",
    });
  }
});

app.post("/public/contracts/:token/sign", async (req, res) => {
  try {
    const token = req.params.token;

    const { signerName, signerCpfCnpj, signerEmail } = req.body || {};

    if (!signerName || !signerCpfCnpj || !signerEmail) {
      return res.status(400).json({
        message:
          "Nome, CPF/CNPJ e e-mail do assinante são obrigatórios para assinatura.",
      });
    }

    const contract = await prisma.contract.findUnique({
      where: {
        publicToken: token,
      },
      include: {
        client: true,
        protocol: true,
        proposal: true,
      },
    });

    if (!contract) {
      return res.status(404).json({
        message: "Contrato não encontrado.",
      });
    }

    if (
      contract.status !== "AGUARDANDO_ASSINATURA" &&
      contract.status !== "ENVIADO" &&
      contract.status !== "GERADO"
    ) {
      return res.status(400).json({
        message: "Este contrato não está disponível para assinatura.",
      });
    }

    const signed = await prisma.contract.update({
      where: {
        id: contract.id,
      },
      data: {
        status: "ASSINADO",
        signedAt: new Date(),

        signerName: String(signerName).trim(),
        signerCpfCnpj: String(signerCpfCnpj).trim(),
        signerEmail: String(signerEmail).trim(),
        signerIp:
          String(
            req.headers["x-forwarded-for"] ||
              req.socket.remoteAddress ||
              req.ip ||
              ""
          ) || null,
        signerUserAgent: req.headers["user-agent"] || null,
      },
    });

    await prisma.protocol.update({
      where: {
        id: contract.protocolId,
      },
      data: {
        status: "CONTRATO_ASSINADO",
      },
    });

    await createProposalHistory({
      protocolId: contract.protocolId,
      proposalId: contract.proposalId || null,
      eventType: "CONTRATO_ASSINADO",
      title: `Contrato ${contract.contractNumber} assinado pelo cliente`,
      description: `Contrato assinado eletronicamente por ${signerName}.`,
      recipient: contract.client.email || null,
      senderName: String(signerName).trim(),
      senderEmail: String(signerEmail).trim(),
      metadata: {
        contractId: contract.id,
        contractNumber: contract.contractNumber,
        signerName,
        signerCpfCnpj,
        signerEmail,
        signedAt: new Date().toISOString(),
        ip:
          String(
            req.headers["x-forwarded-for"] ||
              req.socket.remoteAddress ||
              req.ip ||
              ""
          ) || null,
        userAgent: req.headers["user-agent"] || null,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CLIENT_SIGN_CONTRACT",
        entity: "Contract",
        entityId: String(contract.id),
        description: `Cliente assinou o contrato ${contract.contractNumber}.`,
        metadata: JSON.stringify({
          token,
          contractNumber: contract.contractNumber,
          signerName,
          signerCpfCnpj,
          signerEmail,
          signedAt: new Date().toISOString(),
        }),
      },
    });

    return res.json(signed);
  } catch (error) {
    console.error("Erro ao assinar contrato:", error);

    return res.status(500).json({
      message: "Erro ao assinar contrato.",
    });
  }
});



app.get(
  "/protocols/:id/proposal-history",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const protocolId = Number(req.params.id);

      if (!protocolId) {
        return res.status(400).json({
          message: "ID do protocolo inválido.",
        });
      }

      const history = await prisma.proposalHistory.findMany({
        where: {
          protocolId,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return res.json(history);
    } catch (error) {
      console.error("Erro ao carregar histórico de propostas:", error);

      return res.status(500).json({
        message: "Erro ao carregar histórico de propostas.",
      });
    }
  }
);

app.post(
  "/proposals/:id/send-email",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const proposalId = Number(req.params.id);

      if (!proposalId) {
        return res.status(400).json({
          message: "ID da proposta inválido.",
        });
      }

      const proposal = await prisma.proposal.findUnique({
        where: {
          id: proposalId,
        },
        include: {
          client: true,
          protocol: {
            include: {
              client: true,
              serviceType: true,
            },
          },
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      if (!proposal) {
        return res.status(404).json({
          message: "Proposta não encontrada.",
        });
      }

      const clientEmail =
        proposal.client?.email || proposal.protocol?.client?.email || "";

      if (!clientEmail) {
        return res.status(400).json({
          message: "O cliente não possui e-mail cadastrado.",
        });
      }

      const settings = await getSmtpSettings();
      const company = await getCompanySettings();
      const transporter = await createTransporterFromSettings();

      if (!transporter) {
        throw new Error(
          "SMTP não configurado para envio de proposta. Verifique host, porta, usuário, senha SMTP e remetente em Configurações > SMTP."
        );
      }

      const publicBaseUrl =
        process.env.PUBLIC_APP_URL ||
        process.env.FRONTEND_URL ||
        "http://localhost:5173";

      const proposalUrl = `${publicBaseUrl}/proposta/${proposal.publicToken}`;

      const totalAmount = Number(proposal.totalAmount || 0);
      const entryAmount = Number(proposal.entryAmount || 0);

      const itemsHtml = (proposal.items || [])
        .map(
          (item) => `
            <tr>
              <td style="padding:10px 12px; border-bottom:1px solid #e5ebe7;">
                <strong>${item.serviceName}</strong>
                ${
                  item.description
                    ? `<br><span style="font-size:13px; color:#64748b;">${item.description}</span>`
                    : ""
                }
              </td>
              <td style="padding:10px 12px; border-bottom:1px solid #e5ebe7; text-align:center;">
                ${item.quantity}
              </td>
              <td style="padding:10px 12px; border-bottom:1px solid #e5ebe7; text-align:right;">
                ${formatMoneyBR(item.unitAmount)}
              </td>
              <td style="padding:10px 12px; border-bottom:1px solid #e5ebe7; text-align:right;">
                <strong>${formatMoneyBR(item.totalAmount)}</strong>
              </td>
            </tr>
          `
        )
        .join("");

      const paymentLabel =
        proposal.paymentMode === "A_VISTA"
          ? "À vista"
          : proposal.paymentMode === "PARCELADO"
          ? "Parcelado"
          : "Entrada + parcelas";

      const html = `
        <div style="font-family:Arial, sans-serif; background:#f4f7f5; padding:24px;">
          <div style="max-width:760px; margin:0 auto; background:#ffffff; border-radius:20px; overflow:hidden; border:1px solid #dbe7df;">
            <div style="background:#123c32; padding:24px; color:#ffffff;">
              <h1 style="margin:0; font-size:24px;">Proposta Comercial</h1>
              <p style="margin:8px 0 0; color:#d8f3e5;">
                ${proposal.proposalNumber} · Protocolo ${proposal.protocol?.protocolNumber || "-"}
              </p>
            </div>

            <div style="padding:26px;">
              <p style="font-size:16px; color:#1f2937;">
                Prezado(a) <strong>${proposal.client?.name || proposal.protocol?.client?.name || "cliente"}</strong>,
              </p>

              <p style="font-size:15px; color:#374151; line-height:1.6;">
                Segue a proposta comercial referente ao protocolo
                <strong>${proposal.protocol?.protocolNumber || "-"}</strong>.
                Para visualizar os detalhes, aceitar, solicitar ajuste ou recusar, acesse o botão abaixo.
              </p>

              <div style="margin:22px 0; padding:18px; background:#f8fbf9; border:1px solid #e1ebe5; border-radius:16px;">
                <p style="margin:0 0 8px; color:#64748b;">Serviço principal</p>
                <strong style="font-size:18px; color:#123c32;">
                  ${proposal.protocol?.serviceType?.name || proposal.title}
                </strong>
              </div>

              <table style="width:100%; border-collapse:collapse; margin-top:18px; font-size:14px;">
                <thead>
                  <tr style="background:#123c32; color:#ffffff;">
                    <th style="padding:10px 12px; text-align:left;">Item</th>
                    <th style="padding:10px 12px; text-align:center;">Qtd.</th>
                    <th style="padding:10px 12px; text-align:right;">Unitário</th>
                    <th style="padding:10px 12px; text-align:right;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  ${itemsHtml}
                </tbody>
              </table>

              <div style="margin-top:22px; display:grid; gap:10px;">
                <div style="display:flex; justify-content:space-between; padding:12px; background:#f8fbf9; border-radius:12px;">
                  <span>Valor total</span>
                  <strong>${formatMoneyBR(totalAmount)}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; padding:12px; background:#f8fbf9; border-radius:12px;">
                  <span>Entrada</span>
                  <strong>${formatMoneyBR(entryAmount)}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; padding:12px; background:#f8fbf9; border-radius:12px;">
                  <span>Forma de pagamento</span>
                  <strong>${paymentLabel}</strong>
                </div>
              </div>

              <div style="text-align:center; margin:30px 0 18px;">
                <a
                  href="${proposalUrl}"
                  style="display:inline-block; background:#123c32; color:#ffffff; padding:14px 24px; border-radius:999px; text-decoration:none; font-weight:bold;"
                >
                  Visualizar e responder proposta
                </a>
              </div>

              <p style="font-size:13px; color:#64748b; line-height:1.5;">
                Caso o botão não abra, copie e cole este link no navegador:<br>
                <span style="color:#123c32;">${proposalUrl}</span>
              </p>
            </div>
          </div>
        </div>
      `;

      const info = await transporter.sendMail({
        from: settings.smtpFrom,
        to: clientEmail,
        subject: `Proposta Comercial — ${proposal.proposalNumber}`,
        html,
        attachments: getEmailImageAttachments(),
      });

      const previousStatus = proposal.status;
      const wasAdjustment = proposal.status === "AJUSTE_SOLICITADO";

      const updated = await prisma.proposal.update({
        where: {
          id: proposal.id,
        },
        data: {
          status: "ENVIADA",
          sentAt: new Date(),
        },
        include: {
          client: true,
          protocol: true,
          items: true,
        },
      });

      await prisma.protocol.update({
        where: {
          id: proposal.protocolId,
        },
        data: {
          status: "PROPOSTA_ENVIADA",
        },
      });

      const alreadyLogged = await prisma.proposalHistory.findFirst({
        where: {
          protocolId: proposal.protocolId,
          proposalId: proposal.id,
          eventType: wasAdjustment
            ? "PROPOSTA_AJUSTADA_ENVIADA"
            : "PROPOSTA_ENVIADA",
          recipient: clientEmail,
          createdAt: {
            gte: new Date(Date.now() - 60 * 1000),
          },
        },
      });

      if (!alreadyLogged) {
        await createProposalHistory({
          protocolId: proposal.protocolId,
          proposalId: proposal.id,
          eventType: wasAdjustment
            ? "PROPOSTA_AJUSTADA_ENVIADA"
            : "PROPOSTA_ENVIADA",
          title: wasAdjustment
            ? `Proposta ajustada ${proposal.proposalNumber} enviada ao cliente`
            : `Proposta ${proposal.proposalNumber} enviada ao cliente`,
          description: `A proposta foi enviada por e-mail para ${clientEmail}.`,
          recipient: clientEmail,
          senderName: req.user?.name || null,
          senderEmail: req.user?.email || null,
          createdById: req.user?.id || null,
          metadata: {
            proposalNumber: proposal.proposalNumber,
            previousStatus,
            messageId: info.messageId,
            publicUrl: proposalUrl,
            totalAmount: proposal.totalAmount,
            entryAmount: proposal.entryAmount,
            paymentMode: proposal.paymentMode,
          },
        });
      }

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "SEND_PROPOSAL_EMAIL",
          entity: "Proposal",
          entityId: String(proposal.id),
          description: `Proposta ${proposal.proposalNumber} enviada por e-mail para ${clientEmail}.`,
          ipAddress: req.ip,
          metadata: JSON.stringify({
            messageId: info.messageId,
            accepted: info.accepted,
            rejected: info.rejected,
            publicUrl: proposalUrl,
          }),
        },
      });

      return res.json({
        ...updated,
        publicUrl: proposalUrl,
        sent: true,
        messageId: info.messageId,
      });
    } catch (error) {
      console.error("Erro ao enviar proposta por e-mail:", error);

      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Erro ao enviar proposta por e-mail.",
      });
    }
  }
);

app.post(
  "/users",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    const { name, email, password, role, active } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({
        message: "Nome, e-mail, senha e perfil são obrigatórios.",
      });
    }

    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return res.status(409).json({
        message: "Já existe usuário cadastrado com este e-mail.",
      });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        role,
        active: active !== false,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        action: "CREATE_USER",
        entity: "User",
        entityId: String(user.id),
        description: `Usuário ${user.name} foi cadastrado.`,
      },
    });

    return res.status(201).json(user);
  }
);

function generatePublicToken() {
  return crypto.randomBytes(32).toString("hex");
}

async function generateProposalNumber() {
  const year = new Date().getFullYear();

  const count = await prisma.proposal.count({
    where: {
      proposalNumber: {
        startsWith: `PROP-${year}-`,
      },
    },
  });

  return `PROP-${year}-${String(count + 1).padStart(6, "0")}`;
}

function calculateProposalTotals(items: any[]) {
  const normalizedItems = items.map((item, index) => {
    const quantity = Number(item.quantity || 1);
    const unitAmount = toIntMoney(item.unitAmount || item.amount || 0);
    const totalAmount = quantity * unitAmount;

    return {
      serviceName: String(item.serviceName || "").trim(),
      description: item.description || null,
      quantity,
      unitAmount,
      totalAmount,
      sortOrder: index + 1,
    };
  });

  const totalAmount = normalizedItems.reduce(
    (sum, item) => sum + item.totalAmount,
    0
  );

  return {
    normalizedItems,
    totalAmount,
  };
}

app.get(
  "/users/managers",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (_req, res) => {
    const managers = await prisma.user.findMany({
      where: {
        role: "GERENTE",
        active: true,
      },
      orderBy: {
        name: "asc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    return res.json(managers);
  }
);

app.get(
  "/appointments/availability",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const managerUserId = Number(req.query.managerUserId);
    const date = String(req.query.date || "");

    if (!managerUserId || !date) {
      return res.status(400).json({
        message: "Gestor e data são obrigatórios.",
      });
    }

    const startOfDay = new Date(`${date}T00:00:00-03:00`);
    const endOfDay = new Date(`${date}T23:59:59-03:00`);

    const appointments = await prisma.appointment.findMany({
      where: {
        managerUserId,
        status: {
          not: "CANCELADO",
        },
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
      orderBy: {
        scheduledAt: "asc",
      },
      include: {
        client: true,
        protocol: {
          include: {
            serviceType: true,
          },
        },
        manager: true,
      },
    });

    const slots = [
      "08:00",
      "09:00",
      "10:00",
      "11:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
    ].map((time) => {
      const slotStart = new Date(`${date}T${time}:00-03:00`);
      const slotEnd = new Date(slotStart.getTime() + 60 * 60 * 1000);

      const busy = appointments.find((appointment) => {
        return (
          appointment.scheduledAt < slotEnd &&
          appointment.scheduledEndAt > slotStart
        );
      });

      return {
        time,
        available: !busy,
        appointment: busy
          ? {
              id: busy.id,
              protocolNumber: busy.protocol.protocolNumber,
              clientName: busy.client.name,
              serviceName: busy.protocol.serviceType.name,
              scheduledAt: busy.scheduledAt,
              scheduledEndAt: busy.scheduledEndAt,
            }
          : null,
      };
    });

    return res.json({
      managerUserId,
      date,
      appointments,
      slots,
    });
  }
);

app.get("/", (_req, res) => {
  res.json({
    name: "SIS Amazonika API",
    status: "online",
    port: PORT,
  });
});

app.post("/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: "E-mail e senha são obrigatórios.",
      });
    }

    const normalizedEmail = String(email).trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (!user) {
      return res.status(401).json({
        message: "Usuário não cadastrado no sistema.",
      });
    }

    if (!user.active) {
      return res.status(403).json({
        message: "Usuário inativo. Procure o programador do sistema.",
      });
    }

    const passwordOk = await bcrypt.compare(String(password), user.passwordHash);

    if (!passwordOk) {
      return res.status(401).json({
        message: "Senha inválida.",
      });
    }

    const ip =
      req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim() ||
      req.socket.remoteAddress ||
      null;

    const updatedUser = await prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: updatedUser.id,
        userName: updatedUser.name,
        userEmail: updatedUser.email,
        userRole: updatedUser.role,
        action: "LOGIN",
        entity: "User",
        entityId: String(updatedUser.id),
        description: `Login realizado por ${updatedUser.name}.`,
        metadata: JSON.stringify({
          ip,
        }),
      },
    });

    const token = jwt.sign(
      {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
      },
      process.env.JWT_SECRET || "amazonika-local-dev-secret",
      {
        expiresIn: "8h",
      }
    );

    return res.json({
      token,
      user: {
        id: updatedUser.id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        active: updatedUser.active,
        lastLoginAt: updatedUser.lastLoginAt,
      },
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      message: "Erro interno ao realizar login.",
    });
  }
});


app.get("/auth/me", authMiddleware, async (req: AuthRequest, res) => {
  if (!req.user) {
    return res.status(401).json({ message: "Usuário não autenticado." });
  }

  const user = await prisma.user.findUnique({
    where: { id: req.user.id },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      active: true,
      lastLoginAt: true,
      lastLoginIp: true,
      createdAt: true,
    },
  });

  return res.json({ user });
});

app.get(
  "/users",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (_req, res) => {
    const users = await prisma.user.findMany({
      orderBy: {
        createdAt: "desc",
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return res.json(users);
  }
);

app.patch(
  "/users/:id",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);

    const { name, email, role, active, password } = req.body;

    if (!name || !email || !role) {
      return res.status(400).json({
        message: "Nome, e-mail e perfil são obrigatórios.",
      });
    }

    const data: any = {
      name,
      email,
      role,
      active: active !== false,
    };

    if (password) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }

    const user = await prisma.user.update({
      where: { id },
      data,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        lastLoginIp: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        action: "UPDATE_USER",
        entity: "User",
        entityId: String(user.id),
        description: `Usuário ${user.name} foi atualizado.`,
      },
    });

    return res.json(user);
  }
);

app.patch(
  "/users/:id/toggle-active",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    const id = Number(req.params.id);

    const user = await prisma.user.findUnique({
      where: { id },
    });

    if (!user) {
      return res.status(404).json({
        message: "Usuário não encontrado.",
      });
    }

    const updated = await prisma.user.update({
      where: { id },
      data: {
        active: !user.active,
      },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        active: true,
        lastLoginAt: true,
        createdAt: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        action: updated.active ? "ACTIVATE_USER" : "DEACTIVATE_USER",
        entity: "User",
        entityId: String(updated.id),
        description: `Usuário ${updated.name} foi ${
          updated.active ? "ativado" : "desativado"
        }.`,
      },
    });

    return res.json(updated);
  }
);

app.get(
  "/audit-logs",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (_req, res) => {
    const logs = await prisma.auditLog.findMany({
      orderBy: {
        createdAt: "desc",
      },
      take: 200,
    });

    return res.json(logs);
  }
);

app.get("/service-types", async (_req, res) => {
  const services = await prisma.serviceType.findMany({
    where: { active: true },
    orderBy: { name: "asc" },
  });

  return res.json(services);
});

app.post(
  "/service-types",
  authMiddleware,
  requireRoles(["PROGRAMADOR", "GERENTE"]),
  async (req, res) => {
    const { name, description } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Nome do serviço é obrigatório." });
    }

    const service = await prisma.serviceType.create({
      data: {
        name,
        description,
        active: true,
      },
    });

    return res.status(201).json(service);
  }
);

app.get(
  "/management/prolabore-summary",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const month = getCompetenceMonth(String(req.query.month || ""));
      const user = (req as any).user;

      const data = await calculateManagementFinance(month, user?.id);

      return res.json(data);
    } catch (error) {
      console.error("Erro ao calcular pró-labore:", error);

      return res.status(500).json({
        message: "Erro ao calcular caixa e pró-labore.",
      });
    }
  }
);


app.post(
  "/management/prolabore-advances",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const user = (req as any).user;

      const managerUserId = Number(req.body.managerUserId);
      const competenceMonth = getCompetenceMonth(req.body.competenceMonth);
      const amount = toIntMoney(req.body.amount);
      const paidAt = req.body.paidAt ? new Date(req.body.paidAt) : new Date();

      if (!managerUserId || amount <= 0) {
        return res.status(400).json({
          message: "Gestor e valor do adiantamento são obrigatórios.",
        });
      }

      const manager = await prisma.user.findFirst({
        where: {
          id: managerUserId,
          role: "GERENTE",
          active: true,
        },
      });

      if (!manager) {
        return res.status(404).json({
          message: "Gestor não encontrado ou inativo.",
        });
      }

      const advance = await prisma.proLaboreAdvance.create({
        data: {
          managerUserId,
          competenceMonth,
          amount,
          paidAt,
          description: req.body.description || "Adiantamento de pró-labore",
          notes: req.body.notes || null,
          createdById: user?.id,
        },
        include: {
          manager: true,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
          userRole: user?.role,
          action: "CREATE_PROLABORE_ADVANCE",
          entity: "ProLaboreAdvance",
          entityId: String(advance.id),
          description: `Adiantamento de pró-labore registrado para ${manager.name}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(201).json(advance);
    } catch (error) {
      console.error("Erro ao criar adiantamento de pró-labore:", error);

      return res.status(500).json({
        message: "Erro ao criar adiantamento de pró-labore.",
      });
    }
  }
);

app.delete(
  "/management/prolabore-advances/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);
      const user = (req as any).user;

      const advance = await prisma.proLaboreAdvance.findUnique({
        where: { id },
        include: {
          manager: true,
        },
      });

      if (!advance) {
        return res.status(404).json({
          message: "Adiantamento não encontrado.",
        });
      }

      await prisma.proLaboreAdvance.delete({
        where: { id },
      });

      await prisma.auditLog.create({
        data: {
          userId: user?.id,
          userName: user?.name,
          userEmail: user?.email,
          userRole: user?.role,
          action: "DELETE_PROLABORE_ADVANCE",
          entity: "ProLaboreAdvance",
          entityId: String(id),
          description: `Adiantamento de pró-labore excluído para ${advance.manager.name}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir adiantamento:", error);

      return res.status(500).json({
        message: "Erro ao excluir adiantamento.",
      });
    }
  }
);

app.get(
  "/clients/search",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();

      if (!q) {
        return res.json([]);
      }

      const clients = await prisma.client.findMany({
        where: {
          OR: [
            {
              name: {
                contains: q,
              },
            },
            {
              email: {
                contains: q,
              },
            },
            {
              cpfCnpj: {
                contains: q,
              },
            },
            {
              phone: {
                contains: q,
              },
            },
            {
              whatsapp: {
                contains: q,
              },
            },
          ],
        },
        orderBy: {
          name: "asc",
        },
        take: 20,
      });

      return res.json(clients);
    } catch (error) {
      console.error("Erro ao buscar clientes:", error);

      return res.status(500).json({
        message: "Erro ao buscar clientes.",
      });
    }
  }
);

app.post(
  "/clients",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const {
      name,
      personType,
      cpfCnpj,
      phone,
      whatsapp,
      email,
      address,
      city,
      state,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({ message: "Nome do cliente é obrigatório." });
    }

    const client = await prisma.client.create({
      data: {
        name,
        personType,
        cpfCnpj,
        phone,
        whatsapp,
        email,
        address,
        city,
        state,
        notes,
      },
    });

    return res.status(201).json(client);
  }
);

app.get("/protocols", authMiddleware, async (req: AuthRequest, res) => {
  const protocols = await prisma.protocol.findMany({
    orderBy: { createdAt: "desc" },
include: {
  client: true,
  serviceType: true,
  responsibleUser: true,
  appointments: {
    include: {
      manager: true,
      client: true,
    },
    orderBy: {
      scheduledAt: "desc",
    },
  },
  documents: true,
  payments: true,
  contracts: true,
}
  });

  return res.json(protocols);
});

app.get("/protocols/:id", authMiddleware, async (req, res) => {
  const id = Number(req.params.id);

  const protocol = await prisma.protocol.findUnique({
    where: { id },
    include: {
      client: true,
      serviceType: true,
      appointments: {
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          scheduledAt: "desc",
        },
      },
      payments: true,
      contracts: true,
      documents: {
        orderBy: {
          createdAt: "desc",
        },
      },
    },
  });

  if (!protocol) {
    return res.status(404).json({ message: "Protocolo não encontrado." });
  }

  return res.json(protocol);
});

app.post(
  "/protocols",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    const {
      clientId,
      serviceTypeId,
      description,
      priority,
      estimatedValue,
      deadlineDate,
    } = req.body;

    if (!clientId || !serviceTypeId) {
      return res
        .status(400)
        .json({ message: "Cliente e tipo de serviço são obrigatórios." });
    }

    const protocolNumber = await nextProtocolNumber();

    const protocol = await prisma.protocol.create({
      data: {
        protocolNumber,
        clientId: Number(clientId),
        serviceTypeId: Number(serviceTypeId),
        description,
        priority,
        estimatedValue: estimatedValue ? Number(estimatedValue) : null,
        deadlineDate: deadlineDate ? new Date(deadlineDate) : null,
        createdByUserId: req.user?.id,
        responsibleUserId: req.user?.id,
      },
      include: {
        client: true,
        serviceType: true,
      },
    });

    return res.status(201).json(protocol);
  }
);

app.patch(
  "/protocols/:id/status",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);
    const { status } = req.body;

    if (!status) {
      return res.status(400).json({ message: "Status é obrigatório." });
    }

    const protocol = await prisma.protocol.update({
      where: { id },
      data: { status },
      include: {
        client: true,
        serviceType: true,
      },
    });

    return res.json(protocol);
  }
);

app.patch(
  "/clients/:id",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);

    const {
      name,
      personType,
      cpfCnpj,
      phone,
      whatsapp,
      email,
      address,
      city,
      state,
      notes,
    } = req.body;

    if (!name) {
      return res.status(400).json({
        message: "Nome do cliente é obrigatório.",
      });
    }

    const client = await prisma.client.update({
      where: { id },
      data: {
        name,
        personType,
        cpfCnpj,
        phone,
        whatsapp,
        email,
        address,
        city,
        state,
        notes,
      },
    });

    return res.json(client);
  }
);

app.get("/appointments", authMiddleware, async (_req, res) => {
  const appointments = await prisma.appointment.findMany({
    orderBy: { scheduledAt: "asc" },
    include: {
      client: true,
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      protocol: {
        include: {
          serviceType: true,
        },
      },
    },
  });

  return res.json(appointments);
});

app.post(
  "/appointments",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const {
      protocolId,
      clientId,
      managerUserId,
      scheduledAt,
      durationMinutes,
      timezone,
      meetingType,
      location,
      meetingLink,
      notes,
    } = req.body;

    if (!protocolId || !clientId || !managerUserId || !scheduledAt) {
      return res.status(400).json({
        message: "Protocolo, cliente, gestor e data/hora são obrigatórios.",
      });
    }

    const start = new Date(scheduledAt);
    const duration = Number(durationMinutes || 60);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const manager = await prisma.user.findFirst({
      where: {
        id: Number(managerUserId),
        role: "GERENTE",
        active: true,
      },
    });

    if (!manager) {
      return res.status(400).json({
        message: "Gestor inválido ou inativo.",
      });
    }

    const overlapping = await prisma.appointment.findFirst({
      where: {
        managerUserId: Number(managerUserId),
        status: {
          not: "CANCELADO",
        },
        scheduledAt: {
          lt: end,
        },
        scheduledEndAt: {
          gt: start,
        },
      },
      include: {
        client: true,
        protocol: true,
      },
    });

    if (overlapping) {
      return res.status(409).json({
        message: `Horário indisponível. O gestor já possui agendamento neste intervalo com ${overlapping.client.name}, protocolo ${overlapping.protocol.protocolNumber}.`,
      });
    }

    const appointment = await prisma.appointment.create({
      data: {
        protocolId: Number(protocolId),
        clientId: Number(clientId),
        managerUserId: Number(managerUserId),
        scheduledAt: start,
        scheduledEndAt: end,
        timezone: timezone || "America/Belem",
        meetingType,
        location,
        meetingLink,
        notes,
      },
      include: {
        client: true,
        manager: true,
        protocol: {
          include: {
            serviceType: true,
          },
        },
      },
    });

    await prisma.protocol.update({
      where: { id: Number(protocolId) },
      data: {
        status: "AGENDADO",
        responsibleUserId: Number(managerUserId),
      },
    });

        let emailResult = null;

try {
  emailResult = await sendAppointmentNotificationEmail(appointment.protocolId);
} catch (emailError) {
  console.error("Erro ao enviar e-mail automático do agendamento:", emailError);

  emailResult = {
    sent: false,
    error:
      emailError instanceof Error
        ? emailError.message
        : "Erro desconhecido ao enviar e-mail.",
  };
}

    const companyAlertEmail = process.env.COMPANY_ALERT_EMAIL;

    const recipients = [
      manager.email,
      companyAlertEmail,
    ].filter(Boolean) as string[];

    await prisma.notificationLog.create({
      data: {
        protocolId: appointment.protocolId,
        appointmentId: appointment.id,
        clientId: appointment.clientId,
        type: "EMAIL_GESTOR_AGENDAMENTO",
        recipient: recipients.join(","),
        subject: `Novo agendamento - ${appointment.protocol.protocolNumber}`,
        status: recipients.length > 0 ? "PROCESSADO" : "SEM_DESTINATARIO",
        sentAt: new Date(),
      },
    });

    return res.status(201).json({
  ...appointment,
  emailResult,
});
  }
);

app.patch(
  "/appointments/:id",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);

    const {
      managerUserId,
      scheduledAt,
      durationMinutes,
      timezone,
      meetingType,
      location,
      meetingLink,
      notes,
      status,
    } = req.body;

    const current = await prisma.appointment.findUnique({
      where: { id },
      include: {
        protocol: true,
        client: true,
      },
    });

    if (!current) {
      return res.status(404).json({
        message: "Agendamento não encontrado.",
      });
    }

    const start = scheduledAt ? new Date(scheduledAt) : current.scheduledAt;
    const duration = Number(durationMinutes || 60);
    const end = new Date(start.getTime() + duration * 60 * 1000);

    const targetManagerUserId = managerUserId
      ? Number(managerUserId)
      : current.managerUserId;

    if (!targetManagerUserId) {
      return res.status(400).json({
        message: "Gestor responsável é obrigatório.",
      });
    }

    const manager = await prisma.user.findFirst({
      where: {
        id: targetManagerUserId,
        role: "GERENTE",
        active: true,
      },
    });

    if (!manager) {
      return res.status(400).json({
        message: "Gestor inválido ou inativo.",
      });
    }

    const overlapping = await prisma.appointment.findFirst({
      where: {
        id: {
          not: id,
        },
        managerUserId: targetManagerUserId,
        status: {
          not: "CANCELADO",
        },
        scheduledAt: {
          lt: end,
        },
        scheduledEndAt: {
          gt: start,
        },
      },
      include: {
        client: true,
        protocol: true,
      },
    });

    if (overlapping) {
      return res.status(409).json({
        message: `Horário indisponível. O gestor já possui agendamento neste intervalo com ${overlapping.client.name}, protocolo ${overlapping.protocol.protocolNumber}.`,
      });
    }

    const appointment = await prisma.appointment.update({
      where: { id },
      data: {
        managerUserId: targetManagerUserId,
        scheduledAt: start,
        scheduledEndAt: end,
        timezone: timezone || current.timezone || "America/Belem",
        meetingType,
        location,
        meetingLink,
        notes,
        status,
      },
      include: {
        client: true,
        manager: true,
        protocol: {
          include: {
            serviceType: true,
          },
        },
      },
    });

    await prisma.protocol.update({
      where: { id: current.protocolId },
      data: {
        responsibleUserId: targetManagerUserId,
        status: appointment.status === "CANCELADO" ? "CANCELADO" : "AGENDADO",
      },
    });

    return res.json(appointment);
  }
);

app.post(
  "/protocols/:id/documents",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    const protocolId = Number(req.params.id);
    const { documentType, notes } = req.body;

    if (!req.file) {
      return res.status(400).json({
        message: "Arquivo não enviado.",
      });
    }

    const protocol = await prisma.protocol.findUnique({
      where: { id: protocolId },
    });

    if (!protocol) {
      return res.status(404).json({
        message: "Protocolo não encontrado.",
      });
    }

    const document = await prisma.document.create({
      data: {
        protocolId,
        clientId: protocol.clientId,
        uploadedByUserId: req.user?.id,
        documentType: documentType || "DOCUMENTO_INICIAL",
        fileName: req.file.originalname,
        filePath: `/uploads/documents/${req.file.filename}`,
        mimeType: req.file.mimetype,
        size: req.file.size,
        notes,
      },
    });

    return res.status(201).json(document);
  }
);

app.get("/payments", authMiddleware, async (_req, res) => {
  const payments = await prisma.payment.findMany({
    orderBy: { dueDate: "asc" },
    include: {
      client: true,
      protocol: true,
      contract: true,
    },
  });

  return res.json(payments);
});

app.post(
  "/payments",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const {
      contractId,
      protocolId,
      clientId,
      description,
      amount,
      dueDate,
      status,
      paymentMethod,
      installmentNumber,
      totalInstallments,
      notes,
    } = req.body;

    if (!protocolId || !clientId || !description || !amount || !dueDate) {
      return res.status(400).json({
        message: "Protocolo, cliente, descrição, valor e vencimento são obrigatórios.",
      });
    }

    const payment = await prisma.payment.create({
      data: {
        contractId: contractId ? Number(contractId) : null,
        protocolId: Number(protocolId),
        clientId: Number(clientId),
        description,
        amount: Number(amount),
        dueDate: new Date(dueDate),
        status: status || "PENDENTE",
        paymentMethod,
        installmentNumber: installmentNumber ? Number(installmentNumber) : null,
        totalInstallments: totalInstallments ? Number(totalInstallments) : null,
        notes,
      },
    });

    return res.status(201).json(payment);
  }
);

app.patch(
  "/payments/:id/pay",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);

    const payment = await prisma.payment.update({
      where: { id },
      data: {
        status: "PAGO",
        paidDate: new Date(),
      },
    });

    return res.json(payment);
  }
);

function generatePaymentPublicToken() {
  return crypto.randomBytes(24).toString("hex");
}

function generateBbPaymentTxid(paymentId: number) {
  const base = `AMZPAY${paymentId}${Date.now()}${crypto
    .randomBytes(4)
    .toString("hex")}`;

  return base.replace(/[^a-zA-Z0-9]/g, "").slice(0, 35);
}

function paymentAmountToCents(amount: number) {
  return Math.round(Number(amount || 0) * 100);
}

function extractBbPixCopiaECola(result: any) {
  return result?.pixCopiaECola || result?.emv || result?.brCode || null;
}

function extractBbChargeLocation(result: any) {
  return result?.location || result?.loc?.location || null;
}

function extractBbChargeId(result: any) {
  if (result?.loc?.id !== undefined && result?.loc?.id !== null) {
    return String(result.loc.id);
  }

  if (result?.location) {
    return String(result.location);
  }

  return null;
}

app.post(
  "/payments/:id/issue-bb-pix",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do pagamento inválido.",
        });
      }

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: true,
        },
      });

      if (!payment) {
        return res.status(404).json({
          message: "Pagamento não encontrado.",
        });
      }

      if (payment.status === "PAGO") {
        return res.status(400).json({
          message: "Este pagamento já está marcado como pago.",
        });
      }

      if (payment.status === "CANCELADO") {
        return res.status(400).json({
          message: "Não é possível emitir cobrança para pagamento cancelado.",
        });
      }

      if (!payment.amount || Number(payment.amount) <= 0) {
        return res.status(400).json({
          message: "O valor do pagamento deve ser maior que zero.",
        });
      }

      const amountInCents = paymentAmountToCents(payment.amount);

      if (amountInCents <= 0) {
        return res.status(400).json({
          message: "Valor inválido para emissão da cobrança Pix.",
        });
      }

      const txid = payment.txid || generateBbPaymentTxid(payment.id);

      const description =
        payment.description ||
        `Pagamento do protocolo ${payment.protocol.protocolNumber}`;

      const bbResult = await createBbPixCharge({
        txid,
        amountInCents,
        debtorName: payment.client.name,
        debtorCpfCnpj: payment.client.cpfCnpj,
        description,
      });

      const pixCopiaECola = extractBbPixCopiaECola(bbResult);
      const location = extractBbChargeLocation(bbResult);
      const providerChargeId = extractBbChargeId(bbResult);

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: "PENDENTE",
          paymentMethod: "PIX_BB",
          provider: "BB",
          providerEnv: process.env.BB_ENV || "SANDBOX",
          providerChargeId,
          txid,
          pixCopiaECola,
          pixQrCode: location,
          boletoLinhaDigitavel: payment.boletoLinhaDigitavel || null,
          boletoUrl: payment.boletoUrl || null,
          providerRaw: JSON.stringify(bbResult),
          publicToken: payment.publicToken || generatePaymentPublicToken(),
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: true,
        },
      });

      await createProposalHistory({
        protocolId: payment.protocolId,
        proposalId: payment.contract?.proposalId || null,
        eventType: "COBRANCA_BB_PIX_EMITIDA",
        title: `Cobrança Pix BB emitida`,
        description: `Cobrança Pix emitida para ${payment.client.name}, no valor de ${formatCurrencyBRFromFloat(
          payment.amount
        )}.`,
        recipient: payment.client.email || null,
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          paymentId: payment.id,
          contractId: payment.contractId,
          protocolId: payment.protocolId,
          txid,
          provider: "BB",
          providerEnv: process.env.BB_ENV || "SANDBOX",
          amount: payment.amount,
          pixCopiaECola,
          location,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "ISSUE_BB_PIX_PAYMENT",
          entity: "Payment",
          entityId: String(payment.id),
          description: `Cobrança Pix BB emitida para o pagamento ${payment.id}.`,
          ipAddress: req.ip,
          metadata: JSON.stringify({
            txid,
            providerChargeId,
            pixCopiaECola,
            location,
          }),
        },
      });

      return res.json(updated);
    } catch (error: any) {
      console.error("Erro ao emitir cobrança Pix BB:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      return res.status(500).json({
        message:
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Erro ao emitir cobrança Pix BB.",
        bbError: error?.response?.data || null,
      });
    }
  }
);

app.get(
  "/payments/:id/bb-pix-status",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do pagamento inválido.",
        });
      }

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: true,
          contract: true,
        },
      });

      if (!payment) {
        return res.status(404).json({
          message: "Pagamento não encontrado.",
        });
      }

      if (!payment.txid) {
        return res.status(400).json({
          message: "Este pagamento ainda não possui TXID BB Pix.",
        });
      }

      const bbResult = await getBbPixCharge(payment.txid);

      const bbStatus = String(bbResult?.status || "").toUpperCase();

      let updated = payment;

      if (bbStatus === "CONCLUIDA" && payment.status !== "PAGO") {
        updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            status: "PAGO",
            paidDate: new Date(),
            providerRaw: JSON.stringify(bbResult),
          },
          include: {
            client: true,
            protocol: true,
            contract: true,
          },
        });

        await createProposalHistory({
          protocolId: payment.protocolId,
          proposalId: payment.contract?.proposalId || null,
          eventType: "PAGAMENTO_CONFIRMADO",
          title: `Pagamento confirmado`,
          description: `O pagamento da cobrança Pix foi confirmado pelo Banco do Brasil.`,
          recipient: payment.client.email || null,
          senderName: "Banco do Brasil",
          senderEmail: null,
          metadata: {
            paymentId: payment.id,
            txid: payment.txid,
            provider: "BB",
            status: bbStatus,
            paidAt: new Date().toISOString(),
          },
        });
      } else {
        updated = await prisma.payment.update({
          where: { id: payment.id },
          data: {
            providerRaw: JSON.stringify(bbResult),
          },
          include: {
            client: true,
            protocol: true,
            contract: true,
          },
        });
      }

      return res.json({
        payment: updated,
        bbStatus,
        bbResult,
      });
    } catch (error: any) {
      console.error("Erro ao consultar status Pix BB:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
      });

      return res.status(500).json({
        message:
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.message ||
          "Erro ao consultar status Pix BB.",
        bbError: error?.response?.data || null,
      });
    }
  }
);


// ======================================================
// FINANCEIRO PREMIUM
// Acesso: GERENTE e PROGRAMADOR
// Compatível com schema atual:
// FinancialTransaction: type ENTRADA/SAIDA, source, status,
// dueDate, paidAt, competenceMonth, clientName, protocol, category
// ======================================================

async function calculateManagementFinance(month: string, currentUserId?: number) {
  const competenceMonth = getCompetenceMonth(month);
  const { start, end } = getMonthRange(competenceMonth);

  const cashSetting = await prisma.managementCashSetting.upsert({
    where: {
      competenceMonth,
    },
    update: {},
    create: {
      competenceMonth,
      cashPercent: 10,
      notes: "Percentual padrão inicial do caixa da empresa.",
      createdById: currentUserId,
    },
  });

  const managers = await prisma.user.findMany({
    where: {
      active: true,
      role: "GERENTE",
    },
    orderBy: {
      name: "asc",
    },
    select: {
      id: true,
      name: true,
      email: true,
    },
  });

  const receivedTransactions = await prisma.financialTransaction.findMany({
    where: {
      type: "ENTRADA",
      status: "PAGO",
      OR: [
        {
          competenceMonth,
        },
        {
          paidAt: {
            gte: start,
            lt: end,
          },
        },
      ],
    },
    include: {
      category: true,
      protocol: {
        include: {
          client: true,
          serviceType: true,
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  const paidExpenses = await prisma.financialTransaction.findMany({
    where: {
      type: "SAIDA",
      status: "PAGO",
      OR: [
        {
          competenceMonth,
        },
        {
          paidAt: {
            gte: start,
            lt: end,
          },
        },
      ],
    },
    include: {
      category: true,
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  const fixedCosts = await prisma.fixedCost.findMany({
    where: {
      active: true,
    },
    include: {
      category: true,
    },
    orderBy: {
      dueDay: "asc",
    },
  });

  const salaries = await prisma.employeeSalary.findMany({
    where: {
      active: true,
    },
    include: {
      category: true,
    },
    orderBy: {
      employeeName: "asc",
    },
  });

  const advances = await prisma.proLaboreAdvance.findMany({
    where: {
      competenceMonth,
    },
    include: {
      manager: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      paidAt: "desc",
    },
  });

  const entradasRecebidas = receivedTransactions.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const saidasPagas = paidExpenses.reduce(
    (sum, item) => sum + item.amount,
    0
  );

  const custosFixos = fixedCosts.reduce((sum, item) => sum + item.amount, 0);
  const salarios = salaries.reduce((sum, item) => sum + item.amount, 0);
  const adiantamentos = advances.reduce((sum, item) => sum + item.amount, 0);

  const baseLiquida =
    entradasRecebidas - custosFixos - salarios - saidasPagas - adiantamentos;

  const caixaEmpresa = Math.max(
    0,
    Math.round(baseLiquida * (cashSetting.cashPercent / 100))
  );

  const proLaboreDistribuivel = Math.max(0, baseLiquida - caixaEmpresa);

  const activeManagersCount = Math.max(1, managers.length);

  const proLaboreIndividual = Math.round(
    proLaboreDistribuivel / activeManagersCount
  );

  const managerAdvanceMap = new Map<number, number>();

  advances.forEach((advance) => {
    managerAdvanceMap.set(
      advance.managerUserId,
      (managerAdvanceMap.get(advance.managerUserId) || 0) + advance.amount
    );
  });

  const managersProLabore = managers.map((manager) => {
    const advanceAmount = managerAdvanceMap.get(manager.id) || 0;

    return {
      managerId: manager.id,
      managerName: manager.name,
      managerEmail: manager.email,
      proLaboreBruto: proLaboreIndividual,
      adiantamentos: advanceAmount,
      proLaboreLiquido: Math.max(0, proLaboreIndividual - advanceAmount),
    };
  });

  const currentManager = currentUserId
    ? managersProLabore.find((item) => item.managerId === currentUserId)
    : null;

  return {
    competenceMonth,
    cashPercent: cashSetting.cashPercent,
    managersCount: managers.length,

    entradasRecebidas,
    custosFixos,
    salarios,
    saidasPagas,
    adiantamentos,
    baseLiquida,

    caixaEmpresa,
    proLaboreDistribuivel,
    proLaboreIndividual,

    currentManager,
    managersProLabore,

    extracts: {
      companyCash: [
        ...receivedTransactions.map((item) => ({
          type: "ENTRADA",
          label: item.description,
          amount: item.amount,
          date: item.paidAt || item.dueDate,
          category: item.category?.name || "Receita",
          clientName: item.clientName || item.protocol?.client?.name || null,
          protocolNumber: item.protocol?.protocolNumber || null,
        })),
        ...fixedCosts.map((item) => ({
          type: "CUSTO_FIXO",
          label: item.description,
          amount: -item.amount,
          date: null,
          category: item.category?.name || "Custo fixo",
          clientName: null,
          protocolNumber: null,
        })),
        ...salaries.map((item) => ({
          type: "SALARIO",
          label: item.employeeName,
          amount: -item.amount,
          date: null,
          category: item.category?.name || "Salário",
          clientName: null,
          protocolNumber: null,
        })),
        ...paidExpenses.map((item) => ({
          type: "SAIDA",
          label: item.description,
          amount: -item.amount,
          date: item.paidAt || item.dueDate,
          category: item.category?.name || "Saída",
          clientName: item.clientName || null,
          protocolNumber: null,
        })),
        ...advances.map((item) => ({
          type: "ADIANTAMENTO_PRO_LABORE",
          label: item.description || `Adiantamento - ${item.manager.name}`,
          amount: -item.amount,
          date: item.paidAt,
          category: "Adiantamento de pró-labore",
          clientName: item.manager.name,
          protocolNumber: null,
        })),
      ],

      advances,
    },
  };
}

function getCompetenceMonth(value?: string) {
  return value && /^\d{4}-\d{2}$/.test(value)
    ? value
    : new Date().toISOString().slice(0, 7);
}

function getMonthRange(month: string) {
  const [year, monthNumber] = month.split("-").map(Number);

  const start = new Date(year, monthNumber - 1, 1, 0, 0, 0);
  const end = new Date(year, monthNumber, 1, 0, 0, 0);

  return { start, end };
}


function getCurrentCompetenceMonth() {
  return new Date().toISOString().slice(0, 7);
}

function getCompetenceMonthFromDate(value?: string | Date | null) {
  if (!value) return getCurrentCompetenceMonth();

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return getCurrentCompetenceMonth();
  }

  return date.toISOString().slice(0, 7);
}

function getFinanceMonth(req: any) {
  const month = req.query.month;

  if (month && /^\d{4}-\d{2}$/.test(String(month))) {
    return String(month);
  }

  return getCurrentCompetenceMonth();
}

function toIntMoney(value: any) {
  if (value === null || value === undefined || value === "") return 0;
  return Math.round(Number(value));
}

function normalizeNullableDate(value: any) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date;
}

function buildFinancialWhere(req: any) {
  const { type, status, categoryId, source, search } = req.query;
  const competenceMonth = getFinanceMonth(req);

  const where: any = {
    competenceMonth,
  };

  if (type) {
    where.type = String(type);
  }

  if (status) {
    where.status = String(status);
  }

  if (source) {
    where.source = String(source);
  }

  if (categoryId) {
    where.categoryId = Number(categoryId);
  }

  if (search) {
    const text = String(search);

    where.OR = [
      {
        description: {
          contains: text,
        },
      },
      {
        notes: {
          contains: text,
        },
      },
      {
        clientName: {
          contains: text,
        },
      },
    ];
  }

  return where;
}

function categoryTypeFromTransactionType(type: string) {
  return type === "ENTRADA" ? "RECEITA" : "DESPESA";
}

// ------------------------------------------------------
// CATEGORIAS FINANCEIRAS
// ------------------------------------------------------

app.get(
  "/finance/categories",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (_req, res) => {
    const categories = await prisma.financialCategory.findMany({
      orderBy: [{ type: "asc" }, { name: "asc" }],
    });

    return res.json(categories);
  }
);

app.post(
  "/finance/categories",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const { name, type, color, active } = req.body;

    if (!name || !type) {
      return res.status(400).json({
        message: "Nome e tipo da categoria são obrigatórios.",
      });
    }

    const category = await prisma.financialCategory.upsert({
      where: {
        name_type: {
          name: String(name).trim(),
          type,
        },
      },
      update: {
        color: color || undefined,
        active: active === undefined ? true : Boolean(active),
      },
      create: {
        name: String(name).trim(),
        type,
        color: color || "#64748b",
        active: active === undefined ? true : Boolean(active),
      },
    });

    return res.status(201).json(category);
  }
);

// ------------------------------------------------------
// RESUMO FINANCEIRO
// ------------------------------------------------------

app.get(
  "/finance/summary",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const month = getFinanceMonth(req);

    const transactions = await prisma.financialTransaction.findMany({
      where: {
        competenceMonth: month,
      },
      include: {
        category: true,
        protocol: {
          include: {
            client: true,
            serviceType: true,
          },
        },
      },
      orderBy: {
        dueDate: "desc",
      },
    });

    const fixedCosts = await prisma.fixedCost.findMany({
      where: {
        active: true,
      },
      include: {
        category: true,
      },
    });

    const salaries = await prisma.employeeSalary.findMany({
      where: {
        active: true,
      },
      include: {
        category: true,
      },
    });

    const entradas = transactions
      .filter((item) => item.type === "ENTRADA" && item.status !== "CANCELADO")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const saidasLancadas = transactions
      .filter((item) => item.type === "SAIDA" && item.status !== "CANCELADO")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const entradasRecebidas = transactions
      .filter((item) => item.type === "ENTRADA" && item.status === "PAGO")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const entradasPendentes = transactions
      .filter((item) => item.type === "ENTRADA" && item.status === "PENDENTE")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const saidasPagas = transactions
      .filter((item) => item.type === "SAIDA" && item.status === "PAGO")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const saidasPendentes = transactions
      .filter((item) => item.type === "SAIDA" && item.status === "PENDENTE")
      .reduce((sum, item) => sum + Number(item.amount || 0), 0);

    const custoFixoMensal = fixedCosts.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const salariosMensais = salaries.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    const saidasProjetadas = saidasLancadas + custoFixoMensal + salariosMensais;

    const resultadoPrevisto = entradas - saidasProjetadas;
    const resultadoRealizado = entradasRecebidas - saidasPagas;

    const byCategory = transactions.reduce((acc: any[], item) => {
      const categoryName = item.category?.name || "Sem categoria";
      const existing = acc.find(
        (row) => row.category === categoryName && row.type === item.type
      );

      if (existing) {
        existing.amount += Number(item.amount || 0);
        existing.count += 1;
      } else {
        acc.push({
          category: categoryName,
          type: item.type,
          amount: Number(item.amount || 0),
          count: 1,
          color: item.category?.color || "#64748b",
        });
      }

      return acc;
    }, []);

    return res.json({
      month,

      entradas,
      entradasRecebidas,
      entradasPendentes,

      saidasLancadas,
      saidasPagas,
      saidasPendentes,

      custoFixoMensal,
      salariosMensais,
      saidasProjetadas,

      resultadoPrevisto,
      resultadoRealizado,

      transactionCount: transactions.length,
      fixedCostCount: fixedCosts.length,
      salaryCount: salaries.length,

      byCategory,
    });
  }
);

// ------------------------------------------------------
// TRANSAÇÕES FINANCEIRAS
// ------------------------------------------------------

app.get(
  "/finance/transactions",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const where = buildFinancialWhere(req);

    const transactions = await prisma.financialTransaction.findMany({
      where,
      orderBy: {
        dueDate: "desc",
      },
      include: {
        category: true,
        protocol: {
          include: {
            client: true,
            serviceType: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.json(transactions);
  }
);

app.post(
  "/finance/transactions",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    const {
      type,
      source,
      status,
      categoryId,
      protocolId,
      description,
      amount,
      dueDate,
      paidAt,
      competenceMonth,
      clientName,
      notes,
    } = req.body;

    if (!type || !source || !description || amount === undefined || amount === null) {
      return res.status(400).json({
        message: "Tipo, origem, descrição e valor são obrigatórios.",
      });
    }

    const finalDueDate = normalizeNullableDate(dueDate);
    const finalPaidAt = normalizeNullableDate(paidAt);

    const transaction = await prisma.financialTransaction.create({
      data: {
        type,
        source,
        status: status || "PENDENTE",
        categoryId: categoryId ? Number(categoryId) : null,
        protocolId: protocolId ? Number(protocolId) : null,
        description: String(description).trim(),
        amount: toIntMoney(amount),
        dueDate: finalDueDate,
        paidAt: finalPaidAt,
        competenceMonth:
          competenceMonth ||
          getCompetenceMonthFromDate(finalDueDate || finalPaidAt || new Date()),
        clientName: clientName || null,
        notes: notes || null,
        createdById: req.user?.id || null,
      },
      include: {
        category: true,
        protocol: {
          include: {
            client: true,
            serviceType: true,
          },
        },
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        action: "CREATE_FINANCIAL_TRANSACTION",
        entity: "FinancialTransaction",
        entityId: String(transaction.id),
        description: `Transação financeira criada: ${transaction.description}.`,
        metadata: JSON.stringify({
          type: transaction.type,
          source: transaction.source,
          amount: transaction.amount,
          status: transaction.status,
        }),
      },
    });

    return res.status(201).json(transaction);
  }
);

app.put(
  "/finance/transactions/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    const id = Number(req.params.id);

    const {
      type,
      source,
      status,
      categoryId,
      protocolId,
      description,
      amount,
      dueDate,
      paidAt,
      competenceMonth,
      clientName,
      notes,
    } = req.body;

    const finalDueDate = normalizeNullableDate(dueDate);
    const finalPaidAt = normalizeNullableDate(paidAt);

    const transaction = await prisma.financialTransaction.update({
      where: { id },
      data: {
        type,
        source,
        status,
        categoryId: categoryId ? Number(categoryId) : null,
        protocolId: protocolId ? Number(protocolId) : null,
        description,
        amount: amount !== undefined ? toIntMoney(amount) : undefined,
        dueDate: dueDate === undefined ? undefined : finalDueDate,
        paidAt: paidAt === undefined ? undefined : finalPaidAt,
        competenceMonth:
          competenceMonth ||
          (dueDate || paidAt
            ? getCompetenceMonthFromDate(finalDueDate || finalPaidAt)
            : undefined),
        clientName,
        notes,
      },
      include: {
        category: true,
        protocol: {
          include: {
            client: true,
            serviceType: true,
          },
        },
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        action: "UPDATE_FINANCIAL_TRANSACTION",
        entity: "FinancialTransaction",
        entityId: String(transaction.id),
        description: `Transação financeira atualizada: ${transaction.description}.`,
      },
    });

    return res.json(transaction);
  }
);

app.patch(
  "/finance/transactions/:id/pay",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    const id = Number(req.params.id);

    const transaction = await prisma.financialTransaction.update({
      where: { id },
      data: {
        status: "PAGO",
        paidAt: new Date(),
      },
      include: {
        category: true,
        protocol: true,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id || null,
        userName: req.user?.name || null,
        userEmail: req.user?.email || null,
        userRole: req.user?.role || null,
        action: "PAY_FINANCIAL_TRANSACTION",
        entity: "FinancialTransaction",
        entityId: String(transaction.id),
        description: `Transação financeira marcada como paga: ${transaction.description}.`,
      },
    });

    return res.json(transaction);
  }
);



app.delete(
  "/finance/transactions/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do lançamento inválido.",
        });
      }

      const transaction = await prisma.financialTransaction.findUnique({
        where: { id },
      });

      if (!transaction) {
        return res.status(404).json({
          message: "Lançamento financeiro não encontrado.",
        });
      }

      await prisma.financialTransaction.delete({
        where: { id },
      });

      await prisma.auditLog.create({
        data: {
          userId: (req as any).user?.id,
          userName: (req as any).user?.name,
          userEmail: (req as any).user?.email,
          userRole: (req as any).user?.role,
          action: "DELETE_FINANCIAL_TRANSACTION",
          entity: "FinancialTransaction",
          entityId: String(id),
          description: `Lançamento financeiro excluído: ${transaction.description}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir lançamento financeiro:", error);

      return res.status(500).json({
        message: "Erro ao excluir lançamento financeiro.",
      });
    }
  }
);

app.delete(
  "/finance/fixed-costs/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do custo fixo inválido.",
        });
      }

      const fixedCost = await prisma.fixedCost.findUnique({
        where: { id },
      });

      if (!fixedCost) {
        return res.status(404).json({
          message: "Custo fixo não encontrado.",
        });
      }

      await prisma.fixedCost.update({
        where: { id },
        data: {
          active: false,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: (req as any).user?.id,
          userName: (req as any).user?.name,
          userEmail: (req as any).user?.email,
          userRole: (req as any).user?.role,
          action: "DISABLE_FIXED_COST",
          entity: "FixedCost",
          entityId: String(id),
          description: `Custo fixo desativado: ${fixedCost.description}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao desativar custo fixo:", error);

      return res.status(500).json({
        message: "Erro ao desativar custo fixo.",
      });
    }
  }
);

app.delete(
  "/finance/salaries/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do salário inválido.",
        });
      }

      const salary = await prisma.employeeSalary.findUnique({
        where: { id },
      });

      if (!salary) {
        return res.status(404).json({
          message: "Salário não encontrado.",
        });
      }

      await prisma.employeeSalary.update({
        where: { id },
        data: {
          active: false,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: (req as any).user?.id,
          userName: (req as any).user?.name,
          userEmail: (req as any).user?.email,
          userRole: (req as any).user?.role,
          action: "DISABLE_EMPLOYEE_SALARY",
          entity: "EmployeeSalary",
          entityId: String(id),
          description: `Salário desativado: ${salary.employeeName}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao desativar salário:", error);

      return res.status(500).json({
        message: "Erro ao desativar salário.",
      });
    }
  }
);

app.delete(
  "/finance/categories/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da categoria inválido.",
        });
      }

      const category = await prisma.financialCategory.findUnique({
        where: { id },
        include: {
          transactions: true,
          fixedCosts: true,
          salaries: true,
        },
      });

      if (!category) {
        return res.status(404).json({
          message: "Categoria não encontrada.",
        });
      }

      await prisma.financialCategory.update({
        where: { id },
        data: {
          active: false,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: (req as any).user?.id,
          userName: (req as any).user?.name,
          userEmail: (req as any).user?.email,
          userRole: (req as any).user?.role,
          action: "DISABLE_FINANCIAL_CATEGORY",
          entity: "FinancialCategory",
          entityId: String(id),
          description: `Categoria financeira desativada: ${category.name}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao desativar categoria financeira:", error);

      return res.status(500).json({
        message: "Erro ao desativar categoria financeira.",
      });
    }
  }
);

// ------------------------------------------------------
// CUSTOS FIXOS
// ------------------------------------------------------

app.get(
  "/finance/fixed-costs",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (_req, res) => {
    const fixedCosts = await prisma.fixedCost.findMany({
      orderBy: [{ active: "desc" }, { dueDay: "asc" }, { description: "asc" }],
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.json(fixedCosts);
  }
);

app.post(
  "/finance/fixed-costs",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    const { description, amount, categoryId, dueDay, active, notes } = req.body;

    if (!description || amount === undefined || amount === null || !dueDay) {
      return res.status(400).json({
        message: "Descrição, valor e dia de vencimento são obrigatórios.",
      });
    }

    const fixedCost = await prisma.fixedCost.create({
      data: {
        description: String(description).trim(),
        amount: toIntMoney(amount),
        categoryId: categoryId ? Number(categoryId) : null,
        dueDay: Number(dueDay),
        active: active === undefined ? true : Boolean(active),
        notes: notes || null,
        createdById: req.user?.id || null,
      },
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.status(201).json(fixedCost);
  }
);

app.put(
  "/finance/fixed-costs/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);
    const { description, amount, categoryId, dueDay, active, notes } = req.body;

    const fixedCost = await prisma.fixedCost.update({
      where: { id },
      data: {
        description,
        amount: amount !== undefined ? toIntMoney(amount) : undefined,
        categoryId: categoryId ? Number(categoryId) : null,
        dueDay: dueDay !== undefined ? Number(dueDay) : undefined,
        active: active === undefined ? undefined : Boolean(active),
        notes,
      },
      include: {
        category: true,
      },
    });

    return res.json(fixedCost);
  }
);


// ------------------------------------------------------
// SALÁRIOS / FUNCIONÁRIOS
// ------------------------------------------------------

app.get(
  "/finance/salaries",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (_req, res) => {
    const salaries = await prisma.employeeSalary.findMany({
      orderBy: [{ active: "desc" }, { employeeName: "asc" }],
      include: {
        category: true,
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    return res.json(salaries);
  }
);

app.post(
  "/finance/salaries",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    const {
      employeeName,
      roleDescription,
      amount,
      categoryId,
      dueDay,
      active,
      notes,
    } = req.body;

    if (!employeeName || amount === undefined || amount === null || !dueDay) {
      return res.status(400).json({
        message: "Nome do funcionário, salário e dia de pagamento são obrigatórios.",
      });
    }

    const salary = await prisma.employeeSalary.create({
      data: {
        employeeName: String(employeeName).trim(),
        roleDescription: roleDescription || null,
        amount: toIntMoney(amount),
        categoryId: categoryId ? Number(categoryId) : null,
        dueDay: Number(dueDay),
        active: active === undefined ? true : Boolean(active),
        notes: notes || null,
        createdById: req.user?.id || null,
      },
      include: {
        category: true,
      },
    });

    return res.status(201).json(salary);
  }
);

app.put(
  "/finance/salaries/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);

    const {
      employeeName,
      roleDescription,
      amount,
      categoryId,
      dueDay,
      active,
      notes,
    } = req.body;

    const salary = await prisma.employeeSalary.update({
      where: { id },
      data: {
        employeeName,
        roleDescription,
        amount: amount !== undefined ? toIntMoney(amount) : undefined,
        categoryId: categoryId ? Number(categoryId) : null,
        dueDay: dueDay !== undefined ? Number(dueDay) : undefined,
        active: active === undefined ? undefined : Boolean(active),
        notes,
      },
      include: {
        category: true,
      },
    });

    return res.json(salary);
  }
);

app.patch(
  "/protocols/:id",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);

    const {
      serviceTypeId,
      description,
      priority,
      estimatedValue,
      finalValue,
      deadlineDate,
      status,
      responsibleUserId,
    } = req.body;

    const protocol = await prisma.protocol.update({
      where: { id },
      data: {
        serviceTypeId: serviceTypeId ? Number(serviceTypeId) : undefined,
        description,
        priority,
        estimatedValue:
          estimatedValue !== undefined && estimatedValue !== ""
            ? Number(estimatedValue)
            : undefined,
        finalValue:
          finalValue !== undefined && finalValue !== ""
            ? Number(finalValue)
            : undefined,
        deadlineDate: deadlineDate ? new Date(deadlineDate) : undefined,
        status,
        responsibleUserId: responsibleUserId
          ? Number(responsibleUserId)
          : undefined,
      },
      include: {
        client: true,
        serviceType: true,
        appointments: {
          include: {
            manager: true,
          },
        },
        documents: true,
        payments: true,
        contracts: true,
      },
    });

    return res.json(protocol);
  }
);
app.delete(
  "/protocols/:id",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const id = Number(req.params.id);

    const { reason } = req.body || {};

    const protocol = await prisma.protocol.update({
      where: { id },
      data: {
        status: "CANCELADO",
        cancelReason: reason || "Cancelado pelo usuário.",
      },
      include: {
        client: true,
        serviceType: true,
      },
    });

    await prisma.appointment.updateMany({
      where: {
        protocolId: id,
        status: {
          not: "CANCELADO",
        },
      },
      data: {
        status: "CANCELADO",
      },
    });

    return res.json({
      message: "Protocolo cancelado com sucesso.",
      protocol,
    });
  }
);

// ======================================================
// EXCLUSÕES / DESATIVAÇÕES ADMINISTRATIVAS
// ======================================================

app.delete(
  "/users/:id",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do usuário inválido.",
        });
      }

      const user = await prisma.user.findUnique({
        where: { id },
      });

      if (!user) {
        return res.status(404).json({
          message: "Usuário não encontrado.",
        });
      }

      if (user.role === "PROGRAMADOR") {
        const programmersCount = await prisma.user.count({
          where: {
            role: "PROGRAMADOR",
            active: true,
          },
        });

        if (programmersCount <= 1) {
          return res.status(400).json({
            message:
              "Não é possível excluir/desativar o último usuário programador ativo.",
          });
        }
      }

      await prisma.user.update({
        where: { id },
        data: {
          active: false,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: (req as any).user?.id,
          userName: (req as any).user?.name,
          userEmail: (req as any).user?.email,
          userRole: (req as any).user?.role,
          action: "DELETE_USER_SOFT",
          entity: "User",
          entityId: String(id),
          description: `Usuário ${user.name} foi desativado/excluído logicamente.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir usuário:", error);

      return res.status(500).json({
        message: "Erro ao excluir usuário.",
      });
    }
  }
);


app.delete(
  "/finance/salaries/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      const salary = await prisma.employeeSalary.findUnique({
        where: { id },
      });

      if (!salary) {
        return res.status(404).json({
          message: "Salário não encontrado.",
        });
      }

      await prisma.employeeSalary.update({
        where: { id },
        data: {
          active: false,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: (req as any).user?.id,
          userName: (req as any).user?.name,
          userEmail: (req as any).user?.email,
          userRole: (req as any).user?.role,
          action: "DISABLE_EMPLOYEE_SALARY",
          entity: "EmployeeSalary",
          entityId: String(id),
          description: `Salário de "${salary.employeeName}" foi desativado.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir salário:", error);

      return res.status(500).json({
        message: "Erro ao excluir salário.",
      });
    }
  }
);

app.post(
  "/protocols/:id/resend-email",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const protocolId = Number(req.params.id);

      if (!protocolId || Number.isNaN(protocolId)) {
        return res.status(400).json({
          message: "ID do protocolo inválido.",
        });
      }

      const protocol = await prisma.protocol.findUnique({
        where: { id: protocolId },
        include: {
          client: true,
          serviceType: true,
          appointments: {
            include: {
              manager: true,
            },
            orderBy: {
              scheduledAt: "desc",
            },
            take: 1,
          },
        },
      });

      if (!protocol) {
        return res.status(404).json({
          message: "Protocolo não encontrado.",
        });
      }

      if (!protocol.appointments.length) {
        return res.status(400).json({
          message: "Este protocolo ainda não possui agendamento para envio.",
        });
      }

      const result = await sendAppointmentNotificationEmail(protocolId);

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          userName: req.user?.name,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          action: "RESEND_APPOINTMENT_EMAIL",
          entity: "Protocol",
          entityId: String(protocolId),
          description: `E-mail de agendamento reenviado para o protocolo ${protocol.protocolNumber}.`,
          metadata: JSON.stringify(result),
        },
      });

      return res.json({
        message: result.sent
          ? "E-mail reenviado com sucesso."
          : "E-mail não enviado.",
        result,
      });
    } catch (err) {
      console.error("Erro na rota de reenvio de e-mail:", err);

      return res.status(500).json({
        message:
          err instanceof Error
            ? err.message
            : "Erro ao reenviar e-mail de agendamento.",
      });
    }
  }
);

app.get(
  "/settings/smtp",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (_req, res) => {
    const settings = await getSmtpSettings();

    return res.json({
      smtpHost: settings.smtpHost,
      smtpPort: settings.smtpPort,
      smtpUser: settings.smtpUser,
      smtpPassConfigured: Boolean(settings.smtpPass),
      smtpFrom: settings.smtpFrom,
      smtpSecure: settings.smtpSecure,
      companyAlertEmail: settings.companyAlertEmail,
    });
  }
);

app.put(
  "/settings/smtp",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    const {
      smtpHost,
      smtpPort,
      smtpUser,
      smtpPass,
      smtpFrom,
      smtpSecure,
      companyAlertEmail,
    } = req.body;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpFrom || !companyAlertEmail) {
      return res.status(400).json({
        message:
          "Host, porta, usuário, remetente e e-mail da empresa são obrigatórios.",
      });
    }

    await setSetting("SMTP_HOST", smtpHost, "SMTP");
    await setSetting("SMTP_PORT", String(smtpPort), "SMTP");
    await setSetting("SMTP_USER", smtpUser, "SMTP");
    await setSetting("SMTP_FROM", smtpFrom, "SMTP");
    await setSetting("SMTP_SECURE", String(Boolean(smtpSecure)), "SMTP");
    await setSetting("COMPANY_ALERT_EMAIL", companyAlertEmail, "SMTP");

    if (smtpPass) {
      await setSetting("SMTP_PASS", smtpPass, "SMTP");
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user?.id,
        userName: req.user?.name,
        userEmail: req.user?.email,
        userRole: req.user?.role,
        action: "UPDATE_SMTP_SETTINGS",
        entity: "SystemSetting",
        description: "Configurações SMTP atualizadas.",
      },
    });

    return res.json({
      message: "Configurações SMTP salvas com sucesso.",
    });
  }
);

app.post(
  "/settings/smtp/test",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    const { testEmail } = req.body;

    const settings = await getSmtpSettings();

    if (!testEmail) {
      return res.status(400).json({
        message: "Informe um e-mail para teste.",
      });
    }

    const transporter = await createTransporterFromSettings();

    if (!transporter) {
      return res.status(400).json({
        message: "SMTP não configurado corretamente.",
      });
    }

    try {
      await transporter.sendMail({
        from: settings.smtpFrom,
        to: testEmail,
        subject: "Teste SMTP — SIS Amazonika",
        html: `
          <div style="font-family: Arial, sans-serif; color:#10231b;">
            <h2 style="color:#14543f;">Teste SMTP — SIS Amazonika</h2>
            <p>Se você recebeu este e-mail, o SMTP está funcionando corretamente.</p>
            <p><strong>Remetente:</strong> ${settings.smtpFrom}</p>
          </div>
        `,
        text: "Teste SMTP — SIS Amazonika. Se você recebeu este e-mail, o SMTP está funcionando corretamente.",
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id,
          userName: req.user?.name,
          userEmail: req.user?.email,
          userRole: req.user?.role,
          action: "TEST_SMTP",
          entity: "SystemSetting",
          description: `Teste SMTP enviado para ${testEmail}.`,
        },
      });

      return res.json({
        message: "E-mail de teste enviado com sucesso.",
      });
    } catch (err) {
      console.error(err);

      return res.status(500).json({
        message:
          "Erro ao enviar e-mail de teste. Verifique host, porta, usuário, senha e segurança.",
      });
    }
  }
);

app.get(
  "/settings/company",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req, res) => {
    try {
      const settings = await getCompanySettings();

      return res.json(settings);
    } catch (error) {
      console.error("Erro ao carregar dados da empresa:", error);

      return res.status(500).json({
        message: "Erro ao carregar dados da empresa.",
      });
    }
  }
);

app.put(
  "/settings/company",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req, res) => {
    try {
      const settings = await saveCompanySettings(req.body);

      const authUser = (req as any).user;

      await prisma.auditLog.create({
        data: {
          userId: authUser?.id || null,
          userName: authUser?.name || null,
          userEmail: authUser?.email || null,
          action: "UPDATE_COMPANY_SETTINGS",
          entity: "SystemSetting",
          entityId: "COMPANY",
          description: "Dados institucionais da empresa atualizados.",
          metadata: JSON.stringify({
            updatedFields: Object.keys(req.body || {}),
          }),
        },
      });

      return res.json({
        message: "Dados da empresa atualizados com sucesso.",
        settings,
      });
    } catch (error) {
      console.error("Erro ao salvar dados da empresa:", error);

      return res.status(500).json({
        message: "Erro ao salvar dados da empresa.",
      });
    }
  }
);

app.get(
  "/fixed-costs",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (_req, res) => {
    const costs = await prisma.fixedCost.findMany({
      orderBy: { createdAt: "desc" },
    });

    return res.json(costs);
  }
);

app.post(
  "/fixed-costs",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    const { description, category, amount, dueDay, recurrence, notes } = req.body;

    if (!description || !amount) {
      return res.status(400).json({
        message: "Descrição e valor são obrigatórios.",
      });
    }

    const cost = await prisma.fixedCost.create({
      data: {
        description,
        category,
        amount: Number(amount),
        dueDay: dueDay ? Number(dueDay) : null,
        recurrence: recurrence || "MENSAL",
        notes,
        active: true,
      },
    });

    return res.status(201).json(cost);
  }
);

app.post("/public-requests", async (req, res) => {
  const { name, phone, email, serviceTypeId, message } = req.body;

  if (!name) {
    return res.status(400).json({ message: "Nome é obrigatório." });
  }

  const request = await prisma.publicRequest.create({
    data: {
      name,
      phone,
      email,
      serviceTypeId: serviceTypeId ? Number(serviceTypeId) : null,
      message,
    },
  });

  return res.status(201).json(request);
});

app.get(
  "/public-requests",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (_req, res) => {
    const requests = await prisma.publicRequest.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        serviceType: true,
      },
    });

    return res.json(requests);
  }
);

app.get(
  "/dashboard",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (_req, res) => {
    try {
      const [
        protocolsCount,
        appointmentsCount,
        clientsCount,
        recentProtocols,
      ] = await Promise.all([
        prisma.protocol.count(),

        prisma.appointment.count(),

        prisma.client.count(),

        prisma.protocol.findMany({
          orderBy: {
            createdAt: "desc",
          },
          take: 6,
          include: {
            client: true,
            serviceType: true,
          },
        }),
      ]);

      return res.json({
        protocolsCount,
        appointmentsCount,
        clientsCount,
        recentProtocols,
      });
    } catch (error) {
      console.error("Erro ao carregar dashboard:", error);

      return res.status(500).json({
        message: "Erro ao carregar dashboard.",
      });
    }
  }
);

app.get("/company-settings", async (_req, res) => {
  const settings = await prisma.companySettings.findFirst({
    where: { id: 1 },
  });

  return res.json(settings);
});

app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error(error);

  return res.status(500).json({
    message: "Erro interno do servidor.",
  });
});

// ------------------------------------------------------
// GESTÃO / CAIXA / PRÓ-LABORE DOS GESTORES
// ------------------------------------------------------

function getManagementMonth(req: any) {
  const rawMonth = String(req.query.month || req.body?.competenceMonth || "").trim();

  if (/^\d{4}-\d{2}$/.test(rawMonth)) {
    return rawMonth;
  }

  return new Date().toISOString().slice(0, 7);
}

function sumMoney(items: Array<{ amount?: number | null }>) {
  return items.reduce((sum, item) => sum + Number(item.amount || 0), 0);
}

function percentOf(value: number, percent: number) {
  if (!Number.isFinite(value) || !Number.isFinite(percent)) return 0;
  return Math.round((value * percent) / 100);
}

function safePositive(value: number) {
  return Number.isFinite(value) ? Math.max(value, 0) : 0;
}

app.get(
  "/management/pro-labore-summary",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const month = getManagementMonth(req);
      const loggedUser = req.user;

      const [
        transactions,
        fixedCosts,
        salaries,
        cashSetting,
        managers,
        advances,
      ] = await Promise.all([
        prisma.financialTransaction.findMany({
          where: {
            competenceMonth: month,
            status: {
              not: "CANCELADO",
            },
          },
          include: {
            category: true,
            protocol: {
              include: {
                client: true,
                serviceType: true,
              },
            },
          },
          orderBy: {
            dueDate: "desc",
          },
        }),

        prisma.fixedCost.findMany({
          where: {
            active: true,
          },
          include: {
            category: true,
          },
          orderBy: {
            dueDay: "asc",
          },
        }),

        prisma.employeeSalary.findMany({
          where: {
            active: true,
          },
          include: {
            category: true,
          },
          orderBy: {
            employeeName: "asc",
          },
        }),

        prisma.managementCashSetting.findUnique({
          where: {
            competenceMonth: month,
          },
        }),

        prisma.user.findMany({
          where: {
            role: "GERENTE",
            active: true,
          },
          orderBy: {
            name: "asc",
          },
        }),

        prisma.proLaboreAdvance.findMany({
          where: {
            competenceMonth: month,
          },
          include: {
            manager: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
            createdBy: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: {
            paidAt: "desc",
          },
        }),
      ]);

      const entradasRecebidas = transactions.filter(
        (item) => item.type === "ENTRADA" && item.status === "PAGO"
      );

      const saidasLancadas = transactions.filter(
        (item) => item.type === "SAIDA" && item.status !== "CANCELADO"
      );

      const faturamentoMensal = sumMoney(entradasRecebidas);
      const custosFixos = sumMoney(fixedCosts);
      const salariosFuncionarios = sumMoney(salaries);
      const saidasProjetadas = sumMoney(saidasLancadas);
      const adiantamentosTotais = sumMoney(advances);

      const liquidoAntesCaixa =
        faturamentoMensal -
        custosFixos -
        salariosFuncionarios -
        saidasProjetadas -
        adiantamentosTotais;

      const cashPercent = cashSetting?.cashPercent ?? 10;
      const caixaEmpresa = percentOf(safePositive(liquidoAntesCaixa), cashPercent);

      const liquidoDistribuivel = safePositive(liquidoAntesCaixa - caixaEmpresa);

      const managersCount = managers.length;
      const proLaboreIndividual =
        managersCount > 0 ? Math.round(liquidoDistribuivel / managersCount) : 0;

      const formattedAdvances = advances.map((advance) => ({
        id: advance.id,
        managerUserId: advance.managerUserId,
        managerName: advance.manager?.name || "-",
        managerEmail: advance.manager?.email || "-",
        amount: advance.amount,
        paidAt: advance.paidAt,
        description: advance.description,
        notes: advance.notes,
        createdBy: advance.createdBy,
      }));

      const managersSummary = managers.map((manager) => {
        const managerAdvances = advances.filter(
          (advance) => advance.managerUserId === manager.id
        );

        const totalAdvances = sumMoney(managerAdvances);
        const saldoReceber = safePositive(proLaboreIndividual - totalAdvances);

        return {
          id: manager.id,
          name: manager.name,
          email: manager.email,
          proLabore: proLaboreIndividual,
          proLaboreBruto: proLaboreIndividual,
          advances: totalAdvances,
          adiantamentos: totalAdvances,
          saldoReceber,
          proLaboreLiquido: saldoReceber,
        };
      });

const currentManager =
  loggedUser?.role === "GERENTE"
    ? managersSummary.find((manager) => manager.id === Number(loggedUser?.id)) ||
      null
    : null;

      const myAdvances = advances
        .filter((advance) => advance.managerUserId === Number(loggedUser?.id))
        .map((advance) => ({
          id: advance.id,
          managerUserId: advance.managerUserId,
          competenceMonth: advance.competenceMonth,
          amount: advance.amount,
          paidAt: advance.paidAt,
          description: advance.description || "Adiantamento de pró-labore",
          notes: advance.notes,
          manager: advance.manager,
          createdBy: advance.createdBy,
        }));

      const meuAdiantamento = currentManager?.advances || 0;
      const meuProLaboreLiquido = currentManager?.saldoReceber || 0;

      const cashExtract = [
        {
          label: "Faturamento mensal recebido",
          type: "ENTRADA",
          amount: faturamentoMensal,
          value: faturamentoMensal,
          description: "Entradas pagas registradas no mês.",
        },
        {
          label: "Custos fixos ativos",
          type: "SAIDA",
          amount: custosFixos,
          value: custosFixos,
          description: "Custos fixos mensais ativos.",
        },
        {
          label: "Salários de funcionários",
          type: "SAIDA",
          amount: salariosFuncionarios,
          value: salariosFuncionarios,
          description: "Folha salarial ativa cadastrada.",
        },
        {
          label: "Saídas projetadas/lançadas",
          type: "SAIDA",
          amount: saidasProjetadas,
          value: saidasProjetadas,
          description: "Saídas financeiras cadastradas no mês.",
        },
        {
          label: "Adiantamentos de pró-labore",
          type: "SAIDA",
          amount: adiantamentosTotais,
          value: adiantamentosTotais,
          description: "Adiantamentos pagos aos gestores no mês.",
        },
        {
          label: "Líquido antes do caixa",
          type: "RESULTADO",
          amount: liquidoAntesCaixa,
          value: liquidoAntesCaixa,
          description: "Resultado antes da reserva de caixa da empresa.",
        },
        {
          label: `Reserva de caixa da empresa (${cashPercent}%)`,
          type: "RESULTADO",
          amount: caixaEmpresa,
          value: caixaEmpresa,
          description: "Percentual reservado sobre o líquido mensal.",
        },
        {
          label: "Líquido distribuível aos gestores",
          type: "RESULTADO",
          amount: liquidoDistribuivel,
          value: liquidoDistribuivel,
          description: "Valor final disponível para divisão entre gestores.",
        },
      ];

      const proLaboreExtract = [
        {
          label: "Líquido distribuível aos gestores",
          type: "RESULTADO",
          amount: liquidoDistribuivel,
          value: liquidoDistribuivel,
          description: "Valor após reserva de caixa da empresa.",
        },
        {
          label: "Gestores ativos",
          type: "INFO",
          amount: managersCount,
          value: managersCount,
          description: "Quantidade considerada na divisão.",
        },
        {
          label: "Pró-labore individual bruto",
          type: "PRO_LABORE",
          amount: proLaboreIndividual,
          value: proLaboreIndividual,
          description: "Valor bruto previsto para cada gestor.",
        },
        {
          label: "Meus adiantamentos",
          type: "SAIDA",
          amount: meuAdiantamento,
          value: meuAdiantamento,
          description: "Valores antecipados ao gestor logado.",
        },
        {
          label: "Meu pró-labore líquido",
          type: "RESULTADO",
          amount: meuProLaboreLiquido,
          value: meuProLaboreLiquido,
          description: "Saldo previsto após desconto dos adiantamentos.",
        },
      ];

      return res.json({
        month,
        competenceMonth: month,

        cashPercent,
        managersCount,
        gestoresAtivos: managersCount,

        faturamentoMensal,
        custosFixos,
        salariosFuncionarios,
        saidasProjetadas,
        saidasLancadas: saidasProjetadas,
        adiantamentosTotais,
        adiantamentosProLabore: adiantamentosTotais,

        liquidoAntesCaixa,
        caixaEmpresa,
        liquidoDistribuivel,

        proLaboreIndividual,
        proLaboreBrutoPorGestor: proLaboreIndividual,

        meuAdiantamento,
        meuProLaboreLiquido,

        currentManager,
        managers: managersSummary,

        advances: formattedAdvances,
        myAdvances,

        cashExtract,
        proLaboreExtract,
      });
    } catch (error) {
      console.error("Erro ao carregar resumo de caixa e pró-labore:", error);

      return res.status(500).json({
        message: "Erro ao carregar resumo de caixa e pró-labore.",
      });
    }
  }
);



app.get(
  "/management/cash-setting",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const month = getManagementMonth(req);

      const setting = await prisma.managementCashSetting.findUnique({
        where: {
          competenceMonth: month,
        },
      });

      return res.json({
        competenceMonth: month,
        cashPercent: setting?.cashPercent ?? 10,
        notes: setting?.notes || "",
      });
    } catch (error) {
      console.error("Erro ao carregar percentual de caixa:", error);

      return res.status(500).json({
        message: "Erro ao carregar percentual de caixa.",
      });
    }
  }
);

app.put(
  "/management/cash-setting",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const competenceMonth =
        req.body.competenceMonth || new Date().toISOString().slice(0, 7);

      const cashPercent = Number(req.body.cashPercent);

      if (
        Number.isNaN(cashPercent) ||
        cashPercent < 0 ||
        cashPercent > 100
      ) {
        return res.status(400).json({
          message: "Percentual de caixa deve estar entre 0 e 100.",
        });
      }

      const setting = await prisma.managementCashSetting.upsert({
        where: {
          competenceMonth,
        },
        update: {
          cashPercent,
          notes: req.body.notes || null,
          createdById: req.user?.id || null,
        },
        create: {
          competenceMonth,
          cashPercent,
          notes: req.body.notes || null,
          createdById: req.user?.id || null,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "UPDATE_MANAGEMENT_CASH_SETTING",
          entity: "ManagementCashSetting",
          entityId: String(setting.id),
          description: `Percentual de caixa atualizado para ${cashPercent}% no mês ${competenceMonth}.`,
          ipAddress: req.ip,
        },
      });

      return res.json(setting);
    } catch (error) {
      console.error("Erro ao salvar percentual de caixa:", error);

      return res.status(500).json({
        message: "Erro ao salvar percentual de caixa.",
      });
    }
  }
);

app.get(
  "/management/pro-labore-advances",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const month = getManagementMonth(req);

      const advances = await prisma.proLaboreAdvance.findMany({
        where: {
          competenceMonth: month,
        },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
        orderBy: {
          paidAt: "desc",
        },
      });

      return res.json(advances);
    } catch (error) {
      console.error("Erro ao carregar adiantamentos:", error);

      return res.status(500).json({
        message: "Erro ao carregar adiantamentos de pró-labore.",
      });
    }
  }
);

app.post(
  "/management/pro-labore-advances",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const {
        managerUserId,
        competenceMonth,
        amount,
        paidAt,
        description,
        notes,
      } = req.body;

      if (!managerUserId || !competenceMonth || amount === undefined || amount === null) {
        return res.status(400).json({
          message: "Gestor, mês de competência e valor são obrigatórios.",
        });
      }

      const manager = await prisma.user.findFirst({
        where: {
          id: Number(managerUserId),
          role: "GERENTE",
          active: true,
        },
      });

      if (!manager) {
        return res.status(404).json({
          message: "Gestor não encontrado ou inativo.",
        });
      }

      const advance = await prisma.proLaboreAdvance.create({
        data: {
          managerUserId: Number(managerUserId),
          competenceMonth,
          amount: toIntMoney(amount),
          paidAt: paidAt ? new Date(paidAt) : new Date(),
          description: description || "Adiantamento de pró-labore",
          notes: notes || null,
          createdById: req.user?.id || null,
        },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "CREATE_PRO_LABORE_ADVANCE",
          entity: "ProLaboreAdvance",
          entityId: String(advance.id),
          description: `Adiantamento de pró-labore registrado para ${advance.manager.name}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(201).json(advance);
    } catch (error) {
      console.error("Erro ao registrar adiantamento:", error);

      return res.status(500).json({
        message: "Erro ao registrar adiantamento de pró-labore.",
      });
    }
  }
);
app.put(
  "/management/pro-labore-advances/:id",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do adiantamento inválido.",
        });
      }

      const existing = await prisma.proLaboreAdvance.findUnique({
        where: { id },
      });

      if (!existing) {
        return res.status(404).json({
          message: "Adiantamento de pró-labore não encontrado.",
        });
      }

      const {
        managerUserId,
        competenceMonth,
        amount,
        paidAt,
        description,
        notes,
      } = req.body;

      if (!managerUserId || !competenceMonth || amount === undefined || amount === null) {
        return res.status(400).json({
          message: "Gestor, mês de competência e valor são obrigatórios.",
        });
      }

      const manager = await prisma.user.findFirst({
        where: {
          id: Number(managerUserId),
          role: "GERENTE",
          active: true,
        },
      });

      if (!manager) {
        return res.status(404).json({
          message: "Gestor não encontrado ou inativo.",
        });
      }

      const advance = await prisma.proLaboreAdvance.update({
        where: { id },
        data: {
          managerUserId: Number(managerUserId),
          competenceMonth,
          amount: toIntMoney(amount),
          paidAt: paidAt ? new Date(paidAt) : existing.paidAt,
          description: description || "Adiantamento de pró-labore",
          notes: notes || null,
        },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "UPDATE_PRO_LABORE_ADVANCE",
          entity: "ProLaboreAdvance",
          entityId: String(advance.id),
          description: `Adiantamento de pró-labore atualizado para ${advance.manager.name}.`,
          ipAddress: req.ip,
        },
      });

      return res.json(advance);
    } catch (error) {
      console.error("Erro ao atualizar adiantamento:", error);

      return res.status(500).json({
        message: "Erro ao atualizar adiantamento de pró-labore.",
      });
    }
  }
);

app.delete(
  "/management/pro-labore-advances/:id",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID do adiantamento inválido.",
        });
      }

      const advance = await prisma.proLaboreAdvance.findUnique({
        where: { id },
        include: {
          manager: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!advance) {
        return res.status(404).json({
          message: "Adiantamento de pró-labore não encontrado.",
        });
      }

      await prisma.proLaboreAdvance.delete({
        where: { id },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "DELETE_PRO_LABORE_ADVANCE",
          entity: "ProLaboreAdvance",
          entityId: String(id),
          description: `Adiantamento de pró-labore excluído: ${advance.description || "Sem descrição"} - ${advance.manager.name}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(204).send();
    } catch (error) {
      console.error("Erro ao excluir adiantamento:", error);

      return res.status(500).json({
        message: "Erro ao excluir adiantamento de pró-labore.",
      });
    }
  }
);

// ------------------------------------------------------
// PROPOSTAS COMERCIAIS
// ------------------------------------------------------

app.get(
  "/proposals",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const protocolId = req.query.protocolId
        ? Number(req.query.protocolId)
        : null;

      const proposals = await prisma.proposal.findMany({
        where: protocolId ? { protocolId } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      return res.json(proposals);
    } catch (error) {
      console.error("Erro ao listar propostas:", error);

      return res.status(500).json({
        message: "Erro ao listar propostas.",
      });
    }
  }
);

app.put(
  "/proposals/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da proposta inválido.",
        });
      }

      const existing = await prisma.proposal.findUnique({
        where: { id },
        include: {
          items: true,
          protocol: true,
          client: true,
        },
      });

      if (!existing) {
        return res.status(404).json({
          message: "Proposta não encontrada.",
        });
      }

      if (
        existing.status !== "RASCUNHO" &&
        existing.status !== "AJUSTE_SOLICITADO"
      ) {
        return res.status(400).json({
          message:
            "Somente propostas em rascunho ou com ajuste solicitado podem ser editadas.",
        });
      }

      const {
        title,
        description,
        technicalScope,
        paymentMode,
        entryAmount,
        installmentQty,
        executionDays,
        validUntil,
        clientMessage,
        internalNotes,
        items,
      } = req.body;

      if (!title) {
        return res.status(400).json({
          message: "Título da proposta é obrigatório.",
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          message: "Inclua pelo menos um item na proposta.",
        });
      }

      const { normalizedItems, totalAmount } = calculateProposalTotals(items);

      if (totalAmount <= 0) {
  return res.status(400).json({
    message: "O valor total da proposta deve ser maior que zero.",
  });
}




      const finalEntryAmount =
        entryAmount !== undefined && entryAmount !== null && entryAmount !== ""
          ? toIntMoney(entryAmount)
          : Math.round(totalAmount * 0.3);

          if (finalEntryAmount < 0) {
  return res.status(400).json({
    message: "O valor da entrada não pode ser negativo.",
  });
}

if (finalEntryAmount > totalAmount) {
  return res.status(400).json({
    message: "O valor da entrada não pode ser maior que o valor total da proposta.",
  });
}

      const finalInstallmentQty =
        installmentQty !== undefined &&
        installmentQty !== null &&
        installmentQty !== ""
          ? Number(installmentQty)
          : null;

      const installmentAmount =
        finalInstallmentQty && finalInstallmentQty > 0
          ? Math.round((totalAmount - finalEntryAmount) / finalInstallmentQty)
          : null;

          if (finalInstallmentQty !== null && finalInstallmentQty < 0) {
  return res.status(400).json({
    message: "A quantidade de parcelas não pode ser negativa.",
  });
}

if (
  paymentMode === "ENTRADA_PARCELAS" &&
  (!finalInstallmentQty || finalInstallmentQty <= 0)
) {
  return res.status(400).json({
    message: "Informe a quantidade de parcelas para pagamento com entrada + parcelas.",
  });
}

if (paymentMode === "A_VISTA" && finalEntryAmount !== totalAmount) {
  return res.status(400).json({
    message: "Para pagamento à vista, o valor da entrada deve ser igual ao valor total.",
  });
}



      await prisma.proposalItem.deleteMany({
        where: {
          proposalId: id,
        },
      });

      const proposal = await prisma.proposal.update({
        where: { id },
        data: {
          title: String(title).trim(),
          description: description || null,
          technicalScope: technicalScope || null,
          paymentMode: paymentMode || "ENTRADA_PARCELAS",

          totalAmount,
          entryAmount: finalEntryAmount,
          installmentQty: finalInstallmentQty,
          installmentAmount,

          executionDays: executionDays ? Number(executionDays) : null,
          validUntil: validUntil ? new Date(validUntil) : null,

          clientMessage: clientMessage || existing.clientMessage || null,
          internalNotes: internalNotes || null,

          items: {
            create: normalizedItems,
          },
        },
        include: {
          client: true,
          protocol: true,
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "UPDATE_PROPOSAL",
          entity: "Proposal",
          entityId: String(proposal.id),
          description: `Proposta ${proposal.proposalNumber} atualizada.`,
          ipAddress: req.ip,
        },
      });

      if (existing.status === "AJUSTE_SOLICITADO") {
        await createProposalHistory({
          protocolId: proposal.protocolId,
          proposalId: proposal.id,
          eventType: "PROPOSTA_AJUSTADA",
          title: `Proposta ${proposal.proposalNumber} ajustada pela equipe`,
          description:
            "A proposta foi revisada pela equipe após solicitação de ajuste do cliente.",
          senderName: req.user?.name || null,
          senderEmail: req.user?.email || null,
          createdById: req.user?.id || null,
          metadata: {
            proposalNumber: proposal.proposalNumber,
            previousTotalAmount: existing.totalAmount,
            newTotalAmount: proposal.totalAmount,
            previousEntryAmount: existing.entryAmount,
            newEntryAmount: proposal.entryAmount,
            previousClientMessage: existing.clientMessage || null,
            currentClientMessage: proposal.clientMessage || null,
          },
        });
      }

      return res.json(proposal);
    } catch (error) {
      console.error("Erro ao atualizar proposta:", error);

      return res.status(500).json({
        message: "Erro ao atualizar proposta.",
      });
    }
  }
);

app.post(
  "/proposals",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const {
        protocolId,
        title,
        description,
        technicalScope,
        paymentMode,
        entryAmount,
        installmentQty,
        executionDays,
        validUntil,
        clientMessage,
        internalNotes,
        items,
      } = req.body;

      if (!protocolId) {
        return res.status(400).json({
          message: "Protocolo é obrigatório.",
        });
      }

      if (!title) {
        return res.status(400).json({
          message: "Título da proposta é obrigatório.",
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          message: "Inclua pelo menos um item na proposta.",
        });
      }

      const protocol = await prisma.protocol.findUnique({
        where: {
          id: Number(protocolId),
        },
        include: {
          client: true,
          serviceType: true,
        },
      });

      if (!protocol) {
        return res.status(404).json({
          message: "Protocolo não encontrado.",
        });
      }

      const { normalizedItems, totalAmount } = calculateProposalTotals(items);

const finalEntryAmount =
  paymentMode === "A_VISTA"
    ? totalAmount
    : entryAmount !== undefined && entryAmount !== null && entryAmount !== ""
    ? toIntMoney(entryAmount)
    : Math.round(totalAmount * 0.3);

if (finalEntryAmount < 0) {
  return res.status(400).json({
    message: "O valor da entrada não pode ser negativo.",
  });
}

if (finalEntryAmount > totalAmount) {
  return res.status(400).json({
    message:
      "O valor da entrada não pode ser maior que o valor total da proposta.",
  });
}

const finalInstallmentQty =
  installmentQty !== undefined &&
  installmentQty !== null &&
  installmentQty !== ""
    ? Number(installmentQty)
    : null;

if (finalInstallmentQty !== null && finalInstallmentQty < 0) {
  return res.status(400).json({
    message: "A quantidade de parcelas não pode ser negativa.",
  });
}

if (
  paymentMode === "ENTRADA_PARCELAS" &&
  (!finalInstallmentQty || finalInstallmentQty <= 0)
) {
  return res.status(400).json({
    message:
      "Informe a quantidade de parcelas para pagamento com entrada + parcelas.",
  });
}

      const installmentAmount =
        finalInstallmentQty && finalInstallmentQty > 0
          ? Math.round((totalAmount - finalEntryAmount) / finalInstallmentQty)
          : null;

      const proposalNumber = await generateProposalNumber();

      const proposal = await prisma.proposal.create({
        data: {
          proposalNumber,
          protocolId: protocol.id,
          clientId: protocol.clientId,
          createdById: req.user?.id || null,

          title: String(title).trim(),
          description: description || null,
          technicalScope: technicalScope || null,

          paymentMode: paymentMode || "ENTRADA_PARCELAS",

          totalAmount,
          entryAmount: finalEntryAmount,
          installmentQty: finalInstallmentQty,
          installmentAmount,

          executionDays: executionDays ? Number(executionDays) : null,
          validUntil: validUntil ? new Date(validUntil) : null,

          clientMessage: clientMessage || null,
          internalNotes: internalNotes || null,

          publicToken: generatePublicToken(),

          rawSnapshot: JSON.stringify({
            protocolNumber: protocol.protocolNumber,
            clientName: protocol.client.name,
            serviceName: protocol.serviceType.name,
            createdAt: new Date().toISOString(),
          }),

          items: {
            create: normalizedItems,
          },
        },
        include: {
          client: true,
          protocol: true,
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "CREATE_PROPOSAL",
          entity: "Proposal",
          entityId: String(proposal.id),
          description: `Proposta ${proposal.proposalNumber} criada para o protocolo ${protocol.protocolNumber}.`,
          ipAddress: req.ip,
        },
      });

      await createProposalHistory({
  protocolId: proposal.protocolId,
  proposalId: proposal.id,
  eventType: "PROPOSTA_GERADA",
  title: `Proposta ${proposal.proposalNumber} gerada`,
  description: "A proposta comercial foi criada pela equipe interna.",
  senderName: req.user?.name || null,
  senderEmail: req.user?.email || null,
  createdById: req.user?.id || null,
  metadata: {
    proposalNumber: proposal.proposalNumber,
    totalAmount: proposal.totalAmount,
    entryAmount: proposal.entryAmount,
    paymentMode: proposal.paymentMode,
  },
});

      return res.status(201).json(proposal);
    } catch (error) {
      console.error("Erro ao criar proposta:", error);

      return res.status(500).json({
        message: "Erro ao criar proposta.",
      });
    }
  }
);

app.put(
  "/proposals/:id",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      const existing = await prisma.proposal.findUnique({
        where: { id },
        include: {
          items: true,
          protocol: true,
        },
      });

      if (!existing) {
        return res.status(404).json({
          message: "Proposta não encontrada.",
        });
      }

      if (existing.status !== "RASCUNHO" && existing.status !== "AJUSTE_SOLICITADO") {
        return res.status(400).json({
          message: "Somente propostas em rascunho ou com ajuste solicitado podem ser editadas.",
        });
      }

      const {
        title,
        description,
        technicalScope,
        paymentMode,
        entryAmount,
        installmentQty,
        executionDays,
        validUntil,
        clientMessage,
        internalNotes,
        items,
      } = req.body;

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({
          message: "Inclua pelo menos um item na proposta.",
        });
      }

      const { normalizedItems, totalAmount } = calculateProposalTotals(items);

const finalEntryAmount =
  paymentMode === "A_VISTA"
    ? totalAmount
    : entryAmount !== undefined && entryAmount !== null && entryAmount !== ""
    ? toIntMoney(entryAmount)
    : Math.round(totalAmount * 0.3);

                  if (finalEntryAmount < 0) {
  return res.status(400).json({
    message: "O valor da entrada não pode ser negativo.",
  });
}

if (finalEntryAmount > totalAmount) {
  return res.status(400).json({
    message: "O valor da entrada não pode ser maior que o valor total da proposta.",
  });
}


      const finalInstallmentQty = installmentQty
        ? Number(installmentQty)
        : null;

      const installmentAmount =
        finalInstallmentQty && finalInstallmentQty > 0
          ? Math.round((totalAmount - finalEntryAmount) / finalInstallmentQty)
          : null;

      await prisma.proposalItem.deleteMany({
        where: {
          proposalId: id,
        },
      });

      const proposal = await prisma.proposal.update({
        where: { id },
        data: {
          title,
          description: description || null,
          technicalScope: technicalScope || null,
          paymentMode: paymentMode || "ENTRADA_PARCELAS",

          totalAmount,
          entryAmount: finalEntryAmount,
          installmentQty: finalInstallmentQty,
          installmentAmount,

          executionDays: executionDays ? Number(executionDays) : null,
          validUntil: validUntil ? new Date(validUntil) : null,

          clientMessage: clientMessage || null,
          internalNotes: internalNotes || null,

          items: {
            create: normalizedItems,
          },
        },
        include: {
          client: true,
          protocol: true,
          items: {
            orderBy: {
              sortOrder: "asc",
            },
          },
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "UPDATE_PROPOSAL",
          entity: "Proposal",
          entityId: String(proposal.id),
          description: `Proposta ${proposal.proposalNumber} atualizada.`,
          ipAddress: req.ip,
        },
      });

      return res.json(proposal);
    } catch (error) {
      console.error("Erro ao atualizar proposta:", error);

      return res.status(500).json({
        message: "Erro ao atualizar proposta.",
      });
    }
  }
);

app.post(
  "/proposals/:id/send",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da proposta inválido.",
        });
      }

      const proposal = await prisma.proposal.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: true,
          items: true,
        },
      });

      if (!proposal) {
        return res.status(404).json({
          message: "Proposta não encontrada.",
        });
      }

      if (
        proposal.status !== "RASCUNHO" &&
        proposal.status !== "AJUSTE_SOLICITADO" &&
        proposal.status !== "ENVIADA"
      ) {
        return res.status(400).json({
          message: "Esta proposta não pode ser marcada como enviada.",
        });
      }

      const updated = await prisma.proposal.update({
        where: { id },
        data: {
          status: "ENVIADA",
          sentAt: proposal.sentAt || new Date(),
        },
        include: {
          client: true,
          protocol: true,
          items: true,
        },
      });

      await prisma.protocol.update({
        where: {
          id: proposal.protocolId,
        },
        data: {
          status: "PROPOSTA_ENVIADA",
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "MARK_PROPOSAL_AS_SENT",
          entity: "Proposal",
          entityId: String(proposal.id),
          description: `Proposta ${proposal.proposalNumber} marcada como enviada.`,
          ipAddress: req.ip,
        },
      });

      return res.json({
        ...updated,
        publicUrl: `${process.env.FRONTEND_URL || ""}/proposta/${updated.publicToken}`,
      });
    } catch (error) {
      console.error("Erro ao marcar proposta como enviada:", error);

      return res.status(500).json({
        message: "Erro ao marcar proposta como enviada.",
      });
    }
  }
);

// ------------------------------------------------------
// PROPOSTA PÚBLICA / ACEITE DO CLIENTE
// ------------------------------------------------------

app.get("/public/proposals/:token", async (req, res) => {
  try {
    const token = req.params.token;

    const proposal = await prisma.proposal.findUnique({
      where: {
        publicToken: token,
      },
      include: {
        client: true,
        protocol: {
          include: {
            serviceType: true,
          },
        },
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },
      },
    });

    if (!proposal) {
      return res.status(404).json({
        message: "Proposta não encontrada.",
      });
    }

    return res.json(proposal);
  } catch (error) {
    console.error("Erro ao carregar proposta pública:", error);

    return res.status(500).json({
      message: "Erro ao carregar proposta.",
    });
  }
});

app.post("/public/proposals/:token/accept", async (req, res) => {
  try {
    const token = req.params.token;

    const proposal = await prisma.proposal.findUnique({
      where: {
        publicToken: token,
      },
      include: {
        client: true,
        protocol: true,
      },
    });

    if (!proposal) {
      return res.status(404).json({
        message: "Proposta não encontrada.",
      });
    }

    if (proposal.status !== "ENVIADA") {
      return res.status(400).json({
        message: "Esta proposta não está disponível para aceite.",
      });
    }

    const updated = await prisma.proposal.update({
      where: {
        id: proposal.id,
      },
      data: {
        status: "ACEITA",
        acceptedAt: new Date(),
      },
      include: {
        client: true,
        protocol: true,
        items: true,
      },
    });

    await createProposalHistory({
      protocolId: proposal.protocolId,
      proposalId: proposal.id,
      eventType: "PROPOSTA_ACEITA",
      title: `Cliente aceitou a proposta ${proposal.proposalNumber}`,
      description:
        proposal.clientMessage ||
        "O cliente aceitou a proposta comercial apresentada.",
      recipient: proposal.client?.email || null,
      senderName: proposal.client?.name || "Cliente",
      senderEmail: proposal.client?.email || null,
      metadata: {
        proposalNumber: proposal.proposalNumber,
        totalAmount: proposal.totalAmount,
        entryAmount: proposal.entryAmount,
        paymentMode: proposal.paymentMode,
        clientMessage: proposal.clientMessage || null,
        acceptedAt: new Date().toISOString(),
      },
    });

    await prisma.protocol.update({
      where: {
        id: proposal.protocolId,
      },
      data: {
        status: "ACORDO_FECHADO",
        finalValue: proposal.totalAmount / 100,
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CLIENT_ACCEPT_PROPOSAL",
        entity: "Proposal",
        entityId: String(proposal.id),
        description: `Cliente aceitou a proposta ${proposal.proposalNumber}.`,
        metadata: JSON.stringify({
          token,
          proposalNumber: proposal.proposalNumber,
          acceptedAt: new Date().toISOString(),
        }),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Erro ao aceitar proposta:", error);

    return res.status(500).json({
      message: "Erro ao aceitar proposta.",
    });
  }
});

app.post("/public/proposals/:token/request-adjustment", async (req, res) => {
  try {
    const token = req.params.token;
    const message = String(req.body?.message || "").trim();

    const proposal = await prisma.proposal.findUnique({
      where: {
        publicToken: token,
      },
      include: {
        client: true,
        protocol: true,
      },
    });

    if (!proposal) {
      return res.status(404).json({
        message: "Proposta não encontrada.",
      });
    }

    if (proposal.status !== "ENVIADA") {
      return res.status(400).json({
        message: "Esta proposta não está disponível para solicitação de ajuste.",
      });
    }

    const updated = await prisma.proposal.update({
      where: {
        id: proposal.id,
      },
      data: {
        status: "AJUSTE_SOLICITADO",
        adjustmentRequestedAt: new Date(),
        clientMessage: message || proposal.clientMessage,
      },
      include: {
        client: true,
        protocol: true,
        items: true,
      },
    });

    await createProposalHistory({
      protocolId: proposal.protocolId,
      proposalId: proposal.id,
      eventType: "AJUSTE_SOLICITADO",
      title: `Cliente solicitou ajuste na proposta ${proposal.proposalNumber}`,
      description:
        message || "O cliente solicitou ajuste na proposta comercial.",
      recipient: proposal.client?.email || null,
      senderName: proposal.client?.name || "Cliente",
      senderEmail: proposal.client?.email || null,
      metadata: {
        proposalNumber: proposal.proposalNumber,
        clientMessage: message || null,
        requestedAt: new Date().toISOString(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CLIENT_REQUEST_PROPOSAL_ADJUSTMENT",
        entity: "Proposal",
        entityId: String(proposal.id),
        description: `Cliente solicitou ajuste na proposta ${proposal.proposalNumber}.`,
        metadata: JSON.stringify({
          token,
          message,
        }),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Erro ao solicitar ajuste da proposta:", error);

    return res.status(500).json({
      message: "Erro ao solicitar ajuste da proposta.",
    });
  }
});



app.post("/public/proposals/:token/refuse", async (req, res) => {
  try {
    const token = req.params.token;
    const message = String(req.body?.message || "").trim();

    const proposal = await prisma.proposal.findUnique({
      where: {
        publicToken: token,
      },
      include: {
        client: true,
        protocol: true,
      },
    });

    if (!proposal) {
      return res.status(404).json({
        message: "Proposta não encontrada.",
      });
    }

    if (proposal.status !== "ENVIADA") {
      return res.status(400).json({
        message: "Esta proposta não está disponível para recusa.",
      });
    }

    const updated = await prisma.proposal.update({
      where: {
        id: proposal.id,
      },
      data: {
        status: "RECUSADA",
        refusedAt: new Date(),
        clientMessage: message || proposal.clientMessage,
      },
      include: {
        client: true,
        protocol: true,
        items: true,
      },
    });

    await createProposalHistory({
      protocolId: proposal.protocolId,
      proposalId: proposal.id,
      eventType: "PROPOSTA_RECUSADA",
      title: `Cliente recusou a proposta ${proposal.proposalNumber}`,
      description:
        message || "O cliente recusou a proposta comercial apresentada.",
      recipient: proposal.client?.email || null,
      senderName: proposal.client?.name || "Cliente",
      senderEmail: proposal.client?.email || null,
      metadata: {
        proposalNumber: proposal.proposalNumber,
        clientMessage: message || null,
        refusedAt: new Date().toISOString(),
      },
    });

    await prisma.auditLog.create({
      data: {
        action: "CLIENT_REFUSE_PROPOSAL",
        entity: "Proposal",
        entityId: String(proposal.id),
        description: `Cliente recusou a proposta ${proposal.proposalNumber}.`,
        metadata: JSON.stringify({
          token,
          message,
        }),
      },
    });

    return res.json(updated);
  } catch (error) {
    console.error("Erro ao recusar proposta:", error);

    return res.status(500).json({
      message: "Erro ao recusar proposta.",
    });
  }
});

// ------------------------------------------------------
// COBRANÇAS / BOLETO PIX / DOCUMENTOS FISCAIS
// ------------------------------------------------------

app.get("/public/billing-charges/:id", async (req, res) => {
  try {
    const id = Number(req.params.id);

    if (!id) {
      return res.status(400).json({
        message: "ID da cobrança inválido.",
      });
    }

    const charge = await prisma.billingCharge.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            cpfCnpj: true,
          },
        },
        protocol: {
          include: {
            serviceType: true,
          },
        },
        contract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            signedAt: true,
          },
        },
        fiscalDocuments: {
          where: {
            status: "ANEXADO",
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!charge) {
      return res.status(404).json({
        message: "Cobrança não encontrada.",
      });
    }

    if (
      charge.status === "RASCUNHO" ||
      charge.status === "AGUARDANDO_DOCUMENTO_FISCAL" ||
      charge.status === "PRONTA_PARA_EMISSAO" ||
      charge.status === "CANCELADA" ||
      charge.status === "ERRO"
    ) {
      return res.status(400).json({
        message: "Esta cobrança ainda não está disponível para o cliente.",
      });
    }

    return res.json(charge);
  } catch (error) {
    console.error("Erro ao carregar cobrança pública:", error);

    return res.status(500).json({
      message: "Erro ao carregar cobrança.",
    });
  }
});

app.get(
  "/billing-charges",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const protocolId = req.query.protocolId
        ? Number(req.query.protocolId)
        : null;

      const charges = await prisma.billingCharge.findMany({
        where: protocolId ? { protocolId } : undefined,
        orderBy: {
          createdAt: "desc",
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: {
            include: {
              proposal: true,
            },
          },
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      return res.json(charges);
    } catch (error) {
      console.error("Erro ao listar cobranças:", error);

      return res.status(500).json({
        message: "Erro ao listar cobranças.",
      });
    }
  }
);

app.get(
  "/billing-charges/:id",
  authMiddleware,
  requireRoles(["ATENDENTE", "GERENTE", "PROGRAMADOR"]),
  async (req, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      const charge = await prisma.billingCharge.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: {
            include: {
              proposal: true,
            },
          },
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      });

      if (!charge) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

      return res.json(charge);
    } catch (error) {
      console.error("Erro ao buscar cobrança:", error);

      return res.status(500).json({
        message: "Erro ao buscar cobrança.",
      });
    }
  }
);

app.post(
  "/contracts/:id/generate-entry-charge",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const contractId = Number(req.params.id);

      if (!contractId) {
        return res.status(400).json({
          message: "ID do contrato inválido.",
        });
      }

      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          proposal: true,
        },
      });

      if (!contract) {
        return res.status(404).json({
          message: "Contrato não encontrado.",
        });
      }

      if (contract.status !== "ASSINADO") {
        return res.status(400).json({
          message:
            "A cobrança da entrada só pode ser gerada após a assinatura do contrato.",
        });
      }

      const existing = await prisma.billingCharge.findFirst({
        where: {
          contractId: contract.id,
          status: {
            notIn: ["CANCELADA", "ERRO"],
          },
        },
      });

      if (existing) {
        return res.status(400).json({
          message:
            "Este contrato já possui uma cobrança ativa. Cancele a cobrança existente antes de gerar outra.",
        });
      }

const entryAmount = Number(contract.entryAmount || 0);

if (!entryAmount || entryAmount <= 0) {
  return res.status(400).json({
    message: "O contrato não possui valor de entrada válido para cobrança.",
  });
}

console.log("GERANDO COBRANÇA DA ENTRADA:", {
  contractId: contract.id,
  contractNumber: contract.contractNumber,
  contractValue: contract.contractValue,
  contractEntryAmount: contract.entryAmount,
  entryAmountUsedForBillingCharge: entryAmount,
});

if (entryAmount < 100 && Number(contract.contractValue || 0) >= 1000) {
  return res.status(400).json({
    message:
      "Valor de entrada inconsistente. A cobrança aparenta ter sido gerada com valor dividido por 100. Verifique o contrato antes de gerar a cobrança.",
  });
}

      const dueDate = req.body?.dueDate
        ? normalizeNullableDate(req.body.dueDate)
        : addDays(new Date(), 3);

const charge = await prisma.billingCharge.create({
  data: {
    protocolId: contract.protocolId,
    clientId: contract.clientId,
    contractId: contract.id,
    createdById: req.user?.id || null,

    provider: "MANUAL",
    status: "AGUARDANDO_DOCUMENTO_FISCAL",
    chargeType: "ENTRADA",
    fiscalMode: "NOTA_FISCAL_ANTES",

    description:
      req.body?.description ||
      `Entrada do contrato ${contract.contractNumber} - Protocolo ${contract.protocol.protocolNumber}`,

    amount: entryAmount,

    dueDate: dueDate || addDays(new Date(), 3),

    installmentNumber: 1,
    totalInstallments: contract.proposal?.installmentQty
      ? Number(contract.proposal.installmentQty) + 1
      : 1,

    notes:
      req.body?.notes ||
      "Cobrança de entrada gerada após assinatura do contrato.",
  },
  include: {
    client: true,
    protocol: {
      include: {
        serviceType: true,
      },
    },
    contract: true,
    fiscalDocuments: true,
  },
});
      await createProposalHistory({
        protocolId: contract.protocolId,
        proposalId: contract.proposalId || null,
        eventType: "COBRANCA_ENTRADA_CRIADA",
        title: `Cobrança da entrada criada para o contrato ${contract.contractNumber}`,
        description:
          "A cobrança da entrada foi criada e aguarda definição fiscal: Nota Fiscal antes da cobrança ou recibo posterior.",
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          billingChargeId: charge.id,
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          amount: charge.amount,
          dueDate: charge.dueDate,
          status: charge.status,
          fiscalMode: charge.fiscalMode,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "CREATE_ENTRY_BILLING_CHARGE",
          entity: "BillingCharge",
          entityId: String(charge.id),
          description: `Cobrança da entrada criada para o contrato ${contract.contractNumber}.`,
          ipAddress: req.ip,
        },
      });

      return res.status(201).json(charge);
    } catch (error) {
      console.error("Erro ao gerar cobrança da entrada:", error);

      return res.status(500).json({
        message: "Erro ao gerar cobrança da entrada.",
      });
    }
  }
);

app.post(
  "/contracts/:id/generate-installment-charges",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const contractId = Number(req.params.id);

      if (!contractId) {
        return res.status(400).json({
          message: "ID do contrato inválido.",
        });
      }

      const contract = await prisma.contract.findUnique({
        where: { id: contractId },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          proposal: true,
          billingCharges: true,
        },
      });

      if (!contract) {
        return res.status(404).json({
          message: "Contrato não encontrado.",
        });
      }

      if (contract.status !== "ASSINADO") {
        return res.status(400).json({
          message:
            "As parcelas só podem ser geradas para contratos assinados.",
        });
      }

      const entryPaid = contract.billingCharges.some(
        (charge) =>
          charge.chargeType === "ENTRADA" &&
          charge.status === "PAGA"
      );

      if (!entryPaid) {
        return res.status(400).json({
          message:
            "A entrada precisa estar paga antes de gerar as parcelas do saldo.",
        });
      }

      const existingInstallments = contract.billingCharges.filter(
        (charge) =>
          charge.chargeType === "PARCELA" &&
          charge.status !== "CANCELADA" &&
          charge.status !== "ERRO"
      );

      if (existingInstallments.length > 0) {
        return res.status(400).json({
          message:
            "Este contrato já possui parcelas geradas. Cancele as parcelas existentes antes de gerar novamente.",
        });
      }

      const totalAmount = Number(contract.contractValue || 0);
      const entryAmount = Number(contract.entryAmount || 0);

      if (!totalAmount || totalAmount <= 0) {
        return res.status(400).json({
          message: "O contrato não possui valor total válido.",
        });
      }

      if (entryAmount < 0 || entryAmount > totalAmount) {
        return res.status(400).json({
          message:
            "O valor da entrada está inconsistente em relação ao valor total do contrato.",
        });
      }

      const installmentQty = contract.proposal?.installmentQty
        ? Number(contract.proposal.installmentQty)
        : 0;

      if (!installmentQty || installmentQty <= 0) {
        return res.status(400).json({
          message:
            "A proposta vinculada não possui quantidade de parcelas configurada.",
        });
      }

      const balanceAmount = Math.round(totalAmount - entryAmount);

      if (!balanceAmount || balanceAmount <= 0) {
        return res.status(400).json({
          message:
            "Não há saldo restante para geração de parcelas.",
        });
      }

      const firstDueDate = req.body?.firstDueDate
        ? normalizeNullableDate(req.body.firstDueDate)
        : addDays(new Date(), 30);

      if (!firstDueDate) {
        return res.status(400).json({
          message: "Data do primeiro vencimento inválida.",
        });
      }

      const intervalDays =
        req.body?.intervalDays !== undefined && req.body?.intervalDays !== ""
          ? Number(req.body.intervalDays)
          : 30;

      if (!intervalDays || intervalDays <= 0) {
        return res.status(400).json({
          message: "Intervalo entre parcelas inválido.",
        });
      }

      const fiscalMode =
        req.body?.fiscalMode === "NOTA_FISCAL_ANTES"
          ? "NOTA_FISCAL_ANTES"
          : "RECIBO_POSTERIOR";

      const baseAmount = Math.floor(balanceAmount / installmentQty);
      const remainder = balanceAmount - baseAmount * installmentQty;

      const createdCharges = [];

      for (let index = 1; index <= installmentQty; index++) {
        const isLast = index === installmentQty;
        const installmentAmount = baseAmount + (isLast ? remainder : 0);

        const dueDate = addDays(
          firstDueDate,
          (index - 1) * intervalDays
        );

        const charge = await prisma.billingCharge.create({
          data: {
            protocolId: contract.protocolId,
            clientId: contract.clientId,
            contractId: contract.id,
            createdById: req.user?.id || null,

            provider: "MANUAL",
            status:
              fiscalMode === "NOTA_FISCAL_ANTES"
                ? "AGUARDANDO_DOCUMENTO_FISCAL"
                : "PRONTA_PARA_EMISSAO",

            chargeType: "PARCELA",
            fiscalMode,

            description: `Parcela ${index}/${installmentQty} do contrato ${contract.contractNumber} - Protocolo ${contract.protocol.protocolNumber}`,

            amount: installmentAmount,
            dueDate,

            installmentNumber: index,
            totalInstallments: installmentQty,

            notes:
              req.body?.notes ||
              "Parcela do saldo gerada após entrega/finalização dos serviços.",
          },
          include: {
            client: true,
            protocol: {
              include: {
                serviceType: true,
              },
            },
            contract: true,
            fiscalDocuments: true,
          },
        });

        createdCharges.push(charge);
      }

      await prisma.protocol.update({
        where: {
          id: contract.protocolId,
        },
        data: {
          status: "FINALIZADO",
          finishedAt: new Date(),
        },
      });

      await createProposalHistory({
        protocolId: contract.protocolId,
        proposalId: contract.proposalId || null,
        eventType: "PARCELAS_GERADAS_APOS_ENTREGA",
        title: "Parcelas do saldo geradas após entrega dos serviços",
        description: `Foram geradas ${createdCharges.length} parcela(s) referentes ao saldo do contrato ${contract.contractNumber}.`,
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          contractId: contract.id,
          contractNumber: contract.contractNumber,
          totalAmount,
          entryAmount,
          balanceAmount,
          installmentQty,
          fiscalMode,
          firstDueDate,
          intervalDays,
          charges: createdCharges.map((charge) => ({
            id: charge.id,
            amount: charge.amount,
            dueDate: charge.dueDate,
            installmentNumber: charge.installmentNumber,
            totalInstallments: charge.totalInstallments,
          })),
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "GENERATE_INSTALLMENT_BILLING_CHARGES",
          entity: "Contract",
          entityId: String(contract.id),
          description: `Parcelas do saldo geradas para o contrato ${contract.contractNumber}.`,
          ipAddress: req.ip,
          metadata: safeJson({
            contractId: contract.id,
            contractNumber: contract.contractNumber,
            balanceAmount,
            installmentQty,
            generatedCharges: createdCharges.length,
          }),
        },
      });

      return res.status(201).json({
        contractId: contract.id,
        protocolId: contract.protocolId,
        balanceAmount,
        installmentQty,
        charges: createdCharges,
      });
    } catch (error) {
      console.error("Erro ao gerar parcelas do saldo:", error);

      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Erro ao gerar parcelas do saldo.",
      });
    }
  }
);

app.post(
  "/billing-charges/:id/select-fiscal-mode",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const fiscalMode = String(req.body?.fiscalMode || "");

      if (!id) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      if (
        fiscalMode !== "NOTA_FISCAL_ANTES" &&
        fiscalMode !== "RECIBO_POSTERIOR"
      ) {
        return res.status(400).json({
          message:
            "Modo fiscal inválido. Use NOTA_FISCAL_ANTES ou RECIBO_POSTERIOR.",
        });
      }

      const charge = await prisma.billingCharge.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: true,
          contract: true,
          fiscalDocuments: true,
        },
      });

      if (!charge) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

      if (
        charge.status !== "AGUARDANDO_DOCUMENTO_FISCAL" &&
        charge.status !== "PRONTA_PARA_EMISSAO"
      ) {
        return res.status(400).json({
          message:
            "O modo fiscal só pode ser alterado antes da emissão da cobrança.",
        });
      }

      const hasPreInvoice = charge.fiscalDocuments.some(
        (document) =>
          document.status === "ANEXADO" &&
          document.type === "NOTA_FISCAL" &&
          document.moment === "PRE_COBRANCA"
      );

      const nextStatus =
        fiscalMode === "RECIBO_POSTERIOR" || hasPreInvoice
          ? "PRONTA_PARA_EMISSAO"
          : "AGUARDANDO_DOCUMENTO_FISCAL";

      const updated = await prisma.billingCharge.update({
        where: { id },
        data: {
          fiscalMode: fiscalMode as any,
          status: nextStatus,
          notes: req.body?.notes || charge.notes,
        },
        include: {
          client: true,
          protocol: true,
          contract: true,
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      await createProposalHistory({
        protocolId: charge.protocolId,
        proposalId: charge.contract?.proposalId || null,
        eventType: "MODO_FISCAL_COBRANCA_DEFINIDO",
        title:
          fiscalMode === "NOTA_FISCAL_ANTES"
            ? "Cobrança configurada para Nota Fiscal antes do pagamento"
            : "Cobrança configurada para recibo posterior ao pagamento",
        description:
          fiscalMode === "NOTA_FISCAL_ANTES"
            ? "A cobrança exigirá anexação da Nota Fiscal antes da emissão do boleto/Pix."
            : "A cobrança poderá ser emitida agora, com recibo a ser anexado após a confirmação do pagamento.",
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          billingChargeId: charge.id,
          fiscalMode,
          nextStatus,
        },
      });

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao definir modo fiscal:", error);

      return res.status(500).json({
        message: "Erro ao definir modo fiscal da cobrança.",
      });
    }
  }
);

app.post(
  "/billing-charges/:id/fiscal-documents",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  upload.single("file"),
  async (req: AuthRequest, res) => {
    try {
      const billingChargeId = Number(req.params.id);

      if (!billingChargeId) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      if (!req.file) {
        return res.status(400).json({
          message: "Arquivo não enviado.",
        });
      }

      const charge = await prisma.billingCharge.findUnique({
        where: { id: billingChargeId },
        include: {
          contract: true,
          fiscalDocuments: true,
        },
      });

      if (!charge) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

const type = String(req.body?.type || "NOTA_FISCAL");
const moment = String(req.body?.moment || "PRE_COBRANCA");

if (
  !["NOTA_FISCAL", "RECIBO", "COMPROVANTE", "OUTRO"].includes(type)
) {
  return res.status(400).json({
    message: "Tipo de documento fiscal inválido.",
  });
}

if (!["PRE_COBRANCA", "POS_PAGAMENTO"].includes(moment)) {
  return res.status(400).json({
    message: "Momento do documento fiscal inválido.",
  });
}

const isReceiptAfterPayment =
  charge.status === "PAGA" &&
  charge.fiscalMode === "RECIBO_POSTERIOR" &&
  type === "RECIBO" &&
  moment === "POS_PAGAMENTO";

if (
  charge.status === "CANCELADA" ||
  charge.status === "VENCIDA" ||
  (charge.status === "PAGA" && !isReceiptAfterPayment)
) {
  return res.status(400).json({
    message:
      "Não é possível anexar documento fiscal nesta situação da cobrança. Para cobrança paga com recibo posterior, anexe um RECIBO no momento POS_PAGAMENTO.",
  });
}

      if (
        !["NOTA_FISCAL", "RECIBO", "COMPROVANTE", "OUTRO"].includes(type)
      ) {
        return res.status(400).json({
          message: "Tipo de documento fiscal inválido.",
        });
      }

      if (!["PRE_COBRANCA", "POS_PAGAMENTO"].includes(moment)) {
        return res.status(400).json({
          message: "Momento do documento fiscal inválido.",
        });
      }

      const document = await prisma.fiscalDocument.create({
        data: {
          protocolId: charge.protocolId,
          clientId: charge.clientId,
          contractId: charge.contractId,
          billingChargeId: charge.id,
          createdById: req.user?.id || null,

          type: type as any,
          moment: moment as any,
          status: "ANEXADO",

          number: req.body?.number || null,
          issuedAt: normalizeNullableDate(req.body?.issuedAt),
          amount:
            req.body?.amount !== undefined && req.body?.amount !== ""
              ? toIntMoney(req.body.amount)
              : null,

          fileName: req.file.originalname,
          filePath: `/uploads/documents/${req.file.filename}`,
          mimeType: req.file.mimetype,
          size: req.file.size,

          notes: req.body?.notes || null,
        },
      });

      const hasPreInvoiceAfterUpload =
        type === "NOTA_FISCAL" && moment === "PRE_COBRANCA";

      let nextStatus = charge.status;

      if (
        charge.status === "AGUARDANDO_DOCUMENTO_FISCAL" &&
        (charge.fiscalMode === "RECIBO_POSTERIOR" || hasPreInvoiceAfterUpload)
      ) {
        nextStatus = "PRONTA_PARA_EMISSAO";
      }

      const updatedCharge = await prisma.billingCharge.update({
        where: { id: charge.id },
        data: {
          status: nextStatus,
        },
        include: {
          client: true,
          protocol: true,
          contract: true,
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      await createProposalHistory({
        protocolId: charge.protocolId,
        proposalId: charge.contract?.proposalId || null,
        eventType:
          type === "NOTA_FISCAL"
            ? "NOTA_FISCAL_ANEXADA"
            : type === "RECIBO"
            ? "RECIBO_ANEXADO"
            : "DOCUMENTO_FISCAL_ANEXADO",
        title:
          type === "NOTA_FISCAL"
            ? "Nota Fiscal anexada à cobrança"
            : type === "RECIBO"
            ? "Recibo anexado à cobrança"
            : "Documento fiscal anexado à cobrança",
        description: `Documento ${req.file.originalname} anexado à cobrança da entrada.`,
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          billingChargeId: charge.id,
          fiscalDocumentId: document.id,
          type,
          moment,
          number: document.number,
          amount: document.amount,
          nextStatus,
        },
      });

      return res.status(201).json({
        document,
        charge: updatedCharge,
      });
    } catch (error) {
      console.error("Erro ao anexar documento fiscal:", error);

      return res.status(500).json({
        message: "Erro ao anexar documento fiscal.",
      });
    }
  }
);

app.post(
  "/billing-charges/:id/emit",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      const charge = await prisma.billingCharge.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: true,
          fiscalDocuments: true,
        },
      });

      if (!charge) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

      if (charge.status === "EMITIDA" || charge.status === "ENVIADA") {
        if (charge.txid && charge.pixCopyPaste) {
          return res.json(charge);
        }

        return res.status(400).json({
          message:
            "Esta cobrança já está emitida, mas está sem dados Pix completos. Verifique o histórico ou gere uma nova cobrança.",
        });
      }

      if (charge.status !== "PRONTA_PARA_EMISSAO") {
        return res.status(400).json({
          message:
            "A cobrança ainda não está pronta para emissão. Anexe a Nota Fiscal ou selecione recibo posterior.",
        });
      }

      if (charge.fiscalMode === "NOTA_FISCAL_ANTES") {
        const hasPreInvoice = charge.fiscalDocuments.some(
          (document) =>
            document.status === "ANEXADO" &&
            document.type === "NOTA_FISCAL" &&
            document.moment === "PRE_COBRANCA"
        );

        if (!hasPreInvoice) {
          return res.status(400).json({
            message:
              "Para este modo fiscal, anexe a Nota Fiscal antes de emitir a cobrança.",
          });
        }
      }

      if (!charge.amount || Number(charge.amount) <= 0) {
        return res.status(400).json({
          message: "O valor da cobrança deve ser maior que zero.",
        });
      }

      const txid = generateBillingChargeTxid(charge.id);

const description =
  charge.chargeType === "PARCELA"
    ? `Parcela ${charge.installmentNumber || ""} ${charge.contract?.contractNumber || ""} ${charge.protocol.protocolNumber}`.trim()
    : `Entrada ${charge.contract?.contractNumber || ""} ${charge.protocol.protocolNumber}`.trim();

const amountInCents = Math.round(Number(charge.amount) * 100);

const isInstallmentCharge = charge.chargeType === "PARCELA";

if (isInstallmentCharge && !charge.client.cpfCnpj) {
  return res.status(400).json({
    message:
      "Para emitir parcela com vencimento, o cliente precisa ter CPF/CNPJ cadastrado.",
  });
}

const bbResult = isInstallmentCharge
  ? await createBbPixDueCharge({
      txid,
      amountInCents,
      debtorName: charge.client.name,
      debtorCpfCnpj: charge.client.cpfCnpj || null,
      description,
      dueDate: charge.dueDate,
    })
  : await createBbPixCharge({
      txid,
      amountInCents,
      debtorName: charge.client.name,
      debtorCpfCnpj: charge.client.cpfCnpj || null,
      description,
      expirationSeconds: Number(process.env.BB_PIX_EXPIRATION_SECONDS || 86400),
    });

      const publicChargeUrl = getChargePublicUrl(charge.id);

      const updated = await prisma.billingCharge.update({
        where: { id: charge.id },
        data: {
          provider: "BANCO_DO_BRASIL",
          status: "EMITIDA",

          externalId: bbResult.txid || txid,
          nossoNumero: null,
          txid: bbResult.txid || txid,

          pixKey: bbResult.chave || process.env.BB_PIX_KEY || null,
          pixCopyPaste: bbResult.pixCopiaECola || null,
          pixQrCode: bbResult.location || null,

          boletoUrl: publicChargeUrl,
          linhaDigitavel: null,
          barcode: null,

rawRequest: safeJson({
  provider: "BANCO_DO_BRASIL",
  providerEnv: getBbProviderEnv(),
  txid,
  chargeType: charge.chargeType || "ENTRADA",
  amount: charge.amount,
  amountInCents,
  debtorName: charge.client.name,
  debtorCpfCnpj: charge.client.cpfCnpj || null,
  description,
  dueDate: charge.dueDate,
  expirationSeconds:
    charge.chargeType === "PARCELA"
      ? null
      : Number(process.env.BB_PIX_EXPIRATION_SECONDS || 172800),
}),
          rawResponse: safeJson(bbResult),
          errorMessage: null,
        },
        include: {
          client: true,
          protocol: true,
          contract: true,
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

await createProposalHistory({
  protocolId: charge.protocolId,
  proposalId: charge.contract?.proposalId || null,
  eventType:
    charge.chargeType === "PARCELA"
      ? "PARCELA_EMITIDA_BB_PIX_VENCIMENTO"
      : "COBRANCA_EMITIDA_BB_PIX",
  title:
    charge.chargeType === "PARCELA"
      ? `Parcela ${charge.installmentNumber || ""} emitida via Pix com vencimento Banco do Brasil`
      : "Cobrança da entrada emitida via Pix Banco do Brasil",
  description:
    charge.chargeType === "PARCELA"
      ? "A parcela do saldo foi emitida via Pix com vencimento pela API do Banco do Brasil."
      : "A cobrança da entrada foi emitida via API Pix do Banco do Brasil.",
  senderName: req.user?.name || null,
  senderEmail: req.user?.email || null,
  createdById: req.user?.id || null,
  metadata: {
    billingChargeId: charge.id,
    provider: "BANCO_DO_BRASIL",
    providerEnv: getBbProviderEnv(),
    chargeType: charge.chargeType || "ENTRADA",
    installmentNumber: charge.installmentNumber,
    totalInstallments: charge.totalInstallments,
    txid: updated.txid,
    amount: charge.amount,
    dueDate: charge.dueDate,
    pixLocation: updated.pixQrCode,
  },
});

await prisma.auditLog.create({
  data: {
    userId: req.user?.id || null,
    userName: req.user?.name || null,
    userEmail: req.user?.email || null,
    userRole: req.user?.role || null,
    action:
      charge.chargeType === "PARCELA"
        ? "EMIT_BB_PIX_DUE_INSTALLMENT_CHARGE"
        : "EMIT_BB_PIX_BILLING_CHARGE",
    entity: "BillingCharge",
    entityId: String(charge.id),
    description:
      charge.chargeType === "PARCELA"
        ? `Parcela da cobrança #${charge.id} emitida via Pix com vencimento Banco do Brasil.`
        : `Cobrança #${charge.id} emitida via Pix Banco do Brasil.`,
    ipAddress: req.ip,
    metadata: safeJson({
      providerEnv: getBbProviderEnv(),
      chargeType: charge.chargeType || "ENTRADA",
      installmentNumber: charge.installmentNumber,
      txid: updated.txid,
      pixLocation: updated.pixQrCode,
    }),
  },
});

      return res.json(updated);
} catch (error: any) {
      console.error("Erro ao emitir cobrança BB Pix:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        headers: error?.response?.headers,
      });

      const id = Number(req.params.id);

      if (id) {
        await prisma.billingCharge
          .update({
            where: { id },
            data: {
              status: "ERRO",
              errorMessage:
                error?.response?.data?.detail ||
                error?.response?.data?.message ||
                error?.response?.data?.title ||
                error?.response?.data ||
                error?.message ||
                "Erro ao emitir cobrança Pix pelo Banco do Brasil.",
              rawResponse: safeJson({
                action: "EMIT_PIX_ERROR",
                status: error?.response?.status,
                data: error?.response?.data,
                headers: error?.response?.headers,
              }),
            },
          })
          .catch(() => null);
      }

      return res.status(500).json({
        message:
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.response?.data?.title ||
          error?.response?.data ||
          error?.message ||
          "Erro ao emitir cobrança Pix pelo Banco do Brasil.",
      });
    }
  }
);

app.post(
  "/billing-charges/:id/reissue-pix",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      const charge = await prisma.billingCharge.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: true,
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!charge) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

      if (charge.status === "PAGA") {
        return res.status(400).json({
          message: "Não é possível reemitir Pix de uma cobrança já paga.",
        });
      }

      if (charge.status === "CANCELADA") {
        return res.status(400).json({
          message: "Não é possível reemitir Pix de uma cobrança cancelada.",
        });
      }

      if (
        charge.status !== "EMITIDA" &&
        charge.status !== "ENVIADA" &&
        charge.status !== "VENCIDA" &&
        charge.status !== "ERRO"
      ) {
        return res.status(400).json({
          message:
            "A cobrança precisa estar emitida, enviada, vencida ou com erro para reemissão do Pix.",
        });
      }

      if (!charge.amount || Number(charge.amount) <= 0) {
        return res.status(400).json({
          message: "O valor da cobrança deve ser maior que zero.",
        });
      }

      const previousTxid = charge.txid || null;
      const previousPixCopyPaste = charge.pixCopyPaste || null;
      const previousPixQrCode = charge.pixQrCode || null;

      const txid = generateBillingChargeReissueTxid(charge.id);

      const description =
        charge.chargeType === "PARCELA"
          ? `Parcela ${charge.installmentNumber || ""} ${
              charge.contract?.contractNumber || ""
            } ${charge.protocol.protocolNumber}`.trim()
          : `Entrada ${charge.contract?.contractNumber || ""} ${
              charge.protocol.protocolNumber
            }`.trim();

      const amountInCents = Math.round(Number(charge.amount) * 100);

      const isInstallmentCharge = charge.chargeType === "PARCELA";

      const bbResult = isInstallmentCharge
        ? await createBbPixDueCharge({
            txid,
            amountInCents,
            debtorName: charge.client.name,
            debtorCpfCnpj: charge.client.cpfCnpj || null,
            description,
            dueDate: charge.dueDate,
          })
        : await createBbPixCharge({
            txid,
            amountInCents,
            debtorName: charge.client.name,
            debtorCpfCnpj: charge.client.cpfCnpj || null,
            description,
            expirationSeconds: Number(
              process.env.BB_PIX_EXPIRATION_SECONDS || 86400
            ),
          });

      const publicChargeUrl = getChargePublicUrl(charge.id);

      const updated = await prisma.billingCharge.update({
        where: { id: charge.id },
        data: {
          provider: "BANCO_DO_BRASIL",
          status: charge.status === "ENVIADA" ? "ENVIADA" : "EMITIDA",

          externalId: bbResult.txid || txid,
          txid: bbResult.txid || txid,

          pixKey: bbResult.chave || process.env.BB_PIX_KEY || null,
          pixCopyPaste: bbResult.pixCopiaECola || null,
          pixQrCode: bbResult.location || null,

          boletoUrl: publicChargeUrl,
          linhaDigitavel: null,
          barcode: null,

          rawRequest: safeJson({
            provider: "BANCO_DO_BRASIL",
            providerEnv: getBbProviderEnv(),
            action: "REISSUE_PIX",
            previousTxid,
            txid,
            chargeType: charge.chargeType || "ENTRADA",
            amount: charge.amount,
            amountInCents,
            debtorName: charge.client.name,
            debtorCpfCnpj: charge.client.cpfCnpj || null,
            description,
            dueDate: charge.dueDate,
            expirationSeconds: isInstallmentCharge
              ? null
              : Number(process.env.BB_PIX_EXPIRATION_SECONDS || 86400),
          }),

          rawResponse: safeJson({
            action: "REISSUE_PIX",
            previous: {
              txid: previousTxid,
              pixCopyPaste: previousPixCopyPaste,
              pixQrCode: previousPixQrCode,
            },
            current: bbResult,
          }),

          errorMessage: null,
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: true,
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      await createProposalHistory({
        protocolId: charge.protocolId,
        proposalId: charge.contract?.proposalId || null,
        eventType: "COBRANCA_PIX_REEMITIDA",
        title: "Cobrança Pix reemitida",
        description:
          "A cobrança Pix foi reemitida via API Pix do Banco do Brasil, gerando novo TXID e novo QR Code.",
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          billingChargeId: charge.id,
          provider: "BANCO_DO_BRASIL",
          providerEnv: getBbProviderEnv(),
          previousTxid,
          newTxid: updated.txid,
          chargeType: updated.chargeType,
          amount: charge.amount,
          dueDate: charge.dueDate,
          pixLocation: updated.pixQrCode,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "REISSUE_BB_PIX_BILLING_CHARGE",
          entity: "BillingCharge",
          entityId: String(charge.id),
          description: `Pix da cobrança #${charge.id} reemitido via Banco do Brasil.`,
          ipAddress: req.ip,
          metadata: safeJson({
            providerEnv: getBbProviderEnv(),
            previousTxid,
            newTxid: updated.txid,
            chargeType: updated.chargeType,
            pixLocation: updated.pixQrCode,
          }),
        },
      });

      return res.json(updated);
    } catch (error: any) {
      console.error("Erro ao reemitir cobrança BB Pix:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        headers: error?.response?.headers,
      });

      const id = Number(req.params.id);

      if (id) {
        await prisma.billingCharge
          .update({
            where: { id },
            data: {
              status: "ERRO",
              errorMessage:
                error?.response?.data?.detail ||
                error?.response?.data?.message ||
                error?.response?.data?.title ||
                (typeof error?.response?.data === "string"
                  ? error.response.data
                  : null) ||
                error?.message ||
                "Erro ao reemitir cobrança Pix pelo Banco do Brasil.",
              rawResponse: safeJson({
                action: "REISSUE_PIX_ERROR",
                status: error?.response?.status,
                data: error?.response?.data,
                headers: error?.response?.headers,
              }),
            },
          })
          .catch(() => null);
      }

      return res.status(500).json({
        message:
          error?.response?.data?.detail ||
          error?.response?.data?.message ||
          error?.response?.data?.title ||
          (typeof error?.response?.data === "string"
            ? error.response.data
            : null) ||
          error?.message ||
          "Erro ao reemitir cobrança Pix pelo Banco do Brasil.",
        bbError: error?.response?.data || null,
      });
    }
  }
);

app.post(
  "/billing-charges/:id/send",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      const charge = await prisma.billingCharge.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: true,
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      if (!charge) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

      if (charge.status !== "EMITIDA" && charge.status !== "ENVIADA") {
        return res.status(400).json({
          message:
            "A cobrança precisa estar emitida antes de ser enviada ao cliente.",
        });
      }

      if (!charge.client.email) {
        return res.status(400).json({
          message: "O cliente não possui e-mail cadastrado.",
        });
      }

      const settings = await getSmtpSettings();
      const company = await getCompanySettings();
      const transporter = await createTransporterFromSettings();

      if (!transporter) {
        throw new Error(
          "SMTP não configurado para envio de cobrança. Verifique as configurações SMTP."
        );
      }

      const publicBaseUrl = getBillingPublicBaseUrl();
      const chargeUrl = `${publicBaseUrl}/cobranca/${charge.id}`;

      const fiscalInfo =
        charge.fiscalMode === "NOTA_FISCAL_ANTES"
          ? "A Nota Fiscal referente à entrada já foi registrada pela empresa."
          : "O recibo será disponibilizado após a confirmação do pagamento.";

      const html = `
        <div style="font-family:Arial,sans-serif;background:#f4f7f5;padding:24px;">
          <div style="max-width:760px;margin:0 auto;background:#ffffff;border-radius:20px;overflow:hidden;border:1px solid #dbe7df;">
            <div style="background:#123c32;color:#ffffff;padding:24px;">
              <h1 style="margin:0;font-size:24px;">Cobrança da entrada</h1>
              <p style="margin:8px 0 0;color:#d8f3e5;">
                ${company.companyName || "AMAZONIKA Engenharia & Meio Ambiente"}
              </p>
            </div>

            <div style="padding:26px;color:#1f2937;">
              <p>Prezado(a) <strong>${charge.client.name}</strong>,</p>

              <p style="line-height:1.6;">
                Conforme contrato assinado, segue a cobrança da entrada para início da mobilização da equipe técnica.
              </p>

              <div style="background:#f8fbf9;border:1px solid #dfe7e2;border-radius:16px;padding:18px;margin:18px 0;">
                <p><strong>Protocolo:</strong> ${charge.protocol.protocolNumber}</p>
                <p><strong>Serviço:</strong> ${charge.protocol.serviceType.name}</p>
                <p><strong>Descrição:</strong> ${charge.description}</p>
                <p><strong>Valor:</strong> ${formatMoneyBR(charge.amount)}</p>
                <p><strong>Vencimento:</strong> ${new Intl.DateTimeFormat("pt-BR", {
                  timeZone: "America/Belem",
                }).format(charge.dueDate)}</p>
                <p><strong>Documento fiscal:</strong> ${fiscalInfo}</p>
              </div>

              <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:16px;padding:18px;margin:18px 0;">
                <p style="margin:0 0 8px;"><strong>PIX copia e cola:</strong></p>
                <p style="word-break:break-all;font-size:13px;color:#7c2d12;">
                  ${charge.pixCopyPaste || "Pix ainda não disponível."}
                </p>

${
  charge.linhaDigitavel
    ? `
      <p style="margin:14px 0 8px;"><strong>Linha digitável do boleto:</strong></p>
      <p style="word-break:break-all;font-size:13px;color:#7c2d12;">
        ${charge.linhaDigitavel}
      </p>
    `
    : `
      <p style="margin:14px 0 0;font-size:13px;color:#7c2d12;">
        Esta cobrança foi emitida via Pix dinâmico Banco do Brasil.
      </p>
    `
}
              </div>

              <p style="text-align:center;margin:28px 0;">
                <a href="${chargeUrl}" target="_blank"
                  style="display:inline-block;background:#123c32;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:bold;">
                  Abrir cobrança
                </a>
              </p>

              <p style="font-size:13px;color:#64748b;line-height:1.5;">
                Caso o botão não funcione, copie e cole este link no navegador:<br>
                ${chargeUrl}
              </p>
            </div>
          </div>
        </div>
      `;

      const info = await transporter.sendMail({
        from: settings.smtpFrom,
        to: charge.client.email,
        subject: `Cobrança da entrada — ${charge.protocol.protocolNumber}`,
        html,
        attachments: getEmailImageAttachments(),
      });

      const updated = await prisma.billingCharge.update({
        where: { id: charge.id },
        data: {
          status: "ENVIADA",
          sentToClientAt: new Date(),
        },
        include: {
          client: true,
          protocol: true,
          contract: true,
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      await createProposalHistory({
        protocolId: charge.protocolId,
        proposalId: charge.contract?.proposalId || null,
        eventType: "COBRANCA_ENVIADA",
        title: "Cobrança da entrada enviada ao cliente",
        description: `A cobrança da entrada foi enviada por e-mail para ${charge.client.email}.`,
        recipient: charge.client.email,
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          billingChargeId: charge.id,
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
          chargeUrl,
        },
      });

      return res.json({
        ...updated,
        chargeUrl,
        email: {
          messageId: info.messageId,
          accepted: info.accepted,
          rejected: info.rejected,
        },
      });
    } catch (error) {
      console.error("Erro ao enviar cobrança:", error);

      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Erro ao enviar cobrança.",
      });
    }
  }
);

async function generateReceiptPdfForBillingCharge(charge: any): Promise<{
  fileName: string;
  filePath: string;
  publicPath: string;
}> {
  const company = await getCompanySettings();

  const outputDir = path.join(process.cwd(), "uploads", "documents");
  fs.mkdirSync(outputDir, { recursive: true });

  const receiptNumber = `REC-${String(charge.id).padStart(6, "0")}`;
  const fileName = `${receiptNumber}-cobranca-${charge.id}.pdf`;
  const filePath = path.join(outputDir, fileName);
  const publicPath = `/uploads/documents/${fileName}`;

  const doc = new PDFDocument({
    size: "A4",
    margins: {
      top: 56,
      bottom: 56,
      left: 56,
      right: 56,
    },
  });

  const stream = fs.createWriteStream(filePath);
  doc.pipe(stream);

  const paidAt = charge.paidAt || new Date();
  const paidAmount = Number(charge.paidAmount || charge.amount || 0);

  const formatDateBR = (value: Date | string | null | undefined) => {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "-";

    return new Intl.DateTimeFormat("pt-BR", {
      timeZone: "America/Belem",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(date);
  };

  const companyLine = [
    company.companyAddress,
    company.companyCity,
    company.companyState,
    company.companyZipCode ? `CEP ${company.companyZipCode}` : "",
  ]
    .filter(Boolean)
    .join(" - ");

  doc
    .font("Helvetica-Bold")
    .fontSize(18)
    .fillColor("#123c32")
    .text(company.companyLegalName || "AMAZONIKA Engenharia & Meio Ambiente", {
      align: "center",
    });

  doc
    .moveDown(0.4)
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(`CNPJ: ${company.companyCnpj || "-"}`, { align: "center" });

  if (companyLine) {
    doc.text(companyLine, { align: "center" });
  }

  if (company.companyEmail || company.companyPhone || company.companyWhatsapp) {
    doc.text(
      [company.companyEmail, company.companyPhone, company.companyWhatsapp]
        .filter(Boolean)
        .join(" | "),
      { align: "center" }
    );
  }

  doc.moveDown(2);

  doc
    .font("Helvetica-Bold")
    .fontSize(22)
    .fillColor("#111827")
    .text("RECIBO DE PAGAMENTO", { align: "center" });

  doc
    .moveDown(0.5)
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor("#123c32")
    .text(receiptNumber, { align: "center" });

  doc.moveDown(2);

doc
  .font("Helvetica")
  .fontSize(12)
  .fillColor("#111827")
  .text(
    `Recebemos de ${charge.client?.name || "-"}, inscrito(a) no CPF/CNPJ ${
      charge.client?.cpfCnpj || "-"
    }, a importância de ${formatMoneyBR(
      paidAmount
    )}, referente ao pagamento da entrada vinculada ao contrato ${
      charge.contract?.contractNumber || "-"
    } e ao protocolo ${
      charge.protocol?.protocolNumber || "-"
    }, correspondente ao serviço ${
      charge.protocol?.serviceType?.name || "-"
    }.`,
    {
      align: "justify",
      lineGap: 4,
    }
  );

  doc.moveDown(1.5);

  doc
    .font("Helvetica")
    .fontSize(12)
    .text(`Descrição da cobrança: ${charge.description || "-"}`, {
      lineGap: 4,
    });

  doc.text(`Data do pagamento: ${formatDateBR(paidAt)}`, { lineGap: 4 });
  doc.text(`Valor recebido: ${formatMoneyBR(paidAmount)}`, {
    lineGap: 4,
  });

  if (charge.txid) {
    doc.text(`TXID: ${charge.txid}`, { lineGap: 4 });
  }

  doc.moveDown(3);

  doc
    .font("Helvetica")
    .fontSize(12)
    .text(`${company.companyCity || "Macapá"}-${company.companyState || "AP"}, ${formatDateBR(new Date())}.`, {
      align: "right",
    });

  doc.moveDown(4);

  const signatureY = doc.y;

  doc
    .moveTo(160, signatureY)
    .lineTo(435, signatureY)
    .strokeColor("#111827")
    .lineWidth(0.8)
    .stroke();

  doc
    .moveDown(0.4)
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor("#111827")
    .text(company.companyLegalName || "AMAZONIKA Engenharia & Meio Ambiente", {
      align: "center",
    });

  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor("#374151")
    .text(`CNPJ: ${company.companyCnpj || "-"}`, { align: "center" });

  doc.moveDown(2);

  doc
    .font("Helvetica")
    .fontSize(8.5)
    .fillColor("#64748b")
    .text(
      "Este recibo foi gerado eletronicamente pelo sistema interno da AMAZONIKA Engenharia & Meio Ambiente após confirmação do pagamento.",
      {
        align: "center",
      }
    );

  doc.end();

  await new Promise<void>((resolve, reject) => {
    stream.on("finish", () => resolve());
    stream.on("error", reject);
  });

  return {
    fileName,
    filePath,
    publicPath,
  };
}

app.post(
  "/billing-charges/:id/mark-paid",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      const charge = await prisma.billingCharge.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: {
            include: {
              proposal: true,
            },
          },
          fiscalDocuments: true,
        },
      });

      if (!charge) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

      if (charge.status === "PAGA") {
        return res.status(400).json({
          message: "Esta cobrança já está marcada como paga.",
        });
      }

      if (charge.status !== "ENVIADA" && charge.status !== "EMITIDA") {
        return res.status(400).json({
          message:
            "Somente cobranças emitidas ou enviadas podem ser marcadas como pagas.",
        });
      }

      const paidAt = normalizeNullableDate(req.body?.paidAt) || new Date();

const paidAmount =
  req.body?.paidAmount !== undefined && req.body?.paidAmount !== ""
    ? Number(req.body.paidAmount)
    : Number(charge.amount || 0);

      const paidCharge = await prisma.billingCharge.update({
        where: { id: charge.id },
        data: {
          status: "PAGA",
          paidAt,
          paidAmount,
          rawWebhook: req.body?.rawWebhook
            ? JSON.stringify(req.body.rawWebhook)
            : charge.rawWebhook,
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: {
            include: {
              proposal: true,
            },
          },
          fiscalDocuments: true,
        },
      });

      const competenceMonth = getCompetenceMonthFromDate(paidAt);

      const duplicatedTransaction =
        await prisma.financialTransaction.findFirst({
          where: {
            type: "ENTRADA",
            source: "CONTRATO",
            protocolId: charge.protocolId,
            description: {
              contains: `Cobrança #${charge.id}`,
            },
          },
        });

      if (!duplicatedTransaction) {
        await prisma.financialTransaction.create({
          data: {
            type: "ENTRADA",
            source: "CONTRATO",
            status: "PAGO",
            protocolId: charge.protocolId,
            description: `Entrada paga - Cobrança #${charge.id} - ${
              charge.contract?.contractNumber || charge.protocol.protocolNumber
            }`,
            amount: paidAmount,
            dueDate: charge.dueDate,
            paidAt,
            competenceMonth,
            clientName: charge.client.name,
            notes:
              req.body?.notes ||
              `Pagamento confirmado da cobrança de entrada vinculada ao protocolo ${charge.protocol.protocolNumber}.`,
            createdById: req.user?.id || null,
          },
        });
      }

      const nextDeadline =
        charge.contract?.deadlineDate ||
        (charge.contract?.proposal?.executionDays
          ? addDays(paidAt, Number(charge.contract.proposal.executionDays))
          : charge.protocol.deadlineDate);

      await prisma.protocol.update({
        where: {
          id: charge.protocolId,
        },
        data: {
          status: "EM_EXECUCAO",
          deadlineDate: nextDeadline || undefined,
        },
      });

      let generatedReceipt: any = null;
      let receiptEmailSent = false;

      if (charge.fiscalMode === "RECIBO_POSTERIOR") {
        const existingReceipt = charge.fiscalDocuments.find(
          (document) =>
            document.status === "ANEXADO" &&
            document.type === "RECIBO" &&
            document.moment === "POS_PAGAMENTO"
        );

        if (!existingReceipt) {
          const receiptPdf = await generateReceiptPdfForBillingCharge({
            ...paidCharge,
            paidAt,
            paidAmount,
          });

          generatedReceipt = await prisma.fiscalDocument.create({
            data: {
              protocolId: charge.protocolId,
              clientId: charge.clientId,
              contractId: charge.contractId,
              billingChargeId: charge.id,
              createdById: req.user?.id || null,

              type: "RECIBO",
              moment: "POS_PAGAMENTO",
              status: "ANEXADO",

              number: `REC-${String(charge.id).padStart(6, "0")}`,
              issuedAt: paidAt,
              amount: paidAmount,

              fileName: receiptPdf.fileName,
              filePath: receiptPdf.publicPath,
              mimeType: "application/pdf",
              size: fs.existsSync(receiptPdf.filePath)
                ? fs.statSync(receiptPdf.filePath).size
                : null,

              notes:
                "Recibo gerado automaticamente após confirmação do pagamento da entrada.",
            },
          });

          await createProposalHistory({
            protocolId: charge.protocolId,
            proposalId: charge.contract?.proposalId || null,
            eventType: "RECIBO_GERADO_AUTOMATICAMENTE",
            title: "Recibo de pagamento gerado automaticamente",
            description:
              "O recibo da entrada foi gerado automaticamente após a confirmação do pagamento.",
            recipient: charge.client.email || null,
            senderName: req.user?.name || "Sistema",
            senderEmail: req.user?.email || null,
            createdById: req.user?.id || null,
            metadata: {
              billingChargeId: charge.id,
              fiscalDocumentId: generatedReceipt.id,
              amount: paidAmount,
              paidAt,
              filePath: receiptPdf.publicPath,
            },
          });

          if (charge.client.email) {
            try {
              const settings = await getSmtpSettings();
              const company = await getCompanySettings();
              const transporter = await createTransporterFromSettings();

              if (transporter) {
                const publicBaseUrl = getBillingPublicBaseUrl();
                const chargeUrl = `${publicBaseUrl}/cobranca/${charge.id}`;

                const html = `
                  <div style="font-family:Arial,sans-serif;background:#f4f7f5;padding:24px;">
                    <div style="max-width:720px;margin:0 auto;background:#ffffff;border-radius:18px;overflow:hidden;border:1px solid #dfe7e2;">
                      <div style="background:#123c32;color:#ffffff;padding:24px;">
                        <h1 style="margin:0;font-size:24px;">Recibo de pagamento</h1>
                        <p style="margin:8px 0 0;color:#d8f3e5;">
                          ${company.companyName || "AMAZONIKA Engenharia & Meio Ambiente"}
                        </p>
                      </div>

                      <div style="padding:24px;color:#1f2937;">
                        <p>Prezado(a) <strong>${charge.client.name}</strong>,</p>

                        <p style="line-height:1.6;">
                          Confirmamos o pagamento da entrada referente ao protocolo
                          <strong>${charge.protocol.protocolNumber}</strong>.
                          O recibo de pagamento segue em anexo.
                        </p>

                        <div style="background:#f8fbf9;border:1px solid #dfe7e2;border-radius:14px;padding:16px;margin:18px 0;">
                          <p><strong>Contrato:</strong> ${charge.contract?.contractNumber || "-"}</p>
                          <p><strong>Serviço:</strong> ${charge.protocol.serviceType?.name || "-"}</p>
                          <p><strong>Valor pago:</strong> ${formatMoneyBR(paidAmount)}</p>
                          <p><strong>Data do pagamento:</strong> ${new Intl.DateTimeFormat("pt-BR", {
                            timeZone: "America/Belem",
                            day: "2-digit",
                            month: "2-digit",
                            year: "numeric",
                          }).format(paidAt)}</p>
                        </div>

                        <p style="line-height:1.6;">
                          Com a confirmação do pagamento, a equipe técnica está liberada para
                          mobilização e início da execução dos serviços, conforme condições contratuais.
                        </p>

                        <p style="text-align:center;margin:28px 0;">
                          <a href="${chargeUrl}" target="_blank"
                            style="display:inline-block;background:#123c32;color:#ffffff;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:bold;">
                            Abrir cobrança
                          </a>
                        </p>
                      </div>
                    </div>
                  </div>
                `;

                const info = await transporter.sendMail({
                  from: settings.smtpFrom,
                  to: charge.client.email,
                  subject: `Recibo de pagamento — ${charge.protocol.protocolNumber}`,
                  html,
                  attachments: [
                    ...getEmailImageAttachments(),
                    {
                      filename: receiptPdf.fileName,
                      path: receiptPdf.filePath,
                    },
                  ],
                });

                receiptEmailSent = true;

                await createProposalHistory({
                  protocolId: charge.protocolId,
                  proposalId: charge.contract?.proposalId || null,
                  eventType: "RECIBO_ENVIADO_AO_CLIENTE",
                  title: "Recibo de pagamento enviado ao cliente",
                  description: `O recibo da entrada foi enviado por e-mail para ${charge.client.email}.`,
                  recipient: charge.client.email,
                  senderName: req.user?.name || "Sistema",
                  senderEmail: req.user?.email || null,
                  createdById: req.user?.id || null,
                  metadata: {
                    billingChargeId: charge.id,
                    fiscalDocumentId: generatedReceipt.id,
                    messageId: info.messageId,
                    accepted: info.accepted,
                    rejected: info.rejected,
                  },
                });
              }
            } catch (emailError) {
              console.error("Pagamento confirmado, mas erro ao enviar recibo:", emailError);

              await createProposalHistory({
                protocolId: charge.protocolId,
                proposalId: charge.contract?.proposalId || null,
                eventType: "ERRO_ENVIO_RECIBO",
                title: "Recibo gerado, mas não enviado por e-mail",
                description:
                  "O recibo foi gerado automaticamente, mas ocorreu erro no envio por e-mail.",
                recipient: charge.client.email || null,
                senderName: req.user?.name || "Sistema",
                senderEmail: req.user?.email || null,
                createdById: req.user?.id || null,
                metadata: {
                  billingChargeId: charge.id,
                  fiscalDocumentId: generatedReceipt?.id || null,
                  error:
                    emailError instanceof Error
                      ? emailError.message
                      : String(emailError),
                },
              });
            }
          }
        }
      }

      await createProposalHistory({
        protocolId: charge.protocolId,
        proposalId: charge.contract?.proposalId || null,
        eventType: "PAGAMENTO_CONFIRMADO",
        title: "Pagamento da entrada confirmado",
        description:
          "O pagamento da entrada foi confirmado. O protocolo foi liberado para execução e mobilização da equipe técnica.",
        recipient: charge.client.email || null,
        senderName: req.user?.name || "Sistema",
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          billingChargeId: charge.id,
          amount: paidAmount,
          paidAt,
          protocolStatus: "EM_EXECUCAO",
          deadlineDate: nextDeadline,
          receiptGenerated: Boolean(generatedReceipt),
          receiptEmailSent,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "MARK_BILLING_CHARGE_PAID",
          entity: "BillingCharge",
          entityId: String(charge.id),
          description: `Cobrança #${charge.id} marcada como paga.`,
          ipAddress: req.ip,
        },
      });

      const finalCharge = await prisma.billingCharge.findUnique({
        where: {
          id: charge.id,
        },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: {
            include: {
              proposal: true,
            },
          },
          fiscalDocuments: {
            orderBy: {
              createdAt: "desc",
            },
          },
        },
      });

      return res.json({
        ...finalCharge,
        receiptGenerated: Boolean(generatedReceipt),
        receiptEmailSent,
      });
    } catch (error) {
      console.error("Erro ao marcar cobrança como paga:", error);

      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Erro ao marcar cobrança como paga.",
      });
    }
  }
);

app.post(
  "/payments/:id/issue-bb-pix",
  authMiddleware,
  requireRoles(["GERENTE", "PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const id = Number(req.params.id);

      if (!id) {
        return res.status(400).json({
          message: "ID da cobrança inválido.",
        });
      }

      const payment = await prisma.payment.findUnique({
        where: { id },
        include: {
          client: true,
          protocol: {
            include: {
              serviceType: true,
            },
          },
          contract: true,
        },
      });

      if (!payment) {
        return res.status(404).json({
          message: "Cobrança não encontrada.",
        });
      }

      if (payment.status === "PAGO") {
        return res.status(400).json({
          message: "Esta cobrança já está marcada como paga.",
        });
      }

      if (!payment.contract) {
        return res.status(400).json({
          message: "A cobrança precisa estar vinculada a um contrato.",
        });
      }

      if (payment.contract.status !== "ASSINADO") {
        return res.status(400).json({
          message:
            "A cobrança só pode ser emitida após assinatura do contrato.",
        });
      }

      if (payment.pixCopiaECola && payment.txid) {
        return res.json(payment);
      }

      const amountInCents = Math.round(Number(payment.amount || 0) * 100);

      if (amountInCents <= 0) {
        return res.status(400).json({
          message: "O valor da cobrança deve ser maior que zero.",
        });
      }

      const txid = `AMZ${String(payment.id).padStart(10, "0")}`;

      const bbResponse = await createBbPixCharge({
        txid,
        amountInCents,
        debtorName: payment.client.name,
        debtorCpfCnpj: payment.client.cpfCnpj,
        description: `Entrada ${payment.protocol.protocolNumber}`,
      });

      const pixCopiaECola =
        bbResponse?.pixCopiaECola ||
        bbResponse?.brcode ||
        bbResponse?.qrcode ||
        bbResponse?.qrCode ||
        null;

      const pixQrCode =
        bbResponse?.imagemQrcode ||
        bbResponse?.imagemQRCode ||
        bbResponse?.qrCodeImagem ||
        null;

      const updated = await prisma.payment.update({
        where: { id: payment.id },
        data: {
          provider: "BANCO_DO_BRASIL",
          providerEnv: process.env.BB_ENV || "sandbox",
          providerChargeId: bbResponse?.loc?.id
            ? String(bbResponse.loc.id)
            : bbResponse?.location
            ? String(bbResponse.location)
            : null,
          txid,
          pixCopiaECola,
          pixQrCode,
          providerRaw: JSON.stringify(bbResponse),
        },
        include: {
          client: true,
          protocol: true,
          contract: true,
        },
      });

      await createProposalHistory({
        protocolId: payment.protocolId,
        proposalId: payment.contract.proposalId || null,
        eventType: "COBRANCA_BB_PIX_EMITIDA",
        title: "Cobrança Pix BB emitida",
        description:
          "Cobrança Pix emitida pelo Banco do Brasil para pagamento da entrada.",
        recipient: payment.client.email || null,
        senderName: req.user?.name || null,
        senderEmail: req.user?.email || null,
        createdById: req.user?.id || null,
        metadata: {
          paymentId: payment.id,
          contractId: payment.contractId,
          contractNumber: payment.contract.contractNumber,
          protocolNumber: payment.protocol.protocolNumber,
          txid,
          provider: "BANCO_DO_BRASIL",
          providerEnv: process.env.BB_ENV || "sandbox",
          amount: payment.amount,
        },
      });

      await prisma.auditLog.create({
        data: {
          userId: req.user?.id || null,
          userName: req.user?.name || null,
          userEmail: req.user?.email || null,
          userRole: req.user?.role || null,
          action: "ISSUE_BB_PIX_PAYMENT",
          entity: "Payment",
          entityId: String(payment.id),
          description: `Pix BB emitido para cobrança ${payment.id}.`,
          ipAddress: req.ip,
          metadata: JSON.stringify({
            txid,
            providerEnv: process.env.BB_ENV || "sandbox",
          }),
        },
      });

      return res.json(updated);
    } catch (error) {
      console.error("Erro ao emitir Pix BB:", error);

      return res.status(500).json({
        message:
          error instanceof Error
            ? error.message
            : "Erro ao emitir Pix pelo Banco do Brasil.",
      });
    }
  }
);


//#__________________________________#rota temporaria

app.post(
  "/bb-pix/test-charge",
  authMiddleware,
  requireRoles(["PROGRAMADOR"]),
  async (req: any, res) => {
    try {
      const txid = `AMZ${Date.now()}${crypto.randomBytes(8).toString("hex")}`.slice(
        0,
        35
      );

      const result = await createBbPixCharge({
        txid,
        amountInCents: 100, // R$ 1,00
        debtorName: "Plinio Marcos Bahia Potyguara",
        debtorCpfCnpj: "73268070272",
        description: "Teste de cobrança PIX BB Sandbox",
      });

      return res.json({
        success: true,
        txid,
        result,
      });
    } catch (error: any) {
      console.error("Erro no teste BB PIX:", {
        message: error?.message,
        status: error?.response?.status,
        data: error?.response?.data,
        headers: error?.response?.headers,
      });

      return res.status(500).json({
        success: false,
        message:
          error?.response?.data?.mensagem ||
          error?.response?.data?.message ||
          error?.message ||
          "Erro no teste BB PIX.",
        bbStatus: error?.response?.status || null,
        bbData: error?.response?.data || null,
      });
    }
  }
);


// ------------------------------------------------------
// MÓDULO DE PARCEIROS
// ------------------------------------------------------

registerPartnerRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
});

registerPartnerReferralRoutes({
  app,
  prisma,
  authMiddleware,
  requireRoles,
});

app.get("/health", (_req, res) => {
  return res.json({
    name: "SIS Amazonika API",
    status: "online",
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`SIS Amazonika API rodando em http://localhost:${PORT}`);
});
