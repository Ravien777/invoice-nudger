type BadgeVariant =
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
  unpaid: "bg-[--warning]/10 text-[--warning]",
  paid: "bg-[--success]/10 text-[--success]",
  cancelled: "bg-[--bg-subtle] text-[--text-muted]",
  overdue: "bg-[--danger]/10 text-[--danger]",
  draft: "bg-[--bg-subtle] text-[--text-muted]",
  sent: "bg-[--info]/10 text-[--info]",
  accepted: "bg-[--success]/10 text-[--success]",
  declined: "bg-[--danger]/10 text-[--danger]",
  expired: "bg-[--warning]/10 text-[--warning]",
  active: "bg-[--success]/10 text-[--success]",
  paused: "bg-[--warning]/10 text-[--warning]",
  neutral: "bg-[--bg-subtle] text-[--text-secondary]",
};

const dotColors: Record<BadgeVariant, string> = {
  unpaid: "bg-[--warning]",
  paid: "bg-[--success]",
  cancelled: "bg-[--text-muted]",
  overdue: "bg-[--danger]",
  draft: "bg-[--text-muted]",
  sent: "bg-[--info]",
  accepted: "bg-[--success]",
  declined: "bg-[--danger]",
  expired: "bg-[--warning]",
  active: "bg-[--success]",
  paused: "bg-[--warning]",
  neutral: "bg-[--text-secondary]",
};

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  className?: string;
}

export function Badge({ label, variant = "neutral", className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium ${colorMap[variant]} ${className}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${dotColors[variant]}`} />
      {label}
    </span>
  );
}
