// Apaga do banco os lançamentos e cobranças do cliente de teste.
// Uso (na VPS, dentro de /var/www/sis-amazonika/backend):
//   node ../scripts/apagar-testes-financeiro.cjs          -> só mostra o que seria apagado
//   APAGAR=1 node ../scripts/apagar-testes-financeiro.cjs -> apaga de verdade
// Regras: só o cliente "Cliente Teste Plinio"; recusa se alguma cobrança do BB
// ainda estiver aberta, e só apaga lançamentos pagos com INCLUIR_PAGOS=1.
const { PrismaClient } = require(require.resolve("@prisma/client", { paths: [process.cwd()] }));
const p = new PrismaClient();
const NOME = "Cliente Teste Plinio";

(async () => {
  const clients = await p.client.findMany({ where: { name: NOME }, select: { id: true, name: true } });
  if (clients.length !== 1) throw new Error(`Esperava 1 cliente "${NOME}", achei ${clients.length}.`);
  const clientId = clients[0].id;

  const txs = await p.financialTransaction.findMany({
    where: { clientId },
    include: { billingCharge: true, partnerCommission: true },
    orderBy: { dueDate: "asc" },
  });
  const charges = await p.billingCharge.findMany({ where: { clientId } });

  console.log(`Cliente ${NOME} (id ${clientId})`);
  for (const t of txs) {
    console.log(`  lançamento #${t.id} ${t.status} venc ${t.dueDate ? t.dueDate.toISOString().slice(0, 10) : "-"} | cobrança: ${t.billingCharge ? `#${t.billingCharge.id} ${t.billingCharge.status}` : "nenhuma"}`);
  }
  const extra = charges.filter((c) => !txs.some((t) => t.billingCharge && t.billingCharge.id === c.id));
  for (const c of extra) console.log(`  cobrança avulsa #${c.id} ${c.status}`);

  const paid = txs.filter((t) => t.status === "PAGO" || t.paidAt);
  if (paid.length && process.env.INCLUIR_PAGOS !== "1") {
    throw new Error(`PAROU: há ${paid.length} lançamento(s) pago(s) (testes de Pix já pagos?). Para apagar esses também, acrescente INCLUIR_PAGOS=1. Nada foi apagado.`);
  }
  // Cobrança paga já foi concluída no BB; só as ainda abertas precisam de cancelamento.
  const live = charges.filter((c) => !["CANCELADA", "PAGA", "RASCUNHO", "ERRO"].includes(String(c.status)) && c.txid);
  if (live.length) {
    throw new Error(`PAROU: cobrança(s) ${live.map((c) => "#" + c.id + " " + c.status).join(", ")} ainda ativa(s) no BB. Cancele antes em Financeiro > Lançamentos > "Cancelar cobrança BB".`);
  }
  if (txs.some((t) => t.partnerCommission)) throw new Error("PAROU: há comissão de parceiro vinculada.");

  if (process.env.APAGAR !== "1") {
    console.log(`\nTeste: apagaria ${txs.length} lançamento(s) e ${charges.length} cobrança(s). Para apagar: APAGAR=1 node ../scripts/apagar-testes-financeiro.cjs`);
    return;
  }

  await p.$transaction([
    p.billingCharge.deleteMany({ where: { id: { in: charges.map((c) => c.id) } } }),
    p.financialTransaction.deleteMany({ where: { id: { in: txs.map((t) => t.id) } } }),
  ]);
  console.log(`APAGADO: ${txs.length} lançamento(s) e ${charges.length} cobrança(s). O cliente continua cadastrado.`);
})()
  .catch((e) => { console.error(e.message || e); process.exitCode = 1; })
  .finally(() => p.$disconnect());
