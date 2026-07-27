import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await bcrypt.hash("123456", 10);

  const gerente = await prisma.user.upsert({
    where: { email: "gerente@amazonika.com.br" },
    update: {
      name: "Plinio Potyguara",
      role: "GERENTE",
      active: true,
    },
    create: {
      name: "Plinio Potyguara",
      email: "gerente@amazonika.com.br",
      passwordHash,
      role: "GERENTE",
      active: true,
    },
  });

  const gestor2 = await prisma.user.upsert({
    where: { email: "gestor2@amazonika.com.br" },
    update: {
      name: "Diego Pessoa",
      role: "GERENTE",
      active: true,
    },
    create: {
      name: "Diego Pessoa",
      email: "gestor2@amazonika.com.br",
      passwordHash,
      role: "GERENTE",
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "atendente@amazonika.com.br" },
    update: {
      name: "Atendente AMAZONIKA",
      role: "ATENDENTE",
      active: true,
    },
    create: {
      name: "Atendente AMAZONIKA",
      email: "atendente@amazonika.com.br",
      passwordHash,
      role: "ATENDENTE",
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "programador@amazonika.com.br" },
    update: {
      name: "Programador",
      role: "PROGRAMADOR",
      active: true,
    },
    create: {
      name: "Programador",
      email: "programador@amazonika.com.br",
      passwordHash,
      role: "PROGRAMADOR",
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: "cliente@teste.com" },
    update: {
      name: "Cliente de Teste",
      role: "CLIENTE",
      active: true,
    },
    create: {
      name: "Cliente de Teste",
      email: "cliente@teste.com",
      passwordHash,
      role: "CLIENTE",
      active: true,
    },
  });

  const services = [
    "Consultoria e Licenciamento Ambiental",
    "CAR - Cadastro Ambiental Rural",
    "Perícias Judiciais",
    "Avaliações de Imóveis Rurais e Urbanos",
    "Regularização Fundiária",
    "Topografia e Georreferenciamento",
    "Aerolevantamento com Drones",
    "Projetos Agropecuários",
    "Financiamento Rural / PRONAF",
    "Inventário e Manejo Florestal",
    "Segurança no Trabalho",
    "Consultoria Técnica e Gestão de Processos",
  ];

  for (const service of services) {
    const existing = await prisma.serviceType.findFirst({
      where: { name: service },
    });

    if (!existing) {
      await prisma.serviceType.create({
        data: {
          name: service,
          description: `Serviço de ${service}.`,
          active: true,
        },
      });
    }
  }

  await prisma.companySettings.upsert({
    where: { id: 1 },
    update: {
      companyName: "AMAZONIKA Engenharia",
      systemName: "SIS Amazonika",
      subtitle: "Gestão de Serviços Ambientais",
      alertEmail: "amazonika.protocolo@xxxxx.com",
      whatsapp: "+55 (96) 98803-6439",
      address: "Av. Almirante Barroso, 620-B, Centro, CEP: 68901-336",
      city: "Macapá",
      state: "AP",
      logoPath: "/brand/logo-amazonika.png",
    },
    create: {
      id: 1,
      companyName: "AMAZONIKA Engenharia",
      systemName: "SIS Amazonika",
      subtitle: "Gestão de Serviços Ambientais",
      alertEmail: "amazonika.protocolo@xxxxx.com",
      whatsapp: "+55 (96) 98803-6439",
      address: "Av. Almirante Barroso, 620-B, Centro, CEP: 68901-336",
      city: "Macapá",
      state: "AP",
      logoPath: "/brand/logo-amazonika.png",
    },
  });

  const licenciamento = await prisma.serviceType.findFirst({
    where: { name: "Consultoria e Licenciamento Ambiental" },
  });

  const topografia = await prisma.serviceType.findFirst({
    where: { name: "Topografia e Georreferenciamento" },
  });

  const client1 = await prisma.client.create({
    data: {
      name: "Fazenda Santa Clara",
      personType: "PJ",
      cpfCnpj: "00.000.000/0001-00",
      phone: "+55 (96) 98803-6439",
      whatsapp: "+55 (96) 98803-6439",
      email: "cliente1@teste.com",
      address: "Macapá/AP",
      city: "Macapá",
      state: "AP",
      notes: "Cliente de teste para georreferenciamento.",
    },
  });

  const client2 = await prisma.client.create({
    data: {
      name: "Agro Norte LTDA",
      personType: "PJ",
      cpfCnpj: "11.111.111/0001-11",
      phone: "+55 (96) 99999-9999",
      whatsapp: "+55 (96) 99999-9999",
      email: "agronorte@teste.com",
      address: "Macapá/AP",
      city: "Macapá",
      state: "AP",
      notes: "Cliente de teste para licenciamento ambiental.",
    },
  });

  if (topografia) {
    await prisma.protocol.create({
      data: {
        protocolNumber: "AMZ-2026-000001",
        clientId: client1.id,
        serviceTypeId: topografia.id,
        status: "EM_EXECUCAO",
        description: "Serviço de topografia e georreferenciamento rural.",
        estimatedValue: 24000,
        finalValue: 24000,
        deadlineDate: new Date("2026-06-30"),
        responsibleUserId: gerente.id,
        appointments: {
          create: {
            clientId: client1.id,
            managerUserId: gerente.id,
            scheduledAt: new Date("2026-05-20T09:00:00-03:00"),
            scheduledEndAt: new Date("2026-05-20T10:00:00-03:00"),
            meetingType: "Presencial",
            location: "AMAZONIKA - Macapá/AP",
            status: "AGENDADO",
          },
        },
        payments: {
          create: [
            {
              clientId: client1.id,
              description: "Entrada do contrato",
              amount: 12000,
              dueDate: new Date("2026-05-20"),
              paidDate: new Date("2026-05-20"),
              status: "PAGO",
              installmentNumber: 1,
              totalInstallments: 2,
            },
            {
              clientId: client1.id,
              description: "Parcela final",
              amount: 12000,
              dueDate: new Date("2026-06-30"),
              status: "PENDENTE",
              installmentNumber: 2,
              totalInstallments: 2,
            },
          ],
        },
      },
    });
  }

  if (licenciamento) {
    await prisma.protocol.create({
      data: {
        protocolNumber: "AMZ-2026-000002",
        clientId: client2.id,
        serviceTypeId: licenciamento.id,
        status: "CONTRATO_ENVIADO",
        description:
          "Licenciamento ambiental e acompanhamento de condicionantes.",
        estimatedValue: 12000,
        finalValue: 12000,
        deadlineDate: new Date("2026-07-15"),
        responsibleUserId: gestor2.id,
        appointments: {
          create: {
            clientId: client2.id,
            managerUserId: gestor2.id,
            scheduledAt: new Date("2026-05-21T10:00:00-03:00"),
            scheduledEndAt: new Date("2026-05-21T11:00:00-03:00"),
            meetingType: "Google Meet",
            meetingLink: "https://meet.google.com/teste",
            status: "AGENDADO",
          },
        },
        payments: {
          create: {
            clientId: client2.id,
            description: "Contrato de licenciamento ambiental",
            amount: 12000,
            dueDate: new Date("2026-05-28"),
            status: "PENDENTE",
          },
        },
      },
    });
  }

