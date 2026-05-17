"use client";

import { signOut, useSession } from "next-auth/react";
import ThemeToggle from "./ThemeToggle";

export default function HeaderActions() {
  const { data: session } = useSession();

  return (
    <div className="flex items-center gap-2">
      <ThemeToggle />
      <span className="hidden text-sm text-slate-400 sm:inline dark:text-slate-500">
        {session?.user?.email}
      </span>
      <button
        onClick={() => signOut({ callbackUrl: "/" })}
        className="rounded-lg px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-700 dark:hover:text-slate-100"
      >
        Sign out
      </button>
    </div>
  );
}
