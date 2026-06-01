"use client";

import { useEffect, useState } from "react";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useSidebar } from "./SidebarProvider";
import { Menu, LogOut } from "lucide-react";
import { NotificationBell } from "./NotificationBell";
import type { ReactNode } from "react";

interface PageShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
}: PageShellProps) {
  const { toggleMobile } = useSidebar();
  const { data: session } = useSession();
  const [pendingPromises, setPendingPromises] = useState(0);

  useEffect(() => {
    async function fetchPendingCount() {
      if (document.hidden) return;
      try {
        const res = await fetch("/api/promises/count");
        const data = await res.json();
        setPendingPromises(data.count ?? 0);
      } catch {}
    }

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0 gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={toggleMobile}
            className="md:hidden p-2 -ml-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold text-text-primary tracking-tight truncate">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-text-secondary truncate">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {pendingPromises > 0 && (
            <Link
              href="/promises"
              className="relative rounded-lg p-2 text-sm font-medium text-[var(--warning)] hover:bg-[var(--warning-muted)] transition-colors"
              title={`${pendingPromises} promise${pendingPromises === 1 ? "" : "s"} pending review`}
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--warning)] text-[10px] font-bold text-white">
                {pendingPromises > 9 ? "9+" : pendingPromises}
              </span>
            </Link>
          )}
          <NotificationBell />
          {actions}
          <button
            onClick={async () => {
              try { await signOut({ redirect: false }); } catch {}
              window.location.href = "/";
            }}
            className="p-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
            title="Sign out"
          >
            <LogOut className="h-5 w-5" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
    </div>
  );
}
