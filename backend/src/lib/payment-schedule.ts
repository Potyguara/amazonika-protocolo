import { assertPrismaIntCents } from "./money";

/** Snapshot between the two existing cents models. Never passes through reais. */
export function copyPaymentSchedule<T extends {
  type: string;
  installmentNumber: number;
  totalInstallments: number | null;
  amountCents: number;
  dueDate: Date;
}>(rows: readonly T[]) {
  return rows.map(row => {
    const amountCents = assertPrismaIntCents(row.amountCents);
    if (amountCents <= 0) throw new RangeError("A etapa financeira deve ser positiva.");
    return {
      type: row.type as T["type"],
      installmentNumber: row.installmentNumber,
      totalInstallments: row.totalInstallments,
      amountCents,
      dueDate: row.dueDate,
    };
  });
}
