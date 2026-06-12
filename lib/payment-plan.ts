import { prisma } from "./prisma";
import { getStripe } from "./stripe";
import { getDefaultPaymentMethod } from "./auto-charge";
import { createPaymentRecord } from "./reconciliation";
import { createAllocationRecord } from "./allocation";
import { getTier } from "./tiers";

const ALLOWED_INSTALLMENTS = [2, 3, 4, 6, 12];
const ALLOWED_INTERVALS = [
  { key: "weekly", days: 7 },
  { key: "biweekly", days: 14 },
  { key: "monthly", days: 30 },
];

export async function canCreatePaymentPlan(userId: string, installments: number): Promise<{ allowed: boolean; reason?: string }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { plan: true },
  });

  const tier = getTier(user?.plan ?? "free");

  if (tier.installmentLimit === 0) {
    return { allowed: false, reason: "Payment plans are not available on your plan" };
  }

  if (installments < 2) {
    return { allowed: false, reason: "Must have at least 2 installments" };
  }

  if (installments > tier.installmentLimit) {
    return { allowed: false, reason: `Your plan supports up to ${tier.installmentLimit} installments` };
  }

  return { allowed: true };
}

export async function createPaymentPlan(
  invoiceId: string,
  installments: number,
  intervalDays: number,
  userId: string,
) {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice || invoice.userId !== userId) {
    throw new Error("Invoice not found");
  }

  if (invoice.status === "paid") {
    throw new Error("Cannot create payment plan for a paid invoice");
  }

  const existing = await prisma.paymentPlan.findUnique({
    where: { invoiceId },
  });

  if (existing) {
    throw new Error("Invoice already has a payment plan");
  }

  const check = await canCreatePaymentPlan(userId, installments);
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const rawAmount = invoice.amount / installments;
  const baseAmount = Math.floor(rawAmount * 100) / 100;
  const remainder = Math.round((invoice.amount - baseAmount * (installments - 1)) * 100) / 100;

  const dueDate = new Date(invoice.dueDate);

  const plan = await prisma.paymentPlan.create({
    data: {
      invoiceId,
      totalAmount: invoice.amount,
      currency: invoice.currency,
      installments,
      intervalDays,
      installmentsList: {
        create: Array.from({ length: installments }, (_, i) => {
          const date = new Date(dueDate);
          date.setDate(date.getDate() + intervalDays * i);
          return {
            amount: i === installments - 1 ? remainder : baseAmount,
            dueDate: date,
          };
        }),
      },
    },
    include: { installmentsList: { orderBy: { dueDate: "asc" } } },
  });

  return plan;
}

export async function getPaymentPlan(invoiceId: string) {
  return prisma.paymentPlan.findUnique({
    where: { invoiceId },
    include: { installmentsList: { orderBy: { dueDate: "asc" } } },
  });
}

export async function cancelPaymentPlan(planId: string, userId: string) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: { invoice: true },
  });

  if (!plan || plan.invoice.userId !== userId) {
    throw new Error("Payment plan not found");
  }

  if (plan.status !== "active") {
    throw new Error("Plan is not active");
  }

  return prisma.paymentPlan.update({
    where: { id: planId },
    data: { status: "cancelled" },
  });
}

