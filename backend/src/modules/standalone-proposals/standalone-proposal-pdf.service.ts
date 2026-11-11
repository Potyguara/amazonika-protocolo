import { assertMoneyCents, formatBRL } from "../../lib/money";
import { standaloneDocumentTerms } from "./standalone-money";
import PDFDocument from "pdfkit";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { PrismaClient } from "@prisma/client";

const GREEN = "#155E49";
const DARK = "#17231F";
const MUTED = "#64736C";
const LIGHT = "#F3F7F5";
const BORDER = "#D9E4DF";

const PAGE_LEFT = 52;
const PAGE_RIGHT = 52;

const CONTENT_TOP = 92;
const CONTENT_BOTTOM = 742;

const CONTENT_WIDTH =
  595.28 -
  PAGE_LEFT -
  PAGE_RIGHT;

function money(value?: number | null) {
  return value == null ? "—" : formatBRL(assertMoneyCents(value));
}

function formatDate(value?: Date | string | null) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Belem",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(value));
}

function safeText(value?: string | null) {
  return String(value || "").trim();
}

function proposalAsset(
  fileName: string
) {
  const candidate = path.resolve(
    process.cwd(),
    "assets",
    fileName
  );

  return fs.existsSync(candidate)
    ? candidate
    : null;
}

function proposalLogo() {
  return proposalAsset(
    "logo_header.png"
  );
}

function proposalWatermark() {
  return proposalAsset(
    "watermark.png"
  );
}

function ensureDirectory(dir: string) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, {
      recursive: true,
    });
  }
}

function fileSha256(filePath: string) {
  const buffer = fs.readFileSync(filePath);

  return crypto
    .createHash("sha256")
    .update(buffer)
    .digest("hex");
}

function line(
  doc: PDFKit.PDFDocument,
  y?: number
) {
  const currentY =
    y ?? doc.y;

  doc
    .moveTo(45, currentY)
    .lineTo(550, currentY)
    .strokeColor(BORDER)
    .lineWidth(0.7)
    .stroke();
}

function ensureSpace(
  doc: PDFKit.PDFDocument,
  height: number
) {
  if (
    doc.y + height <=
    CONTENT_BOTTOM
  ) {
    return;
  }

  doc.addPage();

  doc.x = PAGE_LEFT;
  doc.y = CONTENT_TOP;
}

