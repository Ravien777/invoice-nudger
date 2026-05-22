import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Payment Status | Invoice Nudger",
  description: "Check your payment status for this invoice.",
};

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(dateStr: Date): string {
  return dateStr.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export default async function PaySuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ invoiceId?: string }>;
}) {
  const { invoiceId } = await searchParams;

  if (!invoiceId) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-lg shadow-slate-900/10">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Invoice Not Found</h1>
          <p className="text-muted">No invoice ID was provided.</p>
        </div>
      </main>
    );
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { user: { select: { name: true, email: true } } },
  });

  if (!invoice) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-lg shadow-slate-900/10">
          <h1 className="mb-2 text-2xl font-bold text-foreground">Invoice Not Found</h1>
          <p className="text-muted">This invoice could not be found.</p>
        </div>
      </main>
    );
  }

  const isPaid = invoice.status === "paid";
  const paidViaStripe = isPaid && !!invoice.paymentLink;

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-lg shadow-slate-900/10">
        {isPaid ? (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-[var(--success)]">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Payment Confirmed
            </h1>
            <p className="mb-4 text-muted">
              Thank you! Your payment for invoice{" "}
              {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : ""} has been
              confirmed.
            </p>
            {paidViaStripe && (
              <span className="mb-4 inline-block rounded-full bg-[var(--success-muted)] px-3 py-1 text-xs font-medium text-[var(--success)] ring-1 ring-[var(--success)]/20">
                Paid via Stripe
              </span>
            )}
          </>
        ) : (
          <>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-[var(--warning-muted)] text-[var(--warning)]">
              <svg
                className="h-8 w-8"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h1 className="mb-2 text-2xl font-bold text-foreground">
              Payment Pending
            </h1>
            <p className="mb-4 text-muted">
              We&apos;re waiting for your payment to be confirmed. You&apos;ll
              receive a confirmation once it&apos;s processed.
            </p>
          </>
        )}

        <div className="mb-6 space-y-3 rounded-3xl bg-surface-muted p-4 text-left">
          <div className="flex justify-between">
            <span className="text-sm text-muted">Invoice</span>
            <span className="text-sm font-medium text-foreground">
              {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : invoice.id.slice(0, 8)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Amount</span>
            <span className="text-lg font-bold text-foreground">
              {formatCurrency(invoice.amount, invoice.currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Due Date</span>
            <span className="text-sm font-medium text-foreground">
              {formatDate(invoice.dueDate)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-muted">Status</span>
            <span className="text-sm font-medium text-foreground capitalize">
              {invoice.status}
            </span>
          </div>
        </div>

        <Link
          href="/"
          className="inline-block w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-surface shadow-sm transition hover:brightness-110"
        >
          Back to Home
        </Link>
      </div>
    </main>
  );
}
