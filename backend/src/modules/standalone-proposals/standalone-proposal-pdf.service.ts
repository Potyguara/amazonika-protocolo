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

const CONTENT_TOP = 118;
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
  company: any
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

  if (logo) {
    try {
      doc.image(
        logo,
        PAGE_LEFT,
        27,
        {
          fit: [58, 58],
        }
      );
    } catch {
      // segue sem logo
    }
  }

  doc
    .font("Helvetica-Bold")
    .fontSize(6.3)
    .fillColor(MUTED)
    .text(
      "PROPOSTA DE PRESTAÇÃO DE SERVIÇOS TÉCNICOS",
      340,
      34,
      {
        width: 203,
        align: "right",
        lineBreak: false,
      }
    );

  doc
    .font("Helvetica-Bold")
    .fontSize(10.5)
    .fillColor(GREEN)
    .text(
      proposal.proposalNumber,
      340,
      49,
      {
        width: 203,
        align: "right",
        lineBreak: false,
      }
    );

  doc
    .font("Helvetica")
    .fontSize(6.4)
    .fillColor(MUTED)
    .text(
      `Emissão: ${formatDate(
        proposal.generatedAt ||
        new Date()
      )}`,
      340,
      65,
      {
        width: 203,
        align: "right",
        lineBreak: false,
      }
    );

  doc
    .moveTo(
      PAGE_LEFT,
      98
    )
    .lineTo(
      doc.page.width - PAGE_RIGHT,
      98
    )
    .strokeColor(BORDER)
    .lineWidth(0.5)
    .stroke();

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
      company
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
  ensureSpace(doc, 45);

  doc.moveDown(0.55);

  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(GREEN)
    .text(title.toUpperCase(), {
      continued: false,
    });

  doc.moveDown(0.25);
  line(doc);
  doc.moveDown(0.55);
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
  doc.y = CONTENT_TOP;

  doc
    .font("Helvetica-Bold")
    .fontSize(6.8)
    .fillColor(MUTED)
    .text(
      "DESTINATÁRIO",
      PAGE_LEFT,
      doc.y,
      {
        width: CONTENT_WIDTH,
      }
    );

  doc.moveDown(0.3);

  doc
    .font("Helvetica-Bold")
    .fontSize(12)
    .fillColor(DARK)
    .text(
      proposal.clientName,
      PAGE_LEFT,
      doc.y,
      {
        width: CONTENT_WIDTH,
      }
    );

  const clientDetails = [
    proposal.clientCpfCnpj,
    proposal.clientCity &&
    proposal.clientState
      ? `${proposal.clientCity}/${proposal.clientState}`
      : proposal.clientCity ||
        proposal.clientState,
  ]
    .filter(Boolean)
    .join(" • ");

  if (clientDetails) {
    doc
      .font("Helvetica")
      .fontSize(8)
      .fillColor(MUTED)
      .text(
        clientDetails,
        PAGE_LEFT,
        doc.y,
        {
          width: CONTENT_WIDTH,
        }
      );
  }

  doc.moveDown(0.65);
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

      paragraph(
        doc,
        content
      );

      if (
        index <
        availableItems.length - 1
      ) {
        doc.moveDown(0.15);
      }
    }
  );
}

function drawTotals(
  doc: PDFKit.PDFDocument,
  proposal: any
) {
  const x = 325;
  const width = 225;

  const rows: Array<
    [string, string, boolean]
  > = [
    [
      "Subtotal",
      money(
        proposal.subtotalAmount
      ),
      false,
    ],
  ];

  if (
    proposal.discountAmount > 0
  ) {
    rows.push([
      "Desconto",
      `- ${money(
        proposal.discountAmount
      )}`,
      false,
    ]);
  }

  if (
    proposal.additionAmount > 0
  ) {
    rows.push([
      "Acréscimos",
      money(
        proposal.additionAmount
      ),
      false,
    ]);
  }

  rows.push([
    "VALOR TOTAL",
    money(
      proposal.totalAmount
    ),
    true,
  ]);

  /*
   * Altura real do quadro financeiro.
   *
   * Linha comum:
   *   22 pt + 3 pt de intervalo = 25
   *
   * Total:
   *   28 pt + 3 pt de intervalo = 31
   *
   * Só o quadro de totais muda de página,
   * nunca as linhas anteriores da tabela.
   */
  const totalsHeight =
    rows.reduce(
      (
        height,
        [, , total]
      ) =>
        height +
        (
          total
            ? 31
            : 25
        ),
      0
    ) + 8;

  if (
    doc.y + totalsHeight >
    CONTENT_BOTTOM
  ) {
    doc.addPage();

    doc.x = PAGE_LEFT;
    doc.y = CONTENT_TOP;
  }

  for (
    const [label, value, total]
    of rows
  ) {
    const y = doc.y;

    doc
      .rect(
        x,
        y,
        width,
        total ? 28 : 22
      )
      .fill(
        total
          ? GREEN
          : LIGHT
      );

    doc
      .font(
        total
          ? "Helvetica-Bold"
          : "Helvetica"
      )
      .fontSize(
        total ? 9 : 8
      )
      .fillColor(
        total
          ? "#FFFFFF"
          : DARK
      )
      .text(
        label,
        x + 8,
        y + (total ? 9 : 7),
        {
          width: 95,
        }
      );

    doc
      .font("Helvetica-Bold")
      .text(
        value,
        x + 105,
        y + (total ? 9 : 7),
        {
          width: 110,
          align: "right",
        }
      );

    doc.y =
      y +
      (total ? 31 : 25);
  }

  doc.moveDown(0.5);
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

  paragraph(
    doc,
    paymentTerms.paymentText || "Pagamento conforme condições comerciais acordadas entre as partes."
  );

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
