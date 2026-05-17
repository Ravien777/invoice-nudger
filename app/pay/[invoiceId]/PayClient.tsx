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
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
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
      <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-xl border border-green-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <svg className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-bold text-slate-900">Payment Confirmed</h1>
          <p className="mb-4 text-slate-600">
            Thank you! Your payment for invoice {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : ""} has been confirmed.
          </p>
          <p className="text-lg font-semibold text-slate-900">
            {formatCurrency(invoice.amount, invoice.currency)}
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <h1 className="mb-6 text-2xl font-bold text-slate-900">
          Invoice {invoice.invoiceNumber ? `#${invoice.invoiceNumber}` : ""}
        </h1>

        <div className="mb-6 space-y-3 rounded-lg bg-slate-50 p-4">
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">From</span>
            <span className="text-sm font-medium text-slate-900">{invoice.clientName}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Amount</span>
            <span className="text-lg font-bold text-slate-900">{formatCurrency(invoice.amount, invoice.currency)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Due Date</span>
            <span className="text-sm font-medium text-slate-900">{formatDate(invoice.dueDate)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-sm text-slate-500">Status</span>
            <span className="text-sm font-medium text-slate-900 capitalize">{invoice.status}</span>
          </div>
          {invoice.notes && (
            <div className="flex justify-between">
              <span className="text-sm text-slate-500">Notes</span>
              <span className="text-sm text-slate-900">{invoice.notes}</span>
            </div>
          )}
        </div>

        <button
          onClick={handleConfirmPayment}
          disabled={confirming}
          className="w-full rounded-md bg-green-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-green-700 disabled:opacity-50"
        >
          {confirming ? "Confirming..." : "Confirm Payment"}
        </button>

        <p className="mt-4 text-center text-xs text-slate-400">
          This is a mock payment confirmation. No actual payment is processed.
        </p>
      </div>
    </main>
  );
}
