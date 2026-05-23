"use client";

import type { ReactNode } from "react";
import { FileText, Users, Search } from "lucide-react";
import { Button } from "./Button";

type EmptyStateVariant = "no-invoices" | "no-clients" | "no-results";

interface EmptyStateProps {
  title?: string;
  description?: string;
  variant?: EmptyStateVariant;
  children?: ReactNode;
  action?: {
    label: string;
    href?: string;
    onClick?: () => void;
  };
}

const variantDefaults: Record<
  EmptyStateVariant,
  { icon: typeof FileText; title: string; description: string }
> = {
  "no-invoices": {
    icon: FileText,
    title: "No invoices yet",
    description: "Get started by creating your first invoice.",
  },
  "no-clients": {
    icon: Users,
    title: "No clients yet",
    description:
      "Clients will appear here once you create invoices.",
  },
  "no-results": {
    icon: Search,
    title: "No results found",
    description: "Try adjusting your search or filters.",
  },
};

export function EmptyState({
  title,
  description,
  variant,
  children,
  action,
}: EmptyStateProps) {
  const defaults = variant ? variantDefaults[variant] : null;
  const resolvedTitle = title ?? defaults?.title ?? "";
  const resolvedDescription = description ?? defaults?.description ?? "";

  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      {(children || defaults) && (
        <div className="mb-4">
          {children ??
            (defaults && <defaults.icon className="h-12 w-12 text-text-tertiary" />)}
        </div>
      )}
      <h3 className="text-base font-medium text-text-secondary">
        {resolvedTitle}
      </h3>
      <p className="text-sm text-text-secondary mt-1 max-w-xs">
        {resolvedDescription}
      </p>
      {action && (
        <div className="mt-4">
          <Button
            variant="primary"
            {...(action.href
              ? { href: action.href }
              : { onClick: action.onClick })}
          >
            {action.label}
          </Button>
        </div>
      )}
    </div>
  );
}
export type { EmptyStateVariant };
