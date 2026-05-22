import { prisma } from "./prisma";
import { startOfDay, endOfDay, differenceInCalendarDays, subDays } from "date-fns";

export async function computeDailySummaryForUser(userId: string, date: Date) {
  const dayStart = startOfDay(date);
  const dayEnd = endOfDay(date);

  const invoicesDueToday = await prisma.invoice.findMany({
    where: {
      userId,
      dueDate: { gte: dayStart, lte: dayEnd },
    },
    select: { amount: true, clientEmail: true },
  });

  const invoicesPaidToday = await prisma.invoice.findMany({
    where: {
      userId,
      status: "paid",
      paidAt: { gte: dayStart, lte: dayEnd },
    },
    select: { amount: true, dueDate: true, paidAt: true, clientEmail: true },
  });

  const overdueInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: { in: ["unpaid", "overdue"] },
      dueDate: { lte: dayEnd },
    },
    select: { amount: true },
  });

  const unpaidAfterDue = await prisma.invoice.findMany({
    where: {
      userId,
      status: { in: ["unpaid", "overdue"] },
      dueDate: { lt: dayStart },
    },
    select: { amount: true },
  });

  const totalInvoices = invoicesDueToday.length;
  const paidInvoices = invoicesPaidToday.length;
  const overdueInvoicesCount = overdueInvoices.length;

  const totalAmount = invoicesDueToday.reduce((sum, inv) => sum + inv.amount, 0);
  const collectedAmount = invoicesPaidToday.reduce((sum, inv) => sum + inv.amount, 0);
  const overdueAmount = overdueInvoices.reduce((sum, inv) => sum + inv.amount, 0);

  let avgDaysToPay: number | null = null;
  const daysDiffs = invoicesPaidToday
    .map((inv) => {
      if (inv.paidAt && inv.dueDate) {
        return differenceInCalendarDays(inv.paidAt, inv.dueDate);
      }
      return null;
    })
    .filter((d): d is number => d !== null);

  if (daysDiffs.length > 0) {
    avgDaysToPay = daysDiffs.reduce((a, b) => a + b, 0) / daysDiffs.length;
  }

  const activeEmails = new Set([
    ...invoicesDueToday.map((i) => i.clientEmail),
    ...invoicesPaidToday.map((i) => i.clientEmail),
  ]);

  await prisma.invoiceDailySummary.upsert({
    where: { userId_date: { userId, date: dayStart } },
    create: {
      userId,
      date: dayStart,
      totalInvoices,
      paidInvoices,
      overdueInvoices: overdueInvoicesCount,
      totalAmount,
      collectedAmount,
      overdueAmount,
      avgDaysToPay,
      activeClientEmails: JSON.stringify([...activeEmails]),
    },
    update: {
      totalInvoices,
      paidInvoices,
      overdueInvoices: overdueInvoicesCount,
      totalAmount,
      collectedAmount,
      overdueAmount,
      avgDaysToPay,
      activeClientEmails: JSON.stringify([...activeEmails]),
    },
  });
}

export async function computeClientProfilesForUser(userId: string) {
  const invoices = await prisma.invoice.findMany({
    where: { userId },
    select: {
      clientEmail: true,
      status: true,
      amount: true,
      dueDate: true,
      paidAt: true,
    },
  });

  const grouped = new Map<string, {
    totalInvoices: number;
    paidInvoices: number;
    onTimePayments: number;
    totalAmount: number;
    lateDays: number[];
    lastPaymentDate: Date | null;
  }>();

  for (const inv of invoices) {
    const group = grouped.get(inv.clientEmail) || {
      totalInvoices: 0,
      paidInvoices: 0,
      onTimePayments: 0,
      totalAmount: 0,
      lateDays: [] as number[],
      lastPaymentDate: null as Date | null,
    };
    group.totalInvoices++;
    group.totalAmount += inv.amount;

    if (inv.status === "paid") {
      group.paidInvoices++;
      if (inv.paidAt) {
        if (!group.lastPaymentDate || inv.paidAt > group.lastPaymentDate) {
          group.lastPaymentDate = inv.paidAt;
        }
        const daysLate = differenceInCalendarDays(inv.paidAt, inv.dueDate);
        if (daysLate <= 0) {
          group.onTimePayments++;
        } else {
          group.lateDays.push(daysLate);
        }
      } else {
        group.onTimePayments++;
      }
    }

    grouped.set(inv.clientEmail, group);
  }

  for (const [clientEmail, data] of grouped) {
    const avgDaysLate = data.lateDays.length > 0
      ? data.lateDays.reduce((a, b) => a + b, 0) / data.lateDays.length
      : null;

    const onTimeRatio = data.paidInvoices > 0
      ? data.onTimePayments / data.paidInvoices
      : 0;

    const riskScore = computeRiskScore(onTimeRatio, avgDaysLate);

    await prisma.clientPaymentProfile.upsert({
      where: { userId_clientEmail: { userId, clientEmail } },
      create: {
        userId,
        clientEmail,
        totalInvoices: data.totalInvoices,
        paidInvoices: data.paidInvoices,
        onTimePayments: data.onTimePayments,
        totalAmount: data.totalAmount,
        avgDaysLate,
        lastPaymentDate: data.lastPaymentDate,
        riskScore,
      },
      update: {
        totalInvoices: data.totalInvoices,
        paidInvoices: data.paidInvoices,
        onTimePayments: data.onTimePayments,
        totalAmount: data.totalAmount,
        avgDaysLate,
        lastPaymentDate: data.lastPaymentDate,
        riskScore,
      },
    });
  }
}

