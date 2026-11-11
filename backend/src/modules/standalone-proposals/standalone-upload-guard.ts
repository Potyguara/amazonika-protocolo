import type { Express } from "express";

/**
 * Bloqueia o acesso estático não autenticado aos PDFs de propostas avulsas.
 * A distribuição oficial usa as rotas de token público ou as rotas internas
 * autenticadas; o nome previsível PAV-AAAA-NNNNNN.pdf não é autorização.
 */
export function blockStandaloneProposalStaticAccess(app: Express): void {
  app.use("/uploads/standalone-proposals", (_req, res) => {
    res.set("Cache-Control", "no-store");
    res.status(404).end();
  });
}
