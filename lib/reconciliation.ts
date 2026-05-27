import { prisma } from "./prisma";
import { Resend } from "resend";

const SUPPORTED_CURRENCIES = ["USD", "EUR"];
const resend = new Resend(process.env.RESEND_API_KEY ?? "");

export interface ReconciliationResult {
  invoiceId: string;
  status: "reconciled" | "discrepancy" | "unreconciled";
  paymentCount: number;
  totalPaid: number;
  discrepancies: string[];
}

export async function createPaymentRecord(data: {
  invoiceId: string;
  source: string;
  amount: number;
  currency: string;
  paidAt: Date;
  referenceId?: string;
  notes?: string;
  status?: string;
}) {
  const record = await prisma.paymentRecord.create({
    data: {
      invoiceId: data.invoiceId,
      source: data.source,
      amount: data.amount,
      currency: data.currency,
      paidAt: data.paidAt,
      referenceId: data.referenceId ?? null,
      notes: data.notes ?? null,
      status: data.status ?? "unreconciled",
    },
  });

  await reconcileInvoice(data.invoiceId);

  return record;
}

export async function reconcileInvoice(invoiceId: string): Promise<ReconciliationResult> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!invoice) {
    return { invoiceId, status: "unreconciled", paymentCount: 0, totalPaid: 0, discrepancies: ["Invoice not found"] };
  }

  const payments = invoice.payments;

  if (payments.length === 0) {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { reconciliationStatus: null, lastReconciledAt: null },
    });
    return { invoiceId, status: "unreconciled", paymentCount: 0, totalPaid: 0, discrepancies: [] };
  }

  const discrepancies: string[] = [];
  const refundedPayments = payments.filter((p) => p.status === "refunded");
  const activePayments = payments.filter((p) => p.status !== "refunded");

  const totalPaid = activePayments.reduce((sum, p) => sum + p.amount, 0);
  const totalRefunded = refundedPayments.reduce((sum, p) => sum + p.amount, 0);
  const netPaid = totalPaid - totalRefunded;

  const unsupportedCurrencyPayments = payments.filter(
    (p) => !SUPPORTED_CURRENCIES.includes(p.currency)
  );

  if (unsupportedCurrencyPayments.length > 0) {
    const currencies = [...new Set(unsupportedCurrencyPayments.map((p) => p.currency))];
    discrepancies.push(`Unsupported currency detected: ${currencies.join(", ")}`);
  }

  const currenciesInPlay = [...new Set(activePayments.map((p) => p.currency))];
  if (currenciesInPlay.length > 1) {
    discrepancies.push(`Multiple currencies detected: ${currenciesInPlay.join(", ")}`);
  }

  if (activePayments.length > 1) {
    const amounts = activePayments.map((p) => p.amount);
    const uniqueAmounts = [...new Set(amounts)];

    if (uniqueAmounts.length > 1) {
      const amountDetails = activePayments.map((p) => `${p.source}: ${p.amount} ${p.currency}`).join(", ");
      discrepancies.push(`Amount mismatch across sources: ${amountDetails}`);
    }

    if (netPaid > invoice.amount) {
      discrepancies.push(`Overpayment detected: invoice amount ${invoice.amount}, net paid ${netPaid}`);
    }
  }

  let finalStatus: "reconciled" | "discrepancy" | "unreconciled";

  if (discrepancies.length > 0) {
    finalStatus = "discrepancy";

    await prisma.paymentRecord.updateMany({
      where: {
        invoiceId,
        status: "unreconciled",
      },
      data: { status: "conflict" },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        reconciliationStatus: "discrepancy",
        lastReconciledAt: new Date(),
      },
    });

    const user = await prisma.user.findUnique({
      where: { id: invoice.userId },
      select: { email: true, name: true },
    });

    if (user) {
      await sendDiscrepancyEmail(user.email, user.name, invoice, discrepancies);
    }
  } else if (netPaid >= invoice.amount) {
    finalStatus = "reconciled";

    await prisma.paymentRecord.updateMany({
      where: {
        invoiceId,
        status: { in: ["unreconciled", "conflict"] },
      },
      data: { status: "reconciled" },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        reconciliationStatus: "reconciled",
        lastReconciledAt: new Date(),
      },
    });
  } else {
    finalStatus = "unreconciled";

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: {
        reconciliationStatus: null,
        lastReconciledAt: new Date(),
      },
    });
  }

  return {
    invoiceId,
    status: finalStatus,
    paymentCount: payments.length,
    totalPaid: netPaid,
    discrepancies,
  };
}

