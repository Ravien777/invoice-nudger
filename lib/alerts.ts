import { prisma } from "./prisma";
import { subDays, addDays, differenceInCalendarDays, startOfDay } from "date-fns";
import { computeForecast } from "./forecast";

interface AlertPreferences {
  highRiskInvoices: boolean;
  clientDeterioration: boolean;
  cashFlowGap: boolean;
  weeklyDigest: boolean;
  cashFlowThreshold: number;
}

const DEFAULT_PREFERENCES: AlertPreferences = {
  highRiskInvoices: true,
  clientDeterioration: true,
  cashFlowGap: true,
  weeklyDigest: false,
  cashFlowThreshold: 50,
};

function parsePreferences(raw: unknown): AlertPreferences {
  if (!raw || typeof raw !== "object") return DEFAULT_PREFERENCES;
  const p = raw as Record<string, unknown>;
  return {
    highRiskInvoices:
      typeof p.highRiskInvoices === "boolean" ? p.highRiskInvoices : true,
    clientDeterioration:
      typeof p.clientDeterioration === "boolean" ? p.clientDeterioration : true,
    cashFlowGap:
      typeof p.cashFlowGap === "boolean" ? p.cashFlowGap : true,
    weeklyDigest:
      typeof p.weeklyDigest === "boolean" ? p.weeklyDigest : false,
    cashFlowThreshold:
      typeof p.cashFlowThreshold === "number" ? p.cashFlowThreshold : 50,
  };
}

async function notificationExists(
  userId: string,
  type: string,
  metadataKey: string,
  metadataValue: string,
): Promise<boolean> {
  const since = subDays(new Date(), 1);
  const existing = await prisma.notification.findFirst({
    where: {
      userId,
      type,
      createdAt: { gte: since },
      metadata: { path: [metadataKey], equals: metadataValue },
    },
  });
  return existing !== null;
}

export async function checkHighRiskInvoices(userId: string) {
  const sevenDaysFromNow = addDays(new Date(), 7);

  const highRiskInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      status: { in: ["unpaid", "overdue"] },
      paymentProbability: { lt: 0.3 },
      OR: [
        { dueDate: { lte: sevenDaysFromNow } },
        { status: "overdue" },
      ],
    },
    select: {
      id: true,
      invoiceNumber: true,
      clientName: true,
      clientEmail: true,
      amount: true,
      dueDate: true,
      status: true,
      paymentProbability: true,
    },
  });

  for (const inv of highRiskInvoices) {
    const exists = await notificationExists(
      userId,
      "high_risk_invoice",
      "invoiceId",
      inv.id,
    );
    if (exists) continue;

    const daysLabel = inv.status === "overdue"
      ? "overdue"
      : `due in ${differenceInCalendarDays(inv.dueDate, new Date())} days`;

    await prisma.notification.create({
      data: {
        userId,
        type: "high_risk_invoice",
        title: "High-Risk Invoice",
        message: `${inv.clientName} (${inv.invoiceNumber || "no #"}) — $${inv.amount.toFixed(2)}, ${daysLabel}, ${Math.round((1 - (inv.paymentProbability ?? 0)) * 100)}% risk of not being paid on time.`,
        metadata: { invoiceId: inv.id, clientEmail: inv.clientEmail, riskScore: 1 - (inv.paymentProbability ?? 0) },
      },
    });
  }

  return highRiskInvoices.length;
}

