"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Modal } from "@/app/components/ui/Modal";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/app/components/ui/Table";

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

type Tab = "discrepancies" | "recent";

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );
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

function paymentBadgeColor(status: string): string {
  switch (status) {
    case "refunded":
      return "bg-danger/10 text-danger";
    case "conflict":
      return "bg-warning/10 text-warning";
    default:
      return "bg-success/10 text-success";
  }
}

export default function ReconciliationClient({
  summary,
  discrepancies: initialDiscrepancies,
  recent: initialRecent,
}: ReconciliationClientProps) {
  const [activeTab, setActiveTab] = useState<Tab>("discrepancies");
  const [discrepancies, setDiscrepancies] = useState(initialDiscrepancies);
  const [resolving, setResolving] = useState<string | null>(null);
  const [resolveModal, setResolveModal] = useState<InvoiceWithPayments | null>(
    null,
  );

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
      toast.success(
        action === "force_reconcile"
          ? "Invoice reconciled"
          : "Invoice ignored",
      );
      setResolveModal(null);
    } catch {
      toast.error("Network error");
    } finally {
      setResolving(null);
    }
  }

  return (
    <div className="space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-border-default bg-surface-secondary p-5 shadow-sm">
          <p className="text-sm text-text-secondary">With Payments</p>
          <p className="mt-1 text-2xl font-bold text-text-primary">
            {summary.totalWithPayments}
          </p>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-secondary p-5 shadow-sm">
          <p className="text-sm text-text-secondary">Reconciled</p>
          <p className="mt-1 text-2xl font-bold text-success">
            {summary.reconciled}
          </p>
        </div>
        <div className="rounded-xl border border-border-default bg-surface-secondary p-5 shadow-sm">
          <p className="text-sm text-text-secondary">Discrepancies</p>
          <p className="mt-1 text-2xl font-bold text-warning">
            {summary.discrepancy}
          </p>
        </div>
      </div>

      {/* Tab bar */}
      <div className="inline-flex gap-1 rounded-lg bg-surface-tertiary p-1">
        <button
          onClick={() => setActiveTab("discrepancies")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "discrepancies"
              ? "bg-surface-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Discrepancies
          {discrepancies.length > 0 && (
            <span className="ml-1.5 inline-flex items-center rounded-full bg-warning/10 px-1.5 py-0.5 text-xs text-warning">
              {discrepancies.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("recent")}
          className={`rounded-md px-4 py-2 text-sm font-medium transition ${
            activeTab === "recent"
              ? "bg-surface-primary text-text-primary shadow-sm"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          Recent
        </button>
      </div>

      {/* Discrepancies tab */}
      {activeTab === "discrepancies" && (
        <div>
          {discrepancies.length === 0 ? (
            <EmptyState
              title="No discrepancies to resolve"
              description="All payments are properly matched to their invoices."
            />
          ) : (
            <div className="space-y-4">
              {discrepancies.map((inv) => (
                <div
                  key={inv.id}
                  className="rounded-xl border border-border-default bg-surface-secondary p-5 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between">
                    <div>
                      <h3 className="text-sm font-semibold text-text-primary">
                        {inv.invoiceNumber
                          ? `#${inv.invoiceNumber}`
                          : "Invoice"}{" "}
                        &mdash; {inv.clientName}
                      </h3>
                      <p className="text-sm text-text-secondary">
                        Expected:{" "}
                        {formatCurrency(inv.amount, inv.currency)}
                      </p>
                    </div>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => setResolveModal(inv)}
                    >
                      Resolve
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {inv.payments.map((p) => (
                      <div
                        key={p.id}
                        className="flex items-center justify-between rounded-lg bg-surface-tertiary p-3 text-sm"
                      >
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${paymentBadgeColor(p.status)}`}
                          >
                            {sourceLabels[p.source] || p.source}
                          </span>
                          <span className="font-medium text-text-primary">
                            {formatCurrency(p.amount, p.currency)}
                          </span>
                        </div>
                        <div className="text-xs text-text-secondary">
                          {p.referenceId && (
                            <span className="mr-2">{p.referenceId}</span>
                          )}
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

      {/* Recent tab */}
      {activeTab === "recent" && (
        <div>
          {initialRecent.length === 0 ? (
            <EmptyState
              title="No reconciled invoices yet"
              description="Reconciled invoices with matched payments will appear here."
            />
          ) : (
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Invoice</TableCell>
                  <TableCell>Client</TableCell>
                  <TableCell>Amount</TableCell>
                  <TableCell>Sources</TableCell>
                  <TableCell>Reconciled</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {initialRecent.map((inv) => (
                  <TableRow key={inv.id}>
                    <TableCell>
                      {inv.invoiceNumber
                        ? `#${inv.invoiceNumber}`
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium text-text-primary">
                      {inv.clientName}
                    </TableCell>
                    <TableCell className="font-medium text-text-primary">
                      {formatCurrency(inv.amount, inv.currency)}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        {[
                          ...new Set(inv.payments.map((p) => p.source)),
                        ].map((s) => (
                          <span
                            key={s}
                            className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-xs font-medium text-success"
                          >
                            {sourceLabels[s] || s}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      {inv.lastReconciledAt
                        ? formatDate(inv.lastReconciledAt)
                        : "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      )}

      {/* Resolve modal */}
      {resolveModal && (
        <Modal
          open={!!resolveModal}
          onClose={() => setResolveModal(null)}
          title="Resolve Discrepancy"
          size="md"
          footer={
            <>
              <Button
                variant="secondary"
                onClick={() => handleResolve(resolveModal.id, "ignore")}
                disabled={resolving === resolveModal.id}
              >
                Ignore
              </Button>
              <Button
                variant="primary"
                onClick={() =>
                  handleResolve(resolveModal.id, "force_reconcile")
                }
                disabled={resolving === resolveModal.id}
                loading={resolving === resolveModal.id}
              >
                Force Reconcile
              </Button>
            </>
          }
        >
          <p className="mb-4 text-sm text-text-secondary">
            Invoice{" "}
            <strong className="text-text-primary">
              {resolveModal.invoiceNumber
                ? `#${resolveModal.invoiceNumber}`
                : resolveModal.id}
            </strong>{" "}
            &mdash;{" "}
            <strong className="text-text-primary">
              {resolveModal.clientName}
            </strong>
          </p>
          <div className="mb-4 space-y-2">
            {resolveModal.payments.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between rounded-lg bg-surface-tertiary p-3 text-sm"
              >
                <span className="font-medium text-text-primary">
                  {sourceLabels[p.source] || p.source}
                </span>
                <span className="font-semibold text-text-primary">
                  {formatCurrency(p.amount, p.currency)}
                </span>
              </div>
            ))}
          </div>
          <p className="text-sm text-text-secondary">
            Expected:{" "}
            <strong className="text-text-primary">
              {formatCurrency(resolveModal.amount, resolveModal.currency)}
            </strong>
          </p>
        </Modal>
      )}
    </div>
  );
}
