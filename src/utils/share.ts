export function absolutePublicUrl(pathOrUrl: string) {
  if (!pathOrUrl) return "";

  if (
    pathOrUrl.startsWith("http://") ||
    pathOrUrl.startsWith("https://")
  ) {
    return pathOrUrl;
  }

  const path = pathOrUrl.startsWith("/")
    ? pathOrUrl
    : `/${pathOrUrl}`;

  return `${window.location.origin}${path}`;
}

export function normalizeWhatsappNumber(
  value?: string | null
) {
  let digits = String(value || "").replace(/\D/g, "");

  if (!digits) return "";

  // Se vier apenas DDD + número brasileiro,
  // acrescenta código do Brasil.
  if (
    (digits.length === 10 || digits.length === 11) &&
    !digits.startsWith("55")
  ) {
    digits = `55${digits}`;
  }

  return digits;
}

export async function copyPublicLink(
  pathOrUrl: string
) {
  const url = absolutePublicUrl(pathOrUrl);

  if (!url) {
    throw new Error("Link público não disponível.");
  }

  await navigator.clipboard.writeText(url);

  return url;
}

export function openWhatsappShare(params: {
  phone?: string | null;
  message: string;
  pathOrUrl: string;
}) {
  const url = absolutePublicUrl(params.pathOrUrl);

  if (!url) {
    throw new Error("Link público não disponível.");
  }

  const phone = normalizeWhatsappNumber(
    params.phone
  );

  const text = encodeURIComponent(
    `${params.message}\n\n${url}`
  );

  /*
   * Com telefone cadastrado, abre diretamente
   * a conversa. Sem telefone, abre o seletor
   * do WhatsApp para o usuário escolher.
   */
  const whatsappUrl = phone
    ? `https://wa.me/${phone}?text=${text}`
    : `https://wa.me/?text=${text}`;

  window.open(
    whatsappUrl,
    "_blank",
    "noopener,noreferrer"
  );
}
