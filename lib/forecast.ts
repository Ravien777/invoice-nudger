import { prisma } from "./prisma";
import { addDays, differenceInCalendarDays, startOfDay } from "date-fns";

export interface ForecastDay {
  date: string;
  dayOffset: number;
  expectedInflow: number;
  worstInflow: number;
  bestInflow: number;
  expectedInvoices: Array<{ clientName: string; amount: number; probability: number }>;
}

export interface ForecastResult {
  horizon: number;
  days: ForecastDay[];
  totals: {
    expected: number;
    worst: number;
    best: number;
  };
  topInvoices: Array<{ clientName: string; amount: number; probability: number; expectedAmount: number }>;
  generatedAt: string;
}

export async function computeForecast(userId: string, horizon: number = 90): Promise<ForecastResult> {
  const invoices = await prisma.invoice.findMany({
    where: { userId, status: { in: ["unpaid", "overdue"] } },
    select: { id: true, clientName: true, amount: true, dueDate: true, paymentProbability: true, clientEmail: true },
  });

  const uniqueEmails = [...new Set(invoices.map((i) => i.clientEmail))];
  const profiles = await prisma.clientPaymentProfile.findMany({
    where: { userId, clientEmail: { in: uniqueEmails } },
    select: { clientEmail: true, avgDaysLate: true, paidInvoices: true, onTimePayments: true },
  });
  const profileMap = new Map(profiles.map((p) => [p.clientEmail, p]));

  const today = startOfDay(new Date());
  const horizonDays = Math.min(horizon, 90);

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

  const days: ForecastDay[] = [];

  for (let day = 0; day < horizonDays; day++) {
    const date = addDays(today, day);

    days.push({
      date: date.toISOString().split("T")[0],
      dayOffset: day,
      expectedInflow: expectedDaily[day],
      worstInflow: worstDaily[day],
      bestInflow: bestDaily[day],
      expectedInvoices: expectedInvoicesDaily[day].slice(0, 5),
    });
  }

  const totalExpected = expectedDaily.reduce((a, b) => a + b, 0);
  const totalWorst = worstDaily.reduce((a, b) => a + b, 0);
  const totalBest = bestDaily.reduce((a, b) => a + b, 0);

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
    totals: {
      expected: totalExpected,
      worst: totalWorst,
      best: totalBest,
    },
    topInvoices,
    generatedAt: new Date().toISOString(),
  };
}
