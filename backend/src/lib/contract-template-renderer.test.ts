import test from "node:test";
import assert from "node:assert/strict";

import {
  collectUnresolvedContractPlaceholders,
  findContractPlaceholders,
  renderContractTemplateClauses,
  renderContractTemplateText,
} from "./contract-template-renderer";

test("substitui placeholders conhecidos", () => {
  const rendered = renderContractTemplateText(
    "Contrato {{CONTRATO_NUMERO}} de {{CONTRATANTE_NOME}}.",
    {
      CONTRATO_NUMERO: "CTR-001",
      CONTRATANTE_NOME: "Cliente Teste",
    }
  );

  assert.equal(
    rendered,
    "Contrato CTR-001 de Cliente Teste."
  );
});

test("aceita espaços dentro do placeholder", () => {
  const rendered = renderContractTemplateText(
    "{{ CONTRATADA_NOME }}",
    {
      CONTRATADA_NOME: "Amazonika Engenharia",
    }
  );

  assert.equal(
    rendered,
    "Amazonika Engenharia"
  );
});

test("preserva placeholder desconhecido", () => {
  const rendered = renderContractTemplateText(
    "Imóvel: {{IMOVEL_NOME}}",
    {}
  );

  assert.equal(
    rendered,
    "Imóvel: {{IMOVEL_NOME}}"
  );

  assert.deepEqual(
    findContractPlaceholders(rendered),
    ["IMOVEL_NOME"]
  );
});

test("renderiza cláusulas e informa placeholders pendentes", () => {
  const clauses = renderContractTemplateClauses(
    [
      {
        id: 10,
        clauseKey: "OBJETO",
        title: "DO OBJETO",
        body:
          "Prestação de {{SERVICO_NOME}} no imóvel {{IMOVEL_NOME}}.",
        sortOrder: 10,
        required: true,
      },
    ],
    {
      SERVICO_NOME: "Georreferenciamento",
    }
  );

  assert.equal(clauses.length, 1);
  assert.equal(clauses[0].templateClauseId, 10);

  assert.equal(
    clauses[0].body,
    "Prestação de Georreferenciamento no imóvel {{IMOVEL_NOME}}."
  );

  assert.deepEqual(
    collectUnresolvedContractPlaceholders(clauses),
    ["IMOVEL_NOME"]
  );
});
