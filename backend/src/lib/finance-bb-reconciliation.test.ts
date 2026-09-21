import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import vm from "node:vm";
import ts from "typescript";

function response() {
  return {
    code: 200,
    body: null as any,

    status(code: number) {
      this.code = code;
      return this;
    },

    json(body: any) {
      this.body = body;
      return this;
    },
  };
}

function extractReconcileHandler(context: Record<string, any>) {
  const source = ts.createSourceFile(
    "server.ts",
    fs.readFileSync("src/server.ts", "utf8"),
    ts.ScriptTarget.Latest,
    true
  );

  let handler: ts.ArrowFunction | undefined;

  function visit(node: ts.Node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.getText(source) === "app.post" &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0]) &&
      node.arguments[0].text === "/billing-charges/:id/reconcile-bb"
    ) {
      handler = node.arguments.at(-1) as ts.ArrowFunction;
    }

    ts.forEachChild(node, visit);
  }

  visit(source);

  assert.ok(handler, "Handler reconcile-bb não encontrado.");

  const js = ts.transpileModule(
    `const handler = ${handler.getText(source)}; handler;`,
    {
      compilerOptions: {
        target: ts.ScriptTarget.ES2022,
        module: ts.ModuleKind.CommonJS,
      },
    }
  ).outputText;

  return vm.runInNewContext(js, {
    ...context,
    console,
  }) as Function;
}

function createState() {
  const financialTransaction = {
    id: 2,
    type: "PARCELA",
    status: "PENDENTE",
    amountCents: 100000,
    paidAt: null,
    paymentConfirmedAt: null,
    chargeStatus: "ATIVA",
  };

  const billingCharge = {
    id: 1,
    provider: "BANCO_DO_BRASIL",
    status: "EMITIDA",
    financialTransactionId: 2,
    txid: "TESTTXID123",
    amount: 1000,
    amountCents: 100000,
    paidAt: null,
    paidAmount: null,
    paidAmountCents: null,
    rawResponse: null,
    errorMessage: null,
    financialTransaction,
  };

  return {
    billingCharge,
    financialTransaction,
  };
}

function createPrisma(state: ReturnType<typeof createState>) {
  let billingUpdates = 0;
  let financialUpdates = 0;
  let auditCreates = 0;

  const tx = {
    billingCharge: {
      findUnique: async () => state.billingCharge,

      update: async ({ data }: any) => {
        billingUpdates += 1;
        Object.assign(state.billingCharge, data);
        return state.billingCharge;
      },
    },

    financialTransaction: {
      update: async ({ data }: any) => {
        financialUpdates += 1;
        Object.assign(state.financialTransaction, data);
        return state.financialTransaction;
      },
    },

    auditLog: {
      create: async () => {
        auditCreates += 1;
        return { id: auditCreates };
      },
    },
  };

  const prisma = {
    billingCharge: {
      findUnique: async () => state.billingCharge,
    },

    $transaction: async (fn: Function) => fn(tx),
  };

  return {
    prisma,
    counts: () => ({
      billingUpdates,
      financialUpdates,
      auditCreates,
    }),
  };
}

function baseContext(
  prisma: any,
  getBbPixDueCharge: Function
) {
  return {
    prisma,
    getBbPixDueCharge,

    legacyReaisFromCents: (
      cents: number,
      _classification: string
    ) => cents / 100,

    safeJson: (value: unknown) =>
      JSON.stringify(value),
  };
}

function request() {
  return {
    params: { id: "1" },
    user: {
      id: 1,
      name: "Teste",
      email: "teste@example.com",
      role: "GERENTE",
    },
    ip: "127.0.0.1",
  };
}

test("Finance V2 BB: ATIVA não realiza baixa", async () => {
  const state = createState();
  const db = createPrisma(state);

  let bbCalls = 0;

  const handler = extractReconcileHandler(
    baseContext(
      db.prisma,
      async () => {
        bbCalls += 1;
        return {
          status: "ATIVA",
        };
      }
    )
  );

  const res = response();

  await handler(
    request(),
    res
  );

  assert.equal(res.code, 200);
  assert.equal(res.body.reconciled, false);
  assert.equal(res.body.bbStatus, "ATIVA");

  assert.equal(state.billingCharge.status, "EMITIDA");
  assert.equal(state.billingCharge.paidAt, null);

  assert.equal(state.financialTransaction.status, "PENDENTE");
  assert.equal(state.financialTransaction.paidAt, null);
  assert.equal(state.financialTransaction.paymentConfirmedAt, null);

  assert.equal(bbCalls, 1);

  assert.deepEqual(
    db.counts(),
    {
      billingUpdates: 0,
      financialUpdates: 0,
      auditCreates: 0,
    }
  );
});