function drawInstitutionalPage(
  doc: PDFKit.PDFDocument,
  proposal: any,
  company: any,
  firstPage: boolean
) {
  const savedX = doc.x;
  const savedY = doc.y;

  const savedMargins = {
    top: doc.page.margins.top,
    right: doc.page.margins.right,
    bottom: doc.page.margins.bottom,
    left: doc.page.margins.left,
  };

  /*
   * IMPORTANTE:
   * Elementos institucionais são absolutos e não
   * participam do fluxo do documento.
   *
   * Zeramos temporariamente as margens para impedir
   * que textos do rodapé gerem uma nova página.
   */
  doc.page.margins.top = 0;
  doc.page.margins.right = 0;
  doc.page.margins.bottom = 0;
  doc.page.margins.left = 0;

  const logo =
    proposalLogo();

  const watermark =
    proposalWatermark();

  // -----------------------------------------------------
  // MARCA D'ÁGUA
  // -----------------------------------------------------

  if (watermark) {
    try {
      doc.save();

      doc.opacity(0.022);

      doc.image(
        watermark,
        157,
        282,
        {
          fit: [280, 280],
        }
      );

      doc.restore();
    } catch {
      try {
        doc.restore();
      } catch {
        // segue sem interromper o PDF
      }
    }
  }

  // -----------------------------------------------------
  // CABEÇALHO
  // -----------------------------------------------------

  doc.rect(0, 0, 112, 6).fill("#C5A045");
  doc.rect(112, 0, doc.page.width - 112, 6).fill(GREEN);

  if (firstPage) {
    if (logo) {
      try {
        doc.image(logo, PAGE_LEFT, 27, { fit: [58, 58] });
      } catch { /* preserva PDF sem logomarca se necessário */ }
    }
    doc.font("Helvetica-Bold").fontSize(8.4).fillColor(GREEN)
      .text("AMAZONIKA ENGENHARIA LTDA", PAGE_LEFT + 71, 40, {
        width: 194, lineBreak: false,
      });
    doc.font("Helvetica").fontSize(6.9).fillColor(MUTED)
      .text("T O P O G R A F I A  E  M E I O  A M B I E N T E",
        PAGE_LEFT + 71, 55, { width: 190, lineBreak: false });

    const headerLines = [
      "AMAZONIKA ENGENHARIA LTDA",
      "Av. Almirante Barroso 620-B - CEP 68900-401",
      "Bairro: Central - Macapá/AP",
      "CNPJ: 49.158.834/0001-19",
      "Contato: 96 98803-6439 / 96 9141-0943",
      "www.amazonikaengenharia.com.br",
      "amazonika@amazonikaengenharia.com.br",
    ];
    headerLines.forEach((value, index) => {
      doc.font(index === 0 ? "Helvetica-Bold" : "Helvetica")
        .fontSize(index === 0 ? 7.0 : 6.2)
        .fillColor(index === 0 ? GREEN : MUTED)
        .text(value, 322, 17 + index * 12, {
          width: 221, align: "right", lineBreak: false,
        });
    });
    doc.rect(PAGE_LEFT, 112, 93, 2).fill("#C5A045");
    doc.moveTo(PAGE_LEFT + 93, 113)
      .lineTo(doc.page.width - PAGE_RIGHT, 113)
      .strokeColor(GREEN).lineWidth(0.5).stroke();
  } else {
    // Cabeçalho compacto das páginas seguintes, como no PDF de referência.
    if (logo) {
      try {
        doc.image(logo, PAGE_LEFT, 25, { fit: [33, 33] });
      } catch { /* sem interrupção da emissão */ }
    }
    doc.font("Helvetica-Bold").fontSize(7.8).fillColor(GREEN)
      .text("AMAZONIKA ENGENHARIA", PAGE_LEFT + 40, 38, {
        width: 174, lineBreak: false,
      });
    doc.font("Helvetica").fontSize(6.1).fillColor(MUTED)
      .text(`PROPOSTA DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS  ·  ${proposal.proposalNumber}`,
        285, 39, {
          width: 258, align: "right", lineBreak: false,
        });
    doc.rect(PAGE_LEFT, 68, 80, 2).fill("#C5A045");
    doc.moveTo(PAGE_LEFT + 80, 69)
      .lineTo(doc.page.width - PAGE_RIGHT, 69)
      .strokeColor(BORDER).lineWidth(0.5).stroke();
  }

  // -----------------------------------------------------
  // RODAPÉ INSTITUCIONAL
  // -----------------------------------------------------

  const footerLineY =
    doc.page.height - 61;

  doc
    .moveTo(
      PAGE_LEFT,
      footerLineY
    )
    .lineTo(
      doc.page.width - PAGE_RIGHT,
      footerLineY
    )
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();

  const companyName =
    company?.companyName ||
    "AMAZÔNIKA Engenharia & Meio Ambiente";

  const documentValue =
    company?.cnpj ||
    company?.document ||
    null;

  const cityState =
    company?.city &&
    company?.state
      ? `${company.city}/${company.state}`
      : company?.city ||
        company?.state ||
        null;

  const contactLine = [
    documentValue
      ? `CNPJ: ${documentValue}`
      : null,
    company?.address,
    cityState,
  ]
    .filter(Boolean)
    .join(" • ");

  const communicationLine = [
    company?.phone,
    company?.email,
  ]
    .filter(Boolean)
    .join(" • ");

  doc
    .font("Helvetica-Bold")
    .fontSize(6.2)
    .fillColor(GREEN)
    .text(
      companyName,
      PAGE_LEFT,
      footerLineY + 8,
      {
        width: 390,
        lineBreak: false,
      }
    );

  if (contactLine) {
    doc
      .font("Helvetica")
      .fontSize(5.6)
      .fillColor(MUTED)
      .text(
        contactLine,
        PAGE_LEFT,
        footerLineY + 18,
        {
          width: 390,
          lineBreak: false,
        }
      );
  }

  if (communicationLine) {
    doc
      .font("Helvetica")
      .fontSize(5.6)
      .fillColor(MUTED)
      .text(
        communicationLine,
        PAGE_LEFT,
        footerLineY + 28,
        {
          width: 390,
          lineBreak: false,
        }
      );
  }

  /*
   * Restaura exatamente as margens e o cursor
   * usados pelo conteúdo.
   */
  doc.page.margins.top =
    savedMargins.top;

  doc.page.margins.right =
    savedMargins.right;

  doc.page.margins.bottom =
    savedMargins.bottom;

  doc.page.margins.left =
    savedMargins.left;

  doc.x = savedX;
  doc.y = savedY;
}

function drawInstitutionalPages(
  doc: PDFKit.PDFDocument,
  proposal: any,
  company: any
) {
  const range =
    doc.bufferedPageRange();

  for (
    let index = 0;
    index < range.count;
    index++
  ) {
    doc.switchToPage(
      range.start + index
    );

    drawInstitutionalPage(
      doc,
      proposal,
      company,
      index === 0
    );
  }
}

