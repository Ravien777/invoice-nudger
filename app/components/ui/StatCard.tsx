import Link from "next/link";
import { TrendingUp, TrendingDown } from "lucide-react";
import type { ReactNode } from "react";

interface StatCardProps {
  label: string;
  value: string;
  subLabel?: string;
  children?: ReactNode;
  trend?: { value: string; positive: boolean };
  href?: string;
  variant?: "default" | "highlight" | "warning";
  loading?: boolean;
}

const variantStyles = {
  default: "border-l-2 border-l-accent bg-surface-primary border border-border-default",
  highlight: "bg-accent/10 border-accent",
  warning: "border-l-2 border-l-warning bg-surface-primary border border-border-default",
};

export function StatCard({
  label,
  value,
  subLabel,
  children,
  trend,
  href,
  variant = "default",
  loading = false,
}: StatCardProps) {
  const base = `rounded-xl p-5 ${variantStyles[variant]}`;
  const hover = href ? "hover:border-border-default transition-colors" : "";

  const content = loading ? (
    <div className={`${base} ${hover} animate-pulse`}>
      <div className="flex items-center justify-between mb-3">
        {children ? <div className="h-5 w-5 rounded bg-surface-tertiary" /> : null}
      </div>
      <div className="h-8 w-24 rounded bg-surface-tertiary mb-2" />
      <div className="h-4 w-32 rounded bg-surface-tertiary" />
    </div>
  ) : (
    <div className={`${base} ${hover}`}>
      <div className="flex items-center justify-between mb-3">
        {children && <div className="flex">{children}</div>}
        {trend && (
          <span
            className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
              trend.positive
                ? "bg-success/10 text-success"
                : "bg-danger/10 text-danger"
            }`}
          >
            {trend.positive ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {trend.value}
          </span>
        )}
      </div>
      <p className="text-2xl font-semibold text-text-primary">{value}</p>
      <p className="text-sm text-text-secondary mt-1">{label}</p>
      {subLabel && (
        <p className="text-xs text-text-tertiary mt-0.5">{subLabel}</p>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }

  return content;
}
