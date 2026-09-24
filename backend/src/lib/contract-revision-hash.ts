import { createHash } from "node:crypto";

export type ContractRevisionHashClause = {
  clauseKey?: string | null;
  title: string;
  body: string;
  sortOrder: number;
  source: string;
  required: boolean;
};

export function createContractRevisionDocumentHash(params: {
  contractId: number;
  revisionNumber: number;
  title?: string | null;
  clauses: ContractRevisionHashClause[];
}) {
  const canonical = JSON.stringify({
    contractId:
      params.contractId,

    revisionNumber:
      params.revisionNumber,

    title:
      params.title || null,

    clauses:
      [...params.clauses]
        .sort((a, b) => {
          if (
            a.sortOrder !==
            b.sortOrder
          ) {
            return (
              a.sortOrder -
              b.sortOrder
            );
          }

          return a.title.localeCompare(
            b.title
          );
        })
        .map((clause) => ({
          clauseKey:
            clause.clauseKey || null,

          title:
            clause.title,

          body:
            clause.body,

          sortOrder:
            clause.sortOrder,

          source:
            clause.source,

          required:
            clause.required,
        })),
  });

  return createHash("sha256")
    .update(canonical, "utf8")
    .digest("hex");
}