export async function reconcileAll(): Promise<ReconciliationResult[]> {
  const invoices = await prisma.invoice.findMany({
    where: {
      OR: [
        { reconciliationStatus: null },
        { reconciliationStatus: "discrepancy" },
      ],
      payments: { some: {} },
    },
    select: { id: true },
  });

  const results: ReconciliationResult[] = [];

  for (const invoice of invoices) {
    const result = await reconcileInvoice(invoice.id);
    results.push(result);
  }

  return results;
}

export async function resolveDiscrepancy(
  invoiceId: string,
  action: "force_reconcile" | "mark_discrepancy" | "ignore"
): Promise<void> {
  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { payments: true },
  });

  if (!invoice) return;

  if (action === "force_reconcile") {
    await prisma.paymentRecord.updateMany({
      where: { invoiceId, status: "conflict" },
      data: { status: "reconciled" },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { reconciliationStatus: "reconciled", lastReconciledAt: new Date() },
    });
  } else if (action === "mark_discrepancy") {
    await prisma.paymentRecord.updateMany({
      where: { invoiceId, status: { in: ["unreconciled", "conflict"] } },
      data: { status: "conflict" },
    });

    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { reconciliationStatus: "discrepancy", lastReconciledAt: new Date() },
    });
  } else if (action === "ignore") {
    await prisma.invoice.update({
      where: { id: invoiceId },
      data: { reconciliationStatus: null, lastReconciledAt: new Date() },
    });
  }
}

async function sendDiscrepancyEmail(
  userEmail: string,
  userName: string | null,
  invoice: { id: string; invoiceNumber: string | null; amount: number; currency: string; clientName: string },
  discrepancies: string[]
) {
  const baseUrl = process.env.NEXTAUTH_URL ?? "http://localhost:3000";
  const ref = invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : invoice.id;

  const html = `
    <div style="font-family: system-ui, -apple-system, sans-serif; line-height: 1.6; color: #1a1a1a; max-width: 560px; margin: 0 auto;">
      <p>Hi ${userName || "there"},</p>
      <p>A payment discrepancy has been detected for invoice <strong>${ref}</strong> (${invoice.clientName}, ${invoice.amount} ${invoice.currency}).</p>
      <div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 16px; margin: 16px 0; border-radius: 4px;">
        <p style="margin: 0 0 8px; font-weight: 600;">Discrepancies:</p>
        <ul style="margin: 0; padding-left: 20px;">
          ${discrepancies.map((d) => `<li style="margin-bottom: 4px;">${d}</li>`).join("")}
        </ul>
      </div>
      <p style="margin-top: 24px;">
        <a href="${baseUrl}/reconciliation" style="display: inline-block; padding: 12px 24px; background: #2563eb; color: #ffffff; text-decoration: none; border-radius: 8px; font-weight: 500;">Review & Resolve</a>
      </p>
      <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">You can review all payment records and resolve discrepancies from your reconciliation dashboard.</p>
    </div>
  `;

  try {
    await resend.emails.send({
      from: process.env.EMAIL_FROM ?? "maroni@getmaroni.com",
      to: userEmail,
      subject: `Payment discrepancy detected for invoice ${ref}`,
      html,
    });
  } catch (err) {
    console.error("Failed to send discrepancy email:", err);
  }
}