test("Finance V2 BB: CONCLUIDA baixa cobrança e parcela existente", async () => {
  const state = createState();
  const db = createPrisma(state);

  const handler = extractReconcileHandler(
    baseContext(
      db.prisma,
      async () => ({
        status: "CONCLUIDA",
        pix: [
          {
            horario: "2026-09-21T01:30:00.000Z",
            valor: "1000.00",
          },
        ],
      })
    )
  );

  const res = response();

  await handler(
    request(),
    res
  );

  assert.equal(res.code, 200);
  assert.equal(res.body.reconciled, true);
  assert.equal(res.body.alreadyReconciled, false);
  assert.equal(res.body.bbStatus, "CONCLUIDA");

  assert.equal(state.billingCharge.status, "PAGA");
  assert.equal(state.billingCharge.paidAmountCents, 100000);
  assert.equal(
    new Date(state.billingCharge.paidAt as any).toISOString(),
    "2026-09-21T01:30:00.000Z"
  );

  assert.equal(state.financialTransaction.type, "PARCELA");
  assert.equal(state.financialTransaction.status, "PAGO");
  assert.equal(
    new Date(state.financialTransaction.paidAt as any).toISOString(),
    "2026-09-21T01:30:00.000Z"
  );
  assert.equal(
    new Date(
      state.financialTransaction.paymentConfirmedAt as any
    ).toISOString(),
    "2026-09-21T01:30:00.000Z"
  );
  assert.equal(
    state.financialTransaction.chargeStatus,
    "CONCLUIDA"
  );

  assert.deepEqual(
    db.counts(),
    {
      billingUpdates: 1,
      financialUpdates: 1,
      auditCreates: 1,
    }
  );
});

test("Finance V2 BB: valor recebido divergente bloqueia baixa", async () => {
  const state = createState();
  const db = createPrisma(state);

  const handler = extractReconcileHandler(
    baseContext(
      db.prisma,
      async () => ({
        status: "CONCLUIDA",
        pix: [
          {
            horario: "2026-09-21T01:30:00.000Z",
            valor: "999.99",
          },
        ],
      })
    )
  );

  const res = response();

  await handler(
    request(),
    res
  );

  assert.equal(res.code, 409);
  assert.equal(
    res.body.code,
    "BB_PAID_AMOUNT_MISMATCH"
  );

  assert.equal(state.billingCharge.status, "EMITIDA");
  assert.equal(state.billingCharge.paidAt, null);

  assert.equal(state.financialTransaction.status, "PENDENTE");
  assert.equal(state.financialTransaction.paidAt, null);

  assert.deepEqual(
    db.counts(),
    {
      billingUpdates: 0,
      financialUpdates: 0,
      auditCreates: 0,
    }
  );
});

test("Finance V2 BB: segunda conciliação é idempotente", async () => {
  const state = createState();
  const db = createPrisma(state);

  let bbCalls = 0;

  const handler = extractReconcileHandler(
    baseContext(
      db.prisma,
      async () => {
        bbCalls += 1;

        return {
          status: "CONCLUIDA",
          pix: [
            {
              horario: "2026-09-21T01:30:00.000Z",
              valor: "1000.00",
            },
          ],
        };
      }
    )
  );

  const first = response();

  await handler(
    request(),
    first
  );

  assert.equal(first.body.reconciled, true);
  assert.equal(first.body.alreadyReconciled, false);

  const second = response();

  await handler(
    request(),
    second
  );

  assert.equal(second.code, 200);
  assert.equal(second.body.reconciled, true);
  assert.equal(second.body.alreadyReconciled, true);

  assert.equal(bbCalls, 1);

  assert.deepEqual(
    db.counts(),
    {
      billingUpdates: 1,
      financialUpdates: 1,
      auditCreates: 1,
    }
  );

  assert.equal(state.billingCharge.status, "PAGA");
  assert.equal(state.financialTransaction.status, "PAGO");
});
