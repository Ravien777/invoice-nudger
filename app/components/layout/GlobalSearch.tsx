"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, LayoutDashboard, Plus, ArrowUpDown } from "lucide-react";

interface SearchResult {
  type: "invoice" | "client" | "page";
  id: string;
  label: string;
  subLabel: string;
  href: string;
}

const QUICK_LINKS = [
  {
    type: "page" as const,
    id: "dashboard",
    label: "Dashboard",
    subLabel: "Go to dashboard",
    href: "/dashboard",
  },
  {
    type: "page" as const,
    id: "new-invoice",
    label: "New Invoice",
    subLabel: "Create a new invoice",
    href: "/invoices/new",
  },
  {
    type: "page" as const,
    id: "settings",
    label: "Settings",
    subLabel: "Manage your settings",
    href: "/settings",
  },
];

export function GlobalSearch() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setQuery("");
      setResults([]);
    }
  }, [open]);

  const searchApi = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults(QUICK_LINKS);
      return;
    }
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setResults(data.results ?? []);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchApi(query), 200);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, searchApi]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [results]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter" && results[selectedIndex]) {
      e.preventDefault();
      navigateTo(results[selectedIndex]);
    }
  };

  const navigateTo = (result: SearchResult) => {
    setOpen(false);
    router.push(result.href);
  };

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center pt-[20vh]"
      onClick={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
    >
      <div className="bg-[--bg-elevated] border border-[--border] rounded-[--radius-lg] shadow-2xl w-full max-w-lg overflow-hidden">
        <div className="flex items-center gap-3 px-4 py-3 border-b border-[--border]">
          <Search className="h-4 w-4 text-[--text-muted] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search invoices, clients, pages..."
            className="flex-1 bg-transparent text-sm text-[--text-primary] placeholder:text-[--text-disabled] focus:outline-none"
          />
        </div>

        <div className="max-h-80 overflow-y-auto py-2">
          {results.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-[--text-muted]">
              No results found
            </div>
          ) : (
            results.map((result, index) => (
              <button
                key={`${result.type}-${result.id}`}
                onClick={() => navigateTo(result)}
                onMouseEnter={() => setSelectedIndex(index)}
                className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                  index === selectedIndex
                    ? "bg-[--accent-subtle]"
                    : "hover:bg-[--bg-subtle]"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <p
                    className={`text-sm truncate ${
                      index === selectedIndex
                        ? "text-[--text-primary] font-medium"
                        : "text-[--text-secondary]"
                    }`}
                  >
                    {result.label}
                  </p>
                  <p className="text-xs text-[--text-muted] truncate">
                    {result.subLabel}
                  </p>
                </div>
                {result.type === "invoice" && (
                  <span className="text-[10px] text-[--text-disabled] uppercase tracking-wider">
                    Invoice
                  </span>
                )}
                {result.type === "client" && (
                  <span className="text-[10px] text-[--text-disabled] uppercase tracking-wider">
                    Client
                  </span>
                )}
              </button>
            ))
          )}
        </div>

        <div className="border-t border-[--border] px-4 py-2 flex items-center gap-3 text-[10px] text-[--text-disabled]">
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[--bg-subtle] text-[--text-muted] text-[10px]">
              ↑↓
            </kbd>
            Navigate
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[--bg-subtle] text-[--text-muted] text-[10px]">
              ↵
            </kbd>
            Open
          </span>
          <span className="flex items-center gap-1">
            <kbd className="px-1 py-0.5 rounded bg-[--bg-subtle] text-[--text-muted] text-[10px]">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
