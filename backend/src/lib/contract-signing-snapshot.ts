import { createHash } from "node:crypto";

export type ContractSigningClause = {
  id?: number | null;
  clauseKey?: string | null;
  title: string;
  body: string;
  sortOrder: number;
  source: string;
  required: boolean;
};

export type ContractSigningPaymentScheduleItem = {
  type: string;
  installmentNumber: number;
  totalInstallments?: number | null;
  amountCents: number;
  dueDate: Date | string;
};

export type ContractSigningSnapshotInput = {
  contract: {
    id: number;
    contractNumber: string;
    title?: string | null;

    contractValueCents: number;
    entryAmountCents: number;
    paymentMode?: string | null;

    startDate?: Date | string | null;
    deadlineDate?: Date | string | null;
  };

  revision: {
    id: number;
    revisionNumber: number;
    status: string;
    title?: string | null;
    documentHash?: string | null;
    clauses: ContractSigningClause[];
  };

  protocol: {
    id: number;
    protocolNumber: string;
  };

  service: {
    id: number;
    code?: string | null;
    name: string;
  };

  client: {
    id: number;
    name: string;
    cpfCnpj?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
  };

  company: {
    legalName?: string | null;
    name?: string | null;
    cnpj?: string | null;
    email?: string | null;
    phone?: string | null;
    address?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
  };

  paymentSchedule: ContractSigningPaymentScheduleItem[];
};

function isoDate(
  value: Date | string | null | undefined
) {
  if (!value) {
    return null;
  }

  const date =
    value instanceof Date
      ? value
      : new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_INVALID_DATE"
    );
  }

  return date.toISOString();
}

function nullableText(
  value: string | null | undefined
) {
  if (value === null || value === undefined) {
    return null;
  }

  const text = String(value).trim();

  return text || null;
}

export function buildContractSigningSnapshot(
  input: ContractSigningSnapshotInput
) {
  const clauses =
    [...input.revision.clauses]
      .sort((a, b) => {
        if (a.sortOrder !== b.sortOrder) {
          return a.sortOrder - b.sortOrder;
        }

        const aId = a.id ?? 0;
        const bId = b.id ?? 0;

        return aId - bId;
      })
      .map((clause) => ({
        id:
          clause.id ?? null,

        clauseKey:
          nullableText(
            clause.clauseKey
          ),

        title:
          clause.title.trim(),

        body:
          clause.body.trim(),

        sortOrder:
          clause.sortOrder,

        source:
          clause.source,

        required:
          Boolean(
            clause.required
          ),
      }));

  const paymentSchedule =
    [...input.paymentSchedule]
      .sort((a, b) => {
        const dateDiff =
          isoDate(a.dueDate)!.localeCompare(
            isoDate(b.dueDate)!
          );

        if (dateDiff !== 0) {
          return dateDiff;
        }

        if (a.type !== b.type) {
          return a.type.localeCompare(
            b.type
          );
        }

        return (
          a.installmentNumber -
          b.installmentNumber
        );
      })
      .map((item) => ({
        type:
          item.type,

        installmentNumber:
          item.installmentNumber,

        totalInstallments:
          item.totalInstallments ??
          null,

        amountCents:
          item.amountCents,

        dueDate:
          isoDate(
            item.dueDate
          ),
      }));

  return {
    schemaVersion: 1,

    contract: {
      id:
        input.contract.id,

      contractNumber:
        input.contract
          .contractNumber,

      title:
        nullableText(
          input.contract.title
        ),

      contractValueCents:
        input.contract
          .contractValueCents,

      entryAmountCents:
        input.contract
          .entryAmountCents,

      paymentMode:
        nullableText(
          input.contract
            .paymentMode
        ),

      startDate:
        isoDate(
          input.contract
            .startDate
        ),

      deadlineDate:
        isoDate(
          input.contract
            .deadlineDate
        ),
    },

    revision: {
      id:
        input.revision.id,

      revisionNumber:
        input.revision
          .revisionNumber,

      status:
        input.revision.status,

      title:
        nullableText(
          input.revision.title
        ),

      revisionDocumentHash:
        nullableText(
          input.revision
            .documentHash
        ),

      clauses,
    },

    protocol: {
      id:
        input.protocol.id,

      protocolNumber:
        input.protocol
          .protocolNumber,
    },

    service: {
      id:
        input.service.id,

      code:
        nullableText(
          input.service.code
        ),

      name:
        input.service.name,
    },

    client: {
      id:
        input.client.id,

      name:
        input.client.name,

      cpfCnpj:
        nullableText(
          input.client.cpfCnpj
        ),

      email:
        nullableText(
          input.client.email
        ),

      phone:
        nullableText(
          input.client.phone
        ),

      address:
        nullableText(
          input.client.address
        ),

      city:
        nullableText(
          input.client.city
        ),

      state:
        nullableText(
          input.client.state
        ),
    },

    company: {
      legalName:
        nullableText(
          input.company.legalName
        ),

      name:
        nullableText(
          input.company.name
        ),

      cnpj:
        nullableText(
          input.company.cnpj
        ),

      email:
        nullableText(
          input.company.email
        ),

      phone:
        nullableText(
          input.company.phone
        ),

      address:
        nullableText(
          input.company.address
        ),

      city:
        nullableText(
          input.company.city
        ),

      state:
        nullableText(
          input.company.state
        ),

      zipCode:
        nullableText(
          input.company.zipCode
        ),
    },

    paymentSchedule,
  };
}

export function serializeContractSigningSnapshot(
  input: ContractSigningSnapshotInput
) {
  return JSON.stringify(
    buildContractSigningSnapshot(
      input
    )
  );
}

export function createContractSigningDocumentHash(
  input: ContractSigningSnapshotInput
) {
  return createHash("sha256")
    .update(
      serializeContractSigningSnapshot(
        input
      ),
      "utf8"
    )
    .digest("hex");
}
