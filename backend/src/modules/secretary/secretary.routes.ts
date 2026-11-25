import { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

/*
 * ======================================================
 * PERFIL SECRETÁRIA
 * ======================================================
 *
 * Usa o mesmo painel dos gestores, com menu reduzido:
 * Dashboard (só contagens), Protocolos, Agendamentos,
 * Cronograma de Campo e Financeiro > Lançamentos.
 *
 * Não pode ver quanto a empresa lucra: resumo financeiro,
 * caixa, pró-labore, salários, custos fixos, custos dos
 * sócios, cobranças automáticas, categorias, parceiros,
 * propostas avulsas e catálogo ficam fora.
 *
 * O bloqueio é no servidor: um token de secretária só
 * alcança as rotas da lista abaixo (método + caminho).
 * Qualquer outra devolve 403, mesmo que a rota aceite
 * ATENDENTE ou só exija login.
 */

export const SECRETARY_ROLE = "SECRETARIA";

type Rule = [method: string, pattern: RegExp];

const ID = "\\d+";

const SECRETARY_ALLOWED: Rule[] = [
  // Sessão e páginas públicas
  ["*", /^\/auth\//],
  ["*", /^\/public\//],
  ["GET", /^\/$/],
  ["GET", /^\/health$/],
  ["GET", /^\/company-settings$/],
  ["GET", /^\/uploads\//],

  // Dashboard (o backend só devolve contagens e protocolos recentes)
  ["GET", /^\/dashboard$/],

  // Clientes
  ["GET", /^\/clients$/],
  ["GET", /^\/clients\/search$/],
  ["POST", /^\/clients$/],
  ["PATCH", new RegExp(`^/clients/${ID}$`)],

  // Protocolos (sem excluir)
  ["GET", /^\/protocols$/],
  ["GET", new RegExp(`^/protocols/${ID}$`)],
  ["POST", /^\/protocols$/],
  ["PATCH", new RegExp(`^/protocols/${ID}$`)],
  ["PATCH", new RegExp(`^/protocols/${ID}/status$`)],
  ["POST", new RegExp(`^/protocols/${ID}/documents$`)],
  ["POST", new RegExp(`^/protocols/${ID}/resend-email$`)],
  ["GET", /^\/service-types$/],
  ["GET", /^\/users\/managers$/],
  ["GET", /^\/public-requests$/],

  // Agendamentos
  ["GET", /^\/appointments$/],
  ["GET", /^\/appointments\/availability$/],
  ["POST", /^\/appointments$/],
  ["PATCH", new RegExp(`^/appointments/${ID}$`)],
  ["DELETE", new RegExp(`^/appointments/${ID}$`)],

  // Cronograma de campo
  ["GET", /^\/field-schedules(\/.*)?$/],
  ["POST", /^\/field-schedules$/],
  ["POST", /^\/field-schedules\/process-notifications$/],
  ["PUT", new RegExp(`^/field-schedules/${ID}$`)],
  ["PATCH", new RegExp(`^/field-schedules/${ID}/status$`)],
  ["DELETE", new RegExp(`^/field-schedules/${ID}$`)],

  // Financeiro > Lançamentos: listar, cadastrar, ver plano e dar baixa.
  // Editar, cancelar, excluir e emitir cobrança continuam com os gestores.
  ["GET", /^\/finance\/categories$/],
  ["GET", /^\/finance\/transactions$/],
  ["POST", /^\/finance\/transactions$/],
  ["GET", new RegExp(`^/finance/transactions/${ID}/payment-plan$`)],
  ["PATCH", new RegExp(`^/finance/transactions/${ID}/pay$`)],
  ["GET", /^\/catalog\/services$/],
];

export function isSecretaryAllowed(method: string, path: string) {
  const normalized = (path.split("?")[0].replace(/\/+$/, "") || "/");
  const upper = method.toUpperCase();

  if (upper === "OPTIONS") return true;

  return SECRETARY_ALLOWED.some(
    ([ruleMethod, pattern]) =>
      (ruleMethod === "*" || ruleMethod === upper || (upper === "HEAD" && ruleMethod === "GET")) &&
      pattern.test(normalized)
  );
}

/*
 * Rotas com requireRoles que a secretária também usa, além
 * das que já aceitam ATENDENTE.
 */
export function secretaryMayUseRoute(roles: readonly string[]) {
  return roles.includes(SECRETARY_ROLE) || roles.includes("ATENDENTE");
}

export function restrictSecretaryAccess(getJwtSecret: () => string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) return next();

    const [, token] = authHeader.split(" ");

    if (!token) return next();

    let decoded: any = null;

    try {
      decoded = jwt.verify(token, getJwtSecret());
    } catch {
      // Token inválido: as rotas tratam (401) normalmente.
      return next();
    }

    if (decoded?.role !== SECRETARY_ROLE) return next();

    if (isSecretaryAllowed(req.method, req.path)) return next();

    return res.status(403).json({
      message: "Acesso não autorizado para o perfil Secretária.",
    });
  };
}
