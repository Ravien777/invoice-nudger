import { prisma } from "./prisma";
import {
  startOfMonth,
  subMonths,
  differenceInCalendarDays,
} from "date-fns";

export interface SignalScore {
  score: number;
  maxScore: number;
  details: string;
}

export interface HealthScoreBreakdown {
  collectionRate: SignalScore;
  avgDaysToPay: SignalScore;
  revenueConsistency: SignalScore;
  expenseRatio: SignalScore;
  taxReserve: SignalScore;
}

export interface BusinessHealthResult {
  score: number;
  breakdown: HealthScoreBreakdown;
  tips: string[];
}

export function computeCollectionRateScore(
  paidInvoices: number,
  totalInvoices: number,
): SignalScore {
  const rate = totalInvoices > 0 ? paidInvoices / totalInvoices : 0;
  let score: number;
  if (rate >= 0.95) score = 30;
  else if (rate >= 0.8) score = 24;
  else if (rate >= 0.6) score = 18;
  else if (rate >= 0.4) score = 10;
  else score = 5;
  return {
    score,
    maxScore: 30,
    details: `Collection rate: ${(rate * 100).toFixed(0)}% (${paidInvoices}/${totalInvoices} invoices paid)`,
  };
}

export function computeAvgDaysToPayScore(avgDays: number | null): SignalScore {
  if (avgDays === null) {
    return { score: 10, maxScore: 20, details: "No payment history yet — partial score" };
  }
  let score: number;
  if (avgDays < 20) score = 20;
  else if (avgDays < 35) score = 15;
  else if (avgDays < 50) score = 10;
  else score = 5;
  return {
    score,
    maxScore: 20,
    details: `Avg days to pay: ${avgDays.toFixed(0)} days`,
  };
}

export function computeRevenueConsistencyScore(
  monthlyRevenue: number[],
): SignalScore {
  if (monthlyRevenue.length === 0) {
    return { score: 0, maxScore: 20, details: "No revenue data available" };
  }
  const monthsAvailable = monthlyRevenue.length;
  const maxMonths = 6;
  const prorationFactor = Math.min(monthsAvailable / maxMonths, 1);

  if (monthsAvailable < 2) {
    return {
      score: Math.round(10 * prorationFactor),
      maxScore: 20,
      details: `Only ${monthsAvailable} month(s) of data — prorated score`,
    };
  }

  const mean =
    monthlyRevenue.reduce((a, b) => a + b, 0) / monthlyRevenue.length;
  const variance =
    monthlyRevenue.reduce((sum, val) => sum + (val - mean) ** 2, 0) /
    monthlyRevenue.length;
  const stdDev = Math.sqrt(variance);
  const cv = mean > 0 ? stdDev / mean : 1;

  let baseScore: number;
  if (cv < 0.2) baseScore = 20;
  else if (cv < 0.4) baseScore = 15;
  else if (cv < 0.6) baseScore = 10;
  else if (cv < 0.8) baseScore = 5;
  else baseScore = 0;

  const score = Math.round(baseScore * prorationFactor);
  return {
    score,
    maxScore: 20,
    details: `Revenue CV: ${(cv * 100).toFixed(0)}% over ${monthsAvailable} months`,
  };
}

export function computeExpenseRatioScore(
  totalExpenses: number,
  totalIncome: number,
): SignalScore {
  if (totalIncome === 0) {
    return { score: 10, maxScore: 15, details: "No income yet — partial score" };
  }
  const ratio = totalExpenses / totalIncome;
  let score: number;
  if (ratio < 0.3) score = 15;
  else if (ratio < 0.5) score = 10;
  else if (ratio < 0.7) score = 5;
  else score = 0;
  return {
    score,
    maxScore: 15,
    details: `Expense ratio: ${(ratio * 100).toFixed(0)}% of income`,
  };
}

export function computeTaxReserveScore(
  hasAllocationProfile: boolean,
  hasAllocationRecords: boolean,
): SignalScore {
  if (hasAllocationProfile && hasAllocationRecords) {
    return {
      score: 15,
      maxScore: 15,
      details: "Tax reserves actively tracked",
    };
  }
  if (hasAllocationProfile) {
    return {
      score: 7,
      maxScore: 15,
      details: "Allocation profile set but no records yet",
    };
  }
  return {
    score: 0,
    maxScore: 15,
    details: "No tax reserve tracking enabled",
  };
}

