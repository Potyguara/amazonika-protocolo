import crypto from "crypto";
import fs from "fs";
import forge from "node-forge";
import signpdf from "@signpdf/signpdf";
import { plainAddPlaceholder } from "@signpdf/placeholder-plain";
import { Signer, SUBFILTER_ETSI_CADES_DETACHED } from "@signpdf/utils";

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
  privateKeyPem: string;
  leaf: forge.pki.Certificate;
  chain: forge.pki.Certificate[];
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

  const cn = leaf.subject.getField("CN");

  cachedMaterial = {
    privateKeyPem: forge.pki.privateKeyToPem(privateKey),
    leaf,
    chain,
    subjectName: String(cn?.value || "Certificado ICP-Brasil"),
    validUntil: leaf.validity.notAfter,
  };

  return cachedMaterial;
}

const asn1 = forge.asn1;
const OID = {
  data: "1.2.840.113549.1.7.1",
  signedData: "1.2.840.113549.1.7.2",
  contentType: "1.2.840.113549.1.9.3",
  messageDigest: "1.2.840.113549.1.9.4",
  signingCertificateV2: "1.2.840.113549.1.9.16.2.47",
  sha256: "2.16.840.1.101.3.4.2.1",
  sha256WithRSA: "1.2.840.113549.1.1.11",
};

function oid(value: string) {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OID, false, asn1.oidToDer(value).getBytes());
}

function seq(items: forge.asn1.Asn1[]) {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, items);
}

function set(items: forge.asn1.Asn1[]) {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SET, true, items);
}

function octets(bytes: Buffer) {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.OCTETSTRING, false, bytes.toString("binary"));
}

function int(value: number) {
  return asn1.create(asn1.Class.UNIVERSAL, asn1.Type.INTEGER, false, asn1.integerToDer(value).getBytes());
}

function der(node: forge.asn1.Asn1) {
  return Buffer.from(asn1.toDer(node).getBytes(), "binary");
}

function algorithm(value: string) {
  return seq([oid(value), asn1.create(asn1.Class.UNIVERSAL, asn1.Type.NULL, false, "")]);
}

function attribute(type: string, value: forge.asn1.Asn1) {
  return seq([oid(type), set([value])]);
}

/** Elementos de um SET OF em DER precisam estar ordenados pela codificação. */
function derSet(items: forge.asn1.Asn1[]) {
  return items
    .map((item) => ({ item, bytes: der(item) }))
    .sort((a, b) => Buffer.compare(a.bytes, b.bytes))
    .map((entry) => entry.item);
}

/**
 * Assinatura CAdES-BES (PAdES básico), exigida pelo validador do ITI:
 * atributos content-type, message-digest e signing-certificate-v2,
 * sem signing-time (o horário fica no campo /M do PDF).
 */
class CadesSigner extends Signer {
  constructor(private material: SignerMaterial) {
    super();
  }

  async sign(pdfBuffer: Buffer): Promise<Buffer> {
    const { leaf, chain, privateKeyPem } = this.material;
    const leafDer = der(forge.pki.certificateToAsn1(leaf));
    const leafAsn1 = forge.pki.certificateToAsn1(leaf);
    // TBSCertificate: [0] version, serialNumber, signature, issuer, ...
    const tbs = (leafAsn1.value as forge.asn1.Asn1[])[0];
    const tbsFields = tbs.value as forge.asn1.Asn1[];
    const serialNumber = tbsFields[1];
    const issuerName = tbsFields[3];

    const essCertIdV2 = seq([
      octets(crypto.createHash("sha256").update(leafDer).digest()),
      seq([
        seq([asn1.create(asn1.Class.CONTEXT_SPECIFIC, 4, true, [issuerName])]),
        serialNumber,
      ]),
    ]);

    const signedAttrs = derSet([
      attribute(OID.contentType, oid(OID.data)),
      attribute(OID.messageDigest, octets(crypto.createHash("sha256").update(pdfBuffer).digest())),
      attribute(OID.signingCertificateV2, seq([seq([essCertIdV2])])),
    ]);

    // A assinatura cobre os atributos codificados como SET (tag 0x31).
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(der(set(signedAttrs)))
      .sign(privateKeyPem);

    const signerInfo = seq([
      int(1),
      seq([issuerName, serialNumber]),
      algorithm(OID.sha256),
      asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, signedAttrs),
      algorithm(OID.sha256WithRSA),
      octets(signature),
    ]);

    const signedData = seq([
      int(1),
      set([algorithm(OID.sha256)]),
      seq([oid(OID.data)]),
      asn1.create(
        asn1.Class.CONTEXT_SPECIFIC,
        0,
        true,
        chain.map((cert) => forge.pki.certificateToAsn1(cert))
      ),
      set([signerInfo]),
    ]);

    return der(
      seq([oid(OID.signedData), asn1.create(asn1.Class.CONTEXT_SPECIFIC, 0, true, [signedData])])
    );
  }
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
      subFilter: SUBFILTER_ETSI_CADES_DETACHED,
    });

    const signer = new CadesSigner(material);
    const signed = await signpdf.sign(withPlaceholder, signer);

    return { buffer: Buffer.from(signed), signed: true };
  } catch (error: any) {
    console.error("Falha ao assinar PDF:", error?.message || error);
    return { buffer: pdfBuffer, signed: false, error: error?.message || String(error) };
  }
}
