"use client";

import { useState, useEffect } from "react";
import { Bell } from "lucide-react";
import { NotificationPanel } from "./NotificationPanel";

export function NotificationBell() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    async function fetchCount() {
      try {
        const res = await fetch("/api/notifications?limit=1");
        if (res.ok) {
          const data = await res.json();
          setUnreadCount(data.unreadCount ?? 0);
        }
      } catch {}
    }

    fetchCount();
    const interval = setInterval(fetchCount, 60000);
    return () => clearInterval(interval);
  }, []);

  const displayCount = unreadCount > 9 ? "9+" : String(unreadCount);

  return (
    <>
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
        title="Notifications"
      >
        <Bell className="h-5 w-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-danger text-white text-xs rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
            {displayCount}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </>
  );
}
