import test from "node:test";
import assert from "node:assert/strict";

import {
  ContractSigningSnapshotInput,
  createContractSigningDocumentHash,
} from "./contract-signing-snapshot";

function fixture(): ContractSigningSnapshotInput {
  return {
    contract: {
      id: 10,
      contractNumber:
        "CONT-2026-000010",
      title:
        "Contrato de teste",
      contractValueCents:
        250000,
      entryAmountCents:
        50000,
      paymentMode:
        "ENTRADA_PARCELAS",
      startDate:
        "2026-09-24T12:00:00.000Z",
      deadlineDate:
        "2026-10-24T12:00:00.000Z",
    },

    revision: {
      id: 20,
      revisionNumber: 2,
      status: "APROVADA",
      title: "Revisão 2",
      documentHash:
        "revision-hash-test",

      clauses: [
        {
          id: 2,
          clauseKey: "PRAZO",
          title: "DO PRAZO",
          body: "Prazo contratual.",
          sortOrder: 20,
          source: "TEMPLATE",
          required: true,
        },
        {
          id: 1,
          clauseKey: "OBJETO",
          title: "DO OBJETO",
          body: "Objeto contratual.",
          sortOrder: 10,
          source: "TEMPLATE",
          required: true,
        },
      ],
    },

    protocol: {
      id: 30,
      protocolNumber:
        "AMZ-2026-000030",
    },

    service: {
      id: 6,
      code: "GEO",
      name:
        "Georreferenciamento de Imóveis Rurais",
    },

    client: {
      id: 40,
      name: "Cliente Teste",
      cpfCnpj: "000.000.000-00",
      email:
        "cliente@example.com",
      phone: "000000000",
      address:
        "Endereço Teste",
      city: "Macapá",
      state: "AP",
    },

    company: {
      legalName:
        "AMAZONIKA ENGENHARIA LTDA",
      name:
        "AMAZONIKA ENGENHARIA",
      cnpj:
        "49.158.834/0001-19",
      email:
        "empresa@example.com",
      phone: "000000000",
      address:
        "Endereço Empresa",
      city: "Macapá",
      state: "AP",
      zipCode: "00000-000",
    },

    paymentSchedule: [
      {
        type: "PARCELA",
        installmentNumber: 1,
        totalInstallments: 1,
        amountCents: 200000,
        dueDate:
          "2026-10-10T12:00:00.000Z",
      },
      {
        type: "ENTRADA",
        installmentNumber: 0,
        totalInstallments: null,
        amountCents: 50000,
        dueDate:
          "2026-09-25T12:00:00.000Z",
      },
    ],
  };
}

test(
  "gera SHA-256 determinístico de 64 caracteres",
  () => {
    const a =
      createContractSigningDocumentHash(
        fixture()
      );

    const b =
      createContractSigningDocumentHash(
        fixture()
      );

    assert.match(
      a,
      /^[a-f0-9]{64}$/
    );

    assert.equal(a, b);
  }
);

test(
  "ordem de cláusulas e parcelas não altera o hash",
  () => {
    const a = fixture();
    const b = fixture();

    b.revision.clauses.reverse();
    b.paymentSchedule.reverse();

    assert.equal(
      createContractSigningDocumentHash(a),
      createContractSigningDocumentHash(b)
    );
  }
);

test(
  "alteração de cláusula muda o hash",
  () => {
    const a = fixture();
    const b = fixture();

    b.revision.clauses[0].body =
      "Conteúdo alterado.";

    assert.notEqual(
      createContractSigningDocumentHash(a),
      createContractSigningDocumentHash(b)
    );
  }
);

test(
  "alteração financeira muda o hash",
  () => {
    const a = fixture();
    const b = fixture();

    b.paymentSchedule[0].amountCents +=
      100;

    assert.notEqual(
      createContractSigningDocumentHash(a),
      createContractSigningDocumentHash(b)
    );
  }
);

test(
  "troca da revisão muda o hash",
  () => {
    const a = fixture();
    const b = fixture();

    b.revision.id = 21;
    b.revision.revisionNumber = 3;

    assert.notEqual(
      createContractSigningDocumentHash(a),
      createContractSigningDocumentHash(b)
    );
  }
);

test(
  "alteração do contratante muda o hash",
  () => {
    const a = fixture();
    const b = fixture();

    b.client.name =
      "Outro Cliente";

    assert.notEqual(
      createContractSigningDocumentHash(a),
      createContractSigningDocumentHash(b)
    );
  }
);
