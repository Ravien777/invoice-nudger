"use client";

import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function HeaderActions() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
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
