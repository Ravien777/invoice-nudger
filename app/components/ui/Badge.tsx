import type { ReactNode } from "react";

export type BadgeVariant =
  | "unpaid"
  | "paid"
  | "cancelled"
  | "overdue"
  | "draft"
  | "sent"
  | "accepted"
  | "declined"
  | "expired"
  | "active"
  | "paused"
  | "neutral";

const colorMap: Record<BadgeVariant, string> = {
  unpaid: "bg-warning/10 text-warning",
  paid: "bg-success/10 text-success",
  cancelled: "bg-surface-tertiary text-text-tertiary",
  overdue: "bg-danger/10 text-danger",
  draft: "bg-surface-tertiary text-text-secondary",
  sent: "bg-accent/10 text-accent",
  accepted: "bg-success/10 text-success",
  declined: "bg-danger/10 text-danger",
  expired: "bg-warning/10 text-warning",
  active: "bg-success/10 text-success",
  paused: "bg-warning/10 text-warning",
  neutral: "bg-surface-tertiary text-text-secondary",
};

const dotColors: Record<BadgeVariant, string> = {
  unpaid: "bg-warning",
  paid: "bg-success",
  cancelled: "bg-text-tertiary",
  overdue: "bg-danger",
  draft: "bg-text-secondary",
  sent: "bg-accent",
  accepted: "bg-success",
  declined: "bg-danger",
  expired: "bg-warning",
  active: "bg-success",
  paused: "bg-warning",
  neutral: "bg-text-secondary",
};

interface BadgeProps {
  variant?: BadgeVariant;
  className?: string;
  children?: ReactNode;
  label?: string;
}

export function Badge({ variant = "neutral", className = "", children, label }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[variant]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      {children ?? label}
    </span>
  );
}
