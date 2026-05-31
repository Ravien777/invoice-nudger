import { prisma } from "./prisma";
import { startOfDay, addDays, differenceInCalendarDays } from "date-fns";
import { cache } from "react";

export interface ForecastDay {
  date: string;
  dayOffset: number;
  expectedInflow: number;
  expectedExpenses: number;
  netCashFlow: number;
  cumulativeBalance: number;
  worstInflow: number;
  bestInflow: number;
  expectedInvoices: Array<{ clientName: string; amount: number; probability: number }>;
}

export interface ForecastWeek {
  weekStart: string;
  weekLabel: string;
  expectedIncome: number;
  expectedExpenses: number;
  netCashFlow: number;
  cumulativeBalance: number;
}

export interface ForecastResult {
  horizon: number;
  days: ForecastDay[];
  weeks: ForecastWeek[];
  totals: {
    expected: number;
    worst: number;
    best: number;
  };
  totalExpectedIncome: number;
  totalExpectedExpenses: number;
  totalNetCashFlow: number;
  sixtyDayBalance: number;
  sixtyDayDate: string;
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  topInvoices: Array<{ clientName: string; amount: number; probability: number; expectedAmount: number }>;
  generatedAt: string;
}

function monthsBetween(d1: Date, d2: Date): number {
  const yearDiff = d1.getFullYear() - d2.getFullYear();
  const monthDiff = d1.getMonth() - d2.getMonth();
  return yearDiff * 12 + monthDiff;
}

