"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Pencil,
  Link as LinkIcon,
  Check,
  Sparkles,
  Bell,
  Trash2,
} from "lucide-react";
import {
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
} from "@/app/components/ui/Table";
import { Badge, type BadgeVariant } from "@/app/components/ui/Badge";
import { formatCurrency } from "@/lib/format-currency";
import { Button } from "@/app/components/ui/Button";

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
  paymentProbability: number | null;
  instantPayoutId: string | null;
  paidOutAt: string | null;
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
  onPayout?: (id: string) => Promise<{ success: boolean; error?: string }>;
  onDelete?: (id: string) => Promise<{ success: boolean }>;
  onGenerateAI?: (id: string) => void;
  riskScores?: Record<string, number>;
  probabilities?: Record<string, number>;
  userPlan?: string;
  selectedIds?: Set<string>;
  onSelectionChange?: (ids: Set<string>) => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function stepLabel(step: ScheduleStep): string {
  if (step.daysOffset < 0)
    return `${Math.abs(step.daysOffset)}d before — ${step.emailTemplate}`;
  if (step.daysOffset === 0) return `On due date — ${step.emailTemplate}`;
  return `${step.daysOffset}d after — ${step.emailTemplate}`;
}

function riskBadge(score: number | undefined): React.ReactNode {
  if (score === undefined) return null;
  let color: string;
  let label: string;
  if (score <= 0.3) {
    color = "bg-success/10 text-success";
    label = "Low";
  } else if (score <= 0.7) {
    color = "bg-warning/10 text-warning";
    label = "Med";
  } else {
    color = "bg-danger/10 text-danger";
    label = "High";
  }
  return (
    <span
      className={`ml-1.5 inline-block rounded-full px-1.5 py-0.5 text-[10px] font-medium ${color}`}
    >
      {label}
    </span>
  );
}

const PROBABILITY_PLAN = ["pro", "agency"];

