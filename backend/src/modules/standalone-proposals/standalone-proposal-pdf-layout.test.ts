import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { generateStandaloneProposalPdf } from "./standalone-proposal-pdf.service";

test("PDF de proposta editorial gera arquivo válido com dados dinâmicos", async () => {
  const cwd = process.cwd();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "amazonika-pav-layout-"));
  process.chdir(tmp);

  const proposal = {
    id: 8,
    title: "Prestação de Serviços Técnicos",
    proposalNumber: "PAV-2026-000008",
    clientName: "BENEDITO LIMA MORAES",
    generatedAt: new Date("2026-10-21T12:00:00Z"),
    paymentMode: "A_VISTA",
    paymentText: "Pagamento à vista de R$ 5.000,00.",
    entryAmount: 500000,
    installmentQty: null,
    installmentAmount: null,
    subtotalAmount: 500000,
    discountAmount: 0,
    additionAmount: 0,
    totalAmount: 500000,
    objectText: "Georreferenciamento de 01 imóvel rural estimado em 32 hectares",
    scopeText: null,
    commercialDescription: null,
    executionText: null,
    executionDays: null,
    notes: null,
    validUntil: new Date("2026-11-05T12:00:00Z"),
    items: [{
      id: 1,
      serviceName: "Georreferenciamento de Imóvel Rural",
      summaryDescription: "Levantamento cadastral do perímetro e certificação no SIGEF.",
      quantity: 1,
      unitLabel: "Serviço",
      unitAmount: 500000,
      totalAmount: 500000,
      acronym: "GEO-RURAL",
      commercialDescription: "Georreferenciamento de imóvel rural.",
      technicalDescription: "FASE 1\nPreparação e Análise Documental\nAnálise de matrícula, CCIR e CAR.\nFASE 2\nTrabalhos de Campo\nRastreamento de vértices do imóvel.",
      legalText: "Conforme normas técnicas aplicáveis.",
    }],
    attachments: [],
    client: null,
    createdBy: { id: 1, name: "Teste", email: "teste@example.org" },
  };

  const prisma = {
    standaloneProposal: {
      findUnique: async () => proposal,
      update: async ({ data }: any) => ({ ...proposal, ...data }),
    },
    companySettings: {
      findFirst: async () => ({
        companyName: "AMAZONIKA ENGENHARIA LTDA",
        cnpj: "49.158.834/0001-19",
        city: "Macapá",
        state: "AP",
      }),
    },
  } as any;

  try {
    const result = await generateStandaloneProposalPdf(prisma, 8);
    const buffer = fs.readFileSync(result.filePath);
    assert.equal(buffer.subarray(0, 5).toString(), "%PDF-");
    assert.ok(buffer.length > 3000);
    assert.equal(result.proposal.generatedPdfName, "PAV-2026-000008.pdf");
  } finally {
    process.chdir(cwd);
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