export async function modifyPaymentPlan(
  planId: string,
  userId: string,
  data: { installments?: number; intervalDays?: number },
) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: {
      invoice: true,
      installmentsList: { where: { status: "pending" }, orderBy: { dueDate: "asc" } },
    },
  });

  if (!plan || plan.invoice.userId !== userId) {
    throw new Error("Payment plan not found");
  }

  if (plan.status !== "active") {
    throw new Error("Plan is not active");
  }

  const paidCount = plan.installmentsList.filter((i) => i.status === "paid").length;
  if (paidCount > 0) {
    throw new Error("Cannot modify plan after first payment");
  }

  const installments = data.installments ?? plan.installments;
  const intervalDays = data.intervalDays ?? plan.intervalDays;

  const check = await canCreatePaymentPlan(userId, installments);
  if (!check.allowed) {
    throw new Error(check.reason);
  }

  const invoice = plan.invoice;
  const rawAmount = invoice.amount / installments;
  const baseAmount = Math.floor(rawAmount * 100) / 100;
  const remainder = Math.round((invoice.amount - baseAmount * (installments - 1)) * 100) / 100;

  const dueDate = new Date(invoice.dueDate);

  await prisma.$transaction([
    prisma.paymentPlanInstallment.deleteMany({ where: { planId } }),
    prisma.paymentPlan.update({
      where: { id: planId },
      data: {
        installments,
        intervalDays,
        totalAmount: invoice.amount,
      },
    }),
    ...Array.from({ length: installments }, (_, i) => {
      const date = new Date(dueDate);
      date.setDate(date.getDate() + intervalDays * i);
      return prisma.paymentPlanInstallment.create({
        data: {
          planId,
          amount: i === installments - 1 ? remainder : baseAmount,
          dueDate: date,
        },
      });
    }),
  ]);

  return getPaymentPlan(plan.invoiceId);
}

export async function chargeInstallment(installmentId: string) {
  const installment = await prisma.paymentPlanInstallment.findUnique({
    where: { id: installmentId },
    include: { plan: { include: { invoice: true } } },
  });

  if (!installment) throw new Error("Installment not found");
  if (installment.status !== "pending") throw new Error("Installment is not pending");

  const { plan } = installment;
  const { invoice } = plan;

  const cpm = await getDefaultPaymentMethod(invoice.userId, invoice.clientEmail);
  if (!cpm) throw new Error("No saved payment method for this client");

  const stripe = getStripe();
  const amountCents = Math.round(installment.amount * 100);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountCents,
    currency: invoice.currency.toLowerCase(),
    customer: cpm.stripeCustomerId,
    payment_method: cpm.stripePaymentMethodId,
    off_session: true,
    confirm: true,
    description: `Installment ${installmentId.slice(0, 8)} - ${invoice.clientName}`,
    metadata: { invoiceId: invoice.id, installmentId, type: "installment" },
  });

  return { paymentIntent, installment, plan, invoice, cpm };
}

export async function handleInstallmentSuccess(
  installmentId: string,
  paymentIntent: import("stripe").Stripe.PaymentIntent,
) {
  const installment = await prisma.paymentPlanInstallment.findUnique({
    where: { id: installmentId },
    include: { plan: { include: { invoice: true } } },
  });

  if (!installment || installment.status === "paid") return;

  const { plan, plan: { invoice } } = installment;

  await prisma.$transaction([
    prisma.paymentPlanInstallment.update({
      where: { id: installmentId },
      data: {
        status: "paid",
        paidAt: new Date(),
        stripePaymentIntentId: paymentIntent.id,
      },
    }),
  ]);

  await createPaymentRecord({
    invoiceId: invoice.id,
    source: "stripe",
    amount: (paymentIntent.amount_received ?? paymentIntent.amount) / 100,
    currency: paymentIntent.currency.toUpperCase(),
    paidAt: new Date(paymentIntent.created * 1000),
    referenceId: paymentIntent.id,
    notes: `Installment ${installmentId.slice(0, 8)}`,
  });

  const cpmId = paymentIntent.metadata?.cpmId;
  if (cpmId) {
    await prisma.clientPaymentMethod.update({
      where: { id: cpmId },
      data: { lastChargedAt: new Date() },
    });
  }

  const allInstallments = await prisma.paymentPlanInstallment.findMany({
    where: { planId: plan.id },
  });

  const allPaid = allInstallments.every((i) => i.status === "paid");

  if (allPaid) {
    await prisma.invoice.update({
      where: { id: invoice.id },
      data: {
        status: "paid",
        paidAt: new Date(),
      },
    });

    await prisma.paymentPlan.update({
      where: { id: plan.id },
      data: { status: "completed" },
    });

    await createAllocationRecord(
      invoice.userId,
      invoice.amount,
      invoice.currency,
      invoice.id,
      invoice.clientName,
    );

    await prisma.reminderLog.create({
      data: {
        invoiceId: invoice.id,
        stepName: "auto_paid",
      },
    });
  }
}

