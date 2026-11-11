import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import type { AddressInfo } from "node:net";
import { registerStandaloneProposalRoutes } from "./standalone-proposals.routes";

test("consulta pública exige token, documento emitido e SHA-256 válido", async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "amazonika-public-proposal-"));
  const pdf = path.join(dir, "official.pdf");
  const content = Buffer.from("%PDF-1.4\nDocumento de teste\n%%EOF\n");
  fs.writeFileSync(pdf, content);
  const token = "a".repeat(64);
  let proposal: Record<string, unknown> | null = {
    proposalNumber: "PAV-2026-000008",
    title: "Serviços técnicos",
    clientName: "DESTINATÁRIO DE TESTE",
    totalAmount: 500000,
    validUntil: null,
    generatedAt: new Date("2026-11-10T20:00:00Z"),
    generatedPdfPath: pdf,
    generatedPdfName: "PAV-2026-000008.pdf",
    generatedPdfHash: crypto.createHash("sha256").update(content).digest("hex"),
    status: "GERADA",
  };

  const prisma = {
    standaloneProposal: {
      findUnique: async ({ where }: { where: { publicToken?: string } }) =>
        where.publicToken === token ? proposal : null,
    },
  } as any;
  const app = express();
  registerStandaloneProposalRoutes({
    app, prisma,
    authMiddleware: (_req: unknown, _res: unknown, next: () => void) => next(),
    requireRoles: () => (_req: unknown, _res: unknown, next: () => void) => next(),
    upload: { single: () => (_req: unknown, _res: unknown, next: () => void) => next() },
    createTransporterFromSettings: async () => null,
    getSmtpSettings: async () => ({}),
    getEmailImageAttachments: () => [],
  });
  const server = app.listen(0, "127.0.0.1");
  try {
    await new Promise<void>((resolve) => server.once("listening", resolve));
    const port = (server.address() as AddressInfo).port;
    const base = `http://127.0.0.1:${port}/public/standalone-proposals`;

    const invalid = await fetch(`${base}/123`);
    assert.equal(invalid.status, 404);
    const unknown = await fetch(`${base}/${"b".repeat(64)}`);
    assert.equal(unknown.status, 404);

    const verification = await fetch(`${base}/${token}`);
    assert.equal(verification.status, 200);
    const details = await verification.json() as Record<string, unknown>;
    assert.equal(details.proposalNumber, "PAV-2026-000008");
    assert.equal(details.totalAmount, 500000);
    assert.equal(details.sha256, proposal.generatedPdfHash);
    assert.equal(details.generatedPdfPath, undefined);
    assert.equal(details.publicToken, undefined);
    assert.equal(details.downloadUrl, `/public/standalone-proposals/${token}/pdf`);

    const download = await fetch(`${base}/${token}/pdf`);
    assert.equal(download.status, 200);
    assert.equal(Buffer.compare(Buffer.from(await download.arrayBuffer()), content), 0);

    fs.writeFileSync(pdf, Buffer.from("%PDF-1.4\nArquivo alterado\n%%EOF\n"));
    assert.equal((await fetch(`${base}/${token}`)).status, 409);
    assert.equal((await fetch(`${base}/${token}/pdf`)).status, 409);

    proposal = { ...proposal, generatedPdfPath: null, generatedPdfHash: null };
    assert.equal((await fetch(`${base}/${token}`)).status, 404);
    assert.equal((await fetch(`${base}/${token}/pdf`)).status, 404);
  } finally {
    await new Promise<void>((resolve, reject) =>
      server.close((error) => error ? reject(error) : resolve())
    );
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
