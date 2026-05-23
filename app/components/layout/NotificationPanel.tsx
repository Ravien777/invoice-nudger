"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  DollarSign,
  AlertCircle,
  Check,
  X,
} from "lucide-react";

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  metadata: Record<string, unknown> | null;
}

function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = now - then;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function typeIcon(type: string) {
  switch (type) {
    case "high_risk_invoice":
      return AlertCircle;
    case "client_deterioration":
      return AlertCircle;
    case "cash_flow_gap":
      return DollarSign;
    default:
      return Bell;
  }
}

interface NotificationPanelProps {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: NotificationPanelProps) {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    async function fetchNotifications() {
      try {
        const res = await fetch("/api/notifications?limit=20&unreadFirst=true");
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications ?? []);
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {}
    }
    fetchNotifications();
  }, []);

  async function handleMarkAllRead() {
    try {
      await fetch("/api/notifications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "read_all" }),
      });
      setUnreadCount(0);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {}
  }

  async function handleMarkRead(id: string) {
    try {
      await fetch(`/api/notifications/${id}/read`, { method: "POST" });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {}
  }

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-80 bg-[--bg-elevated] border-l border-[--border] shadow-xl z-50 overflow-y-auto">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[--border]">
          <h3 className="text-sm font-semibold text-[--text-primary]">
            Notifications
            {unreadCount > 0 && (
              <span className="ml-2 text-xs font-normal text-[--text-muted]">
                ({unreadCount} new)
              </span>
            )}
          </h3>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-[--accent] hover:underline"
              >
                Mark all read
              </button>
            )}
            <button
              onClick={onClose}
              className="p-1 rounded-[--radius-sm] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-subtle] transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="max-h-[calc(100vh-56px)] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center px-4">
              <Check className="h-8 w-8 text-[--success] mb-2" />
              <p className="text-sm text-[--text-muted]">
                You&apos;re all caught up.
              </p>
            </div>
          ) : (
            notifications.map((n) => {
              const Icon = typeIcon(n.type);
              return (
                <div
                  key={n.id}
                  className={`flex items-start gap-3 px-4 py-3 border-b border-[--border]/50 transition ${
                    !n.read ? "border-l-2 border-l-[--accent]" : ""
                  }`}
                >
                  <Icon
                    className={`mt-0.5 h-4 w-4 shrink-0 ${
                      !n.read ? "text-[--accent]" : "text-[--text-muted]"
                    }`}
                  />
                  <div className="min-w-0 flex-1">
                    <p
                      className={`text-sm truncate ${
                        !n.read
                          ? "font-medium text-[--text-primary]"
                          : "text-[--text-secondary]"
                      }`}
                    >
                      {n.title}
                    </p>
                    <p className="mt-0.5 text-xs text-[--text-muted] line-clamp-2">
                      {n.message}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-[10px] text-[--text-disabled]">
                        {timeAgo(n.createdAt)}
                      </span>
                      {!n.read && (
                        <button
                          onClick={() => handleMarkRead(n.id)}
                          className="text-[10px] font-medium text-[--accent] hover:underline"
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="border-t border-[--border] px-4 py-2.5 text-center">
          <Link
            href="/notifications"
            onClick={onClose}
            className="text-xs font-medium text-[--accent] hover:underline"
          >
            View all notifications
          </Link>
        </div>
      </div>
    </div>
  );
}
