export type ContractTemplatePlaceholderValue =
  | string
  | number
  | null
  | undefined;

export type ContractTemplatePlaceholderMap = Record<
  string,
  ContractTemplatePlaceholderValue
>;

export type ContractTemplateClauseInput = {
  id?: number;
  clauseKey?: string | null;
  title: string;
  body: string;
  sortOrder: number;
  required: boolean;
};

export type RenderedContractTemplateClause = {
  templateClauseId: number | null;
  clauseKey: string | null;
  title: string;
  body: string;
  sortOrder: number;
  required: boolean;
  unresolvedPlaceholders: string[];
};

const PLACEHOLDER_REGEX = /\{\{\s*([A-Z0-9_]+)\s*\}\}/g;

function normalizedPlaceholderValues(
  values: ContractTemplatePlaceholderMap
) {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [
      key.trim().toUpperCase(),
      value,
    ])
  );
}

export function findContractPlaceholders(
  text: string | null | undefined
) {
  const source = String(text ?? "");

  const placeholders = new Set<string>();

  for (const match of source.matchAll(PLACEHOLDER_REGEX)) {
    if (match[1]) {
      placeholders.add(match[1].toUpperCase());
    }
  }

  return Array.from(placeholders);
}

export function renderContractTemplateText(
  text: string | null | undefined,
  values: ContractTemplatePlaceholderMap
) {
  const source = String(text ?? "");
  const normalized = normalizedPlaceholderValues(values);

  return source.replace(
    PLACEHOLDER_REGEX,
    (original, rawKey: string) => {
      const key = String(rawKey).toUpperCase();

      if (!Object.prototype.hasOwnProperty.call(normalized, key)) {
        // Placeholder desconhecido permanece explícito.
        // Nunca apagamos silenciosamente informação do modelo.
        return original;
      }

      const value = normalized[key];

      return value === null || value === undefined
        ? ""
        : String(value);
    }
  );
}

export function renderContractTemplateClause(
  clause: ContractTemplateClauseInput,
  values: ContractTemplatePlaceholderMap
): RenderedContractTemplateClause {
  const title = renderContractTemplateText(
    clause.title,
    values
  );

  const body = renderContractTemplateText(
    clause.body,
    values
  );

  const unresolvedPlaceholders = Array.from(
    new Set([
      ...findContractPlaceholders(title),
      ...findContractPlaceholders(body),
    ])
  );

  return {
    templateClauseId:
      Number.isInteger(clause.id) && Number(clause.id) > 0
        ? Number(clause.id)
        : null,

    clauseKey: clause.clauseKey || null,
    title,
    body,
    sortOrder: clause.sortOrder,
    required: clause.required,
    unresolvedPlaceholders,
  };
}

export function renderContractTemplateClauses(
  clauses: ContractTemplateClauseInput[],
  values: ContractTemplatePlaceholderMap
) {
  return clauses.map((clause) =>
    renderContractTemplateClause(clause, values)
  );
}

export function collectUnresolvedContractPlaceholders(
  clauses: RenderedContractTemplateClause[]
) {
  return Array.from(
    new Set(
      clauses.flatMap(
        (clause) => clause.unresolvedPlaceholders
      )
    )
  );
}
