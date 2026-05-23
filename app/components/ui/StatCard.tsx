"use client";

import Link from "next/link";
import { type LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string;
  subLabel?: string;
  icon?: LucideIcon;
  trend?: { value: string; positive: boolean };
  href?: string;
  variant?: "default" | "highlight" | "warning";
}

const variantStyles = {
  default: "bg-[--bg-surface] border-[--border]",
  highlight: "border-[--accent] bg-[--accent-subtle]",
  warning: "border-[--warning]/30 bg-[--warning]/5",
};

export function StatCard({
  label,
  value,
  subLabel,
  icon: Icon,
  trend,
  href,
  variant = "default",
}: StatCardProps) {
  const base = `bg-[--bg-surface] border rounded-[--radius-md] p-5 ${variantStyles[variant]}`;
  const hover = href ? "hover:border-[--border-strong] transition-colors" : "";

  const content = (
    <div className={`${base} ${hover}`}>
      <div className="flex items-center justify-between mb-3">
        {Icon && <Icon className="h-5 w-5 text-[--text-muted]" />}
        {trend && (
          <span
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              trend.positive
                ? "bg-[--success]/10 text-[--success]"
                : "bg-[--danger]/10 text-[--danger]"
            }`}
          >
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-[--text-primary]">{value}</p>
      <p className="text-sm text-[--text-muted] mt-1">{label}</p>
      {subLabel && (
        <p className="text-xs text-[--text-disabled] mt-0.5">{subLabel}</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