function drawPageNumbers(
  doc: PDFKit.PDFDocument
) {
  const range =
    doc.bufferedPageRange();

  for (
    let index = 0;
    index < range.count;
    index++
  ) {
    doc.switchToPage(
      range.start + index
    );

    const savedX = doc.x;
    const savedY = doc.y;

    const savedMargins = {
      top: doc.page.margins.top,
      right: doc.page.margins.right,
      bottom: doc.page.margins.bottom,
      left: doc.page.margins.left,
    };

    doc.page.margins.top = 0;
    doc.page.margins.right = 0;
    doc.page.margins.bottom = 0;
    doc.page.margins.left = 0;

    doc
      .font("Helvetica")
      .fontSize(5.8)
      .fillColor(MUTED)
      .text(
        `Página ${index + 1} de ${range.count}`,
        450,
        doc.page.height - 39,
        {
          width: 93,
          align: "right",
          lineBreak: false,
        }
      );

    doc.page.margins.top =
      savedMargins.top;

    doc.page.margins.right =
      savedMargins.right;

    doc.page.margins.bottom =
      savedMargins.bottom;

    doc.page.margins.left =
      savedMargins.left;

    doc.x = savedX;
    doc.y = savedY;
  }
}

function sectionTitle(
  doc: PDFKit.PDFDocument,
  title: string
) {
  ensureSpace(doc, 55);
  doc.moveDown(0.85);
  const y = doc.y;
  const match = title.match(/^([IVX]+)\s*[–-]\s*(.*)$/);
  const numeral = match ? match[1] : "•";
  const heading = match ? match[2] : title;

  doc.roundedRect(PAGE_LEFT, y, 24, 24, 5).fill(GREEN);
  doc.font("Helvetica-Bold").fontSize(10).fillColor("#FFFFFF")
    .text(numeral, PAGE_LEFT, y + 6, { width: 24, align: "center", lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(10.2).fillColor(GREEN)
    .text(heading.toUpperCase(), PAGE_LEFT + 34, y + 6, {
      width: CONTENT_WIDTH - 42, lineBreak: false,
    });
  doc.moveTo(PAGE_LEFT + 34, y + 26)
    .lineTo(PAGE_LEFT + CONTENT_WIDTH, y + 26)
    .strokeColor(BORDER).lineWidth(0.7).stroke();
  doc.x = PAGE_LEFT;
  doc.y = y + 35;
}

function paragraph(
  doc: PDFKit.PDFDocument,
  text: string
) {
  if (!safeText(text)) {
    return;
  }

  ensureSpace(doc, 65);

  doc
    .font("Helvetica")
    .fontSize(9.5)
    .fillColor(DARK)
    .text(text, {
      align: "justify",
      lineGap: 3,
    });

  doc.moveDown(0.6);
}

function drawHeader(
  doc: PDFKit.PDFDocument,
  proposal: any
) {
  doc.x = PAGE_LEFT;
  doc.y = CONTENT_TOP + 45;
  const y = doc.y;

  doc.font("Helvetica-Bold").fontSize(7.4).fillColor("#B69137")
    .text("P R O P O S T A    C O M E R C I A L",
      PAGE_LEFT, y, { width: 320, lineBreak: false });

  doc.font("Helvetica").fontSize(6.8).fillColor(MUTED)
    .text("Nº DA PROPOSTA", 410, y, { width: 133, align: "right", lineBreak: false });
  doc.font("Helvetica-Bold").fontSize(10).fillColor(GREEN)
    .text(proposal.proposalNumber, 385, y + 13, {
      width: 158, align: "right", lineBreak: false,
    });

  doc.font("Times-Bold").fontSize(23).fillColor(GREEN)
    .text("Prestação de Serviços Técnicos", PAGE_LEFT, y + 23,
      { width: 465, lineBreak: false });

  const cardY = y + 71;
  const leftW = 302;
  const rightX = PAGE_LEFT + leftW + 12;
  const rightW = CONTENT_WIDTH - leftW - 12;

  doc.roundedRect(PAGE_LEFT, cardY, leftW, 76, 8)
    .fillAndStroke("#FFFFFF", BORDER);
  doc.rect(PAGE_LEFT, cardY + 9, 4, 58).fill("#B69137");
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#9A7D37")
    .text("D E S T I N A T Á R I O", PAGE_LEFT + 17, cardY + 14,
      { width: leftW - 31, lineBreak: false });
  doc.font("Times-Bold").fontSize(15).fillColor(GREEN)
    .text(safeText(proposal.clientName), PAGE_LEFT + 17, cardY + 34,
      { width: leftW - 32, height: 23, ellipsis: true });
  doc.font("Helvetica").fontSize(6.7).fillColor(MUTED)
    .text(`Emissão: ${formatDate(proposal.generatedAt || new Date())}   •   Proposta nº ${proposal.proposalNumber}`,
      PAGE_LEFT + 17, cardY + 63, { width: leftW - 27, lineBreak: false });

  doc.roundedRect(rightX, cardY, rightW, 76, 8).fill(GREEN);
  doc.rect(rightX, cardY, rightW, 5).fill("#C5A045");
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#E7D1A1")
    .text("V A L O R   T O T A L", rightX + 15, cardY + 16,
      { width: rightW - 30, lineBreak: false });
  doc.font("Times-Bold").fontSize(18).fillColor("#FFFFFF")
    .text(money(proposal.totalAmount), rightX + 15, cardY + 34,
      { width: rightW - 30, lineBreak: false });
  if (proposal.validUntil) {
    doc.font("Helvetica").fontSize(6.8).fillColor("#D6E6DD")
      .text(`Válida até ${formatDate(proposal.validUntil)}`,
        rightX + 15, cardY + 62, { width: rightW - 30, lineBreak: false });
  }

  doc.x = PAGE_LEFT;
  doc.y = cardY + 82;
}

function drawItemsTable(
  doc: PDFKit.PDFDocument,
  items: any[]
) {
  const x = 45;

  /*
   * Área útil da A4:
   * 595 - 45 - 45 = aproximadamente 505 pt.
   *
   * A soma abaixo é exatamente 505 pt.
   */
  const widths = {
    item: 28,
    description: 219,
    quantity: 42,
    unit: 48,
    unitAmount: 80,
    total: 88,
  };

  const totalWidth =
    widths.item +
    widths.description +
    widths.quantity +
    widths.unit +
    widths.unitAmount +
    widths.total;

  const TABLE_HEADER_HEIGHT = 26;
  const TABLE_HEADER_GAP = 3;
  const MIN_ROW_HEIGHT = 34;

  function drawTableHeader() {
    const y = doc.y;

    doc
      .rect(
        x,
        y,
        totalWidth,
        26
      )
      .fill(GREEN);

    let cursor = x;

    const headers = [
      ["Item", widths.item],
      ["Descrição", widths.description],
      ["Qtd.", widths.quantity],
      ["Unid.", widths.unit],
      ["Unitário", widths.unitAmount],
      ["Total", widths.total],
    ] as const;

    for (
      const [label, width]
      of headers
    ) {
      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor("#FFFFFF")
        .text(
          label,
          cursor + 4,
          y + 9,
          {
            width: width - 8,
            align:
              label === "Descrição"
                ? "left"
                : "center",
          }
        );

      cursor += width;
    }

    doc.y =
      y +
      TABLE_HEADER_HEIGHT +
      TABLE_HEADER_GAP;
  }

  /*
   * O primeiro cabeçalho só é iniciado nesta página
   * se houver espaço para:
   *
   * cabeçalho + ao menos uma linha mínima.
   *
   * Isso evita deixar apenas o cabeçalho no rodapé.
   */
  if (
    doc.y +
      TABLE_HEADER_HEIGHT +
      TABLE_HEADER_GAP +
      MIN_ROW_HEIGHT >
    CONTENT_BOTTOM
  ) {
    doc.addPage();

    doc.x = PAGE_LEFT;
    doc.y = CONTENT_TOP;
  }

  drawTableHeader();

  items.forEach(
    (item, index) => {
      /*
       * A tabela comercial deve permanecer compacta.
       *
       * Textos comerciais, técnicos e legais completos
       * são apresentados posteriormente no corpo da
       * proposta.
       */
      const summary =
        safeText(
          item.summaryDescription
        );

      const serviceName =
        safeText(
          item.serviceName
        ) || "Serviço";

      const serviceNameHeight =
        doc
          .font("Helvetica-Bold")
          .fontSize(8)
          .heightOfString(
            serviceName,
            {
              width:
                widths.description -
                10,
              lineGap: 1,
            }
          );

      const summaryHeight =
        summary
          ? doc
              .font("Helvetica")
              .fontSize(7.4)
              .heightOfString(
                summary,
                {
                  width:
                    widths.description -
                    10,
                  lineGap: 1.5,
                }
              )
          : 0;

      const rowHeight =
        Math.max(
          34,
          12 +
            serviceNameHeight +
            (
              summary
                ? summaryHeight + 5
                : 0
            )
        );

      /*
       * PAGINAÇÃO NATURAL
       * --------------------------------------------------
       * Nunca reservamos espaço para a tabela inteira.
       *
       * Cada item é analisado isoladamente.
       * Se a próxima linha não couber, somente ela passa
       * para a página seguinte.
       *
       * O cabeçalho é repetido automaticamente.
       */
      const availableHeight =
        CONTENT_BOTTOM -
        doc.y;

      if (
        rowHeight >
        availableHeight
      ) {
        doc.addPage();

        doc.x = PAGE_LEFT;
        doc.y = CONTENT_TOP;

        drawTableHeader();
      }

      const y = doc.y;

      doc
        .rect(
          x,
          y,
          totalWidth,
          rowHeight
        )
        .fill(
          index % 2 === 0
            ? "#FFFFFF"
            : "#F8FAF9"
        );

      doc
        .rect(
          x,
          y,
          totalWidth,
          rowHeight
        )
        .strokeColor(BORDER)
        .lineWidth(0.4)
        .stroke();

      let cursor = x;

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(DARK)
        .text(
          String(index + 1),
          cursor + 3,
          y + 12,
          {
            width:
              widths.item - 6,
            align: "center",
          }
        );

      cursor += widths.item;

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(DARK)
        .text(
          serviceName,
          cursor + 5,
          y + 7,
          {
            width:
              widths.description -
              10,
            lineGap: 1,
          }
        );

      if (summary) {
        const summaryY =
          y +
          9 +
          serviceNameHeight;

        doc
          .font("Helvetica")
          .fontSize(7.4)
          .fillColor(MUTED)
          .text(
            summary,
            cursor + 5,
            summaryY,
            {
              width:
                widths.description -
                10,
              lineGap: 1.5,
            }
          );
      }

      cursor += widths.description;

      doc
        .font("Helvetica")
        .fontSize(8)
        .fillColor(DARK)
        .text(
          Number(
            item.quantity || 0
          ).toLocaleString(
            "pt-BR",
            {
              maximumFractionDigits: 2,
            }
          ),
          cursor + 3,
          y + 12,
          {
            width:
              widths.quantity - 6,
            align: "center",
          }
        );

      cursor += widths.quantity;

      doc.text(
        safeText(
          item.unitLabel
        ) || "Serviço",
        cursor + 3,
        y + 12,
        {
          width:
            widths.unit - 6,
          align: "center",
        }
      );

      cursor += widths.unit;

      doc.text(
        money(
          item.unitAmount
        ),
        cursor + 3,
        y + 12,
        {
          width:
            widths.unitAmount - 6,
          align: "right",
        }
      );

      cursor += widths.unitAmount;

      doc
        .font("Helvetica-Bold")
        .text(
          money(
            item.totalAmount
          ),
          cursor + 3,
          y + 12,
          {
            width:
              widths.total - 6,
            align: "right",
          }
        );

      doc.y = y + rowHeight;
    }
  );

  doc.moveDown(0.6);
}

type ProposalItemNarrativeField =
  | "commercialDescription"
  | "technicalDescription"
  | "legalText";

function itemNarrativeText(
  item: any,
  field: ProposalItemNarrativeField
) {
  /*
   * Compatibilidade com propostas anteriores à V2:
   * description era o campo comercial genérico.
   */
  if (
    field ===
    "commercialDescription"
  ) {
    return (
      safeText(
        item.commercialDescription
      ) ||
      safeText(
        item.description
      )
    );
  }

  return safeText(
    item[field]
  );
}

function hasNarrativeContent(
  items: any[],
  field: ProposalItemNarrativeField
) {
  return items.some(
    (item) =>
      Boolean(
        itemNarrativeText(
          item,
          field
        )
      )
  );
}

function drawServiceNarratives(
  doc: PDFKit.PDFDocument,
  items: any[],
  field: ProposalItemNarrativeField
) {
  const availableItems =
    items.filter(
      (item) =>
        Boolean(
          itemNarrativeText(
            item,
            field
          )
        )
    );

  availableItems.forEach(
    (item, index) => {
      const content =
        itemNarrativeText(
          item,
          field
        );

      if (!content) {
        return;
      }

      ensureSpace(
        doc,
        82
      );

      const originalIndex =
        items.findIndex(
          (candidate) =>
            candidate.id ===
            item.id
        );

      const itemNumber =
        originalIndex >= 0
          ? originalIndex + 1
          : index + 1;

      const acronym =
        safeText(
          item.acronym
        ) ||
        safeText(
          item.catalogServiceCode
        );

      const title =
        `${itemNumber}. ${safeText(
          item.serviceName
        ) || "Serviço"}${
          acronym
            ? ` (${acronym})`
            : ""
        }`;

      doc
        .font("Helvetica-Bold")
        .fontSize(9.3)
        .fillColor(DARK)
        .text(
          title,
          PAGE_LEFT,
          doc.y,
          {
            width:
              CONTENT_WIDTH,
          }
        );

      doc.moveDown(0.28);

      if (field !== "technicalDescription" ||
          !drawTechnicalTimeline(doc, content)) {
        paragraph(doc, content);
      }

      if (
        index <
        availableItems.length - 1
      ) {
        doc.moveDown(0.15);
      }
    }
  );
}

// Linha do tempo editorial; detecta apenas fases explicitamente registradas.
function drawTechnicalTimeline(doc: PDFKit.PDFDocument, content: string): boolean {
  const normalized = content.replace(/\r\n/g, "\n");
  const matcher = /^\s*FASE\s+(\d+)\s*[-:–]?\s*([^\n]*)/gim;
  const phases = Array.from(normalized.matchAll(matcher));
  if (phases.length === 0) return false;

  const introduction = normalized.slice(0, phases[0].index).trim();
  if (introduction) paragraph(doc, introduction);

  phases.forEach((phase, index) => {
    const begin = (phase.index || 0) + phase[0].length;
    const end = index + 1 < phases.length
      ? phases[index + 1].index || normalized.length
      : normalized.length;
    const lines = normalized.slice(begin, end).trim()
      .split("\n").map((v) => v.trim()).filter(Boolean);
    const title = phase[2]?.trim() || lines.shift() || `Fase ${phase[1]}`;
    ensureSpace(doc, 90);
    const y = doc.y + 6;
    doc.circle(PAGE_LEFT + 16, y + 10, 11).fill("#C5A045");
    doc.font("Helvetica-Bold").fontSize(8).fillColor(GREEN)
      .text(phase[1], PAGE_LEFT + 7, y + 7, {
        width: 18, align: "center", lineBreak: false,
      });
    doc.font("Helvetica-Bold").fontSize(6.5).fillColor("#9A7D37")
      .text(`F A S E  ${phase[1]}`, PAGE_LEFT + 37, y, {
        width: CONTENT_WIDTH - 45, lineBreak: false,
      });
    doc.font("Helvetica-Bold").fontSize(9).fillColor(GREEN)
      .text(title, PAGE_LEFT + 37, y + 11, {
        width: CONTENT_WIDTH - 47,
      });
    doc.x = PAGE_LEFT + 37;
    doc.y = Math.max(y + 34, doc.y + 3);
    if (lines.length > 0) {
      lines.forEach((line) => {
        ensureSpace(doc, 36);
        const cleaned = line.replace(/^[-•●]\s*/, "");
        doc.font("Helvetica").fontSize(8.3).fillColor(DARK)
          .text("•  " + cleaned, PAGE_LEFT + 42, doc.y, {
            width: CONTENT_WIDTH - 53, lineGap: 2,
          });
        doc.moveDown(0.25);
      });
    }
    doc.x = PAGE_LEFT;
    doc.y += 9;
  });
  return true;
}

function drawPaymentPanel(
  doc: PDFKit.PDFDocument,
  proposal: any,
  terms: { paymentText?: string | null }
) {
  ensureSpace(doc, 135);
  const y = doc.y + 4;
  const leftWidth = 306;
  const rightX = PAGE_LEFT + leftWidth + 12;
  const rightWidth = CONTENT_WIDTH - leftWidth - 12;
  doc.roundedRect(PAGE_LEFT, y, leftWidth, 112, 7)
    .fillAndStroke("#FFFFFF", BORDER);
  doc.rect(PAGE_LEFT, y, leftWidth, 24).fill(GREEN);
  doc.rect(PAGE_LEFT, y, 5, 24).fill("#C5A045");
  doc.font("Helvetica-Bold").fontSize(7.2).fillColor("#FFFFFF")
    .text("FORMA DE PAGAMENTO", PAGE_LEFT + 13, y + 8,
      { width: leftWidth - 24, lineBreak: false });
  doc.font("Helvetica").fontSize(8.4).fillColor(DARK)
    .text(terms.paymentText || "Conforme condições comerciais acordadas.",
      PAGE_LEFT + 14, y + 35, {
        width: leftWidth - 28, lineGap: 3,
      });
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#9A7D37")
    .text(safeText(proposal.paymentMode).replace(/_/g, " "),
      PAGE_LEFT + 14, y + 92, {
        width: leftWidth - 28, lineBreak: false,
      });
  doc.roundedRect(rightX, y, rightWidth, 112, 7).fill(GREEN);
  doc.rect(rightX, y, rightWidth, 5).fill("#C5A045");
  doc.font("Helvetica-Bold").fontSize(7.3).fillColor("#DCC38C")
    .text("VALOR DA PROPOSTA", rightX + 13, y + 22,
      { width: rightWidth - 26, lineBreak: false });
  doc.font("Times-Bold").fontSize(17).fillColor("#FFFFFF")
    .text(money(proposal.totalAmount), rightX + 13, y + 43,
      { width: rightWidth - 26, lineBreak: false });
  doc.font("Helvetica").fontSize(7).fillColor("#D8E7DE")
    .text("Pagamento conforme as condições acordadas.",
      rightX + 13, y + 76, { width: rightWidth - 26 });
  doc.x = PAGE_LEFT;
  doc.y = y + 120;
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  proposal: any
) {
  const rows: Array<[string, string]> = [
    ["Subtotal", money(proposal.subtotalAmount)],
  ];
  if (proposal.discountAmount > 0)
    rows.push(["Desconto", "- " + money(proposal.discountAmount)]);
  if (proposal.additionAmount > 0)
    rows.push(["Acréscimos", money(proposal.additionAmount)]);

  const totalRowsHeight = rows.length * 22 + 35;
  ensureSpace(doc, totalRowsHeight + 12);
  const y = doc.y + 4;

  // À esquerda, condição comercial com a tarja dourada do modelo.
  doc.font("Helvetica-Bold").fontSize(6.8).fillColor("#9A7D37")
    .text("C O N D I Ç Ã O", PAGE_LEFT, y + 9, {
      width: 195, lineBreak: false,
    });
  const mode = safeText(proposal.paymentMode).replace(/_/g, " ");
  doc.roundedRect(PAGE_LEFT, y + 29, 150, 21, 10)
    .fillAndStroke("#FFF5D9", "#D8BC6B");
  doc.font("Helvetica-Bold").fontSize(7).fillColor("#9A7D37")
    .text(mode, PAGE_LEFT + 10, y + 36, {
      width: 130, lineBreak: false,
    });

  const x = 332;
  const width = PAGE_LEFT + CONTENT_WIDTH - x;
  rows.forEach(([label, value], index) => {
    const rowY = y + index * 22;
    doc.rect(x, rowY, width, 22).fill(index % 2 ? "#F8FAF9" : LIGHT);
    doc.font("Helvetica").fontSize(8).fillColor(DARK)
      .text(label, x + 12, rowY + 7, {
        width: 93, lineBreak: false,
      });
    doc.font("Helvetica-Bold").fontSize(8).fillColor(DARK)
      .text(value, x + 105, rowY + 7, {
        width: width - 116, align: "right", lineBreak: false,
      });
  });
  const totalY = y + rows.length * 22;
  doc.rect(x, totalY, width, 35).fill(GREEN);
  doc.rect(x, totalY, 5, 35).fill("#C5A045");
  doc.font("Helvetica-Bold").fontSize(8).fillColor("#FFFFFF")
    .text("VALOR TOTAL", x + 11, totalY + 13, {
      width: 98, lineBreak: false,
    });
  doc.font("Times-Bold").fontSize(13.5).fillColor("#DCC38C")
    .text(money(proposal.totalAmount), x + 100, totalY + 10, {
      width: width - 112, align: "right", lineBreak: false,
    });
  doc.x = PAGE_LEFT;
  doc.y = totalY + 44;
}

export async function generateStandaloneProposalPdf(
  prisma: PrismaClient,
  proposalId: number
) {
  const proposal =
    await prisma.standaloneProposal.findUnique({
      where: {
        id: proposalId,
      },

      include: {
        items: {
          orderBy: {
            sortOrder: "asc",
          },
        },

        attachments: {
          orderBy: {
            sortOrder: "asc",
          },
        },

        client: true,

        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

  if (!proposal) {
    throw new Error(
      "Proposta avulsa não encontrada."
    );
  }

  const paymentTerms = standaloneDocumentTerms(proposal);

  if (
    proposal.items.length === 0
  ) {
    throw new Error(
      "Adicione pelo menos um serviço antes de gerar o PDF."
    );
  }

  const company =
    await prisma.companySettings.findFirst();

  const outputDir =
    path.resolve(
      process.cwd(),
      "uploads",
      "standalone-proposals"
    );

  ensureDirectory(
    outputDir
  );

  const fileName =
    `${proposal.proposalNumber}.pdf`;

  const filePath =
    path.join(
      outputDir,
      fileName
    );

  const doc =
    new PDFDocument({
      size: "A4",
      margins: {
        top: CONTENT_TOP,
        right: PAGE_RIGHT,
        bottom: 100,
        left: PAGE_LEFT,
      },
      bufferPages: true,
      info: {
        Title:
          proposal.title,
        Author:
          company?.companyName ||
          "AMAZÔNIKA Engenharia & Meio Ambiente",
        Subject:
          proposal.proposalNumber,
      },
    });

  const stream =
    fs.createWriteStream(
      filePath
    );

  doc.pipe(stream);

  /*
   * Primeiro geramos somente o conteúdo.
   * A identidade institucional será aplicada
   * quando a paginação estiver definitivamente fechada.
   */
  doc.x = PAGE_LEFT;
  doc.y = CONTENT_TOP;

  drawHeader(
    doc,
    proposal
  );

  /*
   * Numeração dinâmica.
   * Se determinada seção opcional não existir,
   * as seções seguintes continuam numeradas
   * sequencialmente.
   */
  let sectionNumber = 1;

  const roman = (
    value: number
  ) => {
    const numbers: Record<number, string> = {
      1: "I",
      2: "II",
      3: "III",
      4: "IV",
      5: "V",
      6: "VI",
      7: "VII",
      8: "VIII",
      9: "IX",
      10: "X",
    };

    return numbers[value] || String(value);
  };

  const nextSection = (
    title: string
  ) => {
    const value =
      `${roman(sectionNumber)} – ${title}`;

    sectionNumber += 1;

    return value;
  };

  sectionTitle(
    doc,
    nextSection("Objeto da Proposta")
  );

  paragraph(
    doc,
    proposal.objectText ||
    proposal.introText ||
    `Prestação de serviços técnicos conforme composição apresentada nesta proposta comercial.`
  );

  if (
    safeText(
      proposal.scopeText
    )
  ) {
    sectionTitle(
      doc,
      nextSection("Escopo dos Serviços")
    );

    paragraph(
      doc,
      proposal.scopeText!
    );
  }

  sectionTitle(
    doc,
    nextSection("Composição dos Serviços")
  );

  drawItemsTable(
    doc,
    proposal.items
  );

  drawTotals(
    doc,
    proposal
  );

  doc.x =
    doc.page.margins.left;

  /*
   * =====================================================
   * CONTEÚDO DESCRITIVO DOS SERVIÇOS
   * =====================================================
   *
   * A tabela anterior apresenta somente informações
   * comerciais essenciais. Os textos extensos passam
   * a integrar o corpo da proposta.
   */

  if (
    hasNarrativeContent(
      proposal.items,
      "commercialDescription"
    )
  ) {
    sectionTitle(
      doc,
      nextSection(
        "Descrição Comercial dos Serviços"
      )
    );

    drawServiceNarratives(
      doc,
      proposal.items,
      "commercialDescription"
    );
  }

  if (
    hasNarrativeContent(
      proposal.items,
      "technicalDescription"
    )
  ) {
    sectionTitle(
      doc,
      nextSection(
        "Descrição Técnica dos Serviços"
      )
    );

    drawServiceNarratives(
      doc,
      proposal.items,
      "technicalDescription"
    );
  }

  if (
    hasNarrativeContent(
      proposal.items,
      "legalText"
    )
  ) {
    sectionTitle(
      doc,
      nextSection(
        "Fundamentação Legal e Normativa"
      )
    );

    drawServiceNarratives(
      doc,
      proposal.items,
      "legalText"
    );
  }

  if (
    proposal.executionText ||
    proposal.executionDays
  ) {
    sectionTitle(
      doc,
      nextSection("Prazo de Execução")
    );

    paragraph(
      doc,
      proposal.executionText ||
      `Prazo estimado de ${proposal.executionDays} dia(s), contado a partir da autorização para início dos serviços, disponibilização dos documentos necessários e demais condições aplicáveis.`
    );
  }

  sectionTitle(
    doc,
    nextSection("Condições de Pagamento")
  );

  drawPaymentPanel(doc, proposal, paymentTerms);

  sectionTitle(
    doc,
    nextSection("Observações")
  );

  if (proposal.validUntil) {
    paragraph(
      doc,
      `Validade da proposta: até ${formatDate(
        proposal.validUntil
      )}. Após esse período, valores, prazos e condições poderão ser reavaliados.`
    );
  }

  if (
    safeText(
      proposal.notes
    )
  ) {
    paragraph(
      doc,
      proposal.notes!
    );
  }

  if (
    proposal.attachments.length > 0
  ) {
    sectionTitle(
      doc,
      nextSection("Anexos")
    );

    paragraph(
      doc,
      "Integram ou acompanham esta proposta os seguintes documentos:"
    );

    proposal.attachments.forEach(
      (attachment, index) => {
        ensureSpace(
          doc,
          30
        );

        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(DARK)
          .text(
            `${String(
              index + 1
            ).padStart(
              2,
              "0"
            )}. ${attachment.title}`,
            {
              indent: 8,
            }
          );

        if (
          attachment.description
        ) {
          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(MUTED)
            .text(
              attachment.description,
              {
                indent: 22,
                lineGap: 2,
              }
            );
        }

        doc.moveDown(0.35);
      }
    );
  }

  ensureSpace(
    doc,
    125
  );

  doc.moveDown(0.8);

  doc
    .font("Helvetica")
    .fontSize(9)
    .fillColor(DARK)
    .text(
      "Atenciosamente,"
    );

  doc.moveDown(1);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(GREEN)
    .text(
      company?.companyName ||
      "AMAZÔNIKA Engenharia & Meio Ambiente"
    );


  /*
   * Toda a paginação do conteúdo já terminou.
   * Agora aplicamos identidade institucional
   * e numeração sem interferir no fluxo.
   */
  drawInstitutionalPages(
    doc,
    proposal,
    company
  );

  drawPageNumbers(
    doc
  );

  doc.end();

  await new Promise<void>(
    (resolve, reject) => {
      stream.on(
        "finish",
        resolve
      );

      stream.on(
        "error",
        reject
      );
    }
  );

  const hash =
    fileSha256(
      filePath
    );

  const snapshot =
    JSON.stringify({
      proposalNumber:
        proposal.proposalNumber,
      clientName:
        proposal.clientName,
      title:
        proposal.title,
      objectText:
        proposal.objectText,
      items:
        proposal.items,
      attachments:
        proposal.attachments,
      subtotalAmount:
        proposal.subtotalAmount,
      discountAmount:
        proposal.discountAmount,
      additionAmount:
        proposal.additionAmount,
      totalAmount:
        proposal.totalAmount,
      paymentTerms,
      generatedAt:
        new Date().toISOString(),
      hash,
    });

  const updated =
    await prisma.standaloneProposal.update({
      where: {
        id:
          proposal.id,
      },

      data: {
        status:
          "GERADA",

        generatedAt:
          new Date(),

        generatedPdfPath:
          filePath,

        generatedPdfName:
          fileName,

        generatedPdfHash:
          hash,

        rawSnapshot:
          snapshot,
      },
    });

  return {
    proposal:
      updated,

    filePath,
    fileName,
    hash,
  };
}
