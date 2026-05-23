"use client";

import { useTheme } from "@/app/components/ThemeProvider";
import { NotificationBell } from "@/app/components/layout/NotificationBell";
import { Sun, Moon } from "lucide-react";

export function HeaderBar() {
  const { theme, toggleTheme } = useTheme();

  return (
    <header
      className="fixed top-0 right-0 h-14 flex items-center justify-end gap-2 px-6 z-20 bg-[--bg-base]/80 backdrop-blur-sm border-b border-[--border] transition-all duration-200 ease-in-out"
      style={{ left: "var(--sidebar-current-width, 220px)" }}
    >
      <button
        onClick={toggleTheme}
        className="p-2 rounded-[--radius-sm] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-subtle] transition-colors"
        title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      >
        {theme === "dark" ? (
          <Sun className="h-4 w-4" />
        ) : (
          <Moon className="h-4 w-4" />
        )}
      </button>
      <div className="flex items-center gap-1">
        <NotificationBell />
      </div>
    </header>
  );
}
