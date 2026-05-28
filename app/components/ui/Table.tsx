"use client";

import { createContext, useContext, type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

const TableHeadContext = createContext(false);

interface TableProps {
  children?: ReactNode;
  emptyState?: {
    icon: LucideIcon;
    title: string;
    description: string;
  };
  className?: string;
}

export function Table({ children, emptyState, className = "" }: TableProps) {
  return (
    <div className={`bg-surface-secondary rounded-lg border border-border-default overflow-x-auto ${className}`}>
      {emptyState ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <emptyState.icon className="h-10 w-10 text-text-tertiary mb-3" />
          <h3 className="text-sm font-medium text-text-secondary">{emptyState.title}</h3>
          <p className="text-xs text-text-tertiary mt-1">{emptyState.description}</p>
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">{children}</table>
      )}
    </div>
  );
}

export function TableHead({ children }: { children?: ReactNode }) {
  return (
    <thead className="bg-surface-tertiary">
      <TableHeadContext.Provider value={true}>
        {children}
      </TableHeadContext.Provider>
    </thead>
  );
}

export function TableBody({ children }: { children?: ReactNode }) {
  return <tbody className="divide-y divide-border-default/50">{children}</tbody>;
}

export function TableRow({ children, className = "", onClick }: { children?: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr className={`border-b border-border-default last:border-0 hover:bg-surface-tertiary/50 transition-colors ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

interface TableCellProps {
  children?: ReactNode;
  className?: string;
  colSpan?: number;
  onClick?: (e: React.MouseEvent) => void;
  hideBelow?: "sm" | "md" | "lg";
}

const HIDE_CLASSES: Record<string, string> = {
  sm: "hidden sm:table-cell",
  md: "hidden md:table-cell",
  lg: "hidden lg:table-cell",
};

export function TableCell({ children, className = "", colSpan, onClick, hideBelow }: TableCellProps) {
  const isHeader = useContext(TableHeadContext);
  const Tag = isHeader ? "th" : "td";
  const hideClass = hideBelow ? HIDE_CLASSES[hideBelow] : "";
  const base = isHeader
    ? "px-4 py-3 text-xs font-medium text-text-secondary uppercase tracking-wider text-left"
    : "px-4 py-3 text-sm text-text-secondary";
  return (
    <Tag className={`${base} ${hideClass} ${className}`} colSpan={colSpan} onClick={onClick}>
      {children}
    </Tag>
  );
}