export async function handleInstallmentFailure(
  installmentId: string,
  paymentIntent: import("stripe").Stripe.PaymentIntent,
) {
  const installment = await prisma.paymentPlanInstallment.findUnique({
    where: { id: installmentId },
    include: { plan: true },
  });

  if (!installment || installment.status !== "pending") return;

  const lastError = paymentIntent.last_payment_error?.message ?? "Unknown error";

  await prisma.paymentPlanInstallment.update({
    where: { id: installmentId },
    data: {
      status: "failed",
      failedAt: new Date(),
      failureReason: lastError,
    },
  });

  const recentFailed = await prisma.paymentPlanInstallment.count({
    where: {
      planId: installment.planId,
      status: "failed",
    },
  });

  if (recentFailed >= 2) {
    await prisma.paymentPlan.update({
      where: { id: installment.planId },
      data: { status: "paused" },
    });
  }
}

export async function earlyPayoff(planId: string) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: {
      invoice: true,
      installmentsList: { where: { status: "pending" }, orderBy: { dueDate: "asc" } },
    },
  });

  if (!plan || plan.status !== "active") throw new Error("Plan not found or not active");

  const pending = plan.installmentsList;
  if (pending.length === 0) throw new Error("No pending installments");

  const totalRemaining = pending.reduce((sum, i) => sum + i.amount, 0);
  const totalRemainingCents = Math.round(totalRemaining * 100);

  const cpm = await getDefaultPaymentMethod(plan.invoice.userId, plan.invoice.clientEmail);
  if (!cpm) throw new Error("No saved payment method for this client");

  const stripe = getStripe();

  const paymentIntent = await stripe.paymentIntents.create({
    amount: totalRemainingCents,
    currency: plan.invoice.currency.toLowerCase(),
    customer: cpm.stripeCustomerId,
    payment_method: cpm.stripePaymentMethodId,
    off_session: true,
    confirm: true,
    description: `Early payoff - ${plan.invoice.clientName}`,
    metadata: { invoiceId: plan.invoiceId, planId, type: "early_payoff" },
  });

  return { paymentIntent, plan, pending };
}

export async function handleEarlyPayoffSuccess(paymentIntent: import("stripe").Stripe.PaymentIntent) {
  const invoiceId = paymentIntent.metadata?.invoiceId;
  const planId = paymentIntent.metadata?.planId;
  if (!invoiceId || !planId) return;

  const plan = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: { invoice: true },
  });

  if (!plan || plan.status !== "active") return;

  await prisma.paymentPlanInstallment.updateMany({
    where: { planId, status: "pending" },
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
    notes: "Early payoff",
  });

  await prisma.invoice.update({
    where: { id: invoiceId },
    data: {
      status: "paid",
      paidAt: new Date(),
    },
  });

  await prisma.paymentPlan.update({
    where: { id: planId },
    data: { status: "completed" },
  });

  await createAllocationRecord(
    plan.invoice.userId,
    plan.invoice.amount,
    plan.invoice.currency,
    plan.invoice.id,
    plan.invoice.clientName,
  );

  await prisma.reminderLog.create({
    data: { invoiceId, stepName: "auto_paid" },
  });
}

export async function getDueInstallments() {
  return prisma.paymentPlanInstallment.findMany({
    where: {
      status: "pending",
      dueDate: { lte: new Date() },
    },
    include: {
      plan: {
        include: { invoice: true },
      },
    },
    orderBy: { dueDate: "asc" },
  });
}

export async function resumePlan(planId: string, userId: string) {
  const plan = await prisma.paymentPlan.findUnique({
    where: { id: planId },
    include: { invoice: true },
  });

  if (!plan || plan.invoice.userId !== userId) throw new Error("Plan not found");
  if (plan.status !== "paused") throw new Error("Plan is not paused");

  return prisma.paymentPlan.update({
    where: { id: planId },
    data: { status: "active" },
  });
}
