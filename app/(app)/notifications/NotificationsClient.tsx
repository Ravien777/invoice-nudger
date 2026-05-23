"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

interface NotificationsClientProps {
  initialNotifications: NotificationItem[];
  initialTotal: number;
  initialUnreadCount: number;
}

const TYPE_LABELS: Record<string, string> = {
  high_risk_invoice: "High-Risk Invoice",
  client_deterioration: "Client Deterioration",
  cash_flow_gap: "Cash Flow Gap",
};

const TYPE_ICONS: Record<string, string> = {
  high_risk_invoice: "🔴",
  client_deterioration: "📉",
  cash_flow_gap: "💰",
};

function typeColor(type: string): string {
  switch (type) {
    case "high_risk_invoice": return "bg-[var(--danger-muted)] text-[var(--danger)]";
    case "client_deterioration": return "bg-[var(--warning-muted)] text-[var(--warning)]";
    case "cash_flow_gap": return "bg-blue-100 text-blue-700";
    default: return "bg-surface-muted text-muted";
  }
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min${mins === 1 ? "" : "s"} ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function NotificationsClient({
  initialNotifications,
  initialTotal,
  initialUnreadCount,
}: NotificationsClientProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);
  const [total, setTotal] = useState(initialTotal);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string | null>(null);

  const filtered = filter
    ? notifications.filter((n) => n.type === filter)
    : notifications;

  const hasMore = notifications.length < total;

  const loadMore = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        limit: "20",
        offset: String(notifications.length),
        unreadFirst: "false",
      });
      if (filter) params.set("type", filter);

      const res = await fetch(`/api/notifications?${params}`);
      const data = await res.json();

      setNotifications((prev) => [...prev, ...data.notifications]);
      setTotal(data.total);
    } catch {
      toast.error("Failed to load more notifications");
    } finally {
      setLoading(false);
    }
  }, [notifications.length, filter]);

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      toast.error("Failed to mark as read");
    }
  }

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
      toast.success("All notifications marked as read");
    } catch {
      toast.error("Failed to mark all as read");
    }
  }

  function selectFilter(type: string | null) {
    setFilter(type);
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted">
            {unreadCount > 0
              ? `${unreadCount} unread`
              : "All caught up"}
          </span>
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllRead}
              className="text-xs font-medium text-accent hover:underline"
            >
              Mark all read
            </button>
          )}
        </div>
      </div>

      <div className="mb-4 flex gap-1 rounded-lg bg-surface-muted p-1 w-fit">
        <button
          onClick={() => selectFilter(null)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            filter === null
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          All ({total})
        </button>
        <button
          onClick={() => selectFilter("high_risk_invoice")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            filter === "high_risk_invoice"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          High Risk
        </button>
        <button
          onClick={() => selectFilter("client_deterioration")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            filter === "client_deterioration"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Clients
        </button>
        <button
          onClick={() => selectFilter("cash_flow_gap")}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${
            filter === "cash_flow_gap"
              ? "bg-surface text-foreground shadow-sm"
              : "text-muted hover:text-foreground"
          }`}
        >
          Cash Flow
        </button>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-border bg-surface p-12 text-center shadow-sm">
          <p className="text-lg text-muted">No notifications</p>
          <p className="mt-1 text-sm text-muted">
            {filter
              ? "No notifications of this type yet."
              : "You're all caught up! Predictive alerts will appear here."}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border px-5 py-4 shadow-sm transition ${
                n.read
                  ? "border-border bg-surface"
                  : "border-[var(--accent-muted)]/30 bg-[var(--accent-muted)]/5"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="mt-0.5 text-lg">{TYPE_ICONS[n.type] || "🔔"}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground">
                        {n.title}
                      </h3>
                      {!n.read && (
                        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                      )}
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColor(n.type)}`}
                      >
                        {TYPE_LABELS[n.type] || n.type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-muted">{n.message}</p>
                    <p className="mt-1.5 text-xs text-muted">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>

                {!n.read && (
                  <button
                    onClick={() => handleMarkRead(n.id)}
                    className="flex-shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-accent transition hover:bg-surface-muted"
                  >
                    Mark read
                  </button>
                )}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="pt-2 text-center">
              <button
                onClick={loadMore}
                disabled={loading}
                className="rounded-lg bg-surface px-6 py-2 text-sm font-medium text-foreground ring-1 ring-border transition hover:bg-surface-muted disabled:opacity-50"
              >
                {loading ? "Loading..." : "Load more"}
              </button>
            </div>
          )}
        </div>
      )}

      <p className="mt-6 text-xs text-muted">
        Showing {filtered.length} of {total} notification{total === 1 ? "" : "s"}
      </p>
    </div>
  );
}