function probabilityBadge(
  score: number | undefined,
  plan: string,
): React.ReactNode {
  if (score === undefined || !PROBABILITY_PLAN.includes(plan)) return null;
  let color: string;
  if (score >= 0.8) {
    color = "bg-success/10 text-success";
  } else if (score >= 0.5) {
    color = "bg-warning/10 text-warning";
  } else {
    color = "bg-danger/10 text-danger";
  }
  const pct = (score * 100).toFixed(0);
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${color}`}
      title={`${pct}% payment probability`}
    >
      {pct}%
    </span>
  );
}

export default function InvoiceTable({
  invoices,
  onUploadCsv,
  scheduleSteps,
  onMarkPaid,
  onPayout,
  onDelete,
  onGenerateAI,
  riskScores = {},
  probabilities = {},
  userPlan = "free",
  selectedIds = new Set(),
  onSelectionChange,
}: InvoiceTableProps) {
  const [sending, setSending] = useState<string | null>(null);
  const [markingPaid, setMarkingPaid] = useState<string | null>(null);
  const [payouting, setPayouting] = useState<string | null>(null);
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

  const toggleSelection = (id: string) => {
    if (!onSelectionChange) return;
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    onSelectionChange(next);
  };

  const toggleAll = () => {
    if (!onSelectionChange) return;
    if (selectedIds.size === invoices.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(invoices.map((inv) => inv.id)));
    }
  };

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

  const PLAN_WITH_PAYOUT = ["pro", "agency"];

  async function handlePayout(id: string) {
    const inv = invoices.find((i) => i.id === id);
    if (!inv) return;

    if (!PLAN_WITH_PAYOUT.includes(userPlan)) {
      toast.error("Upgrade to Pro to use Instant Payouts.");
      return;
    }

    if (
      !confirm(
        `Request an instant payout of ${formatCurrency(inv.amount, inv.currency)}?\nFunds will arrive in minutes (1% Stripe fee applies).`,
      )
    )
      return;

    setPayouting(id);

    try {
      const result = await onPayout?.(id);
      if (!result?.success) {
        toast.error(result?.error || "Failed to request payout");
      } else {
        toast.success("Instant payout requested successfully");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setPayouting(null);
    }
  }

  async function handleSendReminder(
    invoiceId: string,
    stepName: string,
    channel: "email" | "sms" | "whatsapp" = "email",
  ) {
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

  const allSelected =
    invoices.length > 0 && selectedIds.size === invoices.length;

  if (invoices.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="flex flex-col items-center gap-2 mb-4">
          <div className="h-12 w-12 rounded-full bg-surface-tertiary flex items-center justify-center">
            <svg
              className="h-6 w-6 text-text-tertiary"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
        </div>
        <h3 className="text-base font-medium text-text-secondary">
          No invoices found
        </h3>
        <p className="text-sm text-text-secondary mt-1 max-w-xs">
          Get started by creating your first invoice.
        </p>
        <div className="mt-4 flex items-center gap-3 flex-wrap">
          <Link
            href="/invoices/new"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent text-white hover:bg-accent-hover font-medium text-sm px-4 py-2 transition-colors"
          >
            Create your first invoice
          </Link>
          {onUploadCsv && (
            <Button variant="secondary" size="md" onClick={onUploadCsv}>
              Upload CSV
            </Button>
          )}
        </div>
      </div>
    );
  }

  return (
    <Table>
      <TableHead>
        <TableRow>
          <TableCell className="w-10">
            <button
              onClick={toggleAll}
              className={`h-4 w-4 rounded border transition-colors flex items-center justify-center ${
                allSelected
                  ? "bg-accent border-accent"
                  : "border-border-default hover:border-text-secondary"
              }`}
              aria-label={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected && (
                <svg
                  className="h-3 w-3 text-white"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={3}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              )}
            </button>
          </TableCell>
          <TableCell>Invoice #</TableCell>
          <TableCell>Client</TableCell>
          <TableCell>Amount</TableCell>
          <TableCell hideBelow="sm">Due Date</TableCell>
          <TableCell>Status</TableCell>
          {PROBABILITY_PLAN.includes(userPlan) && (
            <TableCell hideBelow="md">Prob.</TableCell>
          )}
          <TableCell>Actions</TableCell>
        </TableRow>
      </TableHead>
      <TableBody>
        {invoices.map((inv) => {
          const isSelected = selectedIds.has(inv.id);
          return (
            <TableRow key={inv.id} className={isSelected ? "bg-accent/5" : ""}>
              <TableCell className="w-10">
                <button
                  onClick={() => toggleSelection(inv.id)}
                  className={`h-4 w-4 rounded border transition-colors flex items-center justify-center ${
                    isSelected
                      ? "bg-accent border-accent"
                      : "border-border-default hover:border-text-secondary"
                  }`}
                  aria-label={isSelected ? "Deselect" : "Select"}
                >
                  {isSelected && (
                    <svg
                      className="h-3 w-3 text-white"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </button>
              </TableCell>
              <TableCell className="font-medium text-text-primary">
                {inv.invoiceNumber || inv.id.slice(0, 8)}
              </TableCell>
              <TableCell>
                <div className="font-medium text-text-primary">
                  <Link
                    href={`/clients/${encodeURIComponent(inv.clientEmail)}`}
                    className="hover:text-accent transition-colors"
                  >
                    {inv.clientName}
                  </Link>
                  {riskBadge(riskScores[inv.clientEmail])}
                </div>
                <div className="text-xs text-text-secondary">
                  {inv.clientEmail}
                  {inv.clientPhone && (
                    <span
                      className="ml-1 text-success"
                      title={`Phone: ${inv.clientPhone}`}
                    >
                      📞
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="font-medium text-text-primary">
                <div>
                  {formatCurrency(inv.amount, inv.currency)}
                  {inv.accruedFees > 0 && (
                    <span className="ml-1.5 text-xs text-danger">
                      +{formatCurrency(inv.accruedFees, inv.currency)} fees
                    </span>
                  )}
                </div>
                {inv.accruedFees > 0 && (
                  <div className="text-xs text-text-secondary">
                    Total:{" "}
                    {formatCurrency(inv.amount + inv.accruedFees, inv.currency)}
                  </div>
                )}
              </TableCell>
              <TableCell className="text-text-secondary" hideBelow="sm">
                {formatDate(inv.dueDate)}
              </TableCell>
              <TableCell>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant={inv.status as BadgeVariant}>
                    {inv.status}
                  </Badge>
                  {inv.status === "paid" && inv.paymentLink && (
                    <span className="inline-block rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-success/20">
                      Paid via Stripe
                    </span>
                  )}
                  {inv.source &&
                    inv.source !== "manual" &&
                    inv.source !== "csv" && (
                      <span className="inline-block rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] font-medium text-text-secondary ring-1 ring-border-default">
                        {inv.source === "xero"
                          ? "Xero"
                          : inv.source === "quickbooks"
                            ? "QuickBooks"
                            : inv.source}
                      </span>
                    )}
                  {inv.reconciliationStatus === "reconciled" && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-success/20"
                      title="Reconciled"
                    >
                      <svg
                        className="h-3 w-3"
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
                    </span>
                  )}
                  {inv.reconciliationStatus === "discrepancy" && (
                    <Link
                      href="/reconciliation"
                      className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning ring-1 ring-warning/20 hover:brightness-110"
                      title="Payment discrepancy - click to review"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      Discrepancy
                    </Link>
                  )}
                  {inv.promiseStatus === "active" && inv.promisedDate && (
                    <span
                      className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-success/20"
                      title={`Promise active until ${new Date(inv.promisedDate).toLocaleDateString()}`}
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      Promise: {new Date(inv.promisedDate).toLocaleDateString()}
                    </span>
                  )}
                  {inv.promiseStatus === "pending_review" && (
                    <Link
                      href="/promises"
                      className="inline-flex items-center gap-0.5 rounded-full bg-warning/10 px-2 py-0.5 text-[10px] font-medium text-warning ring-1 ring-warning/20 hover:brightness-110"
                      title="Promise pending review - click to review"
                    >
                      <svg
                        className="h-3 w-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      Review Promise
                    </Link>
                  )}
                </div>
              </TableCell>
              {PROBABILITY_PLAN.includes(userPlan) && (
                <TableCell hideBelow="md">
                  {inv.status !== "paid" && inv.status !== "cancelled" ? (
                    probabilityBadge(probabilities[inv.id], userPlan)
                  ) : (
                    <span className="text-xs text-text-secondary">—</span>
                  )}
                </TableCell>
              )}
              <TableCell>
                <div className="flex items-center gap-1.5 md:flex-wrap justify-end">
                  {inv.paymentLink ? (
                    <a
                      href={inv.paymentLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md px-2 py-1 text-xs font-medium text-success transition hover:bg-success/10"
                    >
                      Pay Now
                    </a>
                  ) : inv.status !== "paid" && inv.status !== "cancelled" ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-accent"
                      title="Payment Link"
                      onClick={() => handleCreatePaymentLink(inv.id)}
                      disabled={creatingLink === inv.id}
                      loading={creatingLink === inv.id}
                      icon={LinkIcon}
                    />
                  ) : null}
                  <Link
                    href={`/invoices/${inv.id}/edit`}
                    className="rounded-md p-2.5 text-accent hover:bg-surface-tertiary transition-colors"
                    title="Edit"
                  >
                    <Pencil className="h-4 w-4" />
                  </Link>
                  {inv.status !== "paid" && inv.status !== "cancelled" && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-success"
                      title="Mark Paid"
                      onClick={() => handleMarkPaid(inv.id)}
                      disabled={markingPaid === inv.id}
                      loading={markingPaid === inv.id}
                      icon={Check}
                    />
                  )}
                  {inv.status === "paid" && !inv.instantPayoutId && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className={
                        PLAN_WITH_PAYOUT.includes(userPlan)
                          ? "text-amber-500"
                          : "text-text-tertiary opacity-50 cursor-not-allowed"
                      }
                      title={
                        PLAN_WITH_PAYOUT.includes(userPlan)
                          ? "Get Paid Now — funds arrive in minutes"
                          : "Upgrade to Pro to use Instant Payouts."
                      }
                      onClick={() =>
                        PLAN_WITH_PAYOUT.includes(userPlan) &&
                        handlePayout(inv.id)
                      }
                      disabled={
                        payouting === inv.id ||
                        !PLAN_WITH_PAYOUT.includes(userPlan)
                      }
                      loading={payouting === inv.id}
                    >
                      {PLAN_WITH_PAYOUT.includes(userPlan)
                        ? "Get Paid Now"
                        : "Pro"}
                    </Button>
                  )}
                  {inv.status === "paid" && inv.instantPayoutId && (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success ring-1 ring-success/20">
                      Paid Out
                    </span>
                  )}
                  {inv.status !== "paid" &&
                    inv.status !== "cancelled" &&
                    scheduleSteps &&
                    scheduleSteps.length > 0 && (
                      <>
                        {onGenerateAI && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-purple-500"
                            title="Generate AI"
                            onClick={() => onGenerateAI(inv.id)}
                            icon={Sparkles}
                          />
                        )}
                        <div
                          className="relative"
                          ref={
                            openDropdown === inv.id ? dropdownRef : undefined
                          }
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-accent"
                            title="Send Reminder"
                            onClick={() =>
                              setOpenDropdown(
                                openDropdown === inv.id ? null : inv.id,
                              )
                            }
                            disabled={sending === inv.id}
                            loading={sending === inv.id}
                            icon={Bell}
                          />
                          {openDropdown === inv.id && (
                            <div className="absolute right-0 z-10 mt-1 w-64 rounded-lg border border-border-default bg-surface-secondary shadow-lg">
                              <div className="py-1">
                                <div className="px-4 py-1.5 text-[10px] font-medium uppercase text-text-tertiary">
                                  Email
                                </div>
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
                                    className="block w-full px-4 py-2 text-left text-xs text-text-primary transition hover:bg-surface-tertiary"
                                  >
                                    {stepLabel(step)}
                                  </button>
                                ))}
                                {inv.clientPhone && (
                                  <>
                                    <div className="mt-1 border-t border-border-default px-4 py-1.5 text-[10px] font-medium uppercase text-text-tertiary">
                                      Phone
                                    </div>
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
                                        className="block w-full px-4 py-2 text-left text-xs text-text-primary transition hover:bg-surface-tertiary"
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
                                        className="block w-full px-4 py-2 text-left text-xs text-text-primary transition hover:bg-surface-tertiary"
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
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-danger"
                    title="Delete"
                    onClick={() => handleDelete(inv.id)}
                    disabled={deleting === inv.id}
                    loading={deleting === inv.id}
                    icon={Trash2}
                  />
                </div>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}
