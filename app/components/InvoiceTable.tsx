"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string;
  clientPhone: string | null;
  projectName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  notes: string | null;
  source: string | null;
  paymentLink: string | null;
  paidAt: string | null;
  reconciliationStatus: string | null;
  promiseStatus: string | null;
  promisedDate: string | null;
  promiseConfidence: number | null;
  lateFeeEnabled: boolean;
  lateFeeAmount: number;
  interestRate: number;
  accruedFees: number;
  feeCap: number;
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
  onGenerateAI?: (id: string) => void;
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
  onGenerateAI,
}: InvoiceTableProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState<string | null>(null);
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

  async function handleCreatePaymentLink(id: string) {
    setCreatingLink(id);

    try {
      const res = await fetch("/api/stripe/create-payment-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: id }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to create payment link");
        return;
      }

      toast.success("Payment link created");
      window.open(data.url, "_blank");
      window.location.reload();
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setCreatingLink(null);
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

  async function handleSendReminder(invoiceId: string, stepName: string, channel: "email" | "sms" | "whatsapp" = "email") {
    setOpenDropdown(null);
    setSending(invoiceId);

    try {
      const res = await fetch("/api/send-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId, stepName, channel }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Failed to send reminder");
        return;
      }

      const channelLabel = channel === "email" ? "" : ` (${channel})`;
      toast.success(`Reminder sent: ${stepName}${channelLabel}`);
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
                <div className="text-xs text-muted">
                  {inv.clientEmail}
                  {inv.clientPhone && (
                    <span className="ml-1 text-[var(--success)]" title={`Phone: ${inv.clientPhone}`}>
                      📞
                    </span>
                  )}
                </div>
              </td>
              <td className="px-4 py-3 font-medium text-foreground">
                <div>
                  {formatCurrency(inv.amount, inv.currency)}
                  {inv.accruedFees > 0 && (
                    <span className="ml-1.5 text-xs text-[var(--danger)]">
                      +{formatCurrency(inv.accruedFees, inv.currency)} fees
                    </span>
                  )}
                </div>
                {inv.accruedFees > 0 && (
                  <div className="text-xs text-muted">
                    Total: {formatCurrency(inv.amount + inv.accruedFees, inv.currency)}
                  </div>
                )}
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
                  {inv.status === "paid" && inv.paymentLink && (
                    <span className="inline-block rounded-full bg-[var(--success-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)] ring-1 ring-[var(--success)]/20">
                      Paid via Stripe
                    </span>
                  )}
                  {inv.source && inv.source !== "manual" && inv.source !== "csv" && (
                    <span className="inline-block rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted ring-1 ring-border">
                      {inv.source === "xero" ? "Xero" : inv.source === "quickbooks" ? "QuickBooks" : inv.source}
                    </span>
                  )}
                  {inv.reconciliationStatus === "reconciled" && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--success-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)] ring-1 ring-[var(--success)]/20" title="Reconciled">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                  {inv.reconciliationStatus === "discrepancy" && (
                    <Link
                      href="/reconciliation"
                      className="inline-flex items-center gap-0.5 rounded-full bg-[var(--warning-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)] ring-1 ring-[var(--warning)]/20 hover:brightness-110"
                      title="Payment discrepancy - click to review"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      Discrepancy
                    </Link>
                  )}
                  {inv.promiseStatus === "active" && inv.promisedDate && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-[var(--success-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--success)] ring-1 ring-[var(--success)]/20" title={`Promise active until ${new Date(inv.promisedDate).toLocaleDateString()}`}>
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Promise: {new Date(inv.promisedDate).toLocaleDateString()}
                    </span>
                  )}
                  {inv.promiseStatus === "pending_review" && (
                    <Link
                      href="/promises"
                      className="inline-flex items-center gap-0.5 rounded-full bg-[var(--warning-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--warning)] ring-1 ring-[var(--warning)]/20 hover:brightness-110"
                      title="Promise pending review - click to review"
                    >
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Review Promise
                    </Link>
                  )}
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-1.5">
                  {inv.paymentLink ? (
                    <a
                      href={inv.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md px-2 py-1 text-xs font-medium text-[var(--success)] transition hover:bg-[var(--success-muted)]"
                    >
                      Pay Now
                    </a>
                  ) : inv.status !== "paid" && inv.status !== "cancelled" ? (
                    <button
                      onClick={() => handleCreatePaymentLink(inv.id)}
                      disabled={creatingLink === inv.id}
                      className="rounded-md px-2 py-1 text-xs font-medium text-accent transition hover:bg-surface-muted disabled:opacity-50"
                    >
                      {creatingLink === inv.id ? "Creating..." : "Payment Link"}
                    </button>
                  ) : null}
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
                      <>
                        {onGenerateAI && (
                          <button
                            onClick={() => onGenerateAI(inv.id)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-purple-500 transition hover:bg-purple-500/10"
                          >
                            Generate AI
                          </button>
                        )}
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
                          <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-border bg-surface shadow-lg">
                            <div className="py-1">
                              <div className="px-4 py-1.5 text-[10px] font-medium uppercase text-muted">Email</div>
                              {scheduleSteps.map((step) => (
                                <button
                                  key={step.emailTemplate}
                                  onClick={() =>
                                    handleSendReminder(
                                      inv.id,
                                      step.emailTemplate,
                                      "email",
                                    )
                                  }
                                  className="block w-full px-4 py-2 text-left text-xs text-foreground transition hover:bg-surface-muted"
                                >
                                  {stepLabel(step)}
                                </button>
                              ))}
                              {inv.clientPhone && (
                                <>
                                  <div className="mt-1 border-t border-border px-4 py-1.5 text-[10px] font-medium uppercase text-muted">Phone</div>
                                  {scheduleSteps.map((step) => (
                                    <button
                                      key={`sms-${step.emailTemplate}`}
                                      onClick={() =>
                                        handleSendReminder(
                                          inv.id,
                                          step.emailTemplate,
                                          "sms",
                                        )
                                      }
                                      className="block w-full px-4 py-2 text-left text-xs text-foreground transition hover:bg-surface-muted"
                                    >
                                      SMS — {stepLabel(step)}
                                    </button>
                                  ))}
                                  {scheduleSteps.map((step) => (
                                    <button
                                      key={`wa-${step.emailTemplate}`}
                                      onClick={() =>
                                        handleSendReminder(
                                          inv.id,
                                          step.emailTemplate,
                                          "whatsapp",
                                        )
                                      }
                                      className="block w-full px-4 py-2 text-left text-xs text-foreground transition hover:bg-surface-muted"
                                    >
                                      WhatsApp — {stepLabel(step)}
                                    </button>
                                  ))}
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                      </>
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
