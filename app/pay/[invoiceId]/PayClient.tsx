"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface InvoiceData {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  notes: string | null;
}

interface PayClientProps {
  invoice: InvoiceData;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function PayClient({ invoice }: PayClientProps) {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(invoice.status === "paid");

  async function handleConfirmPayment() {
    setConfirming(true);

    try {
      const res = await fetch(`/api/invoices/${invoice.id}/mark-paid`, {
        method: "POST",
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to confirm payment");
        return;
      }

      setConfirmed(true);
      toast.success("Payment confirmed!");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setConfirming(false);
    }
  }

  if (confirmed) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-background px-4">
        <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 text-center shadow-lg shadow-slate-900/10">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-muted text-accent">
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
          <h1 className="mb-2 text-2xl font-bold text-foreground ">
            Payment Confirmed
          </h1>
          <p className="mb-4 text-muted">
            Thank you! Your payment for invoice{" "}
            {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : ""} has been
            confirmed.
          </p>
          <p className="text-lg font-semibold text-foreground ">
            {formatCurrency(invoice.amount, invoice.currency)}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md rounded-3xl border border-border bg-surface p-8 shadow-lg shadow-slate-900/10">
        <h1 className="mb-6 text-2xl font-bold text-foreground">
          Invoice {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : ""}
        </h1>

        <div className="mb-6 space-y-3 rounded-3xl bg-surface-muted p-4">
          <div className="flex justify-between">
            <span className="text-sm text-muted">From</span>
            <span className="text-sm font-medium text-foreground">
              {invoice.clientName}
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
          {invoice.notes && (
            <div className="flex justify-between">
              <span className="text-sm text-muted ">Notes</span>
              <span className="text-sm text-foreground ">{invoice.notes}</span>
            </div>
          )}
        </div>

        <button
          onClick={handleConfirmPayment}
          disabled={confirming}
          className="w-full rounded-full bg-accent px-4 py-3 text-sm font-semibold text-surface shadow-sm transition hover:brightness-110 disabled:opacity-50"
        >
          {confirming ? "Confirming..." : "Confirm Payment"}
        </button>

        <p className="mt-4 text-center text-xs text-muted">
          This is a mock payment confirmation. No actual payment is processed.
        </p>
      </div>
    </main>
  );
}
