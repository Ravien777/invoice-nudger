"use client";

import { useState, useEffect, useCallback } from "react";
import toast from "react-hot-toast";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";
import { Modal } from "@/app/components/ui/Modal";
import { formatCurrency } from "@/lib/format-currency";

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

      toast.success(
        "Reminder approved and will be sent on next cron run",
      );
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

      toast.success(
        "Reminder rejected, will use static template",
      );
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

  const previewItem = items.find((item) => item.id === previewId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-text-secondary">Loading AI reminders...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {items.length === 0 ? (
        <EmptyState
          title="No AI reminders awaiting approval"
          description="Approved reminders are sent automatically, while rejected ones fall back to static templates. Check back later for new AI-generated reminders."
        />
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-xl border border-border-default bg-surface-secondary p-4 shadow-sm"
            >
              <div className="mb-3 flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary">
                      {item.clientName}
                    </span>
                    {item.isExpired && (
                      <span className="inline-flex items-center rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-medium text-danger">
                        Expired
                      </span>
                    )}
                    {item.projectName && (
                      <span className="inline-flex items-center rounded-full bg-surface-tertiary px-2 py-0.5 text-[10px] font-medium text-text-tertiary border border-border-default">
                        {item.projectName}
                      </span>
                    )}
                  </div>
                  <div className="mt-1 text-xs text-text-secondary">
                    {item.invoiceNumber
                      ? `Invoice #${item.invoiceNumber}`
                      : "No invoice number"}{" "}
                    &middot; {formatCurrency(item.amount, item.currency)}{" "}
                    &middot; Due: {formatDate(item.dueDate)}
                  </div>
                </div>
                <div className="text-right text-xs text-text-tertiary">
                  <div>Step: {item.stepName}</div>
                  <div>Generated: {formatDate(item.generatedAt)}</div>
                </div>
              </div>

              <div className="mb-3 rounded-lg border border-border-default bg-surface-tertiary p-3">
                <span className="text-xs font-medium text-text-secondary">
                  Subject
                </span>
                <p className="text-sm font-medium text-text-primary">
                  {item.subjectLine ?? "(no subject)"}
                </p>
              </div>

              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPreviewId(item.id)}
                >
                  Preview
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleReject(item.id)}
                  disabled={processing === item.id}
                  loading={processing === item.id}
                  className="text-danger border-danger/30 hover:bg-danger/10"
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => handleApprove(item.id)}
                  disabled={processing === item.id || item.isExpired}
                  loading={processing === item.id}
                >
                  Approve & Send
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Preview modal */}
      {previewItem && (
        <Modal
          open={!!previewId}
          onClose={() => setPreviewId(null)}
          title="Email Preview"
          size="lg"
          description={previewItem.subjectLine ?? undefined}
        >
          <div
            className="max-h-96 overflow-auto rounded-lg border border-border-default bg-surface-primary p-4 text-sm text-text-primary"
            dangerouslySetInnerHTML={{
              __html: previewItem.emailBody ?? "",
            }}
          />
        </Modal>
      )}
    </div>
  );
}
