"use client";

import { type ReactNode } from "react";
import { type LucideIcon } from "lucide-react";

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
    <div className={`overflow-x-auto rounded-[--radius-md] border border-[--border] bg-[--bg-surface] ${className}`}>
      {emptyState ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <emptyState.icon className="h-10 w-10 text-[--text-disabled] mb-3" />
          <h3 className="text-sm font-medium text-[--text-secondary]">{emptyState.title}</h3>
          <p className="text-xs text-[--text-muted] mt-1">{emptyState.description}</p>
        </div>
      ) : (
        <table className="w-full text-sm border-collapse">{children}</table>
      )}
    </div>
  );
}

export function TableHead({ children }: { children?: ReactNode }) {
  return (
    <thead className="border-b border-[--border]">
      {children}
    </thead>
  );
}

export function TableBody({ children }: { children?: ReactNode }) {
  return <tbody className="divide-y divide-[--border]/50">{children}</tbody>;
}

export function TableRow({ children, className = "", onClick }: { children?: ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr className={`hover:bg-[--bg-subtle]/50 transition-colors ${className}`} onClick={onClick}>
      {children}
    </tr>
  );
}

export function TableHeaderCell({ children, className = "" }: { children?: ReactNode; className?: string }) {
  return (
    <th className={`px-4 py-3 text-left text-xs font-medium text-[--text-muted] uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
}

export function TableCell({ children, className = "", onClick }: { children?: ReactNode; className?: string; onClick?: (e: React.MouseEvent) => void }) {
  return (
    <td className={`px-4 py-3 text-[--text-secondary] ${className}`} onClick={onClick}>
      {children}
    </td>
  );
}
