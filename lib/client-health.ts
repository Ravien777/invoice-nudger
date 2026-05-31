import { prisma } from "./prisma";
import { differenceInCalendarDays } from "date-fns";

export interface ClientHealthBreakdown {
  avgDaysToPay: { score: number; maxScore: number; details: string };
  paymentRate: { score: number; maxScore: number; details: string };
  promiseKeptRate: { score: number; maxScore: number; details: string };
  disputeRate: { score: number; maxScore: number; details: string };
}

export interface ClientHealthResult {
  clientEmail: string;
  score: number;
  label: string;
  breakdown: ClientHealthBreakdown;
  signals: string[];
  invoiceCount: number;
}

export function getClientLabel(score: number): string {
  if (score >= 85) return "Excellent";
  if (score >= 65) return "Good";
  if (score >= 45) return "Average";
  if (score >= 25) return "Slow Payer";
  return "High Risk";
}

export function computeClientAvgDaysToPayScore(
  avgDaysLate: number | null,
): { score: number; maxScore: number; details: string } {
  if (avgDaysLate === null) {
    return { score: 12, maxScore: 25, details: "No payment history yet" };
  }
  let score: number;
  if (avgDaysLate < 15) score = 25;
  else if (avgDaysLate < 30) score = 20;
  else if (avgDaysLate < 45) score = 15;
  else if (avgDaysLate < 60) score = 10;
  else score = 5;
  return {
    score,
    maxScore: 25,
    details: `Avg ${avgDaysLate.toFixed(0)} days to pay`,
  };
}

export function computeClientPaymentRateScore(
  paidInvoices: number,
  totalInvoices: number,
): { score: number; maxScore: number; details: string } {
  if (totalInvoices === 0) {
    return { score: 12, maxScore: 25, details: "No invoices yet" };
  }
  const rate = paidInvoices / totalInvoices;
  const score = Math.round(rate * 25);
  return {
    score,
    maxScore: 25,
    details: `${paidInvoices}/${totalInvoices} invoices paid (${(rate * 100).toFixed(0)}%)`,
  };
}

export function computeClientPromiseKeptRateScore(
  userId: string,
  clientEmail: string,
): Promise<{ score: number; maxScore: number; details: string }> {
  const invoicesWithPromises = prisma.invoice.findMany({
    where: {
      userId,
      clientEmail,
      promiseStatus: { not: "none" },
    },
    select: { promiseStatus: true },
  });

  return invoicesWithPromises.then((invoices) => {
    if (invoices.length === 0) {
      return { score: 0, maxScore: 0, details: "No promises tracked (skipped)" };
    }
    const kept = invoices.filter((inv) => inv.promiseStatus === "fulfilled").length;
    const rate = kept / invoices.length;
    const score = Math.round(rate * 25);
    return {
      score,
      maxScore: 25,
      details: `${kept}/${invoices.length} promises kept (${(rate * 100).toFixed(0)}%)`,
    };
  });
}

export function computeClientDisputeRateScore(
  totalInvoices: number,
  invoices: Array<{ status: string; paidAt: Date | null; dueDate: Date }>,
): { score: number; maxScore: number; details: string } {
  if (totalInvoices === 0) {
    return { score: 12, maxScore: 25, details: "No invoices yet" };
  }
  const now = new Date();
  const problematic = invoices.filter(
    (inv) =>
      inv.status === "cancelled" ||
      (inv.status !== "paid" &&
        inv.dueDate &&
        differenceInCalendarDays(now, inv.dueDate) > 90),
  ).length;
  const rate = problematic / totalInvoices;
  let score: number;
  if (rate === 0) score = 25;
  else if (rate < 0.1) score = 20;
  else if (rate < 0.25) score = 15;
  else if (rate < 0.5) score = 10;
  else score = 0;
  return {
    score,
    maxScore: 25,
    details: `${problematic} problematic of ${totalInvoices} invoices`,
  };
}

export async function calculateClientHealthScore(
  userId: string,
  clientEmail: string,
): Promise<ClientHealthResult> {
  const profile = await prisma.clientPaymentProfile.findUnique({
    where: { userId_clientEmail: { userId, clientEmail } },
  });

  const invoices = await prisma.invoice.findMany({
    where: { userId, clientEmail },
    select: { status: true, paidAt: true, dueDate: true },
  });

  const totalInvoices = profile?.totalInvoices ?? invoices.length;
  const paidInvoices = profile?.paidInvoices ?? 0;

  const avgDaysToPay = computeClientAvgDaysToPayScore(
    profile?.avgDaysLate ?? null,
  );
  const paymentRate = computeClientPaymentRateScore(paidInvoices, totalInvoices);
  const promiseKeptRate = await computeClientPromiseKeptRateScore(
    userId,
    clientEmail,
  );
  const disputeRate = computeClientDisputeRateScore(totalInvoices, invoices);

  const promiseAdjustment =
    promiseKeptRate.maxScore === 0
      ? 0
      : 0;
  const adjustedPromiseMax = promiseKeptRate.maxScore > 0 ? 25 : 0;

  const totalMax = 25 + 25 + adjustedPromiseMax + 25;
  const totalScore =
    avgDaysToPay.score +
    paymentRate.score +
    (promiseKeptRate.maxScore > 0 ? promiseKeptRate.score : promiseAdjustment) +
    disputeRate.score;

  const score = Math.min(Math.round((totalScore / totalMax) * 100), 100);
  const label = getClientLabel(score);

  const signals: string[] = [];
  if (avgDaysToPay.score < 20) signals.push(avgDaysToPay.details);
  if (paymentRate.score < 20) signals.push(paymentRate.details);
  if (promiseKeptRate.maxScore > 0 && promiseKeptRate.score < 15) {
    signals.push(promiseKeptRate.details);
  }
  if (disputeRate.score < 20) signals.push(disputeRate.details);

  return {
    clientEmail,
    score,
    label,
    breakdown: {
      avgDaysToPay,
      paymentRate,
      promiseKeptRate,
      disputeRate,
    },
    signals,
    invoiceCount: totalInvoices,
  };
}

export async function calculateAllClientHealthScores(
  userId: string,
): Promise<ClientHealthResult[]> {
  const profiles = await prisma.clientPaymentProfile.findMany({
    where: { userId },
    select: {
      clientEmail: true,
      paidInvoices: true,
      totalInvoices: true,
      avgDaysLate: true,
      onTimePayments: true,
    },
  });

  if (profiles.length === 0) return [];

  const clientEmails = profiles.map((p) => p.clientEmail);

  const [allInvoices, allPromiseInvoices] = await Promise.all([
    prisma.invoice.findMany({
      where: { userId, clientEmail: { in: clientEmails } },
      select: { clientEmail: true, status: true, paidAt: true, dueDate: true },
    }),
    prisma.invoice.findMany({
      where: { userId, clientEmail: { in: clientEmails }, promiseStatus: { not: "none" } },
      select: { clientEmail: true, promiseStatus: true },
    }),
  ]);

  const invoicesByEmail = new Map<string, typeof allInvoices>();
  for (const inv of allInvoices) {
    const arr = invoicesByEmail.get(inv.clientEmail);
    if (arr) arr.push(inv);
    else invoicesByEmail.set(inv.clientEmail, [inv]);
  }

  const promiseByEmail = new Map<string, typeof allPromiseInvoices>();
  for (const inv of allPromiseInvoices) {
    const arr = promiseByEmail.get(inv.clientEmail);
    if (arr) arr.push(inv);
    else promiseByEmail.set(inv.clientEmail, [inv]);
  }

  return profiles.map((profile) => {
    const invoices = invoicesByEmail.get(profile.clientEmail) || [];
    const promiseInvoices = promiseByEmail.get(profile.clientEmail) || [];
    const totalInvoices = profile.totalInvoices ?? invoices.length;
    const paidInvoices = profile.paidInvoices ?? 0;

    const avgDaysToPay = computeClientAvgDaysToPayScore(profile.avgDaysLate ?? null);
    const paymentRate = computeClientPaymentRateScore(paidInvoices, totalInvoices);

    let promiseKeptRate: { score: number; maxScore: number; details: string };
    if (promiseInvoices.length === 0) {
      promiseKeptRate = { score: 0, maxScore: 0, details: "No promises tracked (skipped)" };
    } else {
      const kept = promiseInvoices.filter((inv) => inv.promiseStatus === "fulfilled").length;
      const rate = kept / promiseInvoices.length;
      promiseKeptRate = {
        score: Math.round(rate * 25),
        maxScore: 25,
        details: `${kept}/${promiseInvoices.length} promises kept (${(rate * 100).toFixed(0)}%)`,
      };
    }

    const disputeRate = computeClientDisputeRateScore(totalInvoices, invoices);

    const promiseAdjustment =
      promiseKeptRate.maxScore === 0 ? 0 : 0;
    const adjustedPromiseMax = promiseKeptRate.maxScore > 0 ? 25 : 0;

    const totalMax = 25 + 25 + adjustedPromiseMax + 25;
    const totalScore =
      avgDaysToPay.score +
      paymentRate.score +
      (promiseKeptRate.maxScore > 0 ? promiseKeptRate.score : promiseAdjustment) +
      disputeRate.score;

    const score = Math.min(Math.round((totalScore / totalMax) * 100), 100);
    const label = getClientLabel(score);

    const signals: string[] = [];
    if (avgDaysToPay.score < 20) signals.push(avgDaysToPay.details);
    if (paymentRate.score < 20) signals.push(paymentRate.details);
    if (promiseKeptRate.maxScore > 0 && promiseKeptRate.score < 15) {
      signals.push(promiseKeptRate.details);
    }
    if (disputeRate.score < 20) signals.push(disputeRate.details);

    return {
      clientEmail: profile.clientEmail,
      score,
      label,
      breakdown: { avgDaysToPay, paymentRate, promiseKeptRate, disputeRate },
      signals,
      invoiceCount: totalInvoices,
    };
  });
}
