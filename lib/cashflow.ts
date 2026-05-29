import { prisma } from "./prisma";
import { startOfDay, addDays, differenceInCalendarDays } from "date-fns";

export interface CashflowWeek {
  weekStart: string;
  weekLabel: string;
  expectedIncome: number;
  expectedExpenses: number;
  netCashFlow: number;
  cumulativeBalance: number;
}

export interface CashflowResult {
  weeks: CashflowWeek[];
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  totalExpectedIncome: number;
  totalExpectedExpenses: number;
  totalNetCashFlow: number;
  sixtyDayBalance: number;
  sixtyDayDate: string;
  generatedAt: string;
}

function monthsBetween(d1: Date, d2: Date): number {
  const yearDiff = d1.getFullYear() - d2.getFullYear();
  const monthDiff = d1.getMonth() - d2.getMonth();
  return yearDiff * 12 + monthDiff;
}

export async function computeCashflowForecast(userId: string): Promise<CashflowResult> {
  const today = startOfDay(new Date());
  const horizonDays = 90;
  const numWeeks = Math.ceil(horizonDays / 7);

  const [openInvoices, recurringInvoices, recentExpenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId, status: { in: ["unpaid", "overdue"] } },
      select: { amount: true, paymentProbability: true, dueDate: true },
    }),
    prisma.recurringInvoice.findMany({
      where: {
        userId,
        status: "active",
        nextRunDate: { lte: addDays(today, horizonDays) },
      },
      select: { amount: true, nextRunDate: true, clientName: true },
    }),
    prisma.expense.findMany({
      where: {
        userId,
        status: "confirmed",
        date: { gte: addDays(today, -90) },
      },
      select: { amount: true, date: true },
    }),
  ]);

  const weeklyIncomeFromInvoices: number[] = new Array(numWeeks).fill(0);
  for (const inv of openInvoices) {
    const prob = inv.paymentProbability ?? 0.7;
    const expectedAmount = inv.amount * prob;
    const daysFromToday = differenceInCalendarDays(inv.dueDate, today);
    const weekIndex = Math.floor(daysFromToday / 7);
    if (weekIndex >= 0 && weekIndex < numWeeks) {
      weeklyIncomeFromInvoices[weekIndex] += expectedAmount;
    }
  }

  const weeklyIncomeFromRecurring: number[] = new Array(numWeeks).fill(0);
  for (const inv of recurringInvoices) {
    const daysFromToday = differenceInCalendarDays(inv.nextRunDate, today);
    const weekIndex = Math.floor(daysFromToday / 7);
    if (weekIndex >= 0 && weekIndex < numWeeks) {
      weeklyIncomeFromRecurring[weekIndex] += inv.amount;
    }
  }

  const totalExpenseAmount = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpense = recentExpenses.length > 0 ? totalExpenseAmount / 3 : 0;
  const weeklyExpense = monthlyExpense / 4.33;

  const totalExpectedIncome =
    openInvoices.reduce((sum, inv) => sum + inv.amount * (inv.paymentProbability ?? 0.7), 0) +
    recurringInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  const weeks: CashflowWeek[] = [];
  let cumulativeBalance = 0;

  for (let w = 0; w < numWeeks; w++) {
    const weekStart = addDays(today, w * 7);
    const income = (weeklyIncomeFromInvoices[w] ?? 0) + (weeklyIncomeFromRecurring[w] ?? 0);
    const expenses = weeklyExpense;
    const netCashFlow = income - expenses;
    cumulativeBalance += netCashFlow;

    weeks.push({
      weekStart: weekStart.toISOString().split("T")[0],
      weekLabel: `Week ${w + 1}`,
      expectedIncome: Math.round(income * 100) / 100,
      expectedExpenses: Math.round(expenses * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      cumulativeBalance: Math.round(cumulativeBalance * 100) / 100,
    });
  }

  const paidClients = await prisma.invoice.findMany({
    where: { userId, status: "paid" },
    select: { clientEmail: true },
    distinct: ["clientEmail"],
  });

  const oldestPaid = await prisma.invoice.findFirst({
    where: { userId, status: "paid" },
    orderBy: { paidAt: "asc" },
    select: { paidAt: true },
  });

  let confidence: "high" | "medium" | "low";
  let confidenceReason: string;

  if (oldestPaid?.paidAt) {
    const monthsOfData = monthsBetween(today, oldestPaid.paidAt);
    if (monthsOfData >= 6 && paidClients.length >= 5) {
      confidence = "high";
      confidenceReason = `Based on ${monthsOfData} months of payment history across ${paidClients.length} clients.`;
    } else if (monthsOfData >= 3) {
      confidence = "medium";
      confidenceReason = `Based on ${monthsOfData} months of payment history across ${paidClients.length} clients. More history improves accuracy.`;
    } else {
      confidence = "low";
      confidenceReason = `Limited payment history (${monthsOfData} months). Forecast accuracy will improve over time.`;
    }
  } else {
    confidence = "low";
    confidenceReason = "No paid invoice history yet. Forecast accuracy will improve as you collect payments.";
  }

  const sixtyDayWeekIndex = Math.floor(60 / 7);
  const sixtyDayBalance = weeks[Math.min(sixtyDayWeekIndex, weeks.length - 1)]?.cumulativeBalance ?? 0;
  const sixtyDayDate = addDays(today, 60).toISOString().split("T")[0];

  const totalExpectedExpenses = weeklyExpense * numWeeks;
  const totalNetCashFlow = totalExpectedIncome - totalExpectedExpenses;

  return {
    weeks,
    confidence,
    confidenceReason,
    totalExpectedIncome: Math.round(totalExpectedIncome * 100) / 100,
    totalExpectedExpenses: Math.round(totalExpectedExpenses * 100) / 100,
    totalNetCashFlow: Math.round(totalNetCashFlow * 100) / 100,
    sixtyDayBalance: Math.round(sixtyDayBalance * 100) / 100,
    sixtyDayDate,
    generatedAt: new Date().toISOString(),
  };
}
