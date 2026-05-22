"use client";

import { useState } from "react";
import toast from "react-hot-toast";

interface Payment {
  id: string;
  source: string;
  amount: number;
  currency: string;
  paidAt: string;
  referenceId: string | null;
  status: string;
  notes: string | null;
}

interface InvoiceWithPayments {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  amount: number;
  currency: string;
  payments: Payment[];
  updatedAt?: string;
  lastReconciledAt?: string | null;
}

interface Summary {
  reconciled: number;
  discrepancy: number;
  totalWithPayments: number;
}

interface ReconciliationClientProps {
  summary: Summary;
  discrepancies: InvoiceWithPayments[];
  recent: InvoiceWithPayments[];
}

type Tab = "discrepancies" | "recent" | "all";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const sourceLabels: Record<string, string> = {
  stripe: "Stripe",
  manual: "Manual",
  xero: "Xero",
  quickbooks: "QuickBooks",
  portal: "Portal",
};

export default function ReconciliationClient({ summary, discrepancies: initialDiscrepancies, recent: initialRecent }: ReconciliationClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("discrepancies");
  const [discrepancies, setDiscrepancies] = useState(initialDiscrepancies);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<InvoiceWithPayments | null>(null);

  async function handleResolve(invoiceId: string, action: string) {
    setResolving(invoiceId);
    try {
      const res = await fetch(`/api/reconciliation/${invoiceId}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error || "Failed to resolve");
        return;
      }

      setDiscrepancies((prev) => prev.filter((inv) => inv.id !== invoiceId));
      toast.success(`Invoice ${action === "force_reconcile" ? "reconciled" : action === "ignore" ? "ignored" : "marked as discrepancy"}`);
      setResolveModal(null);
    } catch {
      toast.error("Network error");
    } finally {
      setResolving(null);
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Payment Reconciliation</h1>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">With Payments</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{summary.totalWithPayments}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">Reconciled</p>
          <p className="mt-1 text-2xl font-bold text-[var(--success)]">{summary.reconciled}</p>
        </div>
        <div className="rounded-xl border border-border bg-surface p-5 shadow-sm">
          <p className="text-sm text-muted">Discrepancies</p>
          <p className="mt-1 text-2xl font-bold text-[var(--warning)]">{summary.discrepancy}</p>
        </div>
      </div>

      <div className="mb-6 flex gap-1 rounded-lg bg-surface-muted p-1 w-fit">
        <button
          onClick={() => setActiveTab("discrepancies")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "discrepancies"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Discrepancies
          {discrepancies.length > 0 && (
            <span className="ml-1.5 rounded-full bg-[var(--warning-muted)] px-1.5 py-0.5 text-xs text-[var(--warning)]">
              {discrepancies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "recent"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Recent
        </button>
      </div>

      {activeTab === "discrepancies" && (
        <div>
          {discrepancies.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
              <p className="text-muted">No discrepancies to resolve.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {discrepancies.map((inv) => (
                <div key={inv.id} className="rounded-xl border border-border bg-surface p-5 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-foreground">
                        {inv.invoiceNumber ? `#${inv.invoiceNumber}` : "Invoice"} — {inv.clientName}
                      </h3>
                      <p className="text-sm text-muted">
                        Expected: {formatCurrency(inv.amount, inv.currency)}
                      </p>
                    </div>
                    <button
                      onClick={() => setResolveModal(inv)}
                      className="rounded-lg bg-accent px-3 py-1.5 text-xs font-medium text-surface shadow-sm transition hover:brightness-110"
                    >
                      Resolve
                    </button>
                  </div>
                  <div className="space-y-2">
                    {inv.payments.map((p) => (
                      <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface-muted p-3 text-sm">
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                            p.status === "refunded"
                              ? "bg-[var(--danger-muted)] text-[var(--danger)]"
                              : p.status === "conflict"
                              ? "bg-[var(--warning-muted)] text-[var(--warning)]"
                              : "bg-[var(--success-muted)] text-[var(--success)]"
                          }`}>
                            {sourceLabels[p.source] || p.source}
                          </span>
                          <span className="font-medium text-foreground">
                            {formatCurrency(p.amount, p.currency)}
                          </span>
                        </div>
                        <div className="text-xs text-muted">
                          {p.referenceId && <span className="mr-2">{p.referenceId}</span>}
                          <span>{formatDate(p.paidAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "recent" && (
        <div>
          {initialRecent.length === 0 ? (
            <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
              <p className="text-muted">No reconciled invoices yet.</p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-surface-muted">
                  <tr>
                    <th className="px-4 py-3 font-medium text-muted">Invoice</th>
                    <th className="px-4 py-3 font-medium text-muted">Client</th>
                    <th className="px-4 py-3 font-medium text-muted">Amount</th>
                    <th className="px-4 py-3 font-medium text-muted">Sources</th>
                    <th className="px-4 py-3 font-medium text-muted">Reconciled</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {initialRecent.map((inv) => (
                    <tr key={inv.id} className="transition hover:bg-surface-muted">
                      <td className="px-4 py-3 text-muted">
                        {inv.invoiceNumber ? `#${inv.invoiceNumber}` : "-"}
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{inv.clientName}</td>
                      <td className="px-4 py-3 font-medium text-foreground">
                        {formatCurrency(inv.amount, inv.currency)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {[...new Set(inv.payments.map((p) => p.source))].map((s) => (
                            <span key={s} className="rounded-full bg-[var(--success-muted)] px-2 py-0.5 text-xs font-medium text-[var(--success)]">
                              {sourceLabels[s] || s}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {inv.lastReconciledAt ? formatDate(inv.lastReconciledAt) : "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {resolveModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface shadow-xl">
            <div className="flex items-center justify-between border-b border-border px-6 py-4">
              <h2 className="text-lg font-semibold text-foreground">Resolve Discrepancy</h2>
              <button
                onClick={() => setResolveModal(null)}
                className="rounded-lg p-1.5 text-muted transition hover:bg-surface-muted hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6">
              <p className="mb-4 text-sm text-muted">
                Invoice <strong>{resolveModal.invoiceNumber ? `#${resolveModal.invoiceNumber}` : resolveModal.id}</strong> — {resolveModal.clientName}
              </p>

              <div className="mb-4 space-y-2">
                {resolveModal.payments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-lg bg-surface-muted p-3 text-sm">
                    <span className="font-medium text-foreground">{sourceLabels[p.source] || p.source}</span>
                    <span className="font-semibold text-foreground">{formatCurrency(p.amount, p.currency)}</span>
                  </div>
                ))}
              </div>

              <p className="mb-4 text-sm text-muted">
                Expected: <strong>{formatCurrency(resolveModal.amount, resolveModal.currency)}</strong>
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => handleResolve(resolveModal.id, "force_reconcile")}
                  disabled={resolving === resolveModal.id}
                  className="flex-1 rounded-lg bg-[var(--success)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                >
                  {resolving === resolveModal.id ? "Resolving..." : "Force Reconcile"}
                </button>
                <button
                  onClick={() => handleResolve(resolveModal.id, "ignore")}
                  disabled={resolving === resolveModal.id}
                  className="flex-1 rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                >
                  Ignore
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
