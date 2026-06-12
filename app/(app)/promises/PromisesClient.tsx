"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { formatCurrency } from "@/lib/format-currency";

interface Invoice {
  id: string;
  invoiceNumber: string | null;
  clientName: string;
  clientEmail: string;
  amount: number;
  currency: string;
  dueDate: Date;
  status: string;
}

interface PromiseEvent {
  id: string;
  invoiceId: string;
  detectedAt: Date;
  promisedDate: Date;
  emailSubject: string | null;
  emailSnippet: string | null;
  confidence: number;
  status: string;
  reviewedBy: string | null;
  reviewedAt: Date | null;
  invoice: Invoice;
}

interface PromisesClientProps {
  initialPromises: PromiseEvent[];
  pendingCount: number;
}

type FilterStatus =
  | "all"
  | "pending_review"
  | "active"
  | "expired"
  | "overridden"
  | "fulfilled";

function statusBadgeStyle(status: string): string {
  switch (status) {
    case "active":
      return "bg-success/10 text-success";
    case "pending_review":
      return "bg-warning/10 text-warning";
    case "expired":
      return "bg-surface-tertiary text-text-tertiary";
    case "overridden":
      return "bg-surface-tertiary text-text-tertiary";
    case "fulfilled":
      return "bg-success/10 text-success";
    default:
      return "bg-surface-tertiary text-text-tertiary";
  }
}

export default function PromisesClient({
  initialPromises,
  pendingCount,
}: PromisesClientProps) {
  const [promises, setPromises] = useState<PromiseEvent[]>(initialPromises);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [processing, setProcessing] = useState<string | null>(null);
  const [overrideDate, setOverrideDate] = useState<Record<string, string>>({});

  async function handleAction(id: string, action: string) {
    setProcessing(id);
    try {
      const body: Record<string, string> = { action };
      if (action === "override" && overrideDate[id]) {
        body.promisedDate = overrideDate[id];
      }

      const res = await fetch(`/api/promises/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || "Action failed");
        return;
      }

      setPromises((prev) =>
        prev.map((p) =>
          p.id === id
            ? {
                ...p,
                ...data.promise,
                invoice: { ...p.invoice, ...data.invoice },
              }
            : p,
        ),
      );

      const labels: Record<string, string> = {
        approve: "Promise approved",
        reject: "Promise rejected",
        override: "Promise date updated",
        "mark-fulfilled": "Marked as fulfilled",
      };
      toast.success(labels[action] || "Action completed");
    } catch {
      toast.error("Network error");
    } finally {
      setProcessing(null);
    }
  }

  const filtered =
    filter === "all"
      ? promises
      : promises.filter((p) => p.status === filter);

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

  const filters: FilterStatus[] = [
    "all",
    "pending_review",
    "active",
    "expired",
    "fulfilled",
  ];

  return (
    <div className="space-y-4">
      {/* Pending count badge */}
      {pendingCount > 0 && (
        <div className="inline-flex items-center rounded-full bg-warning/10 px-3 py-1 text-xs font-medium text-warning">
          {pendingCount} pending review
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-surface-tertiary p-1 w-fit">
        {filters.map((s) => (
          <Button
            key={s}
            variant="ghost"
            size="sm"
            onClick={() => setFilter(s)}
            className={filter === s ? "bg-surface-primary text-text-primary shadow-sm" : ""}
          >
            {s === "all"
              ? "All"
              : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </Button>
        ))}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No promises found"
          description={
            filter !== "all"
              ? "No promises match this status."
              : "No payment promises have been detected yet."
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((promise) => (
            <div
              key={promise.id}
              className="rounded-xl border border-border-default bg-surface-secondary p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <h3 className="text-lg font-semibold text-text-primary">
                      {promise.invoice.clientName}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeStyle(promise.status)}`}
                    >
                      {promise.status.replace("_", " ")}
                    </span>
                    <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2 py-0.5 text-xs font-medium text-text-secondary border border-border-default">
                      {Math.round(promise.confidence * 100)}% confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-text-secondary">Invoice:</span>{" "}
                      <span className="text-text-primary">
                        {promise.invoice.invoiceNumber ?? promise.invoice.id}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-secondary">Amount:</span>{" "}
                      <span className="font-medium text-text-primary">
                        {formatCurrency(
                          promise.invoice.amount,
                          promise.invoice.currency,
                        )}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-secondary">
                        Promised Date:
                      </span>{" "}
                      <span className="text-text-primary">
                        {formatDate(promise.promisedDate)}
                      </span>
                    </div>
                    <div>
                      <span className="text-text-secondary">Detected:</span>{" "}
                      <span className="text-text-primary">
                        {formatDate(promise.detectedAt)}
                      </span>
                    </div>
                  </div>

                  {promise.emailSnippet && (
                    <div className="rounded-lg bg-surface-tertiary p-3 text-xs text-text-secondary">
                      <p className="font-medium text-text-primary mb-1">
                        {promise.emailSubject ?? "Reply"}
                      </p>
                      <p className="line-clamp-2">{promise.emailSnippet}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* pending_review actions */}
              {promise.status === "pending_review" && (
              <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border-default pt-4">
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={() => handleAction(promise.id, "approve")}
                    disabled={processing === promise.id}
                    loading={processing === promise.id}
                  >
                    Approve & Pause
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction(promise.id, "reject")}
                    disabled={processing === promise.id}
                  >
                    Reject
                  </Button>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="date"
                      value={overrideDate[promise.id] ?? ""}

                      onChange={(e) =>
                        setOverrideDate((prev) => ({
                          ...prev,
                          [promise.id]: e.target.value,
                        }))
                      }
                      className="w-40"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAction(promise.id, "override")}
                      disabled={processing === promise.id}
                    >
                      Override Date
                    </Button>
                  </div>
                </div>
              )}

              {/* active actions */}
              {promise.status === "active" && (
                <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-border-default pt-4">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Input
                      type="date"
                      value={overrideDate[promise.id] ?? ""}
                      onChange={(e) =>
                        setOverrideDate((prev) => ({
                          ...prev,
                          [promise.id]: e.target.value,
                        }))
                      }
                      className="w-40"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleAction(promise.id, "override")}
                      disabled={
                        processing === promise.id || !overrideDate[promise.id]
                      }
                    >
                      Change Date
                    </Button>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleAction(promise.id, "mark-fulfilled")}
                    disabled={processing === promise.id}
                  >
                    Mark Fulfilled
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
