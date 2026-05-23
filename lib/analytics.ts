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

async function computeMetricsForUserIds(userIds: string[]): Promise<{
  avgDaysToPay: number;
  collectionRate: number;
  latePaymentPercentage: number;
  averageInvoiceAmount: number;
  paidCount: number;
}> {
  const paidInvoices = await prisma.invoice.findMany({
    where: { userId: { in: userIds }, status: "paid", paidAt: { not: null } },
    select: { dueDate: true, paidAt: true },
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

  return {
    avgDaysToPay,
    collectionRate,
    latePaymentPercentage,
    averageInvoiceAmount: amountResult._avg.amount || 0,
    paidCount,
  };
}

async function storeBenchmarks(industry: string, sampleSize: number, metrics: {
  avgDaysToPay: number;
  collectionRate: number;
  latePaymentPercentage: number;
  averageInvoiceAmount: number;
}) {
  const entries: Array<{ metric: string; value: number }> = [
    { metric: "avg_days_to_pay", value: metrics.avgDaysToPay },
    { metric: "collection_rate", value: metrics.collectionRate },
    { metric: "late_payment_percentage", value: metrics.latePaymentPercentage },
    { metric: "average_invoice_amount", value: metrics.averageInvoiceAmount },
  ];

  for (const { metric, value } of entries) {
    await prisma.industryBenchmark.upsert({
      where: { industry_metric_computedAt: { industry, metric, computedAt: new Date() } },
      create: { industry, metric, value, sampleSize, computedAt: new Date() },
      update: { value, sampleSize, computedAt: new Date() },
    });
  }
}

export async function computeIndustryBenchmarks() {
  const optedInUsers = await prisma.user.findMany({
    where: { benchmarksOptOut: false },
    select: { id: true, industry: true },
  });

  const optedInWithIndustry = optedInUsers.filter((u) => u.industry !== null);

  const industryCount = new Map<string, number>();
  for (const u of optedInWithIndustry) {
    const ind = u.industry as string;
    industryCount.set(ind, (industryCount.get(ind) || 0) + 1);
  }

  for (const [industry, count] of industryCount) {
    if (count < 10) continue;

    const userIds = optedInWithIndustry
      .filter((u) => u.industry === industry)
      .map((u) => u.id);

    const metrics = await computeMetricsForUserIds(userIds);
    await storeBenchmarks(industry, count, metrics);
  }

  const allCount = optedInUsers.length;
  if (allCount >= 10) {
    const allIds = optedInUsers.map((u) => u.id);
    const allMetrics = await computeMetricsForUserIds(allIds);
    await storeBenchmarks("all", allCount, allMetrics);
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

export function calculatePaymentProbability(
  clientProfile: {
    paidInvoices: number;
    onTimePayments: number;
    avgDaysLate: number | null;
  } | null,
  invoice: { dueDate: Date; amount: number }
): number {
  if (!clientProfile || clientProfile.paidInvoices === 0) {
    return 0.7;
  }

  const onTimeRatio = clientProfile.paidInvoices > 0
    ? clientProfile.onTimePayments / clientProfile.paidInvoices
    : 0.5;

  const avgDaysLate = clientProfile.avgDaysLate ?? 0;
  const cappedDaysLate = Math.min(avgDaysLate, 30);

  let probability = 1 - ((1 - onTimeRatio) * 0.6 + (cappedDaysLate / 30) * 0.4);

  const daysUntilDue = differenceInCalendarDays(invoice.dueDate, new Date());
  if (daysUntilDue < 0) {
    const overduePenalty = Math.min(Math.abs(daysUntilDue) / 30, 1) * 0.2;
    probability = probability * (1 - overduePenalty);
  }

  return Math.max(0, Math.min(1, probability));
}

export async function computePaymentProbabilityForInvoice(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, userId: true, clientEmail: true, dueDate: true, amount: true, status: true },
  });

  if (!invoice || invoice.status === "paid" || invoice.status === "cancelled") return;

  const profile = await prisma.clientPaymentProfile.findUnique({
    where: { userId_clientEmail: { userId: invoice.userId, clientEmail: invoice.clientEmail } },
  });

  const probability = calculatePaymentProbability(profile, invoice);

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: { paymentProbability: probability },
  });
}

export async function recomputePaymentProbabilitiesForClient(userId: string, clientEmail: string) {
  const profile = await prisma.clientPaymentProfile.findUnique({
    where: { userId_clientEmail: { userId, clientEmail } },
  });

  const openInvoices = await prisma.invoice.findMany({
    where: { userId, clientEmail, status: { notIn: ["paid", "cancelled"] } },
    select: { id: true, dueDate: true, amount: true },
  });

  for (const inv of openInvoices) {
    const probability = calculatePaymentProbability(profile, inv);
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { paymentProbability: probability },
    });
  }
}

export async function recomputePaymentProbabilitiesForUser(userId: string) {
  const openInvoices = await prisma.invoice.findMany({
    where: { userId, status: { notIn: ["paid", "cancelled"] } },
    select: { id: true, clientEmail: true, dueDate: true, amount: true },
  });

  const profileCache = new Map<string, Awaited<ReturnType<typeof prisma.clientPaymentProfile.findUnique>>>();

  for (const inv of openInvoices) {
    if (!profileCache.has(inv.clientEmail)) {
      const profile = await prisma.clientPaymentProfile.findUnique({
        where: { userId_clientEmail: { userId, clientEmail: inv.clientEmail } },
      });
      profileCache.set(inv.clientEmail, profile);
    }
    const profile = profileCache.get(inv.clientEmail)!;
    const probability = calculatePaymentProbability(profile, inv);
    await prisma.invoice.update({
      where: { id: inv.id },
      data: { paymentProbability: probability },
    });
  }
}