export async function checkClientDeterioration(userId: string) {
  const thirtyDaysAgo = subDays(new Date(), 30);

  const profiles = await prisma.clientPaymentProfile.findMany({
    where: { userId },
    select: {
      id: true,
      clientEmail: true,
      paidInvoices: true,
      onTimePayments: true,
    },
  });

  if (profiles.length === 0) return 0;

  const clientEmails = profiles.map((p) => p.clientEmail);
  const allRecentInvoices = await prisma.invoice.findMany({
    where: {
      userId,
      clientEmail: { in: clientEmails },
      status: "paid",
      paidAt: { gte: thirtyDaysAgo },
    },
    select: { clientEmail: true, dueDate: true, paidAt: true },
  });

  const invoicesByEmail = new Map<string, typeof allRecentInvoices>();
  for (const inv of allRecentInvoices) {
    const arr = invoicesByEmail.get(inv.clientEmail);
    if (arr) arr.push(inv);
    else invoicesByEmail.set(inv.clientEmail, [inv]);
  }

  let alertsCreated = 0;

  for (const profile of profiles) {
    const currentRatio = profile.paidInvoices > 0
      ? profile.onTimePayments / profile.paidInvoices
      : 0;

    const recentInvoices = invoicesByEmail.get(profile.clientEmail) || [];

    const recentOnTime = recentInvoices.filter(
      (inv) => inv.paidAt && differenceInCalendarDays(inv.paidAt, inv.dueDate) <= 0,
    ).length;

    const recentRatio = recentInvoices.length > 0
      ? recentOnTime / recentInvoices.length
      : currentRatio;

    if (recentInvoices.length > 0 && recentRatio < currentRatio - 0.2) {
      const exists = await notificationExists(
        userId,
        "client_deterioration",
        "clientEmail",
        profile.clientEmail,
      );
      if (exists) continue;

      await prisma.notification.create({
        data: {
          userId,
          type: "client_deterioration",
          title: "Client Payment Deterioration",
          message: `${profile.clientEmail}'s on-time payment rate dropped from ${Math.round(currentRatio * 100)}% to ${Math.round(recentRatio * 100)}% in the last 30 days.`,
          metadata: { clientEmail: profile.clientEmail, previousRate: currentRatio, currentRate: recentRatio },
        },
      });
      alertsCreated++;
    }
  }

  return alertsCreated;
}

export async function checkCashFlowGap(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { alertPreferences: true },
  });

  const prefs = parsePreferences(user?.alertPreferences);
  const threshold = prefs.cashFlowThreshold / 100;

  const forecast = await computeForecast(userId, 15);
  const forecastTotal = forecast.totals.expected;

  const lastMonthStart = subDays(new Date(), 30);
  const lastMonthSummaries = await prisma.invoiceDailySummary.findMany({
    where: {
      userId,
      date: { gte: startOfDay(lastMonthStart) },
    },
    select: { collectedAmount: true },
  });

  const previousMonthCollected = lastMonthSummaries.reduce(
    (sum, s) => sum + s.collectedAmount,
    0,
  );

  if (previousMonthCollected > 0 && forecastTotal < previousMonthCollected * threshold) {
    const exists = await notificationExists(
      userId,
      "cash_flow_gap",
      "userId",
      userId,
    );
    if (exists) return 0;

    await prisma.notification.create({
      data: {
        userId,
        type: "cash_flow_gap",
        title: "Cash Flow Gap Detected",
        message: `Forecasted inflow over next 15 days ($${forecastTotal.toFixed(2)}) is below ${prefs.cashFlowThreshold}% of last month's collection ($${previousMonthCollected.toFixed(2)}).`,
        metadata: { forecastTotal, previousMonthCollected, threshold: prefs.cashFlowThreshold },
      },
    });
    return 1;
  }

  return 0;
}

export async function generatePredictiveAlertsForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { alertPreferences: true },
  });

  const prefs = parsePreferences(user?.alertPreferences);

  let total = 0;

  if (prefs.highRiskInvoices) {
    total += await checkHighRiskInvoices(userId);
  }

  if (prefs.clientDeterioration) {
    total += await checkClientDeterioration(userId);
  }

  if (prefs.cashFlowGap) {
    total += await checkCashFlowGap(userId);
  }

  return total;
}

const ALERTS_BATCH_SIZE = 1000;

export async function generatePredictiveAlertsForAll() {
  let total = 0;
  let cursor: string | undefined;

  do {
    const users = await prisma.user.findMany({
      select: { id: true },
      take: ALERTS_BATCH_SIZE,
      orderBy: { id: "asc" },
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });

    for (const user of users) {
      total += await generatePredictiveAlertsForUser(user.id);
    }

    cursor = users[users.length - 1]?.id;
  } while (cursor);

  return total;
}
