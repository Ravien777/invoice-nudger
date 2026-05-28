import { prisma } from "./prisma";

export async function autoMatchTransaction(transactionId: string): Promise<void> {
  const tx = await prisma.bankTransaction.findUnique({
    where: { id: transactionId },
  });
  if (!tx || tx.status !== "unmatched") return;

  if (tx.amount > 0) {
    await matchToInvoice(tx);
  } else {
    await matchToExpense(tx);
  }
}

async function matchToInvoice(tx: {
  id: string;
  userId: string;
  amount: number;
  date: Date;
  description: string;
}) {
  const tolerance = 0.01;
  const minAmount = tx.amount * (1 - tolerance);
  const maxAmount = tx.amount * (1 + tolerance);
  const startDate = new Date(tx.date.getTime() - 14 * 86400000);
  const endDate = new Date(tx.date.getTime() + 14 * 86400000);

  const candidates = await prisma.invoice.findMany({
    where: {
      userId: tx.userId,
      status: "unpaid",
      amount: { gte: minAmount, lte: maxAmount },
      dueDate: { gte: startDate, lte: endDate },
    },
    take: 2,
  });

  if (candidates.length === 1) {
    await prisma.bankTransaction.update({
      where: { id: tx.id },
      data: { matchedInvoiceId: candidates[0].id, status: "matched" },
    });
  }
}

async function matchToExpense(tx: {
  id: string;
  userId: string;
  amount: number;
  date: Date;
  description: string;
}) {
  const absAmount = Math.abs(tx.amount);
  const tolerance = 0.01;
  const minAmount = absAmount * (1 - tolerance);
  const maxAmount = absAmount * (1 + tolerance);
  const startDate = new Date(tx.date.getTime() - 3 * 86400000);
  const endDate = new Date(tx.date.getTime() + 3 * 86400000);

  const candidates = await prisma.expense.findMany({
    where: {
      userId: tx.userId,
      amount: { gte: minAmount, lte: maxAmount },
      date: { gte: startDate, lte: endDate },
    },
    take: 2,
  });

  if (candidates.length === 1) {
    await prisma.bankTransaction.update({
      where: { id: tx.id },
      data: { matchedExpenseId: candidates[0].id, status: "matched" },
    });
  }
}