export function computeRiskScore(onTimeRatio: number, avgDaysLate: number | null): number {
  const lateFactor = avgDaysLate !== null ? Math.min(avgDaysLate, 30) / 30 : 0;
  const score = (1 - onTimeRatio) * 0.7 + lateFactor * 0.3;
  return Math.min(Math.max(score, 0), 1);
}

export async function computeIndustryBenchmarks() {
  const usersWithIndustry = await prisma.user.findMany({
    where: { industry: { not: null } },
    select: { id: true, industry: true },
  });

  const industryCount = new Map<string, number>();
  for (const u of usersWithIndustry) {
    const ind = u.industry as string;
    industryCount.set(ind, (industryCount.get(ind) || 0) + 1);
  }

  for (const [industry, count] of industryCount) {
    if (count < 10) continue;

    const userIds = usersWithIndustry
      .filter((u) => u.industry === industry)
      .map((u) => u.id);

    const paidInvoices = await prisma.invoice.findMany({
      where: { userId: { in: userIds }, status: "paid", paidAt: { not: null } },
      select: { dueDate: true, paidAt: true },
    });

    const allInvoicesCount = await prisma.invoice.count({
      where: { userId: { in: userIds } },
    });

    const paidCount = paidInvoices.length;

    const daysToPay = paidInvoices
      .map((inv) => differenceInCalendarDays(inv.paidAt!, inv.dueDate))
      .filter((d) => d !== null);

    const avgDaysToPay = daysToPay.length > 0
      ? daysToPay.reduce((a, b) => a + b, 0) / daysToPay.length
      : 0;

    const lateCount = daysToPay.filter((d) => d > 0).length;
    const latePaymentPercentage = paidCount > 0 ? (lateCount / paidCount) * 100 : 0;

    const oldInvoices = await prisma.invoice.count({
      where: {
        userId: { in: userIds },
        createdAt: { lte: subDays(new Date(), 90) },
      },
    });

    const oldPaidInvoices = await prisma.invoice.count({
      where: {
        userId: { in: userIds },
        status: "paid",
        createdAt: { lte: subDays(new Date(), 90) },
      },
    });

    const collectionRate = oldInvoices > 0 ? (oldPaidInvoices / oldInvoices) * 100 : 0;

    const amountResult = await prisma.invoice.aggregate({
      where: { userId: { in: userIds } },
      _avg: { amount: true },
    });
    const averageInvoiceAmount = amountResult._avg.amount || 0;

    const metrics: Array<{ metric: string; value: number }> = [
      { metric: "avg_days_to_pay", value: avgDaysToPay },
      { metric: "collection_rate", value: collectionRate },
      { metric: "late_payment_percentage", value: latePaymentPercentage },
      { metric: "average_invoice_amount", value: averageInvoiceAmount },
    ];

    for (const { metric, value } of metrics) {
      await prisma.industryBenchmark.upsert({
        where: { industry_metric_computedAt: { industry, metric, computedAt: new Date() } },
        create: { industry, metric, value, sampleSize: count, computedAt: new Date() },
        update: { value, sampleSize: count, computedAt: new Date() },
      });
    }
  }
}

export async function computeAllAnalyticsForUser(userId: string) {
  const yesterday = subDays(new Date(), 1);
  await computeDailySummaryForUser(userId, yesterday);
  await computeClientProfilesForUser(userId);
}

export async function computeAllAnalytics() {
  const users = await prisma.user.findMany({ select: { id: true } });
  const yesterday = subDays(new Date(), 1);

  for (const user of users) {
    await computeDailySummaryForUser(user.id, yesterday);
    await computeClientProfilesForUser(user.id);
  }

  await computeIndustryBenchmarks();
}
