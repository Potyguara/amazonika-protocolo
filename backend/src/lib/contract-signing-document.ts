import { Prisma, PrismaClient } from "@prisma/client";

import {
  buildContractSigningSnapshot,
  createBuiltContractSigningDocumentHash,
  createContractSigningDocumentHash,
  serializeBuiltContractSigningSnapshot,
  type ContractSigningSnapshot,
} from "./contract-signing-snapshot";

import {
  createContractRevisionDocumentHash,
} from "./contract-revision-hash";

type CompanySettingsLike = {
  companyName: string;
  companyLegalName: string;
  companyCnpj: string;
  companyEmail: string;
  companyPhone: string;
  companyAddress: string;
  companyCity: string;
  companyState: string;
  companyZipCode: string;
};

type ResolveDependencies = {
  prisma:
    | PrismaClient
    | Prisma.TransactionClient;

  getCompanySettings: () =>
    Promise<CompanySettingsLike>;
};

function requireCanonicalCents(
  value: number | null | undefined,
  label: string
) {
  if (
    value === null ||
    value === undefined ||
    !Number.isInteger(value) ||
    value < 0
  ) {
    throw new Error(
      `CONTRACT_SIGNING_INVALID_MONEY:${label}`
    );
  }

  return value;
}

function assertRevisionHash(
  value: string | null | undefined
) {
  if (
    !value ||
    !/^[a-f0-9]{64}$/i.test(value)
  ) {
    throw new Error(
      "CONTRACT_APPROVED_REVISION_HASH_INVALID"
    );
  }

  return value;
}

export async function resolveContractSigningDocument(
  dependencies: ResolveDependencies,
  contractId: number
) {
  const {
    prisma,
    getCompanySettings,
  } = dependencies;

  if (
    !Number.isInteger(contractId) ||
    contractId <= 0
  ) {
    throw new Error(
      "CONTRACT_SIGNING_INVALID_CONTRACT_ID"
    );
  }

  const contract =
    await prisma.contract.findUnique({
      where: {
        id: contractId,
      },

      include: {
        client: true,

        protocol: {
          include: {
            serviceType: true,
          },
        },

        paymentSchedule: {
          orderBy: [
            {
              dueDate: "asc",
            },
            {
              installmentNumber:
                "asc",
            },
          ],
        },

        revisions: {
          where: {
            status:
              "APROVADA",
          },

          orderBy: {
            revisionNumber:
              "desc",
          },

          take: 2,

          include: {
            clauses: {
              orderBy: [
                {
                  sortOrder:
                    "asc",
                },
                {
                  id:
                    "asc",
                },
              ],
            },
          },
        },
      },
    });

  if (!contract) {
    throw new Error(
      "CONTRACT_SIGNING_CONTRACT_NOT_FOUND"
    );
  }

  if (
    contract.revisions.length === 0
  ) {
    throw new Error(
      "CONTRACT_APPROVED_REVISION_REQUIRED"
    );
  }

  if (
    contract.revisions.length > 1
  ) {
    throw new Error(
      "CONTRACT_MULTIPLE_APPROVED_REVISIONS"
    );
  }

  const revision =
    contract.revisions[0];

  const revisionDocumentHash =
    assertRevisionHash(
      revision.documentHash
    );

  if (
    revision.clauses.length === 0
  ) {
    throw new Error(
      "CONTRACT_APPROVED_REVISION_EMPTY"
    );
  }

  const recalculatedRevisionHash =
    createContractRevisionDocumentHash({
      contractId:
        revision.contractId,

      revisionNumber:
        revision.revisionNumber,

      title:
        revision.title,

      clauses:
        revision.clauses.map(
          (clause) => ({
            clauseKey:
              clause.clauseKey,

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
          })
        ),
    });

  if (
    recalculatedRevisionHash !==
    revisionDocumentHash
  ) {
    throw new Error(
      "CONTRACT_APPROVED_REVISION_CONTENT_CHANGED"
    );
  }

  const contractValueCents =
    requireCanonicalCents(
      contract.contractValueCents,
      "contractValueCents"
    );

  const entryAmountCents =
    requireCanonicalCents(
      contract.entryAmountCents,
      "entryAmountCents"
    );

  for (
    const item of
      contract.paymentSchedule
  ) {
    requireCanonicalCents(
      item.amountCents,
      `paymentSchedule:${item.id}`
    );
  }

  const company =
    await getCompanySettings();

  const snapshotInput = {
    contract: {
      id:
        contract.id,

      contractNumber:
        contract.contractNumber,

      title:
        contract.title,

      contractValueCents,

      entryAmountCents,

      paymentMode:
        contract.paymentMode,

      startDate:
        contract.startDate,

      deadlineDate:
        contract.deadlineDate,
    },

    revision: {
      id:
        revision.id,

      revisionNumber:
        revision.revisionNumber,

      status:
        revision.status,

      title:
        revision.title,

      documentHash:
        revisionDocumentHash,

      clauses:
        revision.clauses.map(
          (clause) => ({
            id:
              clause.id,

            clauseKey:
              clause.clauseKey,

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
          })
        ),
    },

    protocol: {
      id:
        contract.protocol.id,

      protocolNumber:
        contract.protocol
          .protocolNumber,
    },

    service: {
      id:
        contract.protocol
          .serviceType.id,

      code:
        contract.protocol
          .serviceType.code,

      name:
        contract.protocol
          .serviceType.name,
    },

    client: {
      id:
        contract.client.id,

      name:
        contract.client.name,

      cpfCnpj:
        contract.client.cpfCnpj,

      email:
        contract.client.email,

      phone:
        contract.client.phone,

      address:
        contract.client.address,

      city:
        contract.client.city,

      state:
        contract.client.state,
    },

    company: {
      legalName:
        company.companyLegalName,

      name:
        company.companyName,

      cnpj:
        company.companyCnpj,

      email:
        company.companyEmail,

      phone:
        company.companyPhone,

      address:
        company.companyAddress,

      city:
        company.companyCity,

      state:
        company.companyState,

      zipCode:
        company.companyZipCode,
    },

    paymentSchedule:
      contract.paymentSchedule.map(
        (item) => ({
          type:
            item.type,

          installmentNumber:
            item.installmentNumber,

          totalInstallments:
            item.totalInstallments,

          amountCents:
            item.amountCents,

          dueDate:
            item.dueDate,
        })
      ),
  };

  const snapshot =
    buildContractSigningSnapshot(
      snapshotInput
    );

  const signingDocumentHash =
    createContractSigningDocumentHash(
      snapshotInput
    );

  return {
    contract,
    revision,

    revisionId:
      revision.id,

    revisionNumber:
      revision.revisionNumber,

    revisionDocumentHash,

    signingDocumentHash,

    snapshot,
  };
}


