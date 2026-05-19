"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  notes: string | null;
  source: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ScheduleStep {
  emailTemplate: string;
  daysOffset: number;
}

interface InvoiceTableProps {
  invoices: Invoice[];
  onUploadCsv?: () => void;
  scheduleSteps?: ScheduleStep[];
  onMarkPaid?: (id: string) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (id: string) => Promise<{ success: boolean }>;
}

function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
  }).format(amount);
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function statusBadge(status: string): string {
  switch (status) {
    case "paid":
      return "bg-[var(--success-muted)] text-[var(--success)]";
    case "cancelled":
      return "bg-surface-muted text-muted";
    case "overdue":
      return "bg-[var(--danger-muted)] text-[var(--danger)]";
    default:
      return "bg-[var(--warning-muted)] text-[var(--warning)]";
  }
}

function stepLabel(step: ScheduleStep): string {
  if (step.daysOffset < 0)
    return `${Math.abs(step.daysOffset)}d before — ${step.emailTemplate}`;
  if (step.daysOffset === 0) return `On due date — ${step.emailTemplate}`;
  return `${step.daysOffset}d after — ${step.emailTemplate}`;
}

export default function InvoiceTable({
  invoices,
  onUploadCsv,
  scheduleSteps,
  onMarkPaid,
  onDelete,
}: InvoiceTableProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpenDropdown(null);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this invoice?")) return;

    setDeleting(id);

    try {
      const result = await onDelete?.(id);
      if (!result?.success) {
        toast.error("Failed to delete invoice");
      } else {
        toast.success("Invoice deleted");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setDeleting(null);
    }
  }

  async function handleMarkPaid(id: string) {
    setMarkingPaid(id);

    try {
      const result = await onMarkPaid?.(id);
      if (!result?.success) {
        if (result?.error === "Invoice is already paid") {
          toast("Invoice is already paid", { icon: "✓" });
        } else {
          toast.error(result?.error || "Failed to mark as paid");
        }
      } else {
        toast.success("Invoice marked as paid");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setMarkingPaid(null);
    }
  }

  async function handleSendReminder(invoiceId: string, stepName: string) {
    setOpenDropdown(null);
    setSending(invoiceId);

    try {
      const res = await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, stepName }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send reminder");
        return;
      }

      toast.success(`Reminder sent: ${stepName}`);
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setSending(null);
    }
  }

  if (invoices.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
        <p className="text-muted">No invoices found.</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/invoices/new"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-surface transition hover:brightness-110"
          >
            Create your first invoice
          </Link>
          {onUploadCsv && (
            <button
              onClick={onUploadCsv}
              className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
            >
              Upload CSV
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-border bg-surface-muted">
          <tr>
            <th className="px-4 py-3 font-medium text-muted">Invoice #</th>
            <th className="px-4 py-3 font-medium text-muted">Client</th>
            <th className="px-4 py-3 font-medium text-muted">Amount</th>
            <th className="px-4 py-3 font-medium text-muted">Due Date</th>
            <th className="px-4 py-3 font-medium text-muted">Status</th>
            <th className="px-4 py-3 font-medium text-muted">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {invoices.map((inv) => (
            <tr key={inv.id} className="transition hover:bg-surface-muted">
              <td className="px-4 py-3 text-muted">
                {inv.invoiceNumber || "-"}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-foreground">
                  {inv.clientName}
                </div>
                <div className="text-xs text-muted">{inv.clientEmail}</div>
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                {formatCurrency(inv.amount, inv.currency)}
              </td>
              <td className="px-4 py-3 text-muted">
                {formatDate(inv.dueDate)}
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(inv.status)}`}
                  >
                    {inv.status}
                  </span>
                  {inv.source && inv.source !== "manual" && inv.source !== "csv" && (
                    <span className="inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted ring-1 ring-border">
                      {inv.source === "xero" ? "Xero" : inv.source === "quickbooks" ? "QuickBooks" : inv.source}
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/invoices/${inv.id}/edit`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-accent transition hover:bg-surface-muted"
                  >
                    Edit
                  </Link>
                  {inv.status !== "paid" && inv.status !== "cancelled" && (
                    <button
                      onClick={() => handleMarkPaid(inv.id)}
                      disabled={markingPaid === inv.id}
                      className="rounded-md px-2 py-1 text-xs font-medium text-[var(--success)] transition hover:bg-[var(--success-muted)] disabled:opacity-50"
                    >
                      {markingPaid === inv.id ? "Marking..." : "Mark Paid"}
                    </button>
                  )}
                  {inv.status !== "paid" &&
                    inv.status !== "cancelled" &&
                    scheduleSteps &&
                    scheduleSteps.length > 0 && (
                      <div
                        className="relative"
                        ref={openDropdown === inv.id ? dropdownRef : undefined}
                      >
                        <button
                          onClick={() =>
                            setOpenDropdown(
                              openDropdown === inv.id ? null : inv.id,
                            )
                          }
                          disabled={sending === inv.id}
                          className="rounded-md px-2 py-1 text-xs font-medium text-accent transition hover:bg-surface-muted disabled:opacity-50"
                        >
                          {sending === inv.id ? "Sending..." : "Send Reminder"}
                        </button>
                        {openDropdown === inv.id && (
                          <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-border bg-surface shadow-lg">
                            <div className="py-1">
                              {scheduleSteps.map((step) => (
                                <button
                                  key={step.emailTemplate}
                                  onClick={() =>
                                    handleSendReminder(
                                      inv.id,
                                      step.emailTemplate,
                                    )
                                  }
                                  className="block w-full px-4 py-2 text-left text-xs text-foreground transition hover:bg-surface-muted"
                                >
                                  {stepLabel(step)}
                                </button>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  <button
                    onClick={() => handleDelete(inv.id)}
                    disabled={deleting === inv.id}
                    className="rounded-md px-2 py-1 text-xs font-medium text-[var(--danger)] transition hover:bg-[var(--danger-muted)] disabled:opacity-50"
                  >
                    {deleting === inv.id ? "Deleting..." : "Delete"}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
