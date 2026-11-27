import fs from "fs";
import path from "path";
import { Resvg } from "@resvg/resvg-js";
import { POPPINS_WIDTHS } from "./whatsappCardMetrics";

/*
 * ======================================================
 * CARD DE WHATSAPP (imagem gerada no servidor)
 * ======================================================
 *
 * Monta um SVG com o visual da Amazonika (fundo escuro, brilho verde,
 * logo) e converte em PNG com a fonte Poppins embutida. O texto é
 * dinâmico: cada alerta preenche título, caixa da tarefa e linhas.
 */

export type CardTone = "green" | "amber" | "red" | "blue" | "violet";

export type CardIcon =
  | "calendar"
  | "flag"
  | "user"
  | "clipboard"
  | "clock"
  | "alert"
  | "check"
  | "link"
  | "money"
  | "bell"
  | "pin";

export type CardRow = {
  label: string;
  value: string;
  icon?: CardIcon;
  /** Mostra o valor como selo colorido (ex.: URGENTE). */
  badge?: CardTone;
  tone?: CardTone;
};

export type CardListItem = {
  text: string;
  meta?: string;
  tone?: CardTone;
};

export type CardSpec = {
  pill: string;
  pillIcon?: CardIcon;
  tone?: CardTone;
  titleLead: string;
  titleAccent?: string;
  boxTitle?: string;
  boxSubtitle?: string;
  boxIcon?: CardIcon;
  rows?: CardRow[];
  listTitle?: string;
  list?: CardListItem[];
  listMax?: number;
  /** QR Code (data URI PNG) exibido num quadro branco. */
  qr?: { dataUri: string; label?: string };
  link?: string;
  footnote?: string;
};

const W = 1080;
const PAD = 72;
const INNER = W - PAD * 2;

const TONES: Record<CardTone, { main: string; soft: string; text: string }> = {
  green: { main: "#2fd27f", soft: "rgba(47,210,127,0.14)", text: "#7cf0b3" },
  amber: { main: "#f2b13c", soft: "rgba(242,177,60,0.16)", text: "#ffd58a" },
  red: { main: "#ef5a4c", soft: "rgba(239,90,76,0.18)", text: "#ff9d93" },
  blue: { main: "#4fa3f7", soft: "rgba(79,163,247,0.16)", text: "#a6d0ff" },
  violet: { main: "#a27cf2", soft: "rgba(162,124,242,0.16)", text: "#cdb8ff" },
};