export function generateTips(
  breakdown: HealthScoreBreakdown,
): string[] {
  const tips: string[] = [];
  if (breakdown.collectionRate.score < 24) {
    tips.push(
      `You're collecting ${breakdown.collectionRate.details}. Try sending reminders earlier or requiring a deposit upfront.`,
    );
  }
  if (breakdown.avgDaysToPay.score < 15) {
    tips.push(
      `Clients are paying in ${breakdown.avgDaysToPay.details}. Consider offering early payment discounts or tightening payment terms.`,
    );
  }
  if (breakdown.revenueConsistency.score < 10) {
    tips.push(
      "Your revenue varies significantly month to month. Recurring retainers can help smooth out cash flow.",
    );
  }
  if (breakdown.expenseRatio.score < 10) {
    tips.push(
      `Your expenses are ${breakdown.expenseRatio.details}. Review subscriptions and non-essential spending.`,
    );
  }
  if (breakdown.taxReserve.score < 7) {
    tips.push(
      "Set up income allocation to automatically track tax reserves and avoid a surprise tax bill.",
    );
  }
  return tips;
}

export async function getMonthlyRevenue(
  userId: string,
  months: number = 6,
): Promise<number[]> {
  const revenues: number[] = [];
  const now = new Date();
  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i));
    const monthEnd = startOfMonth(subMonths(now, i - 1));
    const result = await prisma.invoice.aggregate({
      where: {
        userId,
        status: "paid",
        paidAt: { gte: monthStart, lt: monthEnd },
      },
      _sum: { amount: true },
    });
    revenues.push(result._sum.amount ?? 0);
  }
  return revenues;
}

export async function calculateBusinessHealthScore(
  userId: string,
): Promise<BusinessHealthResult> {
  const [
    totalInvoiceCount,
    paidInvoiceCount,
    allInvoices,
    expenseAgg,
    profiles,
    allocationProfile,
    allocationRecordCount,
    monthlyRevenue,
  ] = await Promise.all([
    prisma.invoice.count({ where: { userId } }),
    prisma.invoice.count({ where: { userId, status: "paid" } }),
    prisma.invoice.findMany({
      where: { userId, status: "paid", paidAt: { not: null } },
      select: { amount: true, paidAt: true, dueDate: true },
    }),
    prisma.expense.aggregate({
      where: { userId },
      _sum: { amount: true },
    }),
    prisma.clientPaymentProfile.findMany({
      where: { userId },
      select: { avgDaysLate: true },
    }),
    prisma.allocationProfile.findUnique({ where: { userId } }),
    prisma.allocationRecord.count({ where: { userId } }),
    getMonthlyRevenue(userId),
  ]);

  const totalIncome = allInvoices.reduce((sum, inv) => sum + inv.amount, 0);
  const totalExpenses = expenseAgg._sum.amount ?? 0;

  const lateDays = allInvoices
    .map((inv) => differenceInCalendarDays(inv.paidAt!, inv.dueDate));
  const avgDaysLate =
    lateDays.length > 0
      ? lateDays.reduce((a, b) => a + b, 0) / lateDays.length
      : profiles.length > 0
        ? profiles.reduce((sum, p) => sum + (p.avgDaysLate ?? 0), 0) /
          profiles.length
        : null;

  const collectionRate = computeCollectionRateScore(
    paidInvoiceCount,
    totalInvoiceCount,
  );
  const avgDaysToPay = computeAvgDaysToPayScore(avgDaysLate);
  const revenueConsistency = computeRevenueConsistencyScore(monthlyRevenue);
  const expenseRatio = computeExpenseRatioScore(totalExpenses, totalIncome);
  const taxReserve = computeTaxReserveScore(
    allocationProfile !== null,
    allocationRecordCount > 0,
  );

  const breakdown: HealthScoreBreakdown = {
    collectionRate,
    avgDaysToPay,
    revenueConsistency,
    expenseRatio,
    taxReserve,
  };

  const score = Math.min(
    Math.round(
      collectionRate.score +
        avgDaysToPay.score +
        revenueConsistency.score +
        expenseRatio.score +
        taxReserve.score,
    ),
    100,
  );

  const tips = generateTips(breakdown);

  return { score, breakdown, tips };
}
