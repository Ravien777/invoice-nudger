"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import toast from "react-hot-toast";

interface QueueItem {
  id: string;
  invoiceId: string;
  clientName: string;
  invoiceNumber: string | null;
  projectName: string | null;
  amount: number;
  currency: string;
  dueDate: string;
  status: string;
  stepName: string;
  subjectLine: string | null;
  emailBody: string | null;
  generatedAt: string;
  daysUntilDue: number;
  isExpired: boolean;
}

export default function AIQueueClient() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const fetchQueue = useCallback(async () => {
    try {
      const res = await fetch("/api/ai/queue");
      if (res.ok) {
        const data = await res.json();
        setItems(data);
      }
    } catch {
      // Silent fail
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  async function handleApprove(id: string) {
    setProcessing(id);
    try {
      const res = await fetch("/api/ai/approve-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderLogId: id }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to approve reminder");
        return;
      }

      toast.success("Reminder approved and will be sent on next cron run");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      toast.error("Network error");
    } finally {
      setProcessing(null);
    }
  }

  async function handleReject(id: string) {
    setProcessing(id);
    try {
      const res = await fetch("/api/ai/reject-reminder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reminderLogId: id }),
      });

      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error ?? "Failed to reject reminder");
        return;
      }

      toast.success("Reminder rejected, will use static template");
      setItems((prev) => prev.filter((item) => item.id !== id));
    } catch {
      toast.error("Network error");
    } finally {
      setProcessing(null);
    }
  }

  function formatDate(dateStr: string): string {
    return new Date(dateStr).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
    }).format(amount);
  }

  const previewItem = items.find((item) => item.id === previewId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted">Loading AI reminders...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">AI Reminder Queue</h1>
          <p className="text-sm text-muted">
            Approve or reject AI-generated reminder emails before they are sent.
          </p>
        </div>
        <Link
          href="/invoices"
          className="rounded-lg bg-surface px-4 py-2 text-sm font-medium text-foreground shadow-sm ring-1 ring-border transition hover:bg-surface-muted"
        >
          Back to Invoices
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <p className="text-muted">No AI reminders awaiting approval.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border bg-surface p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-foreground">
                      {item.clientName}
                    </span>
                    {item.isExpired && (
                      <span className="rounded-full bg-[var(--danger-muted)] px-2 py-0.5 text-[10px] font-medium text-[var(--danger)]">
                        Expired
                      </span>
                    )}
                    {item.projectName && (
                      <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10px] font-medium text-muted ring-1 ring-border">
                        {item.projectName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-muted">
                    {item.invoiceNumber ? `Invoice #${item.invoiceNumber}` : "No invoice number"}{" "}
                    &middot; {formatCurrency(item.amount, item.currency)}{" "}
                    &middot; Due: {formatDate(item.dueDate)}
                  </div>
                </div>
                <div className="text-right text-xs text-muted">
                  <div>Step: {item.stepName}</div>
                  <div>Generated: {formatDate(item.generatedAt)}</div>
                </div>
              </div>

              <div className="mb-3 rounded-lg border border-border bg-surface-muted p-3">
                <span className="text-xs font-medium text-muted">Subject</span>
                <p className="text-sm font-medium text-foreground">
                  {item.subjectLine ?? "(no subject)"}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <button
                  onClick={() => setPreviewId(item.id)}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-surface-muted"
                >
                  Preview
                </button>
                <button
                  onClick={() => handleReject(item.id)}
                  disabled={processing === item.id}
                  className="rounded-md px-3 py-1.5 text-xs font-medium text-[var(--danger)] transition hover:bg-[var(--danger-muted)] disabled:opacity-50"
                >
                  {processing === item.id ? "Processing..." : "Reject"}
                </button>
                <button
                  onClick={() => handleApprove(item.id)}
                  disabled={processing === item.id || item.isExpired}
                  className="rounded-md bg-purple-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-purple-700 disabled:opacity-50"
                >
                  {processing === item.id ? "Processing..." : "Approve & Send"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {previewItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setPreviewId(null)}
          />
          <div className="relative z-10 w-full max-w-2xl rounded-xl border border-border bg-surface p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-foreground">
                Email Preview
              </h2>
              <button
                onClick={() => setPreviewId(null)}
                className="rounded-md p-1 text-muted transition hover:bg-surface-muted hover:text-foreground"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="mb-3">
              <span className="text-xs font-medium text-muted">Subject</span>
              <p className="text-sm font-medium text-foreground">
                {previewItem.subjectLine}
              </p>
            </div>
            <div
              className="max-h-96 overflow-auto rounded-lg border border-border bg-surface p-4 text-sm text-foreground"
              dangerouslySetInnerHTML={{ __html: previewItem.emailBody ?? "" }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