const ICONS: Record<CardIcon, string> = {
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  flag: '<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>',
  user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  clipboard:
    '<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M12 11h4M12 16h4M8 11h.01M8 16h.01"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  alert:
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4M12 17h.01"/>',
  check: '<circle cx="12" cy="12" r="10"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  link:
    '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
  money: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  bell: '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};

const ASSETS =
  [path.resolve(__dirname, "../../assets"), path.join(process.cwd(), "assets"), path.join(process.cwd(), "backend", "assets")].find(
    (dir) => fs.existsSync(path.join(dir, "fonts"))
  ) || path.resolve(__dirname, "../../assets");
const FONT_FILES = ["Regular", "SemiBold", "Bold", "ExtraBold"].map((name) =>
  path.join(ASSETS, "fonts", `Poppins-${name}.ttf`)
);

let logoDataUri: string | null | undefined;

function logo() {
  if (logoDataUri === undefined) {
    try {
      const buffer = fs.readFileSync(path.join(ASSETS, "logo_card.png"));
      logoDataUri = `data:image/png;base64,${buffer.toString("base64")}`;
    } catch {
      logoDataUri = null;
    }
  }
  return logoDataUri;
}

function esc(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Tira emojis e caracteres de controle que a Poppins não tem. */
function clean(value?: string | null) {
  return String(value || "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/[\u{1F000}-\u{1FFFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

function textWidth(text: string, size: number, weight: number) {
  const table = POPPINS_WIDTHS[weight] || POPPINS_WIDTHS[400];
  let total = 0;
  for (const ch of text) total += table[ch] ?? 620;
  return (total / 1000) * size;
}

function truncate(text: string, size: number, weight: number, max: number) {
  if (textWidth(text, size, weight) <= max) return text;
  let out = text;
  while (out.length > 1 && textWidth(`${out}…`, size, weight) > max) out = out.slice(0, -1);
  return `${out.trimEnd()}…`;
}

function wrap(text: string, size: number, weight: number, max: number, maxLines: number) {
  const words = clean(text).split(" ").filter(Boolean);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (textWidth(candidate, size, weight) <= max) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    current = textWidth(word, size, weight) > max ? truncate(word, size, weight, max) : word;
  }
  if (current) lines.push(current);

  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = truncate(`${kept[maxLines - 1]} …`, size, weight, max);
    if (!kept[maxLines - 1].endsWith("…")) kept[maxLines - 1] += "…";
    return kept;
  }

  return lines;
}

function icon(name: CardIcon, x: number, y: number, size: number, color: string, stroke = 2) {
  const scale = size / 24;
  return `<g transform="translate(${x} ${y}) scale(${scale})" fill="none" stroke="${color}" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round">${ICONS[name]}</g>`;
}

function text(
  value: string,
  x: number,
  y: number,
  size: number,
  weight: number,
  fill: string,
  extra = ""
) {
  return `<text x="${x}" y="${y}" font-family="Poppins" font-size="${size}" font-weight="${weight}" fill="${fill}" ${extra}>${esc(value)}</text>`;
}

export function buildCardSvg(spec: CardSpec) {
  const tone = TONES[spec.tone || "green"];
  const parts: string[] = [];
  let y = 0;

  /* Cabeçalho: logo + marca à esquerda, selo à direita. */
  const logoUri = logo();
  if (logoUri) {
    parts.push(`<image href="${logoUri}" x="${PAD}" y="64" width="84" height="85"/>`);
  }
  const brandX = PAD + (logoUri ? 104 : 0);
  parts.push(text("AMAZONIKA", brandX, 106, 36, 800, "#ffffff", 'letter-spacing="1"'));
  parts.push(text("ENGENHARIA", brandX + 2, 138, 19, 600, "#8fb3a2", 'letter-spacing="7"'));

  const pillLabel = clean(spec.pill).toUpperCase();
  const pillTextW = textWidth(pillLabel, 22, 700) + pillLabel.length * 1.5;
  const pillW = pillTextW + (spec.pillIcon ? 84 : 52);
  const pillX = W - PAD - pillW;
  parts.push(
    `<rect x="${pillX}" y="76" width="${pillW}" height="60" rx="30" fill="${tone.soft}" stroke="${tone.main}" stroke-opacity="0.55" stroke-width="2"/>`
  );
  let pillTextX = pillX + 26;
  if (spec.pillIcon) {
    parts.push(icon(spec.pillIcon, pillX + 22, 92, 28, tone.text));
    pillTextX = pillX + 60;
  }
  parts.push(text(pillLabel, pillTextX, 114, 22, 700, tone.text, 'letter-spacing="1.5"'));

  /* Título: parte branca + parte destacada na cor do tom. */
  y = 262;
  const lead = clean(spec.titleLead);
  const accent = clean(spec.titleAccent);
  const titleSize = 70;
  const sameLine = accent && textWidth(`${lead} ${accent}`, titleSize, 800) <= INNER;
  if (!accent || sameLine) {
    parts.push(
      `<text x="${PAD}" y="${y}" font-family="Poppins" font-size="${titleSize}" font-weight="800" fill="#ffffff" letter-spacing="-1.5">${esc(lead)}${
        accent ? ` <tspan fill="${tone.main}">${esc(accent)}</tspan>` : ""
      }</text>`
    );
  } else {
    parts.push(text(truncate(lead, titleSize, 800, INNER), PAD, y, titleSize, 800, "#ffffff", 'letter-spacing="-1.5"'));
    y += 84;
    parts.push(text(truncate(accent, titleSize, 800, INNER), PAD, y, titleSize, 800, tone.main, 'letter-spacing="-1.5"'));
  }
  y += 56;

  /* Caixa da tarefa. */
  if (spec.boxTitle) {
    const iconBox = 92;
    const textX = PAD + 40 + iconBox + 32;
    const textMax = W - PAD - 40 - textX;
    const titleLines = wrap(spec.boxTitle, 40, 700, textMax, 3);
    const subLines = spec.boxSubtitle ? wrap(spec.boxSubtitle, 28, 400, textMax, 3) : [];
    const textH = titleLines.length * 54 + (subLines.length ? 12 + subLines.length * 40 : 0);
    const boxH = Math.max(iconBox, textH) + 80;

    parts.push(
      `<rect x="${PAD}" y="${y}" width="${INNER}" height="${boxH}" rx="32" fill="#ffffff" fill-opacity="0.045" stroke="#ffffff" stroke-opacity="0.10" stroke-width="2"/>`
    );
    const iconY = y + (boxH - iconBox) / 2;
    parts.push(
      `<rect x="${PAD + 40}" y="${iconY}" width="${iconBox}" height="${iconBox}" rx="26" fill="${tone.soft}" stroke="${tone.main}" stroke-opacity="0.35" stroke-width="2"/>`
    );
    parts.push(icon(spec.boxIcon || "clipboard", PAD + 40 + 24, iconY + 24, 44, tone.main));

    let ty = y + (boxH - textH) / 2 + 40;
    for (const line of titleLines) {
      parts.push(text(line, textX, ty, 40, 700, "#ffffff"));
      ty += 54;
    }
    if (subLines.length) {
      ty += 4;
      for (const line of subLines) {
        parts.push(text(line, textX, ty, 28, 400, "#a9bdb4"));
        ty += 40;
      }
    }
    y += boxH + 26;
  }

  /* Linhas de detalhe. */
  const rows = spec.rows || [];
  rows.forEach((row, index) => {
    const rowH = 100;
    const mid = y + rowH / 2;
    const rowTone = TONES[row.tone || row.badge || spec.tone || "green"];
    parts.push(
      `<rect x="${PAD}" y="${mid - 30}" width="60" height="60" rx="18" fill="#ffffff" fill-opacity="0.06"/>`
    );
    parts.push(icon(row.icon || "clipboard", PAD + 15, mid - 15, 30, "#9fc2b2"));
    parts.push(text(clean(row.label), PAD + 88, mid + 11, 30, 400, "#a9bdb4"));

    const labelW = textWidth(clean(row.label), 30, 400);
    const valueMax = INNER - 88 - labelW - 40;
    const value = clean(row.value);

    if (row.badge) {
      const badgeText = truncate(value.toUpperCase(), 24, 800, valueMax - 48);
      const bw = textWidth(badgeText, 24, 800) + badgeText.length * 1.5 + 48;
      const bx = W - PAD - bw;
      parts.push(
        `<rect x="${bx}" y="${mid - 25}" width="${bw}" height="50" rx="25" fill="${rowTone.soft}" stroke="${rowTone.main}" stroke-opacity="0.6" stroke-width="2"/>`
      );
      parts.push(text(badgeText, bx + 24, mid + 9, 24, 800, rowTone.text, 'letter-spacing="1.5"'));
    } else {
      parts.push(
        text(
          truncate(value, 32, 600, valueMax),
          W - PAD,
          mid + 11,
          32,
          600,
          row.tone ? rowTone.text : "#ffffff",
          'text-anchor="end"'
        )
      );
    }

    if (index < rows.length - 1) {
      parts.push(
        `<line x1="${PAD}" y1="${y + rowH}" x2="${W - PAD}" y2="${y + rowH}" stroke="#ffffff" stroke-opacity="0.08" stroke-width="2"/>`
      );
    }
    y += rowH;
  });
  if (rows.length) y += 20;

  /* QR Code (Pix). */
  if (spec.qr) {
    const size = 340;
    const frame = size + 48;
    const fx = (W - frame) / 2;
    y += 10;
    parts.push(`<rect x="${fx}" y="${y}" width="${frame}" height="${frame}" rx="32" fill="#ffffff"/>`);
    parts.push(`<image href="${spec.qr.dataUri}" x="${fx + 24}" y="${y + 24}" width="${size}" height="${size}"/>`);
    y += frame;
    if (spec.qr.label) {
      parts.push(text(clean(spec.qr.label), W / 2, y + 46, 24, 400, "#a9bdb4", 'text-anchor="middle"'));
      y += 62;
    }
    y += 20;
  }

  /* Lista (agenda do dia). */
  const list = spec.list || [];
  if (spec.listTitle || list.length) {
    if (spec.listTitle) {
      parts.push(text(clean(spec.listTitle).toUpperCase(), PAD, y + 34, 22, 700, "#8fb3a2", 'letter-spacing="3"'));
      y += 60;
    }
    const max = spec.listMax ?? 8;
    const shown = list.slice(0, max);
    for (const item of shown) {
      const itemTone = TONES[item.tone || spec.tone || "green"];
      const lines = wrap(item.text, 30, 600, INNER - 48, 2);
      const metaLine = item.meta ? truncate(clean(item.meta), 24, 400, INNER - 48) : "";
      const itemH = lines.length * 42 + (metaLine ? 36 : 0) + 30;
      parts.push(`<circle cx="${PAD + 10}" cy="${y + 32}" r="8" fill="${itemTone.main}"/>`);
      let ly = y + 42;
      for (const line of lines) {
        parts.push(text(line, PAD + 40, ly, 30, 600, "#ffffff"));
        ly += 42;
      }
      if (metaLine) parts.push(text(metaLine, PAD + 40, ly - 6, 24, 400, itemTone.text));
      y += itemH;
    }
    if (!list.length) {
      parts.push(text("Nada pendente por aqui.", PAD + 40, y + 42, 30, 400, "#a9bdb4"));
      y += 72;
    }
    if (list.length > max) {
      parts.push(text(`+ ${list.length - max} na agenda do SIS`, PAD + 40, y + 34, 26, 600, tone.text));
      y += 56;
    }
    y += 16;
  }

  /* Link. */
  if (spec.link) {
    const linkText = truncate(clean(spec.link).replace(/^https?:\/\//, ""), 28, 600, INNER - 130);
    y += 10;
    parts.push(
      `<rect x="${PAD}" y="${y}" width="${INNER}" height="84" rx="42" fill="${tone.soft}" stroke="${tone.main}" stroke-opacity="0.45" stroke-width="2"/>`
    );
    parts.push(icon("link", PAD + 34, y + 26, 32, tone.text));
    parts.push(text(linkText, PAD + 86, y + 52, 28, 600, tone.text));
    y += 84;
  }

  if (spec.footnote) {
    y += 20;
    for (const line of wrap(spec.footnote, 22, 400, INNER, 2)) {
      y += 32;
      parts.push(text(line, PAD, y, 22, 400, "#7f978c"));
    }
  }

  const H = Math.round(y + 76);

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d1f18"/>
      <stop offset="0.55" stop-color="#08130f"/>
      <stop offset="1" stop-color="#050b09"/>
    </linearGradient>
    <radialGradient id="glow" cx="0.92" cy="0.02" r="0.7">
      <stop offset="0" stop-color="${tone.main}" stop-opacity="0.30"/>
      <stop offset="1" stop-color="${tone.main}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="glow2" cx="0.02" cy="1" r="0.6">
      <stop offset="0" stop-color="#2fd27f" stop-opacity="0.12"/>
      <stop offset="1" stop-color="#2fd27f" stop-opacity="0"/>
    </radialGradient>
    <filter id="blur" x="-10%" y="-10%" width="120%" height="120%">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>
  <rect width="${W}" height="${H}" fill="#030806"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="52" fill="none" stroke="${tone.main}" stroke-opacity="0.55" stroke-width="10" filter="url(#blur)"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="52" fill="url(#bg)"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="52" fill="url(#glow)"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="52" fill="url(#glow2)"/>
  <rect x="18" y="18" width="${W - 36}" height="${H - 36}" rx="52" fill="none" stroke="${tone.main}" stroke-opacity="0.65" stroke-width="2.5"/>
  ${parts.join("\n  ")}
</svg>`;
}

export function renderCardPng(spec: CardSpec): Buffer {
  const svg = buildCardSvg(spec);
  const resvg = new Resvg(svg, {
    font: {
      fontFiles: FONT_FILES,
      loadSystemFonts: false,
      defaultFontFamily: "Poppins",
    },
    fitTo: { mode: "width", value: W },
  });
  return resvg.render().asPng();
}

/** Igual a renderCardPng, mas nunca lança: devolve null se falhar. */
export function tryRenderCardPng(spec: CardSpec): Buffer | null {
  try {
    return renderCardPng(spec);
  } catch (error) {
    console.error("Card WhatsApp: falha ao gerar imagem", error);
    return null;
  }
}