export async function recomputePaymentProbabilitiesForAll() {
  const users = await prisma.user.findMany({ select: { id: true } });
  for (const user of users) {
    await recomputePaymentProbabilitiesForUser(user.id);
  }
}

export interface CollectionEfficiencyMetrics {
  overall: {
    totalPaidWithReminders: number;
    avgDaysReminderToPayment: number | null;
    paidWithin3Days: number;
    paidWithin24h: number;
    paidWithin7Days: number;
    within3DaysRate: number | null;
    within24hRate: number | null;
    within7DaysRate: number | null;
  };
  byTemplate: Array<{
    template: string;
    timesSent: number;
    paymentsWithin3Days: number;
    conversionRate: number | null;
  }>;
  byChannel: Array<{
    channel: string;
    timesSent: number;
    paymentsWithin3Days: number;
    conversionRate: number | null;
  }>;
}

export async function computeCollectionEfficiencyForUser(userId: string): Promise<CollectionEfficiencyMetrics> {
  const reminders = await prisma.reminderLog.findMany({
    where: { invoice: { userId } },
    orderBy: { sentAt: "asc" },
    select: {
      id: true,
      invoiceId: true,
      sentAt: true,
      stepName: true,
      channel: true,
      invoice: {
        select: {
          id: true,
          status: true,
          paidAt: true,
        },
      },
    },
  });

  const paidInvoices = await prisma.invoice.findMany({
    where: { userId, status: "paid", paidAt: { not: null } },
    select: { id: true, paidAt: true },
  });

  const paidIds = new Set(paidInvoices.map((i) => i.id));

  const reminderByInvoice = new Map<string, typeof reminders>();
  for (const r of reminders) {
    const list = reminderByInvoice.get(r.invoiceId) || [];
    list.push(r);
    reminderByInvoice.set(r.invoiceId, list);
  }

  let totalPaidWithReminders = 0;
  let totalDaysReminderToPayment = 0;
  let paidWithin3Days = 0;
  let paidWithin24h = 0;
  let paidWithin7Days = 0;

  for (const [invId, invReminders] of reminderByInvoice) {
    if (!paidIds.has(invId)) continue;
    const lastReminder = invReminders[invReminders.length - 1];
    const paidAt = paidInvoices.find((i) => i.id === invId)?.paidAt;
    if (!paidAt || !lastReminder) continue;

    totalPaidWithReminders++;
    const diffMs = paidAt.getTime() - lastReminder.sentAt.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    totalDaysReminderToPayment += diffDays;

    if (diffDays <= 1) paidWithin24h++;
    if (diffDays <= 3) paidWithin3Days++;
    if (diffDays <= 7) paidWithin7Days++;
  }

  const avgDaysReminderToPayment = totalPaidWithReminders > 0
    ? totalDaysReminderToPayment / totalPaidWithReminders
    : null;

  const within3DaysRate = totalPaidWithReminders > 0 ? paidWithin3Days / totalPaidWithReminders : null;
  const within24hRate = totalPaidWithReminders > 0 ? paidWithin24h / totalPaidWithReminders : null;
  const within7DaysRate = totalPaidWithReminders > 0 ? paidWithin7Days / totalPaidWithReminders : null;

  const templateMap = new Map<string, { timesSent: number; paymentsWithin3Days: number }>();
  const channelMap = new Map<string, { timesSent: number; paymentsWithin3Days: number }>();

  for (const r of reminders) {
    const tmpl = templateMap.get(r.stepName) || { timesSent: 0, paymentsWithin3Days: 0 };
    tmpl.timesSent++;
    templateMap.set(r.stepName, tmpl);

    const ch = channelMap.get(r.channel) || { timesSent: 0, paymentsWithin3Days: 0 };
    ch.timesSent++;
    channelMap.set(r.channel, ch);

    if (paidIds.has(r.invoiceId) && r.invoice.paidAt) {
      const diffMs = r.invoice.paidAt.getTime() - r.sentAt.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);
      if (diffDays <= 3) {
        tmpl.paymentsWithin3Days++;
        ch.paymentsWithin3Days++;
      }
    }
  }

  const byTemplate = Array.from(templateMap.entries()).map(([template, data]) => ({
    template,
    timesSent: data.timesSent,
    paymentsWithin3Days: data.paymentsWithin3Days,
    conversionRate: data.timesSent > 0 ? data.paymentsWithin3Days / data.timesSent : null,
  }));

  const byChannel = Array.from(channelMap.entries()).map(([channel, data]) => ({
    channel,
    timesSent: data.timesSent,
    paymentsWithin3Days: data.paymentsWithin3Days,
    conversionRate: data.timesSent > 0 ? data.paymentsWithin3Days / data.timesSent : null,
  }));

  return {
    overall: {
      totalPaidWithReminders,
      avgDaysReminderToPayment,
      paidWithin3Days,
      paidWithin24h,
      paidWithin7Days,
      within3DaysRate,
      within24hRate,
      within7DaysRate,
    },
    byTemplate,
    byChannel,
  };
}
