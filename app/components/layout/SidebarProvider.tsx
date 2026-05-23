"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  type ReactNode,
} from "react";

interface SidebarContextValue {
  collapsed: boolean;
  toggle: () => void;
  mobileOpen: boolean;
  toggleMobile: () => void;
  closeMobile: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  collapsed: false,
  toggle: () => {},
  mobileOpen: false,
  toggleMobile: () => {},
  closeMobile: () => {},
});

export function useSidebar() {
  return useContext(SidebarContext);
}

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem("sidebar-collapsed");
    if (stored === "true") {
      setCollapsed(true);
    }
  }, []);

  useEffect(() => {
    if (mounted) {
      localStorage.setItem("sidebar-collapsed", String(collapsed));
      const root = document.documentElement;
      const isMobile = window.innerWidth < 768;
      const width = isMobile ? "0px" : collapsed ? "60px" : "220px";
      root.style.setProperty("--sidebar-current-width", width);
    }
  }, [collapsed, mounted]);

  useEffect(() => {
    const handleResize = () => {
      const root = document.documentElement;
      const isMobile = window.innerWidth < 768;
      if (isMobile) {
        root.style.setProperty("--sidebar-current-width", "0px");
        setMobileOpen(false);
      } else {
        root.style.setProperty(
          "--sidebar-current-width",
          collapsed ? "60px" : "220px",
        );
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [collapsed]);

  const toggle = () => setCollapsed((prev) => !prev);
  const toggleMobile = () => setMobileOpen((prev) => !prev);
  const closeMobile = () => setMobileOpen(false);

  return (
    <SidebarContext.Provider
      value={{ collapsed, toggle, mobileOpen, toggleMobile, closeMobile }}
    >
      {children}
    </SidebarContext.Provider>
  );
}