export const computeForecast = cache(async (userId: string, horizon: number = 90): Promise<ForecastResult> => {
  const today = startOfDay(new Date());
  const horizonDays = Math.min(horizon, 90);
  const numWeeks = Math.ceil(horizonDays / 7);

  const [invoices, recurringInvoices, recentExpenses] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId, status: { in: ["unpaid", "overdue"] } },
      select: { id: true, clientName: true, amount: true, dueDate: true, paymentProbability: true, clientEmail: true },
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

  // --- Client profiles for probability weighting ---
  const uniqueEmails = [...new Set(invoices.map((i) => i.clientEmail))];
  const profiles = await prisma.clientPaymentProfile.findMany({
    where: { userId, clientEmail: { in: uniqueEmails } },
    select: { clientEmail: true, avgDaysLate: true, paidInvoices: true, onTimePayments: true },
  });
  const profileMap = new Map(profiles.map((p) => [p.clientEmail, p]));

  // --- Expense projection ---
  const totalExpenseAmount = recentExpenses.reduce((sum, e) => sum + e.amount, 0);
  const monthlyExpense = recentExpenses.length > 0 ? totalExpenseAmount / 3 : 0;
  const dailyExpense = monthlyExpense / 30;

  // --- Income from invoices (daily granularity) ---
  const expectedDaily: number[] = new Array(horizonDays).fill(0);
  const worstDaily: number[] = new Array(horizonDays).fill(0);
  const bestDaily: number[] = new Array(horizonDays).fill(0);
  const expectedInvoicesDaily: Array<Array<{ clientName: string; amount: number; probability: number }>> =
    new Array(horizonDays).fill(null).map(() => []);

  for (const inv of invoices) {
    const prob = inv.paymentProbability ?? 0.7;
    const profile = profileMap.get(inv.clientEmail);
    const avgLateDays = profile?.avgDaysLate ?? 0;

    const bestDay = differenceInCalendarDays(inv.dueDate, today);
    if (bestDay >= 0 && bestDay < horizonDays) {
      bestDaily[bestDay] += inv.amount;
    }

    if (prob > 0.5) {
      const predictedDate = addDays(inv.dueDate, Math.round(avgLateDays));
      const predictedDay = differenceInCalendarDays(predictedDate, today);
      if (predictedDay >= 0 && predictedDay < horizonDays) {
        expectedDaily[predictedDay] += inv.amount * prob;
        expectedInvoicesDaily[predictedDay].push({
          clientName: inv.clientName,
          amount: inv.amount,
          probability: prob,
        });
      }
    }

    if (prob > 0.7) {
      const predictedDate = addDays(inv.dueDate, Math.round(avgLateDays));
      const predictedDay = differenceInCalendarDays(predictedDate, today);
      if (predictedDay >= 0 && predictedDay < horizonDays) {
        worstDaily[predictedDay] += inv.amount * prob;
      }
    }
  }

  // --- Income from recurring invoices ---
  const weeklyIncomeFromRecurring: number[] = new Array(numWeeks).fill(0);
  for (const inv of recurringInvoices) {
    const daysFromToday = differenceInCalendarDays(inv.nextRunDate, today);
    const weekIndex = Math.floor(daysFromToday / 7);
    if (weekIndex >= 0 && weekIndex < numWeeks) {
      weeklyIncomeFromRecurring[weekIndex] += inv.amount;
    }
  }

  // --- Build daily & weekly arrays ---
  const days: ForecastDay[] = [];
  const weeks: ForecastWeek[] = [];
  let cumulativeBalance = 0;

  for (let day = 0; day < horizonDays; day++) {
    const date = addDays(today, day);
    const weekIndex = Math.floor(day / 7);

    const inflow = expectedDaily[day];
    const expense = dailyExpense;
    const net = inflow - expense;
    cumulativeBalance += net;

    days.push({
      date: date.toISOString().split("T")[0],
      dayOffset: day,
      expectedInflow: inflow,
      expectedExpenses: Math.round(expense * 100) / 100,
      netCashFlow: Math.round(net * 100) / 100,
      cumulativeBalance: Math.round(cumulativeBalance * 100) / 100,
      worstInflow: worstDaily[day],
      bestInflow: bestDaily[day],
      expectedInvoices: expectedInvoicesDaily[day].slice(0, 5),
    });
  }

  // --- Weekly rollup ---
  for (let w = 0; w < numWeeks; w++) {
    const weekStart = addDays(today, w * 7);
    const weekDays = days.slice(w * 7, (w + 1) * 7);
    const income = weekDays.reduce((s, d) => s + d.expectedInflow, 0) + (weeklyIncomeFromRecurring[w] ?? 0);
    const expenses = weekDays.reduce((s, d) => s + d.expectedExpenses, 0);
    const netCashFlow = income - expenses;
    const lastDay = weekDays[weekDays.length - 1];

    weeks.push({
      weekStart: weekStart.toISOString().split("T")[0],
      weekLabel: `Week ${w + 1}`,
      expectedIncome: Math.round(income * 100) / 100,
      expectedExpenses: Math.round(expenses * 100) / 100,
      netCashFlow: Math.round(netCashFlow * 100) / 100,
      cumulativeBalance: lastDay?.cumulativeBalance ?? 0,
    });
  }

  // --- Totals ---
  const totalExpected = expectedDaily.reduce((a, b) => a + b, 0);
  const totalWorst = worstDaily.reduce((a, b) => a + b, 0);
  const totalBest = bestDaily.reduce((a, b) => a + b, 0);
  const totalIncomeFromRecurring = recurringInvoices.reduce((s, r) => s + r.amount, 0);
  const totalExpectedExpenses = dailyExpense * horizonDays;
  const totalExpectedIncome = totalExpected + totalIncomeFromRecurring;
  const totalNetCashFlow = totalExpectedIncome - totalExpectedExpenses;

  // --- Confidence ---
  const paidClients = await prisma.invoice.findMany({
    where: { userId, status: "paid" },
    select: { clientEmail: true },
    distinct: ["clientEmail"],
    take: 100,
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

  // --- 60-day balance ---
  const sixtyDayWeekIndex = Math.floor(60 / 7);
  const sixtyDayBalance = weeks[Math.min(sixtyDayWeekIndex, weeks.length - 1)]?.cumulativeBalance ?? 0;
  const sixtyDayDate = addDays(today, 60).toISOString().split("T")[0];

  // --- Top invoices ---
  const topInvoices = invoices
    .map((inv) => ({
      clientName: inv.clientName,
      amount: inv.amount,
      probability: inv.paymentProbability ?? 0.7,
      expectedAmount: inv.amount * (inv.paymentProbability ?? 0.7),
    }))
    .sort((a, b) => b.expectedAmount - a.expectedAmount)
    .slice(0, 5);

  return {
    horizon: horizonDays,
    days,
    weeks,
    totals: {
      expected: totalExpected,
      worst: totalWorst,
      best: totalBest,
    },
    totalExpectedIncome: Math.round(totalExpectedIncome * 100) / 100,
    totalExpectedExpenses: Math.round(totalExpectedExpenses * 100) / 100,
    totalNetCashFlow: Math.round(totalNetCashFlow * 100) / 100,
    sixtyDayBalance: Math.round(sixtyDayBalance * 100) / 100,
    sixtyDayDate,
    confidence,
    confidenceReason,
    topInvoices,
    generatedAt: new Date().toISOString(),
  };
});