const CONTRACT_SIGNING_SNAPSHOT_VERSION =
  1;

type FrozenSnapshotRecord = {
  id: number;
  contractId: number;
  revisionNumber: number;
  documentHash: string | null;
  signingSnapshotJson: string | null;
  signingSnapshotVersion: number | null;
  signingDocumentHash: string | null;
  signingSnapshotCreatedAt: Date | null;
};

function parseFrozenSigningSnapshot(
  revision: FrozenSnapshotRecord
) {
  if (
    !revision.signingSnapshotJson ||
    revision.signingSnapshotVersion === null ||
    !revision.signingDocumentHash ||
    !revision.signingSnapshotCreatedAt
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_NOT_MATERIALIZED"
    );
  }

  if (
    revision.signingSnapshotVersion !==
    CONTRACT_SIGNING_SNAPSHOT_VERSION
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_VERSION_UNSUPPORTED"
    );
  }

  let snapshot:
    ContractSigningSnapshot;

  try {
    snapshot =
      JSON.parse(
        revision.signingSnapshotJson
      ) as ContractSigningSnapshot;
  } catch {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_INVALID_JSON"
    );
  }

  if (
    !snapshot ||
    snapshot.schemaVersion !==
      CONTRACT_SIGNING_SNAPSHOT_VERSION ||
    snapshot.contract?.id !==
      revision.contractId ||
    snapshot.revision?.id !==
      revision.id ||
    snapshot.revision?.revisionNumber !==
      revision.revisionNumber ||
    !Array.isArray(
      snapshot.revision?.clauses
    ) ||
    !Array.isArray(
      snapshot.paymentSchedule
    )
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_IDENTITY_MISMATCH"
    );
  }

  const recalculatedHash =
    createBuiltContractSigningDocumentHash(
      snapshot
    );

  if (
    recalculatedHash !==
    revision.signingDocumentHash
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_HASH_MISMATCH"
    );
  }

  if (
    snapshot.revision
      .revisionDocumentHash !==
    revision.documentHash
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_REVISION_HASH_MISMATCH"
    );
  }

  return {
    snapshot,

    signingDocumentHash:
      revision.signingDocumentHash,

    signingSnapshotVersion:
      revision.signingSnapshotVersion,

    signingSnapshotCreatedAt:
      revision.signingSnapshotCreatedAt,
  };
}