const smtpSettings = [
  ["SMTP_HOST", "smtp.hostinger.com", "SMTP"],
  ["SMTP_PORT", "465", "SMTP"],
  ["SMTP_USER", "amazonika@amazonikaengenharia.com.br", "SMTP"],
  ["SMTP_PASS", "@m@zoniK@2026", "SMTP"],
  [
    "SMTP_FROM",
    "SIS Amazonika <amazonika@amazonikaengenharia.com.br>",
    "SMTP",
  ],
  ["SMTP_SECURE", "true", "SMTP"],
  [
    "COMPANY_ALERT_EMAIL",
    "amazonika@amazonikaengenharia.com.br",
    "SMTP",
  ],
];

  for (const [key, value, group] of smtpSettings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: { value, group },
      create: { key, value, group },
    });
  }

  const companySettings = [
    ["COMPANY_NAME", "AMAZONIKA"],
    ["COMPANY_LEGAL_NAME", "AMAZONIKA Engenharia & Meio Ambiente"],
    ["COMPANY_CNPJ", "49.158.834/0001-19"],
    ["COMPANY_EMAIL", "contato@amazonika.com.br"],
    ["COMPANY_PHONE", ""],
    ["COMPANY_WHATSAPP", ""],
    ["COMPANY_WEBSITE", ""],
    ["COMPANY_ADDRESS", "Av. Almirante Barroso, 620-B, Centro"],
    ["COMPANY_CITY", "Macapá"],
    ["COMPANY_STATE", "AP"],
    ["COMPANY_ZIP_CODE", "68901-336"],
    [
      "COMPANY_FOOTER_TEXT",
      "Compromisso com soluções sustentáveis e responsabilidade ambiental.",
    ],
  ];

  for (const [key, value] of companySettings) {
    await prisma.systemSetting.upsert({
      where: { key },
      update: {
        value,
        group: "COMPANY",
      },
      create: {
        key,
        value,
        group: "COMPANY",
      },
    });
  }

const fixedCosts = [
  {
    description: "Aluguel",
    categoryName: "Aluguel",
    amount: 2800,
    dueDay: 10,
    notes: "Custo fixo mensal referente ao aluguel da estrutura administrativa.",
  },
  {
    description: "Internet",
    categoryName: "Internet",
    amount: 180,
    dueDay: 12,
    notes: "Internet utilizada nas atividades administrativas e operacionais.",
  },
  {
    description: "Contabilidade",
    categoryName: "Contabilidade",
    amount: 650,
    dueDay: 15,
    notes: "Honorários contábeis mensais.",
  },
  {
    description: "Energia",
    categoryName: "Energia",
    amount: 420,
    dueDay: 18,
    notes: "Estimativa mensal de energia elétrica.",
  },
  {
    description: "Softwares técnicos",
    categoryName: "Softwares técnicos",
    amount: 900,
    dueDay: 20,
    notes: "Licenças e ferramentas técnicas utilizadas pela equipe.",
  },
];

for (const cost of fixedCosts) {
  const category = await prisma.financialCategory.upsert({
    where: {
      name_type: {
        name: cost.categoryName,
        type: "DESPESA",
      },
    },
    update: {
      active: true,
    },
    create: {
      name: cost.categoryName,
      type: "DESPESA",
      active: true,
      color: "#64748b",
    },
  });

  await prisma.fixedCost.create({
    data: {
      description: cost.description,
      amount: cost.amount,
      dueDay: cost.dueDay,
      active: true,
      notes: cost.notes,
      category: {
        connect: {
          id: category.id,
        },
      },
    },
  });
}

  console.log("Seed executado com sucesso.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });