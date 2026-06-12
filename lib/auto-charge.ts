import { prisma } from "./prisma";
import { getStripe } from "./stripe";
import { createPaymentRecord } from "./reconciliation";
import { createAllocationRecord } from "./allocation";
import { getTier } from "./tiers";

const MAX_RETRIES = 3;
const RETRY_DELAYS_DAYS = [3, 7];

export async function getOrCreateStripeCustomer(
  userId: string,
  clientEmail: string,
  clientName?: string,
): Promise<{ stripeCustomerId: string; created: boolean }> {
  const existing = await prisma.clientPaymentMethod.findFirst({
    where: { userId, clientEmail, status: "active" },
    orderBy: { createdAt: "desc" },
  });

  if (existing) {
    return { stripeCustomerId: existing.stripeCustomerId, created: false };
  }

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email: clientEmail,
    name: clientName ?? undefined,
    metadata: { userId },
  });

  return { stripeCustomerId: customer.id, created: true };
}

export async function createSetupIntent(stripeCustomerId: string) {
  const stripe = getStripe();
  return stripe.setupIntents.create({
    customer: stripeCustomerId,
    usage: "off_session",
    payment_method_types: ["card"],
  });
}

export async function savePaymentMethod(data: {
  userId: string;
  clientEmail: string;
  clientName?: string;
  stripeCustomerId: string;
  stripePaymentMethodId: string;
  stripeSetupIntentId?: string;
}) {
  const existing = await prisma.clientPaymentMethod.findFirst({
    where: { userId: data.userId, clientEmail: data.clientEmail, status: "active" },
  });

  if (existing) {
    await prisma.clientPaymentMethod.update({
      where: { id: existing.id },
      data: { status: "removed" },
    });
  }

  const method = await prisma.clientPaymentMethod.create({
    data: {
      userId: data.userId,
      clientEmail: data.clientEmail,
      clientName: data.clientName,
      stripeCustomerId: data.stripeCustomerId,
      stripePaymentMethodId: data.stripePaymentMethodId,
      stripeSetupIntentId: data.stripeSetupIntentId,
      isDefault: true,
    },
  });

  return method;
}

export async function getDefaultPaymentMethod(userId: string, clientEmail: string) {
  return prisma.clientPaymentMethod.findFirst({
    where: { userId, clientEmail, status: "active" },
    orderBy: { isDefault: "desc" },
  });
}

export async function chargeClient(cpmId: string, amount: number, currency: string, invoiceId: string, description?: string) {
  const cpm = await prisma.clientPaymentMethod.findUnique({
    where: { id: cpmId },
  });

  if (!cpm || cpm.status !== "active") {
    throw new Error("Payment method not found or inactive");
  }

  const stripe = getStripe();
  const amountCents = Math.round(amount * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: currency.toLowerCase(),
    customer: cpm.stripeCustomerId,
    payment_method: cpm.stripePaymentMethodId,
    off_session: true,
    confirm: true,
    description,
    metadata: { invoiceId, cpmId: cpm.id },
  });

  return paymentIntent;
}

export async function handleChargeSuccess(paymentIntent: import("stripe").Stripe.PaymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice || invoice.status === "paid") return;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "paid",
      paidAt: new Date(),
      stripePaymentIntentId: paymentIntent.id,
    },
  });

  await createPaymentRecord({
    invoiceId,
    source: "stripe",
    amount: (paymentIntent.amount_received ?? paymentIntent.amount) / 100,
    currency: paymentIntent.currency.toUpperCase(),
    paidAt: new Date(paymentIntent.created * 1000),
    referenceId: paymentIntent.id,
    notes: "Auto-charge via saved payment method",
  });

  await prisma.reminderLog.create({
    data: {
      invoiceId,
      stepName: "auto_paid",
    },
  });

  await createAllocationRecord(
    invoice.userId,
    invoice.amount,
    invoice.currency,
    invoice.id,
    invoice.clientName,
  );

  const cpmId = paymentIntent.metadata?.cpmId;
  if (cpmId) {
    await prisma.clientPaymentMethod.update({
      where: { id: cpmId },
      data: { lastChargedAt: new Date() },
    });
  }

  await incrementAutoChargeUsage(invoice.userId);
}

export async function handleChargeFailure(paymentIntent: import("stripe").Stripe.PaymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoiceId;
  if (!invoiceId) return;

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) return;

  const lastError = paymentIntent.last_payment_error?.message ?? "Unknown error";
  const currentAttempts = (invoice.autoChargeRetryCount ?? 0) + 1;

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      autoChargeRetryCount: currentAttempts,
      autoChargeLastError: lastError,
      autoChargeLastAttemptAt: new Date(),
    },
  });

  await prisma.reminderLog.create({
    data: {
      invoiceId,
      stepName: "auto_charge_failed",
    },
  });

  if (currentAttempts >= MAX_RETRIES) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { autoCharge: false },
    });
  }
}

export async function attemptRetry(invoiceId: string) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice || invoice.status === "paid" || !invoice.autoCharge) return;

  const cpm = await prisma.clientPaymentMethod.findFirst({
    where: { userId: invoice.userId, clientEmail: invoice.clientEmail, status: "active" },
  });

  if (!cpm) return;

  const pi = await chargeClient(cpm.id, invoice.amount, invoice.currency, invoice.id, `Retry: ${invoice.clientName}`);

  if (pi.status === "succeeded") {
    await handleChargeSuccess(pi);
  } else if (pi.status === "requires_payment_method") {
    await handleChargeFailure(pi);
  }
}

export async function getAutoChargeableInvoices() {
  return prisma.invoice.findMany({
    where: {
      autoCharge: true,
      status: { not: "paid" },
      dueDate: { lte: new Date() },
      clientEmail: { not: "" },
    },
  });
}

export async function getMonthlyAutoChargeCount(userId: string): Promise<number> {
  const now = new Date();
  const usage = await prisma.notificationUsage.findUnique({
    where: {
      userId_channel_month_year: {
        userId,
        channel: "auto_charge",
        month: now.getMonth() + 1,
        year: now.getFullYear(),
      },
    },
    select: { count: true },
  });

  return usage?.count ?? 0;
}

export async function canAutoCharge(userId: string): Promise<{ allowed: boolean; used: number; limit: number | null }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const tier = getTier(user?.plan ?? "free");
  const limit = tier.autoChargeLimit;

  if (limit === 0) {
    return { allowed: false, used: 0, limit: 0 };
  }

  if (limit === null) {
    return { allowed: true, used: 0, limit: null };
  }

  const used = await getMonthlyAutoChargeCount(userId);
  return { allowed: used < limit, used, limit };
}

export async function incrementAutoChargeUsage(userId: string): Promise<number> {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();

  const updated = await prisma.notificationUsage.upsert({
    where: {
      userId_channel_month_year: {
        userId,
        channel: "auto_charge",
        month,
        year,
      },
    },
    create: {
      userId,
      channel: "auto_charge",
      month,
      year,
      count: 1,
    },
    update: {
      count: { increment: 1 },
    },
    select: { count: true },
  });

  return updated.count;
}
