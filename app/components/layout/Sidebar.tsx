"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useSidebar } from "./SidebarProvider";
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Handshake,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Settings,
  LogOut,
  X,
  Receipt,
  Calculator,
  ScrollText,
} from "lucide-react";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  zone: 1 | 2 | 3;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", zone: 1 },
  { label: "Invoices", icon: FileText, href: "/invoices", zone: 1 },
  { label: "Quotes", icon: ScrollText, href: "/quotes", zone: 1 },
  { label: "Clients", icon: Users, href: "/clients", zone: 1 },
  { label: "Expenses", icon: Receipt, href: "/expenses", zone: 1 },
  { label: "Tax", icon: Calculator, href: "/tax", zone: 1 },
  { label: "Benchmarks", icon: BarChart3, href: "/benchmarks", zone: 2 },
  { label: "Promises", icon: Handshake, href: "/promises", zone: 2 },
  { label: "Reconciliation", icon: RefreshCw, href: "/reconciliation", zone: 2 },
  { label: "Settings", icon: Settings, href: "/settings", zone: 3 },
];

const ZONE_INDICES = NAV_ITEMS.reduce<number[]>((acc, item, i) => {
  if (i > 0 && item.zone !== NAV_ITEMS[i - 1].zone) acc.push(i);
  return acc;
}, []);

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle, mobileOpen, closeMobile } = useSidebar();
  const { data: session } = useSession();
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const sidebarContent = (
    <div
      className={`flex flex-col h-full bg-surface-secondary border-r border-border-default transition-all duration-300 ease-in-out ${
        collapsed ? "w-[60px]" : "w-[220px]"
      }`}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-border-default h-14">
        {!collapsed && (
          <Link href="/dashboard" className="text-sm font-semibold text-text-primary tracking-tight">
            Invoice Nudger
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <span className="text-lg font-bold text-accent">IN</span>
          </Link>
        )}
        <button
          onClick={toggle}
          className="p-1 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors hidden md:block"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Nav items */}
      <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-1">
        {NAV_ITEMS.map((item, index) => {
          const showDivider = ZONE_INDICES.includes(index);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {showDivider && (
                <hr className="border-border-default my-2 mx-1" />
              )}
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer transition-colors ${
                  isActive(item.href)
                    ? "border-l-2 border-l-accent bg-accent/10 text-text-primary font-medium"
                    : "text-text-secondary hover:bg-surface-tertiary hover:text-text-primary"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className={`transition-opacity duration-300 ${
                    collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                  }`}
                >
                  {item.label}
                </span>
              </Link>
            </div>
          );
        })}
      </nav>

      {/* Bottom section - user menu */}
      {collapsed ? (
        <div className="border-t border-border-default mt-auto pt-4 px-2 pb-2">
          <div className="relative flex justify-center">
            <button
              onClick={() => setUserMenuOpen(!userMenuOpen)}
              className="mx-auto flex h-7 w-7 items-center justify-center rounded-full bg-accent text-white text-xs font-semibold hover:ring-2 hover:ring-accent/50 transition-all"
              title={session?.user?.name || "User"}
            >
              {(session?.user?.name || session?.user?.email || "?").charAt(0).toUpperCase()}
            </button>
            {userMenuOpen && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 w-48 bg-surface-secondary border border-border-default rounded-lg shadow-xl py-1">
                  <div className="px-3 py-2 border-b border-border-default">
                    <p className="text-sm font-medium text-text-primary truncate">
                      {session?.user?.name || "User"}
                    </p>
                    <p className="text-xs text-text-tertiary truncate">
                      {session?.user?.email || ""}
                    </p>
                  </div>
                  <button
                    onClick={() => signOut({ callbackUrl: "/" })}
                    className="flex items-center gap-2 w-full px-3 py-2 text-sm text-text-secondary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign out
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : (
        <div className="border-t border-border-default mt-auto pt-4 px-2 pb-2">
          <div className="flex items-center justify-between px-3 py-2">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-7 w-7 rounded-full bg-accent flex items-center justify-center text-white text-xs font-semibold shrink-0">
                {(session?.user?.name || session?.user?.email || "?").charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">
                  {session?.user?.name || "User"}
                </p>
                <p className="text-xs text-text-tertiary truncate">
                  {session?.user?.email || ""}
                </p>
              </div>
            </div>
            <button
              onClick={() => signOut({ callbackUrl: "/" })}
              className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-surface-tertiary transition-colors"
              title="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={closeMobile}
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="fixed left-0 top-0 h-full w-[280px] z-40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full">
              {sidebarContent}
              <button
                onClick={closeMobile}
                className="absolute top-4 -right-10 p-2 text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden md:block fixed left-0 top-0 h-screen z-30">
        {sidebarContent}
      </aside>
    </>
  );
}
