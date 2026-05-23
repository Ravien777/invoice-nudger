"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { useSidebar } from "./SidebarProvider";
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  ClipboardList,
  FilePen,
  RefreshCw,
  Receipt,
  Landmark,
  Timer,
  Wallet,
  Building2,
  BarChart3,
  Lightbulb,
  UsersRound,
  HeartPulse,
  ChevronLeft,
  ChevronRight,
  Settings,
  Menu,
  X,
} from "lucide-react";
import { useState } from "react";

interface NavItem {
  label: string;
  icon: typeof LayoutDashboard;
  href: string;
  zone: 1 | 2 | 3;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", zone: 1 },
  { label: "Invoices", icon: FileText, href: "/invoices", zone: 1 },
  { label: "Payments", icon: CreditCard, href: "/payments", zone: 1 },
  { label: "Clients", icon: Users, href: "/clients", zone: 1 },
  { label: "Quotes", icon: ClipboardList, href: "/quotes", zone: 2 },
  { label: "Contracts", icon: FilePen, href: "/contracts", zone: 2 },
  { label: "Recurring", icon: RefreshCw, href: "/recurring", zone: 2 },
  { label: "Expenses", icon: Receipt, href: "/expenses", zone: 2 },
  { label: "Tax", icon: Landmark, href: "/tax", zone: 2 },
  { label: "Time", icon: Timer, href: "/time", zone: 3 },
  { label: "My Money", icon: Wallet, href: "/money", zone: 3 },
  { label: "Bank", icon: Building2, href: "/bank", zone: 3 },
  { label: "Accounting", icon: BarChart3, href: "/accounting", zone: 3 },
  { label: "Insights", icon: Lightbulb, href: "/insights", zone: 3 },
  { label: "Payroll", icon: UsersRound, href: "/payroll", zone: 3 },
  { label: "Health", icon: HeartPulse, href: "/health", zone: 3 },
];

const ZONE_INDICES = NAV_ITEMS.reduce<number[]>((acc, item, i) => {
  if (i > 0 && item.zone !== NAV_ITEMS[i - 1].zone) acc.push(i);
  return acc;
}, []);

export default function Sidebar() {
  const pathname = usePathname();
  const { collapsed, toggle } = useSidebar();
  const { data: session } = useSession();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);

  const isActive = (href: string) => {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  };

  const visibleItems = NAV_ITEMS;

  const sidebarContent = (
    <div
      className={`flex flex-col h-full bg-[--bg-surface] border-r border-[--border] transition-all duration-200 ease-in-out ${
        collapsed ? "w-[60px]" : "w-[220px]"
      }`}
    >
      {/* Logo area */}
      <div className="flex items-center justify-between px-3 py-4 border-b border-[--border] h-14">
        {!collapsed && (
          <Link href="/dashboard" className="text-sm font-semibold text-[--text-primary] tracking-tight">
            Invoice Nudger
          </Link>
        )}
        {collapsed && (
          <Link href="/dashboard" className="mx-auto">
            <span className="text-lg font-bold text-[--accent]">IN</span>
          </Link>
        )}
        <button
          onClick={toggle}
          className="p-1 rounded-[--radius-sm] text-[--text-muted] hover:text-[--text-primary] hover:bg-[--bg-subtle] transition-colors hidden md:block"
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
        {visibleItems.map((item, index) => {
          const showDivider = ZONE_INDICES.includes(index);
          const Icon = item.icon;
          return (
            <div key={item.href}>
              {showDivider && (
                <hr className="border-[--border] my-2 mx-1" />
              )}
              <Link
                href={item.href}
                title={collapsed ? item.label : undefined}
                className={`flex items-center gap-3 px-3 py-2 rounded-[--radius-sm] text-sm cursor-pointer transition-colors ${
                  isActive(item.href)
                    ? "bg-[--accent-subtle] text-[--text-primary] font-medium"
                    : "text-[--text-secondary] hover:bg-[--bg-subtle] hover:text-[--text-primary]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span
                  className={`transition-opacity duration-200 ${
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

      {/* Bottom section */}
      <div className="mt-auto border-t border-[--border] py-2 px-2">
        <Link
          href="/settings"
          title={collapsed ? "Settings" : undefined}
          className={`flex items-center gap-3 px-3 py-2 rounded-[--radius-sm] text-sm cursor-pointer transition-colors ${
            isActive("/settings")
              ? "bg-[--accent-subtle] text-[--text-primary] font-medium"
              : "text-[--text-secondary] hover:bg-[--bg-subtle] hover:text-[--text-primary]"
          }`}
        >
          <Settings className="h-4 w-4 shrink-0" />
          <span
            className={`transition-opacity duration-200 ${
              collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
            }`}
          >
            Settings
          </span>
        </Link>

        <div className="relative">
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className={`flex items-center gap-3 px-3 py-2 rounded-[--radius-sm] text-sm w-full transition-colors hover:bg-[--bg-subtle] ${
              collapsed ? "justify-center" : ""
            }`}
          >
            <div className="h-6 w-6 rounded-full bg-[--accent] flex items-center justify-center text-white text-xs font-semibold shrink-0">
              {(session?.user?.name || session?.user?.email || "?").charAt(0).toUpperCase()}
            </div>
            {!collapsed && (
              <span className="text-sm text-[--text-secondary] truncate">
                {session?.user?.name || session?.user?.email || "User"}
              </span>
            )}
          </button>

          {userMenuOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setUserMenuOpen(false)}
              />
              <div
                className={`absolute bottom-full mb-1 bg-[--bg-elevated] border border-[--border] rounded-[--radius-md] shadow-xl z-20 py-1 min-w-[160px] ${
                  collapsed ? "left-0" : "left-0 right-0"
                }`}
              >
                <button
                  onClick={() => {
                    setUserMenuOpen(false);
                    signOut({ callbackUrl: "/" });
                  }}
                  className="w-full px-3 py-2 text-left text-sm text-[--text-secondary] hover:text-[--text-primary] hover:bg-[--bg-subtle] transition-colors"
                >
                  Sign out
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="fixed top-4 left-4 z-40 md:hidden p-2 rounded-[--radius-sm] bg-[--bg-surface] border border-[--border] text-[--text-primary]"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 md:hidden"
          onClick={() => setMobileOpen(false)}
        >
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
          <div
            className="fixed left-0 top-0 h-full w-[280px] z-40"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative h-full">
              {sidebarContent}
              <button
                onClick={() => setMobileOpen(false)}
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
