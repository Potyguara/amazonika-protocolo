import fs from "fs";
import forge from "node-forge";
import signpdf from "@signpdf/signpdf";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { P12Signer } from "@signpdf/signer-p12";

/*
 * ======================================================
 * ASSINATURA DIGITAL DE PDF (ICP-Brasil, e-CNPJ)
 * ======================================================
 *
 * Usa o certificado A1 da empresa já instalado no servidor.
 * Configuração no backend/.env (todas opcionais):
 *   RECEIPT_SIGN_CERT_PATH  cadeia em PEM (empresa + ACs)
 *                           padrão: /root/bb-certs/cadeia-completa.pem,
 *                           senão BB_CERT_PATH
 *   RECEIPT_SIGN_KEY_PATH   chave privada PEM; padrão: BB_CERT_KEY_PATH
 *   RECEIPT_SIGN_KEY_PASSPHRASE  se a chave tiver senha
 *   RECEIPT_SIGN_ENABLED=false   desliga a assinatura
 *
 * Sem certificado configurado, o PDF segue sem assinatura.
 */

type SignerMaterial = {
  p12: Buffer;
  passphrase: string;
  subjectName: string;
  validUntil: Date;
};

let cachedMaterial: SignerMaterial | null | undefined;

function env(name: string) {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : null;
}

function firstExisting(...paths: (string | null)[]) {
  for (const p of paths) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function loadSignerMaterial(): SignerMaterial | null {
  if (cachedMaterial !== undefined) return cachedMaterial;

  cachedMaterial = null;

  if (String(env("RECEIPT_SIGN_ENABLED") || "true").toLowerCase() === "false") {
    return cachedMaterial;
  }

  const certPath = firstExisting(
    env("RECEIPT_SIGN_CERT_PATH"),
    "/root/bb-certs/cadeia-completa.pem",
    env("BB_CERT_PATH")
  );
  const keyPath = firstExisting(env("RECEIPT_SIGN_KEY_PATH"), env("BB_CERT_KEY_PATH"));

  if (!certPath || !keyPath) return cachedMaterial;

  const certPem = fs.readFileSync(certPath, "utf8");
  const keyPem = fs.readFileSync(keyPath, "utf8");

  const keyPassphrase = env("RECEIPT_SIGN_KEY_PASSPHRASE");
  const privateKey = keyPassphrase
    ? forge.pki.decryptRsaPrivateKey(keyPem, keyPassphrase)
    : forge.pki.privateKeyFromPem(keyPem);

  if (!privateKey) {
    throw new Error("Não foi possível ler a chave privada para assinatura do PDF.");
  }

  const blocks =
    certPem.match(/-----BEGIN CERTIFICATE-----[\s\S]+?-----END CERTIFICATE-----/g) || [];
  const certs = blocks.map((block) => forge.pki.certificateFromPem(block));

  if (!certs.length) {
    throw new Error("Nenhum certificado encontrado para assinatura do PDF.");
  }

  // O certificado da empresa é o que corresponde à chave privada.
  const publicKeyPem = forge.pki.publicKeyToPem(
    forge.pki.setRsaPublicKey((privateKey as any).n, (privateKey as any).e)
  );
  const leafIndex = certs.findIndex(
    (cert) => forge.pki.publicKeyToPem(cert.publicKey) === publicKeyPem
  );

  if (leafIndex < 0) {
    throw new Error("O certificado configurado não corresponde à chave privada.");
  }

  const leaf = certs[leafIndex];
  const chain = [leaf, ...certs.filter((_, index) => index !== leafIndex)];

  const passphrase = forge.util.encode64(forge.random.getBytesSync(18));
  const asn1 = forge.pkcs12.toPkcs12Asn1(privateKey, chain, passphrase, {
    algorithm: "3des",
  });
  const p12 = Buffer.from(forge.asn1.toDer(asn1).getBytes(), "binary");

  const cn = leaf.subject.getField("CN");

  cachedMaterial = {
    p12,
    passphrase,
    subjectName: String(cn?.value || "Certificado ICP-Brasil"),
    validUntil: leaf.validity.notAfter,
  };

  return cachedMaterial;
}

/** Nome do titular do certificado, para exibir no documento (ou null). */
export function pdfSignerInfo(): { subjectName: string; validUntil: Date } | null {
  try {
    const material = loadSignerMaterial();
    if (!material || material.validUntil.getTime() < Date.now()) return null;
    return { subjectName: material.subjectName, validUntil: material.validUntil };
  } catch (error: any) {
    console.error("Assinatura de PDF indisponível:", error?.message || error);
    return null;
  }
}

/**
 * Assina o PDF com o e-CNPJ. Devolve o PDF original quando não há
 * certificado configurado ou se a assinatura falhar (nunca bloqueia o envio).
 */
export async function signPdfBuffer(
  pdfBuffer: Buffer,
  info: { reason: string; location: string; contactInfo?: string }
): Promise<{ buffer: Buffer; signed: boolean; error?: string }> {
  try {
    const material = loadSignerMaterial();

    if (!material) return { buffer: pdfBuffer, signed: false };

    if (material.validUntil.getTime() < Date.now()) {
      return { buffer: pdfBuffer, signed: false, error: "Certificado vencido." };
    }

    const withPlaceholder = plainAddPlaceholder({
      pdfBuffer,
      reason: info.reason,
      location: info.location,
      contactInfo: info.contactInfo || "",
      name: material.subjectName,
      signatureLength: 16384,
    });

    const signer = new P12Signer(material.p12, { passphrase: material.passphrase });
    const signed = await signpdf.sign(withPlaceholder, signer);

    return { buffer: Buffer.from(signed), signed: true };
  } catch (error: any) {
    console.error("Falha ao assinar PDF:", error?.message || error);
    return { buffer: pdfBuffer, signed: false, error: error?.message || String(error) };
  }
}
