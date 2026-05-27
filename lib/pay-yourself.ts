import { prisma } from "./prisma";

const OWNER_PAY_PERCENT = 0.4;

export interface PayYourselfResult {
  available: number;
  recommended: number;
  lastPaymentDate: Date | null;
}

export async function calculatePayYourselfAmount(
  userId: string,
): Promise<PayYourselfResult> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { lastPayYourselfDate: true, taxRate: true },
  });

  if (!user) {
    return { available: 0, recommended: 0, lastPaymentDate: null };
  }

  const paidInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: "paid",
      paidAt: user.lastPayYourselfDate
        ? { gt: user.lastPayYourselfDate }
        : { not: null },
    },
    select: { amount: true },
  });

  const totalPaid = paidInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const available = totalPaid * OWNER_PAY_PERCENT;

  return {
    available: Math.round(available * 100) / 100,
    recommended: Math.round(available * 100) / 100,
    lastPaymentDate: user.lastPayYourselfDate,
  };
}
