import { PrismaClient } from "@prisma/client";

import {
  buildContractSigningSnapshot,
  createContractSigningDocumentHash,
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
  prisma: PrismaClient;

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
