"use client";

import { useSidebar } from "./SidebarProvider";
import { Menu } from "lucide-react";
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

  return (
    <div className="flex flex-col h-full">
      <header className="px-6 py-4 border-b border-border-default flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={toggleMobile}
            className="md:hidden p-2 -ml-2 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
            aria-label="Toggle sidebar"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-lg font-semibold text-text-primary tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-sm text-text-secondary">{subtitle}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="hidden md:block">
            <NotificationBell />
          </div>
          {actions}
        </div>
      </header>
      <main className="flex-1 overflow-y-auto px-6 py-8">{children}</main>
    </div>
  );
}
