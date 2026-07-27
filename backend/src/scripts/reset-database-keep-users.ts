import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("Iniciando limpeza do banco...");

  await prisma.$transaction(async (tx) => {
    // 1. Documentos e históricos dependentes
    await tx.fiscalDocument.deleteMany({});
    await tx.proposalHistory.deleteMany({});
    await tx.notificationLog.deleteMany({});

    // 2. Cobranças, pagamentos e financeiro
    await tx.billingCharge.deleteMany({});
    await tx.payment.deleteMany({});
    await tx.financialTransaction.deleteMany({});
    await tx.proLaboreAdvance.deleteMany({});
    await tx.managementCashSetting.deleteMany({});
    await tx.employeeSalary.deleteMany({});
    await tx.fixedCost.deleteMany({});
    await tx.financialCategory.deleteMany({});

    // 3. Propostas e contratos
    await tx.proposalItem.deleteMany({});
    await tx.contract.deleteMany({});
    await tx.proposal.deleteMany({});

    // 4. Protocolo e vínculos operacionais
    await tx.document.deleteMany({});
    await tx.appointment.deleteMany({});
    await tx.protocol.deleteMany({});

    // 5. Solicitações públicas e clientes
    await tx.publicRequest.deleteMany({});
    await tx.client.deleteMany({});

    /**
     * NÃO apagar:
     * - User: usuários para login
     * - SystemSetting: SMTP, empresa, configs
     * - CompanySettings: dados visuais/empresa, se estiver usando
     * - ServiceType: tipos de serviço cadastrados
     */
  });

  console.log("Banco limpo com sucesso. Usuários e configurações foram mantidos.");
}

main()
  .catch((error) => {
    console.error("Erro ao limpar banco:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });