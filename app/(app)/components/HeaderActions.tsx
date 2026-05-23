"use client";

import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";
import { useEffect, useState } from "react";
import Link from "next/link";
import { NotificationBell } from "@/app/components/layout/NotificationBell";

export default function HeaderActions() {
  const { data: session } = useSession();
  const [pendingPromises, setPendingPromises] = useState(0);

  useEffect(() => {
    async function fetchPendingCount() {
      try {
        const res = await fetch("/api/promises/count");
        const data = await res.json();
        setPendingPromises(data.count ?? 0);
      } catch {
      }
    }

    fetchPendingCount();
    const interval = setInterval(fetchPendingCount, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <NotificationBell />
      <ThemeToggle />
      {pendingPromises > 0 && (
        <Link
          href="/promises"
          className="relative rounded-lg px-2 py-1.5 text-sm font-medium text-[var(--warning)] transition hover:bg-[var(--warning-muted)]"
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
      <span className="hidden text-sm text-muted sm:inline">
        {session?.user?.email}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-muted transition hover:bg-surface-muted hover:text-foreground"
      >
        Sign out
      </button>
    </div>
  );
}
