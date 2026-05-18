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
      return "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400";
    case "cancelled":
      return "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300";
    case "overdue":
      return "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400";
  }
}

function stepLabel(step: ScheduleStep): string {
  if (step.daysOffset < 0) return `${Math.abs(step.daysOffset)}d before — ${step.emailTemplate}`;
  if (step.daysOffset === 0) return `On due date — ${step.emailTemplate}`;
  return `${step.daysOffset}d after — ${step.emailTemplate}`;
}

export default function InvoiceTable({ invoices, onUploadCsv, scheduleSteps, onMarkPaid, onDelete }: InvoiceTableProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
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
      <div className="rounded-xl border border-slate-200 bg-white p-12 text-center shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <p className="text-slate-500 dark:text-slate-400">No invoices found.</p>
        <div className="mt-4 flex items-center justify-center gap-3">
          <Link
            href="/invoices/new"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-400"
          >
            Create your first invoice
          </Link>
          {onUploadCsv && (
            <button
              onClick={onUploadCsv}
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 transition hover:bg-slate-50 dark:bg-slate-700 dark:text-slate-200 dark:ring-slate-600 dark:hover:bg-slate-600"
            >
              Upload CSV
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800">
      <table className="w-full text-left text-sm">
        <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/80">
          <tr>
            <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Invoice #</th>
            <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Client</th>
            <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Amount</th>
            <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Due Date</th>
            <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Status</th>
            <th className="px-4 py-3 font-medium text-slate-600 dark:text-slate-300">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {invoices.map((inv) => (
            <tr key={inv.id} className="transition hover:bg-slate-50 dark:hover:bg-slate-700/50">
              <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                {inv.invoiceNumber || "-"}
              </td>
              <td className="px-4 py-3">
                <div className="font-medium text-slate-900 dark:text-white">
                  {inv.clientName}
                </div>
                <div className="text-xs text-slate-500 dark:text-slate-400">{inv.clientEmail}</div>
              </td>
              <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">
                {formatCurrency(inv.amount, inv.currency)}
              </td>
              <td className="px-4 py-3 text-slate-600 dark:text-slate-300">
                {formatDate(inv.dueDate)}
              </td>
              <td className="px-4 py-3">
                <span
                  className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(inv.status)}`}
                >
                  {inv.status}
                </span>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/invoices/${inv.id}/edit`}
                    className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30"
                  >
                    Edit
                  </Link>
                  {inv.status !== "paid" && inv.status !== "cancelled" && (
                    <button
                      onClick={() => handleMarkPaid(inv.id)}
                      disabled={markingPaid === inv.id}
                      className="rounded-md px-2 py-1 text-xs font-medium text-green-700 transition hover:bg-green-50 disabled:opacity-50 dark:text-green-400 dark:hover:bg-green-900/30"
                    >
                      {markingPaid === inv.id ? "Marking..." : "Mark Paid"}
                    </button>
                  )}
                  {inv.status !== "paid" && inv.status !== "cancelled" && scheduleSteps && scheduleSteps.length > 0 && (
                    <div className="relative" ref={openDropdown === inv.id ? dropdownRef : undefined}>
                      <button
                        onClick={() => setOpenDropdown(openDropdown === inv.id ? null : inv.id)}
                        disabled={sending === inv.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-amber-700 transition hover:bg-amber-50 disabled:opacity-50 dark:text-amber-400 dark:hover:bg-amber-900/30"
                      >
                        {sending === inv.id ? "Sending..." : "Send Reminder"}
                      </button>
                      {openDropdown === inv.id && (
                        <div className="absolute right-0 z-10 mt-1 w-56 rounded-lg border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-800">
                          <div className="py-1">
                            {scheduleSteps.map((step) => (
                              <button
                                key={step.emailTemplate}
                                onClick={() => handleSendReminder(inv.id, step.emailTemplate)}
                                className="block w-full px-4 py-2 text-left text-xs text-slate-700 transition hover:bg-slate-50 dark:text-slate-200 dark:hover:bg-slate-700"
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
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50 dark:text-red-400 dark:hover:bg-red-900/30"
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