async function loadFrozenRevisionRecord(
  prisma:
    | PrismaClient
    | Prisma.TransactionClient,
  contractId: number,
  revisionId: number
) {
  const revision =
    await prisma.contractRevision.findFirst({
      where: {
        id:
          revisionId,

        contractId,
      },

      select: {
        id:
          true,

        contractId:
          true,

        revisionNumber:
          true,

        documentHash:
          true,

        signingSnapshotJson:
          true,

        signingSnapshotVersion:
          true,

        signingDocumentHash:
          true,

        signingSnapshotCreatedAt:
          true,
      },
    });

  if (!revision) {
    throw new Error(
      "CONTRACT_SIGNING_REVISION_NOT_FOUND"
    );
  }

  return revision;
}


export async function loadFrozenContractSigningDocument(
  dependencies: {
    prisma:
      | PrismaClient
      | Prisma.TransactionClient;
  },
  contractId: number,
  revisionId: number
) {
  if (
    !Number.isInteger(contractId) ||
    contractId <= 0 ||
    !Number.isInteger(revisionId) ||
    revisionId <= 0
  ) {
    throw new Error(
      "CONTRACT_SIGNING_INVALID_FROZEN_ID"
    );
  }

  const revision =
    await loadFrozenRevisionRecord(
      dependencies.prisma,
      contractId,
      revisionId
    );

  const frozen =
    parseFrozenSigningSnapshot(
      revision
    );

  return {
    revisionId:
      revision.id,

    revisionNumber:
      revision.revisionNumber,

    revisionDocumentHash:
      revision.documentHash!,

    signingDocumentHash:
      frozen.signingDocumentHash,

    signingSnapshotVersion:
      frozen.signingSnapshotVersion,

    signingSnapshotCreatedAt:
      frozen.signingSnapshotCreatedAt,

    snapshot:
      frozen.snapshot,
  };
}


export async function materializeContractSigningSnapshot(
  dependencies: ResolveDependencies,
  contractId: number
) {
  const live =
    await resolveContractSigningDocument(
      dependencies,
      contractId
    );

  const snapshotJson =
    serializeBuiltContractSigningSnapshot(
      live.snapshot
    );

  const signingDocumentHash =
    createBuiltContractSigningDocumentHash(
      live.snapshot
    );

  if (
    signingDocumentHash !==
    live.signingDocumentHash
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_INTERNAL_HASH_MISMATCH"
    );
  }

  const existingSnapshotFields = [
    live.revision
      .signingSnapshotJson,

    live.revision
      .signingSnapshotVersion,

    live.revision
      .signingDocumentHash,

    live.revision
      .signingSnapshotCreatedAt,
  ];

  const existingCount =
    existingSnapshotFields.filter(
      (value) =>
        value !== null &&
        value !== undefined
    ).length;

  if (
    existingCount > 0 &&
    existingCount < 4
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_PARTIAL_STATE"
    );
  }

  if (existingCount === 4) {
    return loadFrozenContractSigningDocument(
      {
        prisma:
          dependencies.prisma,
      },
      contractId,
      live.revisionId
    );
  }

  const createdAt =
    new Date();

  /*
   * updateMany + campos NULL implementam compare-and-set.
   *
   * Apenas uma execução concorrente poderá materializar
   * o snapshot pela primeira vez.
   */
  const writeResult =
    await dependencies.prisma
      .contractRevision
      .updateMany({
        where: {
          id:
            live.revisionId,

          contractId,

          signingSnapshotJson:
            null,

          signingSnapshotVersion:
            null,

          signingDocumentHash:
            null,

          signingSnapshotCreatedAt:
            null,
        },

        data: {
          signingSnapshotJson:
            snapshotJson,

          signingSnapshotVersion:
            CONTRACT_SIGNING_SNAPSHOT_VERSION,

          signingDocumentHash,

          signingSnapshotCreatedAt:
            createdAt,
        },
      });

  /*
   * count=0 pode significar que outra execução acabou de
   * congelar a mesma revisão. Nesse caso nunca sobrescrevemos:
   * apenas carregamos e validamos o snapshot vencedor.
   */
  if (
    writeResult.count !== 0 &&
    writeResult.count !== 1
  ) {
    throw new Error(
      "CONTRACT_SIGNING_SNAPSHOT_WRITE_FAILED"
    );
  }

  return loadFrozenContractSigningDocument(
    {
      prisma:
        dependencies.prisma,
    },
    contractId,
    live.revisionId
  );
}
