import { prisma } from "./prisma";

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
    select: { lastPayYourselfDate: true },
  });

  if (!user) {
    return { available: 0, recommended: 0, lastPaymentDate: null };
  }

  const allocationRecords = await prisma.allocationRecord.findMany({
    where: {
      userId,
      ...(user.lastPayYourselfDate
        ? { createdAt: { gt: user.lastPayYourselfDate } }
        : {}),
    },
    select: { ownerPayAmount: true },
  });

  const available = allocationRecords.reduce((sum, r) => sum + r.ownerPayAmount, 0);

  return {
    available: Math.round(available * 100) / 100,
    recommended: Math.round(available * 100) / 100,
    lastPaymentDate: user.lastPayYourselfDate,
  };
}
