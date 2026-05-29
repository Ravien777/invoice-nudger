"use client";

import { useState, useCallback } from "react";
import toast from "react-hot-toast";
import { Button } from "@/app/components/ui/Button";
import { EmptyState } from "@/app/components/ui/EmptyState";

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
  high_risk_invoice: "\uD83D\uDD34",
  client_deterioration: "\uD83D\uDCC9",
  cash_flow_gap: "\uD83D\uDCB0",
};

function typeColor(type: string): string {
  switch (type) {
    case "high_risk_invoice":
      return "bg-danger/10 text-danger";
    case "client_deterioration":
      return "bg-warning/10 text-warning";
    case "cash_flow_gap":
      return "bg-blue-500/10 text-blue-500";
    default:
      return "bg-surface-tertiary text-text-tertiary";
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
  const [notifications, setNotifications] =
    useState<NotificationItem[]>(initialNotifications);
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

  function filterBtn(type: string | null, label: string) {
    const isActive = filter === type;
    return (
      <Button
        key={label}
        variant="ghost"
        size="sm"
        onClick={() => setFilter(type)}
        className={isActive ? "bg-surface-primary text-text-primary shadow-sm" : ""}
      >
        {label}
      </Button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header bar */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-text-secondary">
          {unreadCount > 0
            ? `${unreadCount} unread`
            : "All caught up"}
        </span>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllRead}
          >
            Mark all read
          </Button>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex flex-wrap gap-1 rounded-lg bg-surface-tertiary p-1 w-fit">
        {filterBtn(null, `All (${total})`)}
        {filterBtn("high_risk_invoice", "High Risk")}
        {filterBtn("client_deterioration", "Clients")}
        {filterBtn("cash_flow_gap", "Cash Flow")}
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <EmptyState
          variant="no-results"
          title={
            filter
              ? "No notifications of this type yet"
              : "No notifications"
          }
          description={
            filter
              ? undefined
              : "You're all caught up! Predictive alerts will appear here."
          }
        />
      ) : (
        <div className="space-y-2">
          {filtered.map((n) => (
            <div
              key={n.id}
              className={`rounded-xl border px-5 py-4 shadow-sm transition ${
                n.read
                  ? "border-border-default bg-surface-secondary"
                  : "border-accent/20 bg-accent/[0.03]"
              }`}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <span className="mt-0.5 text-lg">
                    {TYPE_ICONS[n.type] || "\uD83D\uDD14"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-text-primary">
                        {n.title}
                      </h3>
                      {!n.read && (
                        <span className="inline-block h-2 w-2 rounded-full bg-accent" />
                      )}
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${typeColor(n.type)}`}
                      >
                        {TYPE_LABELS[n.type] || n.type}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-text-secondary">
                      {n.message}
                    </p>
                    <p className="mt-1.5 text-xs text-text-tertiary">
                      {timeAgo(n.createdAt)}
                    </p>
                  </div>
                </div>

                {!n.read && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleMarkRead(n.id)}
                  >
                    Mark read
                  </Button>
                )}
              </div>
            </div>
          ))}

          {hasMore && (
            <div className="pt-2 text-center">
              <Button
                variant="secondary"
                size="sm"
                onClick={loadMore}
                disabled={loading}
              >
                {loading ? "Loading..." : "Load more"}
              </Button>
            </div>
          )}
        </div>
      )}

      <p className="text-xs text-text-tertiary">
        Showing {filtered.length} of {total} notification
        {total === 1 ? "" : "s"}
      </p>
    </div>
  );
}
