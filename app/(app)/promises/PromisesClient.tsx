"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";

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

type FilterStatus = "all" | "pending_review" | "active" | "expired" | "overridden" | "fulfilled";

export default function PromisesClient({ initialPromises, pendingCount }: PromisesClientProps) {
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
            ? { ...p, ...data.promise, invoice: { ...p.invoice, ...data.invoice } }
            : p
        )
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

  const filtered = filter === "all" ? promises : promises.filter((p) => p.status === filter);

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return "bg-[var(--success-muted)] text-[var(--success)]";
      case "pending_review":
        return "bg-[var(--warning-muted)] text-[var(--warning)]";
      case "expired":
        return "bg-surface-muted text-muted";
      case "overridden":
        return "bg-surface-muted text-muted";
      case "fulfilled":
        return "bg-[var(--success-muted)] text-[var(--success)]";
      default:
        return "bg-surface-muted text-muted";
    }
  };

  const formatDate = (date: Date | string) =>
    new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });

  const formatCurrency = (amount: number, currency: string) =>
    new Intl.NumberFormat("en-US", { style: "currency", currency }).format(amount);

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promise Detection</h1>
          <p className="text-sm text-muted">
            Review payment promises detected in client replies.
            {pendingCount > 0 && (
              <span className="ml-2 inline-block rounded-full bg-[var(--warning-muted)] px-2 py-0.5 text-xs font-medium text-[var(--warning)]">
                {pendingCount} pending review
              </span>
            )}
          </p>
        </div>
        <Link
          href="/settings"
          className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted"
        >
          Settings
        </Link>
      </div>

      <div className="mb-4 flex gap-2">
        {(["all", "pending_review", "active", "expired", "fulfilled"] as FilterStatus[]).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              filter === s
                ? "bg-accent text-surface"
                : "bg-surface text-muted ring-1 ring-border hover:bg-surface-muted"
            }`}
          >
            {s === "all" ? "All" : s.replace("_", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <p className="text-muted">No promises found.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((promise) => (
            <div
              key={promise.id}
              className="rounded-xl border border-border bg-surface p-6 shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {promise.invoice.clientName}
                    </h3>
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadge(promise.status)}`}>
                      {promise.status.replace("_", " ")}
                    </span>
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-muted ring-1 ring-border">
                      {Math.round(promise.confidence * 100)}% confidence
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                    <div>
                      <span className="text-muted">Invoice:</span>{" "}
                      <span className="text-foreground">
                        {promise.invoice.invoiceNumber ?? promise.invoice.id}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Amount:</span>{" "}
                      <span className="font-medium text-foreground">
                        {formatCurrency(promise.invoice.amount, promise.invoice.currency)}
                      </span>
                    </div>
                    <div>
                      <span className="text-muted">Promised Date:</span>{" "}
                      <span className="text-foreground">{formatDate(promise.promisedDate)}</span>
                    </div>
                    <div>
                      <span className="text-muted">Detected:</span>{" "}
                      <span className="text-foreground">{formatDate(promise.detectedAt)}</span>
                    </div>
                  </div>

                  {promise.emailSnippet && (
                    <div className="rounded-lg bg-surface-muted p-3 text-xs text-muted">
                      <p className="font-medium text-foreground mb-1">
                        {promise.emailSubject ?? "Reply"}
                      </p>
                      <p className="line-clamp-2">{promise.emailSnippet}</p>
                    </div>
                  )}
                </div>
              </div>

              {promise.status === "pending_review" && (
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  <button
                    onClick={() => handleAction(promise.id, "approve")}
                    disabled={processing === promise.id}
                    className="rounded-lg bg-[var(--success)] px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:brightness-110 disabled:opacity-50"
                  >
                    {processing === promise.id ? "Processing..." : "Approve & Pause"}
                  </button>
                  <button
                    onClick={() => handleAction(promise.id, "reject")}
                    disabled={processing === promise.id}
                    className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                  >
                    Reject
                  </button>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={overrideDate[promise.id] ?? ""}
                      onChange={(e) =>
                        setOverrideDate((prev) => ({ ...prev, [promise.id]: e.target.value }))
                      }
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      onClick={() => handleAction(promise.id, "override")}
                      disabled={processing === promise.id || !overrideDate[promise.id]}
                      className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-accent ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                    >
                      Override Date
                    </button>
                  </div>
                </div>
              )}

              {promise.status === "active" && (
                <div className="mt-4 flex items-center gap-3 border-t border-border pt-4">
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={overrideDate[promise.id] ?? ""}
                      onChange={(e) =>
                        setOverrideDate((prev) => ({ ...prev, [promise.id]: e.target.value }))
                      }
                      className="rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground transition focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
                    />
                    <button
                      onClick={() => handleAction(promise.id, "override")}
                      disabled={processing === promise.id || !overrideDate[promise.id]}
                      className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-accent ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                    >
                      Change Date
                    </button>
                  </div>
                  <button
                    onClick={() => handleAction(promise.id, "mark-fulfilled")}
                    disabled={processing === promise.id}
                    className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-[var(--success)] ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
                  >
                    Mark Fulfilled
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
